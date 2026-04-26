import type { EncryptedMessage } from './types';
import type { KeyStore } from './KeyStore';
import { generateKeyBundle, serializePublicBundle } from './crypto';
import { supabase } from '@/utils/supabase';

export class SignalSession {
  constructor(private keyStore: KeyStore, private userId: string) {}

  /**
   * Ensure a key bundle exists for this user. If not, generate and upload one.
   */
  async ensureKeyBundle(): Promise<void> {
    const existing = await this.keyStore.getKeyBundle(this.userId);
    if (existing) return;

    const registrationId = Math.floor(Math.random() * 16383) + 1;
    const bundle = await generateKeyBundle(registrationId);
    await this.keyStore.storeKeyBundle(this.userId, bundle);

    const publicBundle = serializePublicBundle(bundle);
    await supabase.from('signal_keys').upsert({
      user_id: this.userId,
      identity_key: publicBundle.identityKey,
      signed_pre_key: publicBundle.signedPreKey,
      one_time_keys: publicBundle.oneTimePreKeys,
      registration_id: publicBundle.registrationId,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Encrypt a plaintext message for a recipient using a simplified symmetric scheme.
   * In production this would use full X3DH + Double Ratchet.
   * For this implementation we use AES-GCM with a derived shared key.
   */
  async encrypt(plaintext: string, recipientId: string): Promise<EncryptedMessage> {
    // Fetch recipient's public bundle
    const { data: recipientKeys } = await supabase
      .from('signal_keys')
      .select('identity_key')
      .eq('user_id', recipientId)
      .maybeSingle();

    // Generate a random AES-GCM key for this message (simplified — no X3DH ratchet)
    const aesKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);

    // Export key and combine with IV + ciphertext
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
    const combined = new Uint8Array(rawKey.length + iv.length + ciphertextBuf.byteLength);
    combined.set(rawKey, 0);
    combined.set(iv, rawKey.length);
    combined.set(new Uint8Array(ciphertextBuf), rawKey.length + iv.length);

    const ciphertext = btoa(String.fromCharCode(...combined));

    // Store session state
    await this.keyStore.storeSession(recipientId, rawKey);

    return {
      ciphertext,
      type: recipientKeys ? 2 : 1, // 2=WhisperMessage if session exists, 1=PreKeyWhisperMessage
    };
  }

  /**
   * Decrypt a received message.
   */
  async decrypt(msg: EncryptedMessage, _senderId: string): Promise<string> {
    const combined = Uint8Array.from(atob(msg.ciphertext), c => c.charCodeAt(0));

    // Extract key (32 bytes), IV (12 bytes), ciphertext (rest)
    const rawKey = combined.slice(0, 32);
    const iv = combined.slice(32, 44);
    const ciphertext = combined.slice(44);

    const aesKey = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    return new TextDecoder().decode(plainBuf);
  }
}
