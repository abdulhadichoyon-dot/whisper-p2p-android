import React from 'react';
import { WhisperProvider, useWhisper } from './context/WhisperContext';
import { TopAppBar } from './components/TopAppBar';
import { SecurityBanner } from './components/SecurityBanner';
import { ChatListScreen } from './components/ChatListScreen';
import { ChatConversationScreen } from './components/ChatConversationScreen';
import { BottomNavBar } from './components/BottomNavBar';
import { NewConnectionModal } from './components/NewConnectionModal';
import { VaultSecurityModal } from './components/VaultSecurityModal';
import { NetworkNodeTab } from './components/NetworkNodeTab';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AlertCircle, X } from 'lucide-react';

const AppShell: React.FC = () => {
  const {
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
    errorMessage,
    clearError,
  } = useWhisper();

  return (
    <div className="flex flex-col h-full w-full bg-[#FEF7FF] font-sans text-[#1D1B20] overflow-hidden">
      {/* Top Application Bar */}
      <TopAppBar
        nodeName={myName}
        nodeId={myId}
        avatarColor={myAvatarColor}
        isOnline={true}
        onOpenVault={() => setIsVaultOpen(true)}
        onOpenNewPeer={() => setIsNewPeerModalOpen(true)}
        onPanicBurn={panicBurnAll}
      />

      {/* Global Toast for Network/Cryptographic Exceptions */}
      {errorMessage && (
        <div className="mx-4 mt-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800 shadow-sm animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={clearError}
            className="p-1 hover:bg-red-100 rounded-lg text-red-700"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {selectedPeer ? (
          /* Active Chat Conversation Screen */
          <ChatConversationScreen
            peer={selectedPeer}
            messages={activePeerMessages}
            onBack={() => setSelectedPeerId(null)}
            onSendMessage={sendMessage}
            onOpenPeerSecurity={() => setIsVaultOpen(true)}
            onBurnMessage={burnMessage}
          />
        ) : (
          /* Main Navigation Tabs */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Top Cryptographic Security & Zero-Disk Banner */}
            <SecurityBanner
              onBannerClick={() => setIsVaultOpen(true)}
              messageCount={messages.length}
            />

            {/* Chats Tab */}
            {activeTab === 'chats' && (
              <ChatListScreen
                peers={peers}
                selectedPeerId={selectedPeerId}
                onSelectPeer={(peer) => {
                  setSelectedPeerId(peer.id);
                  markMessagesRead(peer.id);
                }}
                onOpenNewPeerModal={() => setIsNewPeerModalOpen(true)}
                onSimulatePeerConnect={(name) => simulatePeer(name)}
              />
            )}

            {/* P2P Mesh & Node Visualizer Tab */}
            {activeTab === 'node' && (
              <NetworkNodeTab
                myId={myId}
                myName={myName}
                myFingerprint={myFingerprint}
                peers={peers}
                ramMessageCount={messages.length}
                onConnectPeer={(id, name) => connectToPeer(id, name)}
                onSimulatePeer={(name) => simulatePeer(name)}
              />
            )}

            {/* Security Vault Inspector Tab */}
            {activeTab === 'vault' && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="p-4 bg-[#F3EDF7] rounded-2xl border border-[#CAC4D0]/40">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[#49454F] mb-2">
                      Active Node Identity
                    </h2>
                    <p className="text-lg font-bold text-[#21005D]">{myName}</p>
                    <p className="font-mono text-xs text-[#49454F] mt-1">{myId}</p>
                    <div className="mt-3 p-3 bg-[#FEF7FF] rounded-xl border border-[#CAC4D0]/30">
                      <span className="text-[10px] text-[#49454F] block">Safety Fingerprint</span>
                      <span className="font-mono text-xs font-semibold text-[#21005D]">{myFingerprint}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsVaultOpen(true)}
                    className="w-full py-3 bg-[#6750A4] text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-[#523d8c] transition-colors"
                  >
                    Open Complete Vault Inspector
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar (Hidden during active chat) */}
      {!selectedPeer && (
        <BottomNavBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unreadCount={peers.reduce((acc, p) => acc + (p.unreadCount || 0), 0)}
        />
      )}

      {/* Direct P2P Pairing Modal */}
      <NewConnectionModal
        myId={myId}
        myName={myName}
        myFingerprint={myFingerprint}
        isOpen={isNewPeerModalOpen}
        onClose={() => setIsNewPeerModalOpen(false)}
        onConnectPeer={(id, name) => connectToPeer(id, name)}
        onSimulatePeer={(name) => simulatePeer(name)}
      />

      {/* Cryptographic Vault & Security Modal */}
      <VaultSecurityModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        myId={myId}
        myName={myName}
        myPublicKeyHex={myPublicKeyHex}
        myFingerprint={myFingerprint}
        activePeers={peers}
        selectedPeer={selectedPeer}
        selectedPeerFingerprint={
          selectedPeer
            ? {
                safetyNumberFormatted: '4920 1832 9901 2475 8821 3490 1192 4821',
                hexFingerprint: 'A492B10284F934C7810A',
                shortKey: selectedPeer.fingerprint,
                verified: true,
              }
            : null
        }
        onPanicBurnAll={panicBurnAll}
        onRotateIdentity={rotateKeys}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <WhisperProvider>
        <AppShell />
      </WhisperProvider>
    </ErrorBoundary>
  );
};

export default App;
