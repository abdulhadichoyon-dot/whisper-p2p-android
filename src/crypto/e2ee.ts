/**
 * Pure In-Memory End-to-End Cryptography Layer
 * Utilizes standard Web Crypto API (SubtleCrypto):
 * - Ephemeral Elliptic Curve Diffie-Hellman (ECDH over NIST P-256)
 * - HKDF-SHA256 key derivation with salt and app context
 * - Authenticated symmetric cipher: AES-256-GCM with 96-bit unique IV & 128-bit auth tag
 * - Robust input validation, sanitization, and OWASP compliance
 * - No keys or plaintexts are ever persisted to disk or storage
 */

export interface KeyPairBundle {
  keyPair: CryptoKeyPair;
  publicKeyJwk: JsonWebKey;
  publicKeyHex: string;
}

const getCrypto = (): Crypto => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('WebCrypto API not supported in this execution environment');
};

/**
 * High-performance, memory-safe Buffer to Base64 conversion
 * Uses 8KB chunking to prevent call-stack or string-length limits on large binary data
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.byteLength));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Defensive Base64 to Uint8Array converter
 * Strips whitespace, validates base64 alphabet, and catches decoding anomalies
 */
export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof base64 !== 'string' || base64.trim().length === 0) {
    throw new Error('Invalid Base64 input: string is empty or non-string');
  }

  // Remove potential whitespace/newlines
  const cleanBase64 = base64.replace(/\s+/g, '');
  
  // Validate standard base64 format
  const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!base64Regex.test(cleanBase64)) {
    throw new Error('Invalid Base64 format: contains illegal characters or corrupted padding');
  }

  try {
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err: any) {
    throw new Error(`Failed to decode Base64 data: ${err.message || 'corrupted stream'}`);
  }
}

/**
 * Convert ArrayBuffer to lowercase Hex string
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validates and sanitizes a peer's JsonWebKey structure to guard against
 * prototype pollution, curve mismatches, and malformed key material.
 */
export function validatePeerJwk(jwk: unknown): asserts jwk is JsonWebKey {
  if (!jwk || typeof jwk !== 'object') {
    throw new Error('Invalid JWK: public key must be a non-null object');
  }

  const key = jwk as Record<string, unknown>;

  if (key.kty !== 'EC') {
    throw new Error(`Unsupported key type "${key.kty}". Only "EC" is supported.`);
  }

  if (key.crv !== 'P-256') {
    throw new Error(`Unsupported elliptic curve "${key.crv}". Must be NIST "P-256".`);
  }

  if (typeof key.x !== 'string' || !key.x.trim()) {
    throw new Error('Invalid JWK: missing or invalid coordinate x');
  }

  if (typeof key.y !== 'string' || !key.y.trim()) {
    throw new Error('Invalid JWK: missing or invalid coordinate y');
  }
}

/**
 * Safe Image Validation to prevent Stored XSS via malicious Data URIs
 * Only permits strictly whitelisted raster image MIME types (png, jpeg, webp, gif)
 * Explicitly rejects svg, html, javascript, or executable data URIs.
 */
export function isSafeImageMimeType(mime?: string | null): boolean {
  if (!mime) return false;
  const safeMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  return safeMimes.includes(mime.toLowerCase().trim());
}

export function isSafeImageDataUri(dataUri?: string | null): boolean {
  if (!dataUri || typeof dataUri !== 'string') return false;
  // Regex strictly enforces safe image raster base64 data URIs
  const safeDataUriRegex = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
  return safeDataUriRegex.test(dataUri.trim());
}

/**
 * Generate a new Ephemeral ECDH Key Pair in RAM
 */
export async function generateEphemeralKeyPair(): Promise<KeyPairBundle> {
  const cryptoEngine = getCrypto();
  const keyPair = await cryptoEngine.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false, // Private key is strictly non-extractable from RAM
    ['deriveKey', 'deriveBits']
  );

  const publicKeyJwk = await cryptoEngine.subtle.exportKey('jwk', keyPair.publicKey);
  const rawPublic = await cryptoEngine.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyHex = bufferToHex(rawPublic);

  return {
    keyPair,
    publicKeyJwk,
    publicKeyHex,
  };
}

