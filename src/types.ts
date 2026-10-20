export type PeerStatus = 'online' | 'connecting' | 'offline' | 'pairing';

export interface PeerProfile {
  id: string;
  name: string;
  avatarColor: string;
  publicKeyJwk?: JsonWebKey;
  fingerprint: string;
  status: PeerStatus;
  lastSeen: number;
  unreadCount?: number;
  lastMessageSnippet?: string;
  lastMessageTime?: number;
  isVerified?: boolean;
}

export interface EncryptedPayload {
  iv: string; // base64
  ciphertext: string; // base64
  tagLength?: number;
  senderId: string;
  targetId: string;
  timestamp: number;
}

export interface EphemeralMessage {
  id: string;
  peerId: string;
  senderId: string;
  senderName: string;
  isMine: boolean;
  text?: string;
  imageBase64?: string; // encrypted and decrypted in RAM only
  imageMimeType?: string;
  timestamp: number;
  ttlSeconds?: number; // 0 = no auto-burn, >0 = self-destruct countdown
  expiresAt?: number;
  remainingSeconds?: number;
  isSelfDestructing?: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'burned';
  cipherSummary: {
    algorithm: 'AES-256-GCM';
    ivSnippet: string;
    ciphertextLength: number;
  };
}

export interface SecurityFingerprint {
  safetyNumberFormatted: string; // "3829 4810 5928 1039"
  hexFingerprint: string;
  shortKey: string;
  verified: boolean;
}

export type ActiveTab = 'chats' | 'node' | 'vault';
