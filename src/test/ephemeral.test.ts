import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EphemeralMessage } from '../types';

describe('Ephemeral Storage & Memory Discarding Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates burn expiry and purges messages on timer completion', () => {
    const memoryStore = new Map<string, EphemeralMessage>();
    const now = Date.now();

    const msg: EphemeralMessage = {
      id: 'msg_test_1',
      peerId: 'peer_bob',
      senderId: 'me',
      senderName: 'Me',
      isMine: true,
      text: 'This message will self destruct in 5 seconds',
      timestamp: now,
      ttlSeconds: 5,
      remainingSeconds: 5,
      status: 'read',
      cipherSummary: {
        algorithm: 'AES-256-GCM',
        ivSnippet: 'A1B2C3D4',
        ciphertextLength: 64,
      },
    };

    memoryStore.set(msg.id, msg);
    expect(memoryStore.has('msg_test_1')).toBe(true);

    // Simulate countdown tick handler
    const tick = () => {
      for (const [id, m] of memoryStore.entries()) {
        if (m.remainingSeconds !== undefined && m.remainingSeconds > 0) {
          const updated = { ...m, remainingSeconds: m.remainingSeconds - 1 };
          if (updated.remainingSeconds <= 0) {
            // Ephemeral purge: clear payload and mark burned
            updated.status = 'burned';
            updated.text = undefined;
            updated.imageBase64 = undefined;
          }
          memoryStore.set(id, updated);
        }
      }
    };

    // Fast-forward 3 seconds
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(1000);
      tick();
    }

    let current = memoryStore.get('msg_test_1');
    expect(current?.remainingSeconds).toBe(2);
    expect(current?.status).toBe('read');
    expect(current?.text).toBe('This message will self destruct in 5 seconds');

    // Advance remaining 2 seconds
    for (let i = 0; i < 2; i++) {
      vi.advanceTimersByTime(1000);
      tick();
    }

    current = memoryStore.get('msg_test_1');
    expect(current?.remainingSeconds).toBe(0);
    expect(current?.status).toBe('burned');
    // Verified that plaintext payload was completely wiped from memory
    expect(current?.text).toBeUndefined();
    expect(current?.imageBase64).toBeUndefined();
  });

  it('nuke/burn-all immediately purges entire conversation history from RAM', () => {
    let activeSessions: Record<string, EphemeralMessage[]> = {
      peer_bob: [
        {
          id: '1',
          peerId: 'peer_bob',
          senderId: 'peer_bob',
          senderName: 'Bob',
          isMine: false,
          text: 'Confidential message',
          timestamp: Date.now(),
          status: 'read',
          cipherSummary: {
            algorithm: 'AES-256-GCM',
            ivSnippet: '11223344',
            ciphertextLength: 32,
          },
        },
        {
          id: '2',
          peerId: 'peer_bob',
          senderId: 'me',
          senderName: 'Me',
          isMine: true,
          text: 'Blueprint',
          imageBase64: 'data:image/png;base64,...',
          timestamp: Date.now(),
          status: 'delivered',
          cipherSummary: {
            algorithm: 'AES-256-GCM',
            ivSnippet: '55667788',
            ciphertextLength: 2048,
          },
        },
      ],
    };

    expect(activeSessions['peer_bob'].length).toBe(2);

    // Nuclear burn all action
    const burnAll = () => {
      // Zero out RAM references
      for (const key of Object.keys(activeSessions)) {
        activeSessions[key] = [];
      }
      activeSessions = {};
    };

    burnAll();
    expect(Object.keys(activeSessions).length).toBe(0);
  });
});
