import { describe, it, expect } from 'vitest';
import {
  generateEphemeralKeyPair,
  importPeerPublicKey,
  deriveSessionKey,
  encryptPayload,
  decryptPayload,
  computeSafetyFingerprint,
  bufferToBase64,
  base64ToBuffer,
  bufferToHex,
} from '../crypto/e2ee';

describe('End-to-End Cryptography Layer (ECDH P-256 + AES-256-GCM)', () => {
  it('generates valid ephemeral keypair bundles in RAM', async () => {
    const bundle = await generateEphemeralKeyPair();
    expect(bundle.keyPair).toBeDefined();
    expect(bundle.publicKeyJwk).toBeDefined();
    expect(bundle.publicKeyHex).toBeTypeOf('string');
    expect(bundle.publicKeyHex.length).toBeGreaterThan(0);
    expect(bundle.publicKeyJwk.kty).toBe('EC');
    expect(bundle.publicKeyJwk.crv).toBe('P-256');

    // Generating another bundle should produce a unique key
    const bundle2 = await generateEphemeralKeyPair();
    expect(bundle2.publicKeyHex).not.toBe(bundle.publicKeyHex);
  });

  it('performs full peer-to-peer ECDH key exchange and derives matching symmetric session keys', async () => {
    // Node A (Alice)
    const alice = await generateEphemeralKeyPair();
    // Node B (Bob)
    const bob = await generateEphemeralKeyPair();

    // Alice imports Bob's public JWK
    const aliceImportedBob = await importPeerPublicKey(bob.publicKeyJwk);
    const aliceSessionKey = await deriveSessionKey(alice.keyPair.privateKey, aliceImportedBob);

    // Bob imports Alice's public JWK
    const bobImportedAlice = await importPeerPublicKey(alice.publicKeyJwk);
    const bobSessionKey = await deriveSessionKey(bob.keyPair.privateKey, bobImportedAlice);

    expect(aliceSessionKey).toBeDefined();
    expect(bobSessionKey).toBeDefined();

    // Alice encrypts plaintext message
    const plaintext = 'Secret rendezvous coordinates: 37.7749,-122.4194 at 21:00 UTC';
    const encryptedByAlice = await encryptPayload(aliceSessionKey, plaintext);

    expect(encryptedByAlice.ciphertext).toBeTypeOf('string');
    expect(encryptedByAlice.iv).toBeTypeOf('string');
    expect(encryptedByAlice.ivSnippet.length).toBe(8);

    // Bob decrypts with his derived session key
    const decryptedByBob = await decryptPayload(
      bobSessionKey,
      encryptedByAlice.ciphertext,
      encryptedByAlice.iv
    );

    expect(decryptedByBob).toBe(plaintext);

    // Bob sends an encrypted response
    const bobResponse = 'Coordinates confirmed. Ephemeral channel verified.';
    const encryptedByBob = await encryptPayload(bobSessionKey, bobResponse);

    // Alice decrypts with her derived session key
    const decryptedByAlice = await decryptPayload(
      aliceSessionKey,
      encryptedByBob.ciphertext,
      encryptedByBob.iv
    );

    expect(decryptedByAlice).toBe(bobResponse);
  });

  it('transfers encrypted base64 image payloads seamlessly', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();

    const aliceImportedBob = await importPeerPublicKey(bob.publicKeyJwk);
    const aliceSessionKey = await deriveSessionKey(alice.keyPair.privateKey, aliceImportedBob);

    const bobImportedAlice = await importPeerPublicKey(alice.publicKeyJwk);
    const bobSessionKey = await deriveSessionKey(bob.keyPair.privateKey, bobImportedAlice);

    // Simulated 1x1 png image payload
    const imagePayload = JSON.stringify({
      type: 'image',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      caption: 'Node circuit schematic',
      dimensions: { width: 1, height: 1 },
    });

    const encrypted = await encryptPayload(aliceSessionKey, imagePayload);
    const decrypted = await decryptPayload(bobSessionKey, encrypted.ciphertext, encrypted.iv);

    const parsed = JSON.parse(decrypted);
    expect(parsed.type).toBe('image');
    expect(parsed.caption).toBe('Node circuit schematic');
    expect(parsed.dataUrl).toContain('data:image/png');
  });

  it('detects tampering and rejects unauthorized ciphertext (authenticated encryption)', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();

    const aliceImportedBob = await importPeerPublicKey(bob.publicKeyJwk);
    const aliceSessionKey = await deriveSessionKey(alice.keyPair.privateKey, aliceImportedBob);

    const bobImportedAlice = await importPeerPublicKey(alice.publicKeyJwk);
    const bobSessionKey = await deriveSessionKey(bob.keyPair.privateKey, bobImportedAlice);

    const encrypted = await encryptPayload(aliceSessionKey, 'Authentic message');

    // Tamper with ciphertext by flipping bytes
    const rawCipher = base64ToBuffer(encrypted.ciphertext);
    rawCipher[0] = rawCipher[0] ^ 0xff;
    const tamperedCiphertext = bufferToBase64(rawCipher);

    await expect(
      decryptPayload(bobSessionKey, tamperedCiphertext, encrypted.iv)
    ).rejects.toThrow();
  });

  it('computes symmetric, deterministic safety numbers (Signal fingerprint style)', async () => {
    const alice = await generateEphemeralKeyPair();
    const bob = await generateEphemeralKeyPair();

    // Fingerprint computed from Alice's side
    const fpAlice = await computeSafetyFingerprint(alice.publicKeyHex, bob.publicKeyHex);
    // Fingerprint computed from Bob's side
    const fpBob = await computeSafetyFingerprint(bob.publicKeyHex, alice.publicKeyHex);

    expect(fpAlice.safetyNumberFormatted).toBe(fpBob.safetyNumberFormatted);
    expect(fpAlice.hexFingerprint).toBe(fpBob.hexFingerprint);
    expect(fpAlice.shortKey).toBe(fpBob.shortKey);

    // Verify 16 digits formatted in 4 blocks of 4
    const blocks = fpAlice.safetyNumberFormatted.split(' ');
    expect(blocks.length).toBe(8); // 8 groups of 4 digits
    for (const block of blocks) {
      expect(block).toMatch(/^\d{4}$/);
    }
  });

  it('buffer conversion helpers work accurately for binary data', () => {
    const original = new Uint8Array([0, 15, 255, 128, 42]);
    const hex = bufferToHex(original);
    expect(hex).toBe('000fff802a');

    const b64 = bufferToBase64(original);
    const restored = base64ToBuffer(b64);
    expect(Array.from(restored)).toEqual(Array.from(original));
  });
});
