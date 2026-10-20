import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyVault } from '../core/security/KeyVault';
import { EphemeralMessageStore } from '../core/storage/EphemeralMessageStore';
import { TransportMultiplexer } from '../core/transport/TransportMultiplexer';
import { BroadcastChannelTransport } from '../core/transport/BroadcastChannelTransport';
import { EphemeralMessage } from '../types';

describe('Clean Architecture Subsystems', () => {
  describe('KeyVault', () => {
    it('initializes local ephemeral NIST P-256 keypair in RAM', async () => {
      const vault = new KeyVault();
      const bundle = await vault.initialize();

      expect(bundle).toBeDefined();
      expect(bundle.publicKeyHex).toBeTypeOf('string');
      expect(vault.getLocalPublicKeyHex()).toBe(bundle.publicKeyHex);
      expect(vault.getLocalFingerprintSnippet()).toMatch(/^0x[a-f0-9]{4}\.\.\.[a-f0-9]{4}$/);
    });

    it('establishes peer session key and Signal-style safety fingerprint', async () => {
      const aliceVault = new KeyVault();
      const bobVault = new KeyVault();

      const aliceBundle = await aliceVault.initialize();
      const bobBundle = await bobVault.initialize();

      const aliceSession = await aliceVault.establishPeerSession(
        'BOB_NODE',
        bobBundle.publicKeyJwk,
        bobBundle.publicKeyHex
      );

      const bobSession = await bobVault.establishPeerSession(
        'ALICE_NODE',
        aliceBundle.publicKeyJwk,
        aliceBundle.publicKeyHex
      );

      expect(aliceSession.sessionKey).toBeDefined();
      expect(bobSession.sessionKey).toBeDefined();
      expect(aliceSession.fingerprint.safetyNumberFormatted).toBe(
        bobSession.fingerprint.safetyNumberFormatted
      );
      expect(aliceSession.fingerprint.hexFingerprint).toBe(
        bobSession.fingerprint.hexFingerprint
      );
    });

    it('rotates keys and purges previous session keys on demand', async () => {
      const vault = new KeyVault();
      const firstBundle = await vault.initialize();

      const secondBundle = await vault.rotateLocalKeys();
      expect(secondBundle.publicKeyHex).not.toBe(firstBundle.publicKeyHex);
      expect(vault.getLocalPublicKeyHex()).toBe(secondBundle.publicKeyHex);
    });

    it('panicPurge completely wipes all cryptographic materials from RAM', async () => {
      const vault = new KeyVault();
      await vault.initialize();
      expect(vault.getLocalKeyBundle()).not.toBeNull();

      vault.panicPurge();
      expect(vault.getLocalKeyBundle()).toBeNull();
      expect(vault.getLocalPublicKeyHex()).toBe('');
      expect(vault.getLocalFingerprintSnippet()).toBe('0x0000...0000');
    });
  });

  describe('EphemeralMessageStore', () => {
    it('manages in-memory messages without disk storage', () => {
      const store = new EphemeralMessageStore();
      const msg: EphemeralMessage = {
        id: 'msg_arch_1',
        peerId: 'PEER_X',
        senderId: 'ME',
        senderName: 'Me',
        isMine: true,
        text: 'Zero-persistence architecture test',
        timestamp: Date.now(),
        status: 'delivered',
        cipherSummary: {
          algorithm: 'AES-256-GCM',
          ivSnippet: '0x1234',
          ciphertextLength: 48,
        },
      };

      store.addMessage(msg);
      expect(store.getMessageCount()).toBe(1);
      expect(store.getMessagesForPeer('PEER_X')).toHaveLength(1);
      expect(store.getMessagesForPeer('PEER_X')[0].text).toBe('Zero-persistence architecture test');

      store.destroy();
    });

    it('burnSingleMessage instantly shreds text and media from memory', () => {
      const store = new EphemeralMessageStore();
      const msg: EphemeralMessage = {
        id: 'msg_burn_me',
        peerId: 'PEER_Y',
        senderId: 'ME',
        senderName: 'Me',
        isMine: true,
        text: 'Confidential Payload',
        imageBase64: 'data:image/png;base64,SECRET...',
        timestamp: Date.now(),
        status: 'delivered',
        cipherSummary: {
          algorithm: 'AES-256-GCM',
          ivSnippet: '0x9999',
          ciphertextLength: 120,
        },
      };

      store.addMessage(msg);
      store.burnSingleMessage('msg_burn_me');

      const burned = store.getMessagesForPeer('PEER_Y')[0];
      expect(burned.status).toBe('burned');
      expect(burned.text).toBeUndefined();
      expect(burned.imageBase64).toBeUndefined();

      store.destroy();
    });

    it('panicBurnAll zeros out and purges the entire message catalog', () => {
      const store = new EphemeralMessageStore();
      for (let i = 0; i < 5; i++) {
        store.addMessage({
          id: `msg_${i}`,
          peerId: 'PEER_A',
          senderId: 'ME',
          senderName: 'Me',
          isMine: true,
          text: `Message ${i}`,
          timestamp: Date.now(),
          status: 'sent',
          cipherSummary: { algorithm: 'AES-256-GCM', ivSnippet: '0x00', ciphertextLength: 10 },
        });
      }

      expect(store.getMessageCount()).toBe(5);
      store.panicBurnAll();
      expect(store.getMessageCount()).toBe(0);

      store.destroy();
    });
  });

  describe('TransportMultiplexer', () => {
    it('aggregates metrics from attached transports and tracks active transports', async () => {
      const broadcast = new BroadcastChannelTransport('test_mesh_channel');
      const multiplexer = new TransportMultiplexer([broadcast]);

      await multiplexer.initialize('NODE_TEST_ALPHA');
      const metrics = multiplexer.getAggregateMetrics();

      expect(metrics.packetsSent).toBe(0);
      expect(metrics.packetsReceived).toBe(0);
      expect(metrics.activeTransports).toContain(broadcast.name);

      multiplexer.destroy();
    });
  });
});
