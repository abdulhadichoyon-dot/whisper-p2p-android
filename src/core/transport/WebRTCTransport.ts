import { ITransport, NetworkPacket, PacketHandler, TransportMetrics, TransportStatus } from './ITransport';

export class WebRTCTransport implements ITransport {
  public readonly id = 'webrtc';
  public readonly name = 'Direct P2P (WebRTC DataChannel)';
  private peerInstance: any = null;
  private localNodeId: string = '';
  private handlers: Set<PacketHandler> = new Set();
  private connections: Map<string, any> = new Map();
  private _status: TransportStatus = 'disconnected';
  private metrics: TransportMetrics = {
    packetsSent: 0,
    packetsReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    lastActiveTimestamp: Date.now(),
  };

  public get status(): TransportStatus {
    return this._status;
  }

  public async initialize(localNodeId: string): Promise<void> {
    this.localNodeId = localNodeId;
    this._status = 'connecting';

    try {
      const { Peer } = await import('peerjs');
      const peerId = this.localNodeId.toLowerCase();
      
      const peer = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      peer.on('open', () => {
        this._status = 'connected';
      });

      peer.on('connection', (conn: any) => {
        this.setupConnectionListeners(conn);
      });

      peer.on('error', (err: any) => {
        // Soft error handling - WebRTC fallback without breaking app
        console.warn('[WebRTC] Peer warning/error:', err?.type || err);
      });

      peer.on('close', () => {
        this._status = 'disconnected';
      });

      this.peerInstance = peer;
    } catch (e) {
      console.warn('[WebRTC] Initialization failed, will use local mesh fallback:', e);
      this._status = 'error';
    }
  }

  private setupConnectionListeners(conn: any) {
    const remotePeerId = (conn.peer || '').toUpperCase();

    conn.on('open', () => {
      this.connections.set(remotePeerId, conn);
    });

    conn.on('data', (data: any) => {
      if (!data || typeof data !== 'object') return;
      const packet = data as NetworkPacket;
      
      const estimatedBytes = JSON.stringify(packet).length;
      this.metrics.packetsReceived++;
      this.metrics.bytesReceived += estimatedBytes;
      this.metrics.lastActiveTimestamp = Date.now();

      for (const handler of this.handlers) {
        try {
          handler(packet);
        } catch (e) {
          console.error('[WebRTC] Handler error:', e);
        }
      }
    });

    conn.on('close', () => {
      this.connections.delete(remotePeerId);
    });

    conn.on('error', (err: any) => {
      console.warn(`[WebRTC] Connection error with peer ${remotePeerId}:`, err);
      this.connections.delete(remotePeerId);
    });
  }

  public async connectToPeer(targetPeerId: string): Promise<boolean> {
    const cleanTargetId = targetPeerId.trim().toUpperCase();
    if (!this.peerInstance || this._status !== 'connected') return false;
    if (this.connections.has(cleanTargetId)) return true;

    try {
      const conn = this.peerInstance.connect(cleanTargetId.toLowerCase(), { reliable: true });
      this.setupConnectionListeners(conn);
      return true;
    } catch (e) {
      console.warn(`[WebRTC] Failed to initiate connection to ${cleanTargetId}:`, e);
      return false;
    }
  }

  public async send(packet: NetworkPacket, targetPeerId?: string): Promise<boolean> {
    const target = (targetPeerId || packet.targetId || '').toUpperCase();
    if (!target) return false;

    const conn = this.connections.get(target);
    if (!conn || !conn.open) {
      // Attempt connect on demand
      this.connectToPeer(target);
      return false;
    }

    try {
      const packetToSend: NetworkPacket = {
        ...packet,
        senderId: this.localNodeId,
        targetId: target,
        timestamp: packet.timestamp || Date.now(),
      };
      conn.send(packetToSend);

      const estimatedBytes = JSON.stringify(packetToSend).length;
      this.metrics.packetsSent++;
      this.metrics.bytesSent += estimatedBytes;
      this.metrics.lastActiveTimestamp = Date.now();
      return true;
    } catch (e) {
      console.warn(`[WebRTC] send error to ${target}:`, e);
      return false;
    }
  }

  public async broadcast(packet: NetworkPacket): Promise<boolean> {
    let anySent = false;
    for (const [peerId] of this.connections) {
      const sent = await this.send(packet, peerId);
      if (sent) anySent = true;
    }
    return anySent;
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
    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch (e) {
        // ignore
      }
    }
    this.connections.clear();

    if (this.peerInstance) {
      try {
        this.peerInstance.destroy();
      } catch (e) {
        // ignore
      }
      this.peerInstance = null;
    }
  }
}
