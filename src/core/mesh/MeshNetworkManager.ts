import { TransportMultiplexer } from '../transport/TransportMultiplexer';
import { KeyVault } from '../security/KeyVault';
import { EphemeralMessageStore } from '../storage/EphemeralMessageStore';
import { encryptPayload, decryptPayload, isSafeImageDataUri, isSafeImageMimeType } from '../../crypto/e2ee';
import { PeerProfile, EphemeralMessage, SecurityFingerprint } from '../../types';
import { WhisperPacket } from '../protocol/ProtocolPackets';

export interface MeshEvents {
  onNodeReady: (myId: string, myName: string, myAvatarColor: string, myFingerprint: string) => void;
  onPeersUpdated: (peers: PeerProfile[]) => void;
  onMessageReceived: (message: EphemeralMessage) => void;
  onMessageStatusChanged: (messageId: string, status: EphemeralMessage['status']) => void;
  onSessionReady?: (peerId: string, fingerprint: SecurityFingerprint) => void;
  onBurnCompleted?: () => void;
}

export interface SimulatedPeerContext {
  id: string;
  name: string;
  keyPair: CryptoKeyPair;
  sessionKey: CryptoKey | null;
}

export class MeshNetworkManager {
  private localNodeId: string = '';
  private localNodeName: string = '';
  private localAvatarColor: string = '';
  
  private transportMultiplexer: TransportMultiplexer;
  private keyVault: KeyVault;
  private messageStore: EphemeralMessageStore;
  private events: MeshEvents;

  private peers: Map<string, PeerProfile> = new Map();
  private simulatedPeers: Map<string, SimulatedPeerContext> = new Map();
  private unregisterPacketHandler: (() => void) | null = null;
  private destroyed: boolean = false;

  constructor(
    transportMultiplexer: TransportMultiplexer,
    keyVault: KeyVault,
    messageStore: EphemeralMessageStore,
    events: MeshEvents
  ) {
    this.transportMultiplexer = transportMultiplexer;
    this.keyVault = keyVault;
    this.messageStore = messageStore;
    this.events = events;
  }

  public async initialize(): Promise<void> {
    this.destroyed = false;

    // 1. Generate local node identity in RAM
    this.localNodeId = 'NODE_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const names = ['Aura Node', 'Cipher One', 'Ghost Lynx', 'Echo Void', 'Solaris', 'Vanguard', 'Apex Cipher'];
    this.localNodeName = names[Math.floor(Math.random() * names.length)] + ' ' + this.localNodeId.slice(-3);
    
    const colors = ['#E8DEF8', '#D0BCFF', '#FFD8E4', '#EADDFF', '#C4EED0', '#FDE293'];
    this.localAvatarColor = colors[Math.floor(Math.random() * colors.length)];

    // 2. Initialize Key Vault (Generates Ephemeral ECDH Key Pair in RAM)
    await this.keyVault.initialize();

    // 3. Clean up any existing packet handler to prevent duplicate handler leakage
    if (this.unregisterPacketHandler) {
      this.unregisterPacketHandler();
      this.unregisterPacketHandler = null;
    }

    // Setup packet routing from transport multiplexer
    this.unregisterPacketHandler = this.transportMultiplexer.onPacket((packet) => {
      if (this.destroyed) return;
      this.handleNetworkPacket(packet as WhisperPacket);
    });

    // 4. Initialize transports with local node ID
    await this.transportMultiplexer.initialize(this.localNodeId);

    // 5. Fire ready callback
    this.events.onNodeReady(
      this.localNodeId,
      this.localNodeName,
      this.localAvatarColor,
      this.keyVault.getLocalFingerprintSnippet()
    );

    // 6. Broadcast discovery announcement to mesh
    this.announcePresence();
  }

  public getLocalProfile() {
    return {
      id: this.localNodeId,
      name: this.localNodeName,
      avatarColor: this.localAvatarColor,
      fingerprint: this.keyVault.getLocalFingerprintSnippet(),
      publicKeyHex: this.keyVault.getLocalPublicKeyHex(),
    };
  }

  public getPeers(): PeerProfile[] {
    return Array.from(this.peers.values());
  }

  public getMessageStore(): EphemeralMessageStore {
    return this.messageStore;
  }

  public getKeyVault(): KeyVault {
    return this.keyVault;
  }

  public getTransportMetrics() {
    return this.transportMultiplexer.getAggregateMetrics();
  }

