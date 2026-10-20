import { ITransport, NetworkPacket, PacketHandler, TransportMetrics } from './ITransport';

export class TransportMultiplexer {
  private transports: ITransport[] = [];
  private handlers: Set<PacketHandler> = new Set();
  private localNodeId: string = '';
  private seenPacketSignatures: Set<string> = new Set();
  private maxSeenCacheSize: number = 500;
  private registeredTransportIds: Set<string> = new Set();

  constructor(transports: ITransport[] = []) {
    for (const t of transports) {
      this.addTransport(t);
    }
  }

  public addTransport(transport: ITransport): void {
    if (!this.transports.includes(transport)) {
      this.transports.push(transport);
    }

    if (!this.registeredTransportIds.has(transport.id)) {
      this.registeredTransportIds.add(transport.id);
      transport.onPacket((packet) => this.handlePacket(packet, transport.id));
    }
  }

  public async initialize(localNodeId: string): Promise<void> {
    this.localNodeId = localNodeId;
    await Promise.allSettled(
      this.transports.map((t) => t.initialize(localNodeId))
    );
  }

  private handlePacket(packet: NetworkPacket, sourceTransportId: string): void {
    if (!packet || typeof packet !== 'object') return;
    if (packet.senderId === this.localNodeId) return;

    // Reject packets with invalid or excessively skewed timestamps (Replay Attack Defense)
    const now = Date.now();
    if (typeof packet.timestamp === 'number') {
      const timeDiff = now - packet.timestamp;
      // Drop if more than 5 minutes old or more than 1 minute in the future
      if (timeDiff > 5 * 60 * 1000 || timeDiff < -60 * 1000) {
        console.warn(`[TransportMultiplexer] Dropped packet outside valid freshness window (type: ${packet.type}, drift: ${timeDiff}ms)`);
        return;
      }
    }

    // Deduplicate packets arriving across multiple transports (e.g. BroadcastChannel + WebRTC)
    const packetId = packet.id || (packet as any).messageId || '';
    const sig = `${packet.senderId}:${packet.type}:${packet.timestamp}:${packetId}`;
    if (this.seenPacketSignatures.has(sig)) return;

    this.seenPacketSignatures.add(sig);
    if (this.seenPacketSignatures.size > this.maxSeenCacheSize) {
      // Purge oldest 100 items from LRU set
      const iterator = this.seenPacketSignatures.values();
      for (let i = 0; i < 100; i++) {
        const next = iterator.next();
        if (next.done) break;
        this.seenPacketSignatures.delete(next.value);
      }
    }

    // Attach transport metadata for diagnostics
    const enrichedPacket = {
      ...packet,
      _receivedVia: sourceTransportId,
    };

    for (const handler of this.handlers) {
      try {
        handler(enrichedPacket);
      } catch (e) {
        console.error('[TransportMultiplexer] Packet handler error:', e);
      }
    }
  }

  public async send(packet: NetworkPacket, targetPeerId?: string): Promise<boolean> {
    let success = false;
    for (const transport of this.transports) {
      if (transport.status === 'connected') {
        try {
          const sent = await transport.send(packet, targetPeerId);
          if (sent) success = true;
        } catch (e) {
          console.warn(`[TransportMultiplexer] Transport ${transport.name} send failed:`, e);
        }
      }
    }
    return success;
  }

  public async broadcast(packet: NetworkPacket): Promise<boolean> {
    let success = false;
    for (const transport of this.transports) {
      if (transport.status === 'connected') {
        try {
          const sent = await transport.broadcast(packet);
          if (sent) success = true;
        } catch (e) {
          console.warn(`[TransportMultiplexer] Transport ${transport.name} broadcast failed:`, e);
        }
      }
    }
    return success;
  }

  public onPacket(handler: PacketHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  public getAggregateMetrics(): TransportMetrics & { activeTransports: string[] } {
    let packetsSent = 0;
    let packetsReceived = 0;
    let bytesSent = 0;
    let bytesReceived = 0;
    let lastActiveTimestamp = 0;
    const activeTransports: string[] = [];

    for (const t of this.transports) {
      const m = t.getMetrics();
      packetsSent += m.packetsSent;
      packetsReceived += m.packetsReceived;
      bytesSent += m.bytesSent;
      bytesReceived += m.bytesReceived;
      if (m.lastActiveTimestamp > lastActiveTimestamp) {
        lastActiveTimestamp = m.lastActiveTimestamp;
      }
      if (t.status === 'connected') {
        activeTransports.push(t.name);
      }
    }

    return {
      packetsSent,
      packetsReceived,
      bytesSent,
      bytesReceived,
      lastActiveTimestamp,
      activeTransports,
    };
  }

  public destroy(): void {
    this.handlers.clear();
    this.seenPacketSignatures.clear();
    this.registeredTransportIds.clear();
    for (const transport of this.transports) {
      transport.destroy();
    }
    this.transports = [];
  }
}
