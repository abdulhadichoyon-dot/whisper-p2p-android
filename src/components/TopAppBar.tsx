import React from 'react';
import { Shield, Flame, Search, SlidersHorizontal, KeyRound, Wifi } from 'lucide-react';

interface TopAppBarProps {
  nodeName: string;
  nodeId: string;
  avatarColor: string;
  isOnline: boolean;
  onOpenVault: () => void;
  onOpenNewPeer: () => void;
  onPanicBurn: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  nodeName,
  nodeId,
  avatarColor,
  isOnline,
  onOpenVault,
  onOpenNewPeer,
  onPanicBurn,
}) => {
  const safeName = nodeName || 'Aura Node';
  const initials = safeName
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'AN';

  return (
    <header className="flex items-center justify-between px-4 h-16 bg-[#FEF7FF] border-b border-[#CAC4D0]/30 select-none shrink-0">
      {/* Node identity */}
      <div className="flex items-center gap-3">
        <div
          onClick={onOpenVault}
          data-testid="avatar_badge"
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer shadow-sm active:scale-95 transition-transform"
          style={{ backgroundColor: avatarColor || '#E8DEF8', color: '#21005D' }}
          title="Inspect Ephemeral Vault & Keys"
        >
          {initials}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-semibold tracking-tight text-[#1D1B20] leading-tight">
              Whisper P2P
            </h1>
            <span className="text-[10px] bg-[#E8DEF8] text-[#21005D] px-1.5 py-0.5 rounded-full font-mono font-medium">
              E2EE
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[11px] font-medium text-[#49454F] tracking-wider uppercase font-mono">
              {isOnline ? 'Node Active' : 'Connecting'} • {(nodeId || '').slice(-4)}
            </span>
          </div>
        </div>
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenVault}
          data-testid="vault_button"
          className="w-10 h-10 flex items-center justify-center rounded-full text-[#49454F] hover:bg-[#1D1B20]/5 active:bg-[#1D1B20]/10 transition-colors"
          title="Security Vault & Fingerprint"
        >
          <KeyRound className="w-5 h-5 text-[#21005D]" />
        </button>

        <button
          onClick={onPanicBurn}
          data-testid="panic_burn_button"
          className="w-10 h-10 flex items-center justify-center rounded-full text-[#B3261E] hover:bg-red-50 active:bg-red-100 transition-colors"
          title="Emergency Panic Burn (Zero RAM & Keys)"
        >
          <Flame className="w-5 h-5 text-[#B3261E]" />
        </button>
      </div>
    </header>
  );
};