  public announcePresence(): void {
    const keyBundle = this.keyVault.getLocalKeyBundle();
    if (!keyBundle) return;

    this.transportMultiplexer.broadcast({
      type: 'DISCOVERY_ANNOUNCE',
      senderId: this.localNodeId,
      senderName: this.localNodeName,
      avatarColor: this.localAvatarColor,
      publicKeyJwk: keyBundle.publicKeyJwk,
      publicKeyHex: keyBundle.publicKeyHex,
      timestamp: Date.now(),
    });
  }

  public async connectToPeer(targetId: string, peerName?: string): Promise<void> {
    const cleanId = (targetId || '').trim().toUpperCase();
    if (!cleanId || cleanId === this.localNodeId) return;

    // Sanitize peer name
    const sanitizedName = (peerName || `Peer ${cleanId.slice(-4)}`).slice(0, 50).trim();

    if (!this.peers.has(cleanId)) {
      this.peers.set(cleanId, {
        id: cleanId,
        name: sanitizedName,
        avatarColor: '#D0BCFF',
        fingerprint: 'Handshaking...',
        status: 'connecting',
        lastSeen: Date.now(),
      });
      this.notifyPeers();
    }

    const keyBundle = this.keyVault.getLocalKeyBundle();
    if (!keyBundle) return;

    // Send Key Exchange Init to target
    await this.transportMultiplexer.send(
      {
        type: 'KEY_EXCHANGE_INIT',
        senderId: this.localNodeId,
        senderName: this.localNodeName,
        avatarColor: this.localAvatarColor,
        publicKeyJwk: keyBundle.publicKeyJwk,
        publicKeyHex: keyBundle.publicKeyHex,
        timestamp: Date.now(),
      },
      cleanId
    );
  }

  private async handleNetworkPacket(packet: WhisperPacket): Promise<void> {
    if (!packet || typeof packet !== 'object') return;
    const { type, senderId, targetId } = packet;

    if (!senderId || typeof senderId !== 'string') return;
    if (senderId === this.localNodeId) return;
    if (targetId && targetId !== this.localNodeId) return;

    switch (type) {
      case 'DISCOVERY_ANNOUNCE': {
        const { senderName, avatarColor, publicKeyJwk, publicKeyHex } = packet;
        await this.registerDiscoveredPeer(senderId, senderName, avatarColor, publicKeyJwk, publicKeyHex);
        
        // Reply so the other peer knows we exist
        const keyBundle = this.keyVault.getLocalKeyBundle();
        if (keyBundle) {
          this.transportMultiplexer.send(
            {
              type: 'DISCOVERY_REPLY',
              senderId: this.localNodeId,
              senderName: this.localNodeName,
              avatarColor: this.localAvatarColor,
              publicKeyJwk: keyBundle.publicKeyJwk,
              publicKeyHex: keyBundle.publicKeyHex,
              timestamp: Date.now(),
            },
            senderId
          );
        }
        break;
      }

      case 'DISCOVERY_REPLY': {
        const { senderName, avatarColor, publicKeyJwk, publicKeyHex } = packet;
        await this.registerDiscoveredPeer(senderId, senderName, avatarColor, publicKeyJwk, publicKeyHex);
        break;
      }

      case 'KEY_EXCHANGE_INIT': {
        const { senderName, avatarColor, publicKeyJwk, publicKeyHex } = packet;
        await this.registerDiscoveredPeer(senderId, senderName, avatarColor, publicKeyJwk, publicKeyHex);
        
        // Return ACK with our public key
        const keyBundle = this.keyVault.getLocalKeyBundle();
        if (keyBundle) {
          this.transportMultiplexer.send(
            {
              type: 'KEY_EXCHANGE_ACK',
              senderId: this.localNodeId,
              senderName: this.localNodeName,
              avatarColor: this.localAvatarColor,
              publicKeyJwk: keyBundle.publicKeyJwk,
              publicKeyHex: keyBundle.publicKeyHex,
              timestamp: Date.now(),
            },
            senderId
          );
        }
        break;
      }

      case 'KEY_EXCHANGE_ACK': {
        const { senderName, avatarColor, publicKeyJwk, publicKeyHex } = packet;
        await this.registerDiscoveredPeer(senderId, senderName, avatarColor, publicKeyJwk, publicKeyHex);
        break;
      }

      case 'ENCRYPTED_MESSAGE': {
        await this.handleIncomingEncryptedMessage(packet);
        break;
      }

      case 'MESSAGE_ACK': {
        const { messageId, status } = packet;
        if (messageId && status) {
          this.messageStore.updateMessageStatus(messageId, status);
          this.events.onMessageStatusChanged(messageId, status);
        }
        break;
      }

      case 'MESSAGE_BURN_REQUEST': {
        const { messageId } = packet;
        if (messageId) {
          this.messageStore.burnSingleMessage(messageId);
        }
        break;
      }

      case 'PANIC_BURN_SIGNAL': {
        this.panicBurnAll();
        break;
      }
    }
  }

