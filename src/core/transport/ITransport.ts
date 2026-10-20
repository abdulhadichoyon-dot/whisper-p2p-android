/**
 * Transport Layer Interface
 * Defines pluggable transport mechanisms for Peer-to-Peer communication (WebRTC, BroadcastChannel, etc.)
 */

export interface NetworkPacket {
  type: string;
  senderId: string;
  targetId?: string;
  timestamp: number;
  payload?: any;
  [key: string]: any;
}

export type PacketHandler = (packet: NetworkPacket) => void;

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TransportMetrics {
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
  lastActiveTimestamp: number;
}

export interface ITransport {
  readonly id: string;
  readonly name: string;
  readonly status: TransportStatus;
  
  initialize(localNodeId: string): Promise<void>;
  send(packet: NetworkPacket, targetPeerId?: string): Promise<boolean>;
  broadcast(packet: NetworkPacket): Promise<boolean>;
  onPacket(handler: PacketHandler): () => void;
  getMetrics(): TransportMetrics;
  destroy(): void;
}
