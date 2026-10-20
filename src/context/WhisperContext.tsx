import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { P2PManager } from '../p2p/p2pManager';
import { PeerProfile, EphemeralMessage, SecurityFingerprint, ActiveTab } from '../types';

export interface WhisperContextValue {
  // Node Identity & Security
  myId: string;
  myName: string;
  myAvatarColor: string;
  myFingerprint: string;
  myPublicKeyHex: string;

  // Peers & Network
  peers: PeerProfile[];
  selectedPeerId: string | null;
  selectedPeer: PeerProfile | undefined;
  setSelectedPeerId: (id: string | null) => void;
  connectToPeer: (id: string, name?: string) => void;
  simulatePeer: (name: string, welcomeMessage?: string) => void;

  // Messages & Ephemeral Storage
  messages: EphemeralMessage[];
  activePeerMessages: EphemeralMessage[];
  sendMessage: (text?: string, imageBase64?: string, imageMimeType?: string, ttlSeconds?: number) => Promise<void>;
  burnMessage: (messageId: string) => void;
  markMessagesRead: (peerId: string) => void;

  // Security Operations
  rotateKeys: () => Promise<void>;
  panicBurnAll: () => Promise<void>;

  // Navigation & UI Modals
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isVaultOpen: boolean;
  setIsVaultOpen: (open: boolean) => void;
  isNewPeerModalOpen: boolean;
  setIsNewPeerModalOpen: (open: boolean) => void;
  networkMetrics: any;

  // Error handling & user feedback
  errorMessage: string | null;
  clearError: () => void;
}

const WhisperContext = createContext<WhisperContextValue | null>(null);

