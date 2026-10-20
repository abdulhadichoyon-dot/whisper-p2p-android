import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  Flame,
  Key,
  Lock,
  RefreshCw,
  Cpu,
  CheckCircle,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { PeerProfile, SecurityFingerprint } from '../types';

interface VaultSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  myId: string;
  myName: string;
  myPublicKeyHex: string;
  myFingerprint: string;
  activePeers: PeerProfile[];
  selectedPeer?: PeerProfile | null;
  selectedPeerFingerprint?: SecurityFingerprint | null;
  onPanicBurnAll: () => void;
  onRotateIdentity: () => void;
}

export const VaultSecurityModal: React.FC<VaultSecurityModalProps> = ({
  isOpen,
  onClose,
  myId,
  myName,
  myPublicKeyHex,
  myFingerprint,
  activePeers,
  selectedPeer,
  selectedPeerFingerprint,
  onPanicBurnAll,
  onRotateIdentity,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [showPanicConfirm, setShowPanicConfirm] = useState(false);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(myPublicKeyHex);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FEF7FF] w-full max-w-md rounded-3xl p-5 shadow-2xl border border-[#CAC4D0]/30 select-none max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#CAC4D0]/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#E8DEF8] flex items-center justify-center text-[#21005D]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#1D1B20]">Cryptographic Vault</h3>
              <p className="text-[11px] text-[#49454F]">RAM Ephemeral Key Manager</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#49454F] hover:bg-[#1D1B20]/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cryptographic Specifications Card */}
        <div className="my-4 p-4 bg-[#F3EDF7] rounded-2xl border border-[#CAC4D0]/40 space-y-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#49454F] font-bold block">
            Cryptographic Architecture
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#FEF7FF] p-2.5 rounded-xl border border-[#CAC4D0]/30">
              <span className="text-[10px] text-[#49454F] block">Asymmetric Protocol</span>
              <span className="font-mono font-semibold text-[#21005D]">ECDH NIST P-256</span>
            </div>
            <div className="bg-[#FEF7FF] p-2.5 rounded-xl border border-[#CAC4D0]/30">
              <span className="text-[10px] text-[#49454F] block">Symmetric Cipher</span>
              <span className="font-mono font-semibold text-[#21005D]">AES-256-GCM (128-bit MAC)</span>
            </div>
            <div className="bg-[#FEF7FF] p-2.5 rounded-xl border border-[#CAC4D0]/30">
              <span className="text-[10px] text-[#49454F] block">Key Derivation</span>
              <span className="font-mono font-semibold text-[#21005D]">HKDF-SHA256</span>
            </div>
            <div className="bg-[#FEF7FF] p-2.5 rounded-xl border border-[#CAC4D0]/30">
              <span className="text-[10px] text-[#49454F] block">Storage Boundary</span>
              <span className="font-mono font-semibold text-emerald-700">Strictly In-RAM (0B Disk)</span>
            </div>
          </div>
        </div>

        {/* Selected Peer Safety Numbers (if chatting) */}
        {selectedPeer && selectedPeerFingerprint && (
          <div className="mb-4 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-900">
                Safety Numbers with {selectedPeer.name}
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-snug mb-2">
              Compare this out-of-band to verify no man-in-the-middle attack:
            </p>
            <div className="bg-white/80 p-2 rounded-xl text-center font-mono font-bold text-xs tracking-wider text-emerald-950 border border-emerald-300">
              {selectedPeerFingerprint.safetyNumberFormatted}
            </div>
          </div>
        )}

        {/* Ephemeral Public Key Display */}
        <div className="mb-4 p-3.5 bg-[#F3EDF7] rounded-2xl border border-[#CAC4D0]/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#49454F] font-bold">
              Current Ephemeral Public Key (RAM)
            </span>
            <button
              onClick={handleCopyKey}
              className="text-[11px] text-[#6750A4] font-medium flex items-center gap-1 hover:underline"
            >
              {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copiedKey ? 'Copied' : 'Copy Hex'}
            </button>
          </div>
          <p className="font-mono text-[10px] text-[#49454F] break-all bg-[#FEF7FF] p-2 rounded-lg border border-[#CAC4D0]/30 max-h-20 overflow-y-auto">
            {myPublicKeyHex || 'Generating...'}
          </p>
        </div>

        {/* Key Rotation Action */}
        <div className="mb-4">
          <button
            onClick={() => {
              onRotateIdentity();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#F3EDF7] hover:bg-[#E8DEF8] text-[#21005D] text-xs font-semibold py-2.5 px-3 rounded-xl border border-[#CAC4D0]/40 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Rotate Ephemeral Keys Now
          </button>
        </div>

        {/* Emergency Panic Burn Section */}
        <div className="pt-3 border-t border-[#CAC4D0]/30">
          {!showPanicConfirm ? (
            <button
              onClick={() => setShowPanicConfirm(true)}
              className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-[#B3261E] text-xs font-semibold py-3 px-4 rounded-xl border border-red-200 transition-colors"
            >
              <Flame className="w-4 h-4 text-[#B3261E]" />
              Emergency Panic Burn (Zero RAM &amp; Purge All)
            </button>
          ) : (
            <div className="p-3.5 bg-red-100/70 border border-red-300 rounded-2xl text-center space-y-2">
              <div className="flex items-center justify-center gap-1 text-red-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-red-700" />
                Confirm Instant Memory Wipe?
              </div>
              <p className="text-[11px] text-red-800 leading-snug">
                All messages, shared images, and cryptographic session keys will be immediately zeroized in RAM and destroyed.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setShowPanicConfirm(false)}
                  className="bg-white text-xs font-medium py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onPanicBurnAll();
                    setShowPanicConfirm(false);
                    onClose();
                  }}
                  className="bg-[#B3261E] text-white text-xs font-bold py-2 rounded-xl hover:bg-red-800"
                >
                  Yes, Burn Everything
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
