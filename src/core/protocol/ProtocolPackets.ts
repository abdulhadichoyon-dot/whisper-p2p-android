/**
 * Whisper P2P Protocol Packet Specifications
 * Standardized protocol framing for zero-trust ephemeral P2P messaging.
 */

export type PacketType =
  | 'DISCOVERY_ANNOUNCE'
  | 'DISCOVERY_REPLY'
  | 'KEY_EXCHANGE_INIT'
  | 'KEY_EXCHANGE_ACK'
  | 'ENCRYPTED_MESSAGE'
  | 'MESSAGE_ACK'
  | 'MESSAGE_BURN_REQUEST'
  | 'PING'
  | 'PONG'
  | 'PANIC_BURN_SIGNAL';

export interface BasePacket {
  type: PacketType;
  senderId: string;
  targetId?: string;
  timestamp: number;
}

export interface DiscoveryAnnouncePacket extends BasePacket {
  type: 'DISCOVERY_ANNOUNCE';
  senderName: string;
  avatarColor: string;
  publicKeyJwk?: JsonWebKey;
  publicKeyHex?: string;
}

export interface DiscoveryReplyPacket extends BasePacket {
  type: 'DISCOVERY_REPLY';
  senderName: string;
  avatarColor: string;
  publicKeyJwk?: JsonWebKey;
  publicKeyHex?: string;
}

export interface KeyExchangeInitPacket extends BasePacket {
  type: 'KEY_EXCHANGE_INIT';
  senderName: string;
  avatarColor: string;
  publicKeyJwk: JsonWebKey;
  publicKeyHex: string;
}

export interface KeyExchangeAckPacket extends BasePacket {
  type: 'KEY_EXCHANGE_ACK';
  senderName: string;
  avatarColor: string;
  publicKeyJwk: JsonWebKey;
  publicKeyHex: string;
}

export interface EncryptedMessagePacket extends BasePacket {
  type: 'ENCRYPTED_MESSAGE';
  messageId: string;
  iv: string; // Base64 96-bit AES-GCM IV
  ciphertext: string; // Base64 ciphertext with appended 128-bit GCM auth tag
  ivSnippet: string; // 8-char hex snippet for crypto transparency
  ttlSeconds?: number;
}

export interface MessageAckPacket extends BasePacket {
  type: 'MESSAGE_ACK';
  messageId: string;
  status: 'delivered' | 'read';
}

export interface MessageBurnRequestPacket extends BasePacket {
  type: 'MESSAGE_BURN_REQUEST';
  messageId: string;
}

export interface PingPacket extends BasePacket {
  type: 'PING';
  nonce: string;
}

export interface PongPacket extends BasePacket {
  type: 'PONG';
  nonce: string;
}

export interface PanicBurnSignalPacket extends BasePacket {
  type: 'PANIC_BURN_SIGNAL';
}

export type WhisperPacket =
  | DiscoveryAnnouncePacket
  | DiscoveryReplyPacket
  | KeyExchangeInitPacket
  | KeyExchangeAckPacket
  | EncryptedMessagePacket
  | MessageAckPacket
  | MessageBurnRequestPacket
  | PingPacket
  | PongPacket
  | PanicBurnSignalPacket;