/**
 * Import a peer's public key from JWK with strict validation
 */
export async function importPeerPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  validatePeerJwk(jwk);
  const cryptoEngine = getCrypto();
  
  // Clean object to prevent prototype contamination
  const cleanJwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: jwk.x,
    y: jwk.y,
    ext: true,
  };

  return cryptoEngine.subtle.importKey(
    'jwk',
    cleanJwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    []
  );
}

/**
 * Derive shared symmetric AES-256-GCM key from local private key and peer's public key
 * using HKDF-SHA256 for key derivation
 */
export async function deriveSessionKey(
  localPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  const cryptoEngine = getCrypto();

  // 1. Derive raw shared secret bits via ECDH
  const sharedBits = await cryptoEngine.subtle.deriveBits(
    {
      name: 'ECDH',
      public: peerPublicKey,
    },
    localPrivateKey,
    256
  );

  // 2. Import shared bits as HKDF key material
  const hkdfKey = await cryptoEngine.subtle.importKey(
    'raw',
    sharedBits,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  // 3. Derive 256-bit AES-GCM session key
  const salt = new TextEncoder().encode('whisper-p2p-salt-v1');
  const info = new TextEncoder().encode('whisper-p2p-aes-256-gcm-session');

  const sessionKey = await cryptoEngine.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );

  return sessionKey;
}

/**
 * Encrypt arbitrary payload with AES-256-GCM
 */
export async function encryptPayload(
  sessionKey: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string; ivSnippet: string }> {
  if (typeof plaintext !== 'string') {
    throw new Error('Encryption payload must be a string');
  }

  const cryptoEngine = getCrypto();
  // Generate cryptographically random 96-bit (12 byte) IV
  const iv = cryptoEngine.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await cryptoEngine.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    sessionKey,
    encoded
  );

  const ciphertext = bufferToBase64(encryptedBuffer);
  const ivBase64 = bufferToBase64(iv);
  const ivSnippet = bufferToHex(iv).substring(0, 8);

  return {
    ciphertext,
    iv: ivBase64,
    ivSnippet,
  };
}

/**
 * Decrypt payload with AES-256-GCM and resilient error handling
 */
export async function decryptPayload(
  sessionKey: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string
): Promise<string> {
  if (!ciphertextBase64 || !ivBase64) {
    throw new Error('Decryption failed: Missing ciphertext or IV parameter');
  }

  const cryptoEngine = getCrypto();
  const iv = base64ToBuffer(ivBase64);
  const ciphertext = base64ToBuffer(ciphertextBase64);

  try {
    const decryptedBuffer = await cryptoEngine.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      sessionKey,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err: any) {
    throw new Error('Cryptographic authentication failed: Ciphertext has been tampered with, corrupted, or key is invalid.');
  }
}

/**
 * Generate Safety Numbers / Fingerprint for out-of-band verification (Signal style)
 */
export async function computeSafetyFingerprint(
  pubKeyHex1: string,
  pubKeyHex2: string
): Promise<{ safetyNumberFormatted: string; hexFingerprint: string; shortKey: string }> {
  if (!pubKeyHex1 || !pubKeyHex2) {
    throw new Error('Both public keys are required to compute safety fingerprint');
  }

  const cryptoEngine = getCrypto();
  // Sort keys deterministically
  const sorted = [pubKeyHex1, pubKeyHex2].sort().join(':');
  const hashBuffer = await cryptoEngine.subtle.digest('SHA-256', new TextEncoder().encode(sorted));
  const hashBytes = new Uint8Array(hashBuffer);

  // Hex fingerprint (32 chars)
  const fullHex = bufferToHex(hashBytes);
  const hexFingerprint = fullHex.substring(0, 32).toUpperCase();
  const shortKey = `0x${fullHex.substring(0, 4)}...${fullHex.substring(28, 32)}`;

  // 16-digit safety numbers grouped in 4 digits (8 groups)
  let digits = '';
  for (let i = 0; i < 8; i++) {
    const val = (hashBytes[i * 2] * 256 + hashBytes[i * 2 + 1]) % 10000;
    digits += val.toString().padStart(4, '0') + ' ';
  }

  return {
    safetyNumberFormatted: digits.trim(),
    hexFingerprint,
    shortKey,
  };
}
