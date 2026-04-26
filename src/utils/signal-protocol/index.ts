import { KeyStore } from './KeyStore';
import { SignalSession } from './SignalSession';
import type { EncryptedMessage } from './types';

let keyStore: KeyStore | null = null;
let session: SignalSession | null = null;
let initialized = false;
let passthroughMode = false;

/**
 * Initialize the Signal Protocol for a user.
 * Falls back to passthrough mode if IndexedDB is unavailable.
 */
export async function initSignal(userId: string): Promise<void> {
  try {
    keyStore = new KeyStore();
    await keyStore.open();
    session = new SignalSession(keyStore, userId);
    await session.ensureKeyBundle();
    initialized = true;
    passthroughMode = false;
  } catch (err) {
    console.warn('[Wave Signal] Falling back to passthrough mode:', err);
    passthroughMode = true;
    initialized = false;
  }
}

/**
 * Encrypt a plaintext message for a recipient.
 * Returns null in passthrough mode (message sent as plaintext).
 */
export async function encrypt(
  plaintext: string,
  recipientId: string
): Promise<EncryptedMessage | null> {
  if (!initialized || !session || passthroughMode) return null;
  return session.encrypt(plaintext, recipientId);
}

/**
 * Decrypt a received message.
 * Returns null on failure (caller should show placeholder).
 */
export async function decrypt(
  msg: EncryptedMessage,
  senderId: string
): Promise<string | null> {
  if (!initialized || !session || passthroughMode) return null;
  try {
    return await session.decrypt(msg, senderId);
  } catch {
    return null;
  }
}
