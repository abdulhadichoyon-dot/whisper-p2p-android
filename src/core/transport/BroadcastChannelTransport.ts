import { ITransport, NetworkPacket, PacketHandler, TransportMetrics, TransportStatus } from './ITransport';

export class BroadcastChannelTransport implements ITransport {
  public readonly id = 'broadcast_channel';
  public readonly name = 'Local Mesh (BroadcastChannel)';
  private channelName: string;
  private channel: BroadcastChannel | null = null;
  private localNodeId: string = '';
  private handlers: Set<PacketHandler> = new Set();
  private _status: TransportStatus = 'disconnected';
  private metrics: TransportMetrics = {
    packetsSent: 0,
    packetsReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    lastActiveTimestamp: Date.now(),
  };

  constructor(channelName: string = 'whisper_p2p_local_mesh') {
    this.channelName = channelName;
  }

  public get status(): TransportStatus {
    return this._status;
  }

  public async initialize(localNodeId: string): Promise<void> {
    this.localNodeId = localNodeId;
    this._status = 'connecting';

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (event: MessageEvent) => {
          this.handleIncoming(event.data);
        };
        this.channel.onmessageerror = (err) => {
          console.warn('[BroadcastChannel] message error:', err);
        };
        this._status = 'connected';
      } else {
        console.warn('[BroadcastChannel] Not supported in current environment');
        this._status = 'error';
      }
    } catch (e) {
      console.warn('[BroadcastChannel] Initialization failed:', e);
      this._status = 'error';
    }
  }

  private handleIncoming(data: any): void {
    if (!data || typeof data !== 'object') return;
    const packet = data as NetworkPacket;

    // Discard packets from ourselves
    if (packet.senderId === this.localNodeId) return;

    // Discard packets routed to a specific node other than ourselves
    if (packet.targetId && packet.targetId !== this.localNodeId) return;

    const estimatedBytes = JSON.stringify(packet).length;
    this.metrics.packetsReceived++;
    this.metrics.bytesReceived += estimatedBytes;
    this.metrics.lastActiveTimestamp = Date.now();

    for (const handler of this.handlers) {
      try {
        handler(packet);
      } catch (err) {
        console.error('[BroadcastChannel] Handler error:', err);
      }
    }
  }

  public async send(packet: NetworkPacket, targetPeerId?: string): Promise<boolean> {
    if (this._status !== 'connected' || !this.channel) return false;
    try {
      const packetToSend: NetworkPacket = {
        ...packet,
        senderId: this.localNodeId,
        targetId: targetPeerId || packet.targetId,
        timestamp: packet.timestamp || Date.now(),
      };
      this.channel.postMessage(packetToSend);
      
      const estimatedBytes = JSON.stringify(packetToSend).length;
      this.metrics.packetsSent++;
      this.metrics.bytesSent += estimatedBytes;
      this.metrics.lastActiveTimestamp = Date.now();
      return true;
    } catch (e) {
      console.warn('[BroadcastChannel] send error:', e);
      return false;
    }
  }

  public async broadcast(packet: NetworkPacket): Promise<boolean> {
    return this.send(packet, undefined);
  }

  public onPacket(handler: PacketHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  public getMetrics(): TransportMetrics {
    return { ...this.metrics };
  }

  public destroy(): void {
    this._status = 'disconnected';
    this.handlers.clear();
    if (this.channel) {
      try {
        this.channel.close();
      } catch (e) {
        // ignore
      }
      this.channel = null;
    }
  }
}