  private async registerDiscoveredPeer(
    peerId: string,
    peerName?: string,
    avatarColor?: string,
    publicKeyJwk?: JsonWebKey,
    publicKeyHex?: string
  ): Promise<void> {
    const cleanId = (peerId || '').trim();
    if (!cleanId) return;

    const safeName = (peerName || `Peer ${cleanId.slice(-4)}`).slice(0, 50).trim();
    const safeAvatar = (avatarColor && avatarColor.startsWith('#')) ? avatarColor : '#E8DEF8';

    let peer = this.peers.get(cleanId);
    if (!peer) {
      peer = {
        id: cleanId,
        name: safeName,
        avatarColor: safeAvatar,
        fingerprint: 'Calculating...',
        status: 'connecting',
        lastSeen: Date.now(),
        unreadCount: 0,
      };
      this.peers.set(cleanId, peer);
    } else {
      peer.name = safeName || peer.name;
      peer.avatarColor = safeAvatar || peer.avatarColor;
      peer.lastSeen = Date.now();
    }

    if (publicKeyJwk && publicKeyHex) {
      peer.publicKeyJwk = publicKeyJwk;
      try {
        const sessionResult = await this.keyVault.establishPeerSession(
          cleanId,
          publicKeyJwk,
          publicKeyHex
        );
        peer.fingerprint = sessionResult.fingerprint.shortKey;
        peer.status = 'online';

        if (sessionResult.isKeyChanged) {
          console.warn(`[MeshSecurity] Identity key changed for peer ${cleanId}! Potential MITM or key rotation.`);
          peer.isVerified = false;
        }

        this.events.onSessionReady?.(cleanId, sessionResult.fingerprint);
      } catch (e) {
        console.warn(`[Mesh] Failed to derive session key with peer ${cleanId}:`, e);
      }
    }

    this.notifyPeers();
  }

