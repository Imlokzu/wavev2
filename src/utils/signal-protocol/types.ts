export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface PreKey {
  id: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SignedPreKey extends PreKey {
  signature: Uint8Array;
}

export interface KeyBundle {
  identityKey: IdentityKeyPair;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: PreKey[];
  registrationId: number;
}

export interface PublicKeyBundle {
  identityKey: string;       // base64
  signedPreKey: {
    id: number;
    publicKey: string;       // base64
    signature: string;       // base64
  };
  oneTimePreKeys: Array<{ id: number; publicKey: string }>; // base64
  registrationId: number;
}

export interface EncryptedMessage {
  ciphertext: string;        // base64
  type: number;              // 1 = PreKeyWhisperMessage, 2 = WhisperMessage
}
