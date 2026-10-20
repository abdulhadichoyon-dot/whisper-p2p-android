import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SecurityBanner } from '../components/SecurityBanner';
import { TopAppBar } from '../components/TopAppBar';
import { VaultSecurityModal } from '../components/VaultSecurityModal';
import { ChatConversationScreen } from '../components/ChatConversationScreen';
import { PeerProfile, EphemeralMessage } from '../types';

describe('UI & Design Components ("Professional Polish")', () => {
  it('renders SecurityBanner with E2EE and ephemeral in-RAM notice', () => {
    render(<SecurityBanner />);
    expect(screen.getByText(/End-to-End Encrypted/i)).toBeInTheDocument();
    expect(screen.getByText(/stored only in RAM/i)).toBeInTheDocument();
  });

  it('renders TopAppBar with node status and user details', () => {
    const onOpenVault = vi.fn();
    const onOpenNewPeer = vi.fn();
    const onPanicBurn = vi.fn();

    render(
      <TopAppBar
        nodeName="John Doe"
        nodeId="NODE_1234"
        avatarColor="#E8DEF8"
        isOnline={true}
        onOpenVault={onOpenVault}
        onOpenNewPeer={onOpenNewPeer}
        onPanicBurn={onPanicBurn}
      />
    );

    expect(screen.getByText('Whisper P2P')).toBeInTheDocument();
    expect(screen.getByText(/Node Active/i)).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();

    const vaultBtn = screen.getByTestId('vault_button');
    fireEvent.click(vaultBtn);
    expect(onOpenVault).toHaveBeenCalledTimes(1);

    const panicBtn = screen.getByTestId('panic_burn_button');
    fireEvent.click(panicBtn);
    expect(onPanicBurn).toHaveBeenCalledTimes(1);
  });

  it('renders VaultSecurityModal showing cryptographic specifications and zero-persistence audit', () => {
    const onClose = vi.fn();
    const onRotate = vi.fn();
    const onNuclearWipe = vi.fn();

    render(
      <VaultSecurityModal
        isOpen={true}
        onClose={onClose}
        myId="NODE_TEST_99"
        myName="Node 99"
        myPublicKeyHex="0123456789abcdef"
        myFingerprint="0xA1B2...C3D4"
        activePeers={[]}
        onRotateIdentity={onRotate}
        onPanicBurnAll={onNuclearWipe}
      />
    );

    expect(screen.getByText(/Cryptographic Vault/i)).toBeInTheDocument();
    expect(screen.getByText(/ECDH NIST P-256/i)).toBeInTheDocument();
    expect(screen.getByText(/AES-256-GCM/i)).toBeInTheDocument();
    expect(screen.getByText(/HKDF-SHA256/i)).toBeInTheDocument();
    expect(screen.getByText(/0123456789abcdef/i)).toBeInTheDocument();
    expect(screen.getByText(/Rotate Ephemeral Keys Now/i)).toBeInTheDocument();
    expect(screen.getByText(/Emergency Panic Burn/i)).toBeInTheDocument();
  });

  it('renders ChatConversationScreen with peer header, message list, and message input', () => {
    const peer: PeerProfile = {
      id: 'peer_alice',
      name: 'Alice Vance',
      avatarColor: '#FFD8E4',
      fingerprint: '0xAABB...8899',
      status: 'online',
      lastSeen: Date.now(),
      unreadCount: 0,
    };

    const messages: EphemeralMessage[] = [
      {
        id: 'msg_1',
        peerId: 'peer_alice',
        senderId: 'peer_alice',
        senderName: 'Alice Vance',
        isMine: false,
        text: 'Handshake completed successfully',
        timestamp: Date.now() - 10000,
        status: 'read',
        cipherSummary: {
          algorithm: 'AES-256-GCM',
          ivSnippet: 'A1B2C3D4',
          ciphertextLength: 32,
        },
      },
    ];

    const onSendMessage = vi.fn();
    const onBack = vi.fn();
    const onOpenPeerSecurity = vi.fn();
    const onBurnMessage = vi.fn();

    render(
      <ChatConversationScreen
        peer={peer}
        messages={messages}
        onSendMessage={onSendMessage}
        onBack={onBack}
        onOpenPeerSecurity={onOpenPeerSecurity}
        onBurnMessage={onBurnMessage}
      />
    );

    expect(screen.getByText('Alice Vance')).toBeInTheDocument();
    expect(screen.getByText('Handshake completed successfully')).toBeInTheDocument();

    // Type a new message
    const input = screen.getByPlaceholderText(/Encrypted message.../i);
    fireEvent.change(input, { target: { value: 'Hello Alice, direct P2P link ready.' } });
    expect((input as HTMLInputElement).value).toBe('Hello Alice, direct P2P link ready.');

    // Click send
    const sendBtn = screen.getByTestId('send_button');
    fireEvent.click(sendBtn);

    expect(onSendMessage).toHaveBeenCalledWith(
      'Hello Alice, direct P2P link ready.',
      undefined,
      undefined,
      undefined
    );
  });
});