  public async sendMessage(
    targetPeerId: string,
    text?: string,
    imageBase64?: string,
    imageMimeType?: string,
    ttlSeconds?: number
  ): Promise<EphemeralMessage | null> {
    const cleanTargetId = (targetPeerId || '').trim().toUpperCase();
    const peer = this.peers.get(cleanTargetId);
    if (!peer) {
      throw new Error(`Target peer ${cleanTargetId} not found in mesh.`);
    }

    // Input bounds validation & sanitization
    const sanitizedText = text ? text.slice(0, 10000).trim() : undefined;
    let sanitizedImageBase64: string | undefined = undefined;
    let sanitizedMimeType: string | undefined = undefined;

    if (imageBase64) {
      if (!isSafeImageDataUri(imageBase64)) {
        throw new Error('Rejected image payload: Only safe raster images (PNG, JPEG, WebP, GIF) are permitted.');
      }
      sanitizedImageBase64 = imageBase64;
      sanitizedMimeType = isSafeImageMimeType(imageMimeType) ? imageMimeType : 'image/jpeg';
    }

    if (!sanitizedText && !sanitizedImageBase64) {
      throw new Error('Cannot send empty message without text or image payload');
    }

    // Ensure valid TTL range (0 to 24 hours)
    const validTtl = (typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0 && ttlSeconds <= 86400)
      ? Math.floor(ttlSeconds)
      : undefined;

    let sessionKey = this.keyVault.getSessionKey(cleanTargetId);
    if (!sessionKey && peer.publicKeyJwk) {
      // Lazy derivation attempt
      const result = await this.keyVault.establishPeerSession(
        cleanTargetId,
        peer.publicKeyJwk,
        peer.publicKeyJwk.x || ''
      );
      sessionKey = result.sessionKey;
    }

    if (!sessionKey) {
      throw new Error(`Secure cryptographic session not established with peer ${cleanTargetId}.`);
    }

    // Prepare plaintext payload JSON
    const payload = JSON.stringify({
      text: sanitizedText || '',
      imageBase64: sanitizedImageBase64 || null,
      imageMimeType: sanitizedMimeType || null,
      sentAt: Date.now(),
    });

    // Encrypt payload via AES-256-GCM authenticated cipher
    const encrypted = await encryptPayload(sessionKey, payload);
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const now = Date.now();
    const expiresAt = validTtl ? now + validTtl * 1000 : undefined;

    const ephemeralMsg: EphemeralMessage = {
      id: messageId,
      peerId: cleanTargetId,
      senderId: this.localNodeId,
      senderName: this.localNodeName,
      isMine: true,
      text: sanitizedText,
      imageBase64: sanitizedImageBase64,
      imageMimeType: sanitizedMimeType,
      timestamp: now,
      ttlSeconds: validTtl,
      expiresAt,
      remainingSeconds: validTtl,
      isSelfDestructing: !!validTtl,
      status: 'sending',
      cipherSummary: {
        algorithm: 'AES-256-GCM',
        ivSnippet: encrypted.ivSnippet,
        ciphertextLength: encrypted.ciphertext.length,
      },
    };

    // Store in RAM
    this.messageStore.addMessage(ephemeralMsg);

    // Send encrypted packet over mesh transports
    const sent = await this.transportMultiplexer.send(
      {
        type: 'ENCRYPTED_MESSAGE',
        messageId,
        senderId: this.localNodeId,
        targetId: cleanTargetId,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        ivSnippet: encrypted.ivSnippet,
        ttlSeconds: validTtl,
        timestamp: now,
      },
      cleanTargetId
    );

    const newStatus = sent ? 'delivered' : 'sent';
    this.messageStore.updateMessageStatus(messageId, newStatus);
    ephemeralMsg.status = newStatus;

    // Update peer snippet
    peer.lastMessageSnippet = sanitizedText || (sanitizedImageBase64 ? '📷 Encrypted Image' : 'Encrypted message');
    peer.lastMessageTime = now;
    this.notifyPeers();

    return ephemeralMsg;
  }

