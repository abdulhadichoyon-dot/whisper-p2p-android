import React, { useState } from 'react';
import { X, Copy, Check, Radio, QrCode, ArrowRight, UserPlus, Shield } from 'lucide-react';

interface NewConnectionModalProps {
  myId: string;
  myName: string;
  myFingerprint: string;
  isOpen: boolean;
  onClose: () => void;
  onConnectPeer: (targetId: string, peerName?: string) => void;
  onSimulatePeer: (name: string) => void;
}

export const NewConnectionModal: React.FC<NewConnectionModalProps> = ({
  myId,
  myName,
  myFingerprint,
  isOpen,
  onClose,
  onConnectPeer,
  onSimulatePeer,
}) => {
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTargetId = targetId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    if (!cleanTargetId) return;
    const cleanTargetName = targetName.trim().slice(0, 40);
    onConnectPeer(cleanTargetId, cleanTargetName || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FEF7FF] w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-[#CAC4D0]/30 select-none animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#CAC4D0]/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#E8DEF8] flex items-center justify-center text-[#21005D]">
              <Radio className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-base text-[#1D1B20]">New P2P Connection</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#49454F] hover:bg-[#1D1B20]/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* My Node Identity Card */}
        <div className="my-4 p-3.5 bg-[#F3EDF7] rounded-2xl border border-[#CAC4D0]/40">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#49454F] font-bold block mb-1">
            Your Ephemeral Node ID
          </span>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-base font-bold text-[#21005D] tracking-wide select-all">
                {myId}
              </p>
              <p className="text-[11px] text-[#49454F] font-mono mt-0.5">
                Key: {myFingerprint}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 bg-[#FEF7FF] text-[#21005D] px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#CAC4D0]/40 hover:bg-[#E8DEF8] active:scale-95 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Connect Form */}
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#1D1B20] mb-1">
              Enter Peer's Node ID
            </label>
            <input
              type="text"
              placeholder="e.g. NODE_9X2A1"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value.toUpperCase())}
              className="w-full bg-[#F3EDF7] text-sm font-mono text-[#1D1B20] placeholder-[#49454F] px-3.5 py-2.5 rounded-xl border border-transparent focus:border-[#6750A4] focus:outline-none uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1D1B20] mb-1">
              Nickname (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="w-full bg-[#F3EDF7] text-sm text-[#1D1B20] placeholder-[#49454F] px-3.5 py-2.5 rounded-xl border border-transparent focus:border-[#6750A4] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!targetId.trim()}
            className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
              targetId.trim()
                ? 'bg-[#6750A4] text-white hover:bg-[#523d8c] shadow-sm active:scale-98'
                : 'bg-[#CAC4D0]/30 text-[#49454F]/50 cursor-not-allowed'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Establish Direct Handshake
          </button>
        </form>

        {/* Quick Simulation Section for Immediate Testing */}
        <div className="mt-4 pt-3 border-t border-[#CAC4D0]/30">
          <p className="text-[11px] text-[#49454F] font-medium mb-2 text-center">
            Or pair with simulated local test peers:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onSimulatePeer('Alice Vance');
                onClose();
              }}
              className="bg-[#F3EDF7] hover:bg-[#E8DEF8] text-[#21005D] text-xs font-semibold py-2 px-3 rounded-xl border border-[#CAC4D0]/40 transition-colors"
            >
              + Alice Vance
            </button>
            <button
              onClick={() => {
                onSimulatePeer('Bob Miller');
                onClose();
              }}
              className="bg-[#F3EDF7] hover:bg-[#E8DEF8] text-[#21005D] text-xs font-semibold py-2 px-3 rounded-xl border border-[#CAC4D0]/40 transition-colors"
            >
              + Bob Miller
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
