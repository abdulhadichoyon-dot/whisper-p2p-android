import React, { useState } from 'react';
import { PeerProfile } from '../types';
import { Plus, UserPlus, Image as ImageIcon, Shield, Radio, Sparkles, Clock } from 'lucide-react';

interface ChatListScreenProps {
  peers: PeerProfile[];
  selectedPeerId: string | null;
  onSelectPeer: (peer: PeerProfile) => void;
  onOpenNewPeerModal: () => void;
  onSimulatePeerConnect: (name: string) => void;
}

export const ChatListScreen: React.FC<ChatListScreenProps> = ({
  peers,
  selectedPeerId,
  onSelectPeer,
  onOpenNewPeerModal,
  onSimulatePeerConnect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPeers = peers.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Search Bar */}
      {peers.length > 3 && (
        <div className="px-4 pb-2">
          <input
            type="text"
            placeholder="Search active peers or keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F3EDF7] text-sm text-[#1D1B20] placeholder-[#49454F] px-3 py-2 rounded-xl border border-transparent focus:border-[#6750A4] focus:outline-none transition-all"
          />
        </div>
      )}

      {/* Main Peer List */}
      <div className="flex-1 overflow-y-auto px-4 py-1 space-y-1">
        {filteredPeers.length > 0 ? (
          filteredPeers.map((peer) => {
            const initial = peer.name.charAt(0).toUpperCase() || 'P';
            const isOnline = peer.status === 'online';

            return (
              <div
                key={peer.id}
                onClick={() => onSelectPeer(peer)}
                className={`flex items-center gap-3.5 py-3 px-3 rounded-2xl cursor-pointer transition-all ${
                  selectedPeerId === peer.id
                    ? 'bg-[#E8DEF8]/60 border border-[#6750A4]/30'
                    : 'hover:bg-[#1D1B20]/5 active:bg-[#1D1B20]/10'
                }`}
              >
                {/* Avatar with Status Pip */}
                <div className="relative shrink-0">
                  <div
                    className="w-13 h-13 rounded-full flex items-center justify-center font-bold text-lg shadow-xs"
                    style={{
                      backgroundColor: peer.avatarColor || '#D0BCFF',
                      color: '#21005D',
                    }}
                  >
                    {initial}
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#FEF7FF] ${
                      isOnline ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 border-b border-[#CAC4D0]/30 pb-2">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h2 className="text-base font-semibold text-[#1D1B20] truncate">
                      {peer.name}
                    </h2>
                    <span className="text-[11px] text-[#6750A4] font-medium font-mono shrink-0 ml-2">
                      {peer.lastMessageTime
                        ? new Date(peer.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Active'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[#49454F] truncate font-mono">
                      {peer.lastMessageSnippet || `Handshake OK • ${peer.fingerprint || '0x...'}`}
                    </p>

                    {peer.unreadCount && peer.unreadCount > 0 ? (
                      <span className="shrink-0 bg-[#6750A4] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center">
                        {peer.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E8DEF8] flex items-center justify-center text-[#21005D] mb-4 shadow-sm">
              <Radio className="w-8 h-8 text-[#21005D] animate-pulse" />
            </div>

            <h3 className="text-lg font-semibold text-[#1D1B20] mb-1">
              Direct Peer-to-Peer Network
            </h3>
            <p className="text-xs text-[#49454F] max-w-xs leading-relaxed mb-6">
              No server holds your data. Connect to a nearby node via pairing code or local mesh channel.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-col w-full max-w-xs gap-2">
              <button
                onClick={onOpenNewPeerModal}
                className="w-full flex items-center justify-center gap-2 bg-[#6750A4] text-white py-2.5 px-4 rounded-xl text-sm font-medium shadow-sm hover:bg-[#523d8c] active:scale-98 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Connect Peer via Code
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#CAC4D0]/40"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                  <span className="bg-[#FEF7FF] px-2 text-[#49454F]">Instant Local Test</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSimulatePeerConnect('Alice Vance')}
                  className="bg-[#F3EDF7] hover:bg-[#E8DEF8] text-[#21005D] text-xs font-semibold py-2 px-3 rounded-xl border border-[#CAC4D0]/40 transition-colors"
                >
                  + Pair Alice
                </button>
                <button
                  onClick={() => onSimulatePeerConnect('Bob Miller')}
                  className="bg-[#F3EDF7] hover:bg-[#E8DEF8] text-[#21005D] text-xs font-semibold py-2 px-3 rounded-xl border border-[#CAC4D0]/40 transition-colors"
                >
                  + Pair Bob
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={onOpenNewPeerModal}
        className="absolute bottom-6 right-5 w-14 h-14 bg-[#E8DEF8] text-[#21005D] rounded-2xl shadow-lg flex items-center justify-center hover:bg-[#D0BCFF] active:scale-95 transition-all z-10 border border-[#CAC4D0]/30"
        title="Pair new P2P node"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
};
