import type { KeyBundle, PublicKeyBundle, PreKey, SignedPreKey, IdentityKeyPair } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function generateECDHKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const privRaw = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  return { publicKey: pubRaw, privateKey: privRaw };
}

async function signData(privateKeyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);
  return new Uint8Array(sig);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a full X3DH key bundle for a user.
 */
export async function generateKeyBundle(registrationId: number): Promise<KeyBundle> {
  const identityPair = await generateECDHKeyPair();
  const signedPreKeyPair = await generateECDHKeyPair();

  // Sign the signed pre-key public key with the identity private key
  const signature = await signData(identityPair.privateKey, signedPreKeyPair.publicKey);

  const signedPreKey: SignedPreKey = {
    id: 1,
    publicKey: signedPreKeyPair.publicKey,
    privateKey: signedPreKeyPair.privateKey,
    signature,
  };

  // Generate 5 one-time pre-keys
  const oneTimePreKeys: PreKey[] = await Promise.all(
    Array.from({ length: 5 }, async (_, i) => {
      const pair = await generateECDHKeyPair();
      return { id: i + 1, publicKey: pair.publicKey, privateKey: pair.privateKey };
    })
  );

  const identityKey: IdentityKeyPair = {
    publicKey: identityPair.publicKey,
    privateKey: identityPair.privateKey,
  };

  return { identityKey, signedPreKey, oneTimePreKeys, registrationId };
}

/**
 * Serialize a full KeyBundle to a JSON string (all Uint8Arrays → base64).
 */
export function serializeBundle(bundle: KeyBundle): string {
  return JSON.stringify({
    identityKey: {
      publicKey: toBase64(bundle.identityKey.publicKey),
      privateKey: toBase64(bundle.identityKey.privateKey),
    },
    signedPreKey: {
      id: bundle.signedPreKey.id,
      publicKey: toBase64(bundle.signedPreKey.publicKey),
      privateKey: toBase64(bundle.signedPreKey.privateKey),
      signature: toBase64(bundle.signedPreKey.signature),
    },
    oneTimePreKeys: bundle.oneTimePreKeys.map(k => ({
      id: k.id,
      publicKey: toBase64(k.publicKey),
      privateKey: toBase64(k.privateKey),
    })),
    registrationId: bundle.registrationId,
  });
}

/**
 * Deserialize a JSON string back to a KeyBundle.
 */
export function deserializeBundle(json: string): KeyBundle {
  const raw = JSON.parse(json);
  return {
    identityKey: {
      publicKey: fromBase64(raw.identityKey.publicKey),
      privateKey: fromBase64(raw.identityKey.privateKey),
    },
    signedPreKey: {
      id: raw.signedPreKey.id,
      publicKey: fromBase64(raw.signedPreKey.publicKey),
      privateKey: fromBase64(raw.signedPreKey.privateKey),
      signature: fromBase64(raw.signedPreKey.signature),
    },
    oneTimePreKeys: raw.oneTimePreKeys.map((k: any) => ({
      id: k.id,
      publicKey: fromBase64(k.publicKey),
      privateKey: fromBase64(k.privateKey),
    })),
    registrationId: raw.registrationId,
  };
}

/**
 * Extract only the public fields from a KeyBundle for upload to Supabase.
 */
export function serializePublicBundle(bundle: KeyBundle): PublicKeyBundle {
  return {
    identityKey: toBase64(bundle.identityKey.publicKey),
    signedPreKey: {
      id: bundle.signedPreKey.id,
      publicKey: toBase64(bundle.signedPreKey.publicKey),
      signature: toBase64(bundle.signedPreKey.signature),
    },
    oneTimePreKeys: bundle.oneTimePreKeys.map(k => ({
      id: k.id,
      publicKey: toBase64(k.publicKey),
    })),
    registrationId: bundle.registrationId,
  };
}
