import { describe, it, expect } from 'vitest';
import {
  isSafeImageDataUri,
  isSafeImageMimeType,
  validatePeerJwk,
  base64ToBuffer,
  bufferToBase64,
  generateEphemeralKeyPair,
  encryptPayload,
  decryptPayload,
} from '../crypto/e2ee';
import { KeyVault } from '../core/security/KeyVault';
import { TransportMultiplexer } from '../core/transport/TransportMultiplexer';
import { BroadcastChannelTransport } from '../core/transport/BroadcastChannelTransport';

describe('Application Security & OWASP Hardening Suite', () => {
  describe('Stored XSS & Image Data URI Validation', () => {
    it('approves legitimate raster image data URIs', () => {
      expect(isSafeImageDataUri('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).toBe(true);
      expect(isSafeImageDataUri('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=')).toBe(true);
      expect(isSafeImageDataUri('data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==')).toBe(true);
      expect(isSafeImageDataUri('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe(true);
    });

    it('strictly rejects malicious executable or script data URIs (XSS vectors)', () => {
      // JavaScript URI scheme
      expect(isSafeImageDataUri('javascript:alert(document.cookie)')).toBe(false);
      // HTML data URI
      expect(isSafeImageDataUri('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      // SVG containing embedded scripts (classic SVG XSS)
      expect(isSafeImageDataUri('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=')).toBe(false);
      // Malformed or empty strings
      expect(isSafeImageDataUri('')).toBe(false);
      expect(isSafeImageDataUri('data:image/png;base64,NOT_BASE64!@#$')).toBe(false);
      expect(isSafeImageDataUri(null)).toBe(false);
      expect(isSafeImageDataUri(undefined)).toBe(false);
    });

    it('strictly checks safe image MIME types', () => {
      expect(isSafeImageMimeType('image/png')).toBe(true);
      expect(isSafeImageMimeType('image/jpeg')).toBe(true);
      expect(isSafeImageMimeType('image/webp')).toBe(true);
      expect(isSafeImageMimeType('image/gif')).toBe(true);

      // Insecure types
      expect(isSafeImageMimeType('image/svg+xml')).toBe(false);
      expect(isSafeImageMimeType('text/html')).toBe(false);
      expect(isSafeImageMimeType('application/javascript')).toBe(false);
      expect(isSafeImageMimeType(null)).toBe(false);
    });
  });

  describe('JWK Validation & Key Parameter Integrity', () => {
    it('accepts compliant NIST P-256 EC JWKs', async () => {
      const bundle = await generateEphemeralKeyPair();
      expect(() => validatePeerJwk(bundle.publicKeyJwk)).not.toThrow();
    });

    it('rejects JWKs with invalid curve, type, or missing coordinates', () => {
      // Wrong curve (e.g. P-384 or P-521)
      expect(() =>
        validatePeerJwk({ kty: 'EC', crv: 'P-384', x: '123', y: '456' })
      ).toThrow(/Unsupported elliptic curve/);

      // Wrong key type (e.g. RSA)
      expect(() =>
        validatePeerJwk({ kty: 'RSA', crv: 'P-256', x: '123', y: '456' })
      ).toThrow(/Unsupported key type/);

      // Missing coordinates
      expect(() =>
        validatePeerJwk({ kty: 'EC', crv: 'P-256', x: '', y: '456' })
      ).toThrow(/coordinate x/);
      expect(() =>
        validatePeerJwk({ kty: 'EC', crv: 'P-256', x: '123', y: '' })
      ).toThrow(/coordinate y/);
    });
  });

  describe('Base64 Decoding & Malformed Input Defense', () => {
    it('rejects illegal base64 characters safely without uncaught crashes', () => {
      expect(() => base64ToBuffer('???NOT_BASE_64???')).toThrow(/Invalid Base64 format/);
      expect(() => base64ToBuffer('')).toThrow(/Invalid Base64 input/);
    });

    it('safely handles large buffers without call-stack overflow', () => {
      const largeArray = new Uint8Array(65536); // 64KB
      for (let i = 0; i < largeArray.length; i++) {
        largeArray[i] = i % 256;
      }
      const b64 = bufferToBase64(largeArray);
      expect(b64.length).toBeGreaterThan(0);
      const restored = base64ToBuffer(b64);
      expect(restored.length).toBe(largeArray.length);
      expect(restored[100]).toBe(largeArray[100]);
    });
  });

  describe('Replay Attack Protection & Timestamp Skew Validation', async () => {
    it('drops packets that exceed maximum timestamp drift window', async () => {
      const transport = new BroadcastChannelTransport('test_replay_channel');
      const multiplexer = new TransportMultiplexer([transport]);
      await multiplexer.initialize('NODE_REPLAY_TEST');

      let receivedCount = 0;
      multiplexer.onPacket(() => {
        receivedCount++;
      });

      // Packet from 1 hour ago (Replay Attack)
      (multiplexer as any).handlePacket(
        {
          type: 'DISCOVERY_ANNOUNCE',
          senderId: 'NODE_ATTACKER',
          timestamp: Date.now() - 3600 * 1000,
        },
        'test_channel'
      );

      // Packet from 10 minutes in the future (Time-Travel / Desync Attack)
      (multiplexer as any).handlePacket(
        {
          type: 'DISCOVERY_ANNOUNCE',
          senderId: 'NODE_ATTACKER_2',
          timestamp: Date.now() + 600 * 1000,
        },
        'test_channel'
      );

      expect(receivedCount).toBe(0);

      // Legitimate fresh packet within 2 seconds
      (multiplexer as any).handlePacket(
        {
          type: 'DISCOVERY_ANNOUNCE',
          senderId: 'NODE_HONEST',
          timestamp: Date.now(),
        },
        'test_channel'
      );

      expect(receivedCount).toBe(1);

      multiplexer.destroy();
    });
  });

  describe('KeyVault Identity Mutation Detection (MITM Protection)', () => {
    it('detects when an existing peer changes their public key and flags key alteration', async () => {
      const vault = new KeyVault();
      await vault.initialize();

      const initialPeerKey = await generateEphemeralKeyPair();
      const firstSession = await vault.establishPeerSession(
        'TARGET_PEER',
        initialPeerKey.publicKeyJwk,
        initialPeerKey.publicKeyHex
      );
      expect(firstSession.isKeyChanged).toBe(false);

      // Same peer ID connects with a different keypair (Key Substitution / MITM)
      const attackerKey = await generateEphemeralKeyPair();
      const secondSession = await vault.establishPeerSession(
        'TARGET_PEER',
        attackerKey.publicKeyJwk,
        attackerKey.publicKeyHex
      );

      expect(secondSession.isKeyChanged).toBe(true);
      expect(secondSession.fingerprint.verified).toBe(false);
    });
  });
});