  private async handleIncomingEncryptedMessage(packet: any): Promise<void> {
    if (!packet || typeof packet !== 'object') return;
    const { senderId, messageId, iv, ciphertext, ivSnippet, ttlSeconds } = packet;

    if (!senderId || !messageId || !iv || !ciphertext) {
      console.warn('[Mesh] Dropped malformed encrypted packet with missing fields');
      return;
    }

    const sessionKey = this.keyVault.getSessionKey(senderId);
    if (!sessionKey) {
      console.warn(`[Mesh] Received encrypted message from ${senderId} without session key`);
      return;
    }

    try {
      // Authenticated AES-256-GCM Decryption in RAM
      const decryptedPlaintext = await decryptPayload(sessionKey, ciphertext, iv);
      const parsed = JSON.parse(decryptedPlaintext);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Malformed message payload: parsed object is invalid');
      }

      // XSS & Security Validation on decrypted data
      const safeText = typeof parsed.text === 'string' ? parsed.text.slice(0, 10000) : undefined;
      let safeImage: string | undefined = undefined;
      let safeImageMime: string | undefined = undefined;

      if (parsed.imageBase64 && typeof parsed.imageBase64 === 'string') {
        if (isSafeImageDataUri(parsed.imageBase64)) {
          safeImage = parsed.imageBase64;
          safeImageMime = isSafeImageMimeType(parsed.imageMimeType) ? parsed.imageMimeType : 'image/jpeg';
        } else {
          console.warn('[MeshSecurity] Rejected unsafe image attachment in decrypted message');
        }
      }

      const validTtl = (typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0 && ttlSeconds <= 86400)
        ? Math.floor(ttlSeconds)
        : undefined;

      const now = Date.now();
      const expiresAt = validTtl ? now + validTtl * 1000 : undefined;

      const ephemeralMsg: EphemeralMessage = {
        id: messageId,
        peerId: senderId,
        senderId: senderId,
        senderName: this.peers.get(senderId)?.name || `Peer ${senderId.slice(-4)}`,
        isMine: false,
        text: safeText,
        imageBase64: safeImage,
        imageMimeType: safeImageMime,
        timestamp: now,
        ttlSeconds: validTtl,
        expiresAt,
        remainingSeconds: validTtl,
        isSelfDestructing: !!validTtl,
        status: 'delivered',
        cipherSummary: {
          algorithm: 'AES-256-GCM',
          ivSnippet: typeof ivSnippet === 'string' ? ivSnippet.slice(0, 16) : '0x0000',
          ciphertextLength: ciphertext.length,
        },
      };

      this.messageStore.addMessage(ephemeralMsg);
      this.events.onMessageReceived(ephemeralMsg);

      // Update peer snippet & unread count
      const peer = this.peers.get(senderId);
      if (peer) {
        peer.lastMessageSnippet = safeText || (safeImage ? '📷 Encrypted Image' : 'Encrypted message');
        peer.lastMessageTime = now;
        peer.unreadCount = (peer.unreadCount || 0) + 1;
        peer.lastSeen = now;
        this.notifyPeers();
      }

      // Send Delivery ACK back to sender
      this.transportMultiplexer.send(
        {
          type: 'MESSAGE_ACK',
          messageId,
          senderId: this.localNodeId,
          targetId: senderId,
          status: 'delivered',
          timestamp: Date.now(),
        },
        senderId
      );
    } catch (e: any) {
      console.error(`[Mesh] Cryptographic decryption failed for message ${messageId}:`, e.message || e);
    }
  }

  public burnSingleMessage(messageId: string, peerId?: string): void {
    if (!messageId) return;
    this.messageStore.burnSingleMessage(messageId);
    if (peerId) {
      this.transportMultiplexer.send(
        {
          type: 'MESSAGE_BURN_REQUEST',
          messageId,
          senderId: this.localNodeId,
          targetId: peerId,
          timestamp: Date.now(),
        },
        peerId
      );
    }
  }

  public markMessagesRead(peerId: string): void {
    if (!peerId) return;
    this.messageStore.markMessagesRead(peerId);
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.unreadCount = 0;
      this.notifyPeers();
    }
  }

  public async panicBurnAll(): Promise<void> {
    // 1. Broadcast panic burn signal to mesh
    await this.transportMultiplexer.broadcast({
      type: 'PANIC_BURN_SIGNAL',
      senderId: this.localNodeId,
      timestamp: Date.now(),
    });

    // 2. Zero and shred message memory
    this.messageStore.panicBurnAll();

    // 3. Purge cryptographic vault
    this.keyVault.panicPurge();

    // 4. Clear peer sessions
    this.peers.clear();
    this.simulatedPeers.clear();

    // 5. Notify UI
    this.notifyPeers();
    this.events.onBurnCompleted?.();

    // 6. Generate fresh clean identity in RAM
    await this.initialize();
  }

  public async rotateIdentityKeys(): Promise<void> {
    await this.keyVault.rotateLocalKeys();
    this.announcePresence();
  }

  public registerSimulatedPeer(name: string, welcomeText?: string): PeerProfile {
    const safeName = (name || 'Peer Node').slice(0, 40).trim();
    const peerId = 'NODE_' + safeName.split(' ')[0].toUpperCase() + '_' + Math.random().toString(36).substring(2, 5).toUpperCase();
    const avatarColor = safeName.includes('Alice') ? '#FFD8E4' : '#D0BCFF';

    const profile: PeerProfile = {
      id: peerId,
      name: safeName,
      avatarColor,
      fingerprint: '0x8F2A...E491',
      status: 'online',
      lastSeen: Date.now(),
      lastMessageSnippet: welcomeText || 'Handshake OK. Key: 0x8f2...e4',
      lastMessageTime: Date.now(),
      unreadCount: welcomeText ? 1 : 0,
    };

    this.peers.set(peerId, profile);
    this.notifyPeers();

    if (welcomeText) {
      const welcomeMsg: EphemeralMessage = {
        id: 'welcome_' + Date.now(),
        peerId,
        senderId: peerId,
        senderName: safeName,
        isMine: false,
        text: welcomeText,
        timestamp: Date.now(),
        status: 'delivered',
        cipherSummary: {
          algorithm: 'AES-256-GCM',
          ivSnippet: '0x3a82',
          ciphertextLength: 128,
        },
      };
      this.messageStore.addMessage(welcomeMsg);
    }

    return profile;
  }

  private notifyPeers(): void {
    this.events.onPeersUpdated(Array.from(this.peers.values()));
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.unregisterPacketHandler) {
      this.unregisterPacketHandler();
      this.unregisterPacketHandler = null;
    }
    this.transportMultiplexer.destroy();
    this.messageStore.destroy();
    this.keyVault.panicPurge();
    this.peers.clear();
  }
}
