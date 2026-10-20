/**
 * P2PManager - Architecture Facade
 * Provides a clean unified interface to the modular Core Architecture:
 * - Transport Layer (BroadcastChannel + WebRTC)
 * - KeyVault (NIST P-256 ECDH + HKDF-SHA256)
 * - EphemeralMessageStore (In-RAM zero persistence with TTL countdown)
 * - MeshNetworkManager (Mesh routing & peer discovery)
 */

import { BroadcastChannelTransport } from '../core/transport/BroadcastChannelTransport';
import { WebRTCTransport } from '../core/transport/WebRTCTransport';
import { TransportMultiplexer } from '../core/transport/TransportMultiplexer';
import { KeyVault } from '../core/security/KeyVault';
import { EphemeralMessageStore } from '../core/storage/EphemeralMessageStore';
import { MeshNetworkManager, MeshEvents } from '../core/mesh/MeshNetworkManager';
import { PeerProfile, EphemeralMessage, SecurityFingerprint } from '../types';

export interface P2PEvents {
  onPeersUpdated: (peers: PeerProfile[]) => void;
  onMessageReceived: (message: EphemeralMessage) => void;
  onMessageStatusChanged: (messageId: string, status: EphemeralMessage['status']) => void;
  onSessionReady?: (peerId: string, fingerprint: SecurityFingerprint) => void;
  onNodeReady: (myId: string, myName: string, myAvatarColor: string, myFingerprint: string) => void;
  onBurnCompleted?: () => void;
}

export class P2PManager {
  private meshManager: MeshNetworkManager;
  private messageStore: EphemeralMessageStore;
  private keyVault: KeyVault;
  private transportMultiplexer: TransportMultiplexer;
  private unsubscribeMessageStore: (() => void) | null = null;

  constructor(events: P2PEvents) {
    // 1. Initialize Pluggable Transports
    const broadcastTransport = new BroadcastChannelTransport();
    const webrtcTransport = new WebRTCTransport();
    this.transportMultiplexer = new TransportMultiplexer([broadcastTransport, webrtcTransport]);

    // 2. Initialize Security Vault
    this.keyVault = new KeyVault();

    // 3. Initialize In-RAM Ephemeral Storage Engine
    this.messageStore = new EphemeralMessageStore();

    // 4. Initialize Mesh Network Coordinator
    const meshEvents: MeshEvents = {
      onNodeReady: events.onNodeReady,
      onPeersUpdated: events.onPeersUpdated,
      onMessageReceived: events.onMessageReceived,
      onMessageStatusChanged: events.onMessageStatusChanged,
      onSessionReady: events.onSessionReady,
      onBurnCompleted: events.onBurnCompleted,
    };

    this.meshManager = new MeshNetworkManager(
      this.transportMultiplexer,
      this.keyVault,
      this.messageStore,
      meshEvents
    );
  }

  public async initialize(): Promise<void> {
    await this.meshManager.initialize();
  }

  public getMyProfile() {
    return this.meshManager.getLocalProfile();
  }

  public getPeers(): PeerProfile[] {
    return this.meshManager.getPeers();
  }

  public getMessages(peerId?: string): EphemeralMessage[] {
    return peerId
      ? this.messageStore.getMessagesForPeer(peerId)
      : this.messageStore.getAllMessages();
  }

  public subscribeMessages(listener: (messages: EphemeralMessage[]) => void): () => void {
    return this.messageStore.subscribe(listener);
  }

  public addMessage(msg: EphemeralMessage): void {
    this.messageStore.addMessage(msg);
  }

  public getNetworkMetrics() {
    return this.meshManager.getTransportMetrics();
  }

  public connectToPeer(targetId: string, peerName?: string): void {
    this.meshManager.connectToPeer(targetId, peerName);
  }

  public async sendMessage(
    targetPeerId: string,
    text?: string,
    imageBase64?: string,
    imageMimeType?: string,
    ttlSeconds?: number
  ): Promise<EphemeralMessage | null> {
    return this.meshManager.sendMessage(
      targetPeerId,
      text,
      imageBase64,
      imageMimeType,
      ttlSeconds
    );
  }

  public markMessagesRead(peerId: string): void {
    this.meshManager.markMessagesRead(peerId);
  }

  public burnSingleMessage(messageId: string, peerId?: string): void {
    this.meshManager.burnSingleMessage(messageId, peerId);
  }

  public async panicBurnAll(): Promise<void> {
    await this.meshManager.panicBurnAll();
  }

  public async rotateKeys(): Promise<void> {
    await this.meshManager.rotateIdentityKeys();
  }

  public registerSimulatedPeer(name: string, welcomeText?: string): PeerProfile {
    return this.meshManager.registerSimulatedPeer(name, welcomeText);
  }

  public destroy(): void {
    if (this.unsubscribeMessageStore) {
      this.unsubscribeMessageStore();
      this.unsubscribeMessageStore = null;
    }
    this.meshManager.destroy();
  }
}