export const WhisperProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [myId, setMyId] = useState<string>('Initializing...');
  const [myName, setMyName] = useState<string>('Whisper Node');
  const [myAvatarColor, setMyAvatarColor] = useState<string>('#E8DEF8');
  const [myFingerprint, setMyFingerprint] = useState<string>('0x0000...0000');
  const [myPublicKeyHex, setMyPublicKeyHex] = useState<string>('');

  const [peers, setPeers] = useState<PeerProfile[]>([]);
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('chats');
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isNewPeerModalOpen, setIsNewPeerModalOpen] = useState(false);
  const [networkMetrics, setNetworkMetrics] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const p2pManagerRef = useRef<P2PManager | null>(null);
  const simulatedPeersRef = useRef<Set<string>>(new Set());

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // Initialize P2P Architecture subsystem
  useEffect(() => {
    const manager = new P2PManager({
      onNodeReady: (id, name, avatarColor, shortFingerprint) => {
        setMyId(id);
        setMyName(name);
        setMyAvatarColor(avatarColor);
        setMyFingerprint(shortFingerprint);
        const profile = manager.getMyProfile();
        setMyPublicKeyHex(profile.publicKeyHex);
      },
      onPeersUpdated: (updatedPeers) => {
        setPeers([...updatedPeers]);
      },
      onMessageReceived: (newMsg) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMsg.id);
          return exists ? prev : [...prev, newMsg];
        });
      },
      onMessageStatusChanged: (msgId, status) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, status } : m))
        );
      },
      onBurnCompleted: () => {
        setMessages([]);
        setPeers([]);
        setSelectedPeerId(null);
      },
    });

    p2pManagerRef.current = manager;
    manager.initialize();

    // Subscribe to Ephemeral Message Store reactive stream (single source of truth)
    const unsubscribeMessages = manager.subscribeMessages((allMessages) => {
      setMessages([...allMessages]);
    });

    // Seed default sample peer for demo after brief initialization
    const timer = setTimeout(() => {
      simulatePeer('Alice Vance', 'Hey! This channel is directly connected peer-to-peer. Everything is in RAM.');
    }, 600);

    // Periodic network metrics sampler
    const metricsInterval = setInterval(() => {
      if (p2pManagerRef.current) {
        setNetworkMetrics(p2pManagerRef.current.getNetworkMetrics());
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(metricsInterval);
      unsubscribeMessages();
      manager.destroy();
    };
  }, []);

  const simulatePeer = useCallback((name: string, welcomeMessage?: string) => {
    if (!p2pManagerRef.current) return;
    const profile = p2pManagerRef.current.registerSimulatedPeer(name, welcomeMessage);
    simulatedPeersRef.current.add(profile.id);

    setPeers((prev) => {
      const exists = prev.some((p) => p.id === profile.id);
      return exists ? prev : [profile, ...prev];
    });
  }, []);

  const connectToPeer = useCallback((id: string, name?: string) => {
    p2pManagerRef.current?.connectToPeer(id, name);
  }, []);

  const sendMessage = useCallback(
    async (
      text?: string,
      imageBase64?: string,
      imageMimeType?: string,
      ttlSeconds?: number
    ) => {
      if (!selectedPeerId || !p2pManagerRef.current) return;

      try {
        await p2pManagerRef.current.sendMessage(
          selectedPeerId,
          text,
          imageBase64,
          imageMimeType,
          ttlSeconds
        );

        // If simulated peer, trigger intelligent automatic cryptographic reply via EphemeralMessageStore
        if (simulatedPeersRef.current.has(selectedPeerId)) {
          setTimeout(() => {
            const replies = [
              'Got it! Decrypted seamlessly in RAM.',
              'Cryptographic handshake verified. Zero logs on disk.',
              'Payload received via direct WebRTC channel.',
              'Nice! Ephemeral TTL active on this session.',
            ];
            const replyText = replies[Math.floor(Math.random() * replies.length)];
            const now = Date.now();

            const replyMsg: EphemeralMessage = {
              id: 'sim_reply_' + Date.now(),
              peerId: selectedPeerId,
              senderId: selectedPeerId,
              senderName: peers.find((p) => p.id === selectedPeerId)?.name || 'Peer',
              isMine: false,
              text: replyText,
              timestamp: now,
              ttlSeconds,
              expiresAt: ttlSeconds && ttlSeconds > 0 ? now + ttlSeconds * 1000 : undefined,
              remainingSeconds: ttlSeconds,
              isSelfDestructing: !!(ttlSeconds && ttlSeconds > 0),
              status: 'delivered',
              cipherSummary: {
                algorithm: 'AES-256-GCM',
                ivSnippet: '0x' + Math.random().toString(16).substring(2, 6),
                ciphertextLength: 96,
              },
            };

            // Feed reply directly into the message store single source of truth
            if (p2pManagerRef.current) {
              p2pManagerRef.current.addMessage(replyMsg);
            } else {
              setMessages((prev) => [...prev, replyMsg]);
            }
          }, 1200);
        }
      } catch (err: any) {
        console.error('Failed to send message:', err);
        setErrorMessage(err.message || 'Could not deliver encrypted message');
      }
    },
    [selectedPeerId, peers]
  );

  const burnMessage = useCallback(
    (messageId: string) => {
      p2pManagerRef.current?.burnSingleMessage(messageId, selectedPeerId || undefined);
    },
    [selectedPeerId]
  );

  const markMessagesRead = useCallback((peerId: string) => {
    p2pManagerRef.current?.markMessagesRead(peerId);
  }, []);

  const panicBurnAll = useCallback(async () => {
    await p2pManagerRef.current?.panicBurnAll();
    simulatedPeersRef.current.clear();
    setMessages([]);
    setSelectedPeerId(null);
  }, []);

  const rotateKeys = useCallback(async () => {
    await p2pManagerRef.current?.rotateKeys();
  }, []);

  const selectedPeer = peers.find((p) => p.id === selectedPeerId);
  const activePeerMessages = messages.filter((m) => m.peerId === selectedPeerId);

  return (
    <WhisperContext.Provider
      value={{
        myId,
        myName,
        myAvatarColor,
        myFingerprint,
        myPublicKeyHex,
        peers,
        selectedPeerId,
        selectedPeer,
        setSelectedPeerId,
        connectToPeer,
        simulatePeer,
        messages,
        activePeerMessages,
        sendMessage,
        burnMessage,
        markMessagesRead,
        rotateKeys,
        panicBurnAll,
        activeTab,
        setActiveTab,
        isVaultOpen,
        setIsVaultOpen,
        isNewPeerModalOpen,
        setIsNewPeerModalOpen,
        networkMetrics,
        errorMessage,
        clearError,
      }}
    >
      {children}
    </WhisperContext.Provider>
  );
};

export const useWhisper = (): WhisperContextValue => {
  const context = useContext(WhisperContext);
  if (!context) {
    throw new Error('useWhisper must be used within a WhisperProvider');
  }
  return context;
};
