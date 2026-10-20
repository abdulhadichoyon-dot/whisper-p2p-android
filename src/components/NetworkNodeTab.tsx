import React, { useState } from 'react';
import {
  Radio,
  Wifi,
  ShieldCheck,
  ServerOff,
  Activity,
  Layers,
  HardDrive,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { PeerProfile } from '../types';

interface NetworkNodeTabProps {
  myId: string;
  myName: string;
  myFingerprint: string;
  peers: PeerProfile[];
  ramMessageCount: number;
  onConnectPeer: (id: string, name?: string) => void;
  onSimulatePeer: (name: string) => void;
}

export const NetworkNodeTab: React.FC<NetworkNodeTabProps> = ({
  myId,
  myName,
  myFingerprint,
  peers,
  ramMessageCount,
  onConnectPeer,
  onSimulatePeer,
}) => {
  const [inputPeerId, setInputPeerId] = useState('');
  const [inputName, setInputName] = useState('');

  const onlinePeersCount = peers.filter(p => p.status === 'online').length;

  const handleManualPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPeerId.trim()) return;
    onConnectPeer(inputPeerId.trim(), inputName.trim() || undefined);
    setInputPeerId('');
    setInputName('');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 select-none">
      {/* Node Status Banner */}
      <div className="p-4 bg-[#F3EDF7] rounded-2xl border border-[#CAC4D0]/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#E8DEF8] flex items-center justify-center text-[#21005D]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1D1B20]">{myName}</h2>
              <p className="text-[11px] font-mono text-[#49454F]">{myId}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </span>
        </div>

        {/* Network Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-[#CAC4D0]/30">
          <div className="bg-[#FEF7FF] p-2 rounded-xl">
            <span className="text-[10px] text-[#49454F] block">Connected</span>
            <span className="font-mono font-bold text-sm text-[#21005D]">
              {onlinePeersCount} peers
            </span>
          </div>
          <div className="bg-[#FEF7FF] p-2 rounded-xl">
            <span className="text-[10px] text-[#49454F] block">Server Dependency</span>
            <span className="font-mono font-bold text-sm text-emerald-700">
              0% (P2P)
            </span>
          </div>
          <div className="bg-[#FEF7FF] p-2 rounded-xl">
            <span className="text-[10px] text-[#49454F] block">Disk Storage</span>
            <span className="font-mono font-bold text-sm text-emerald-700">
              0 Bytes
            </span>
          </div>
        </div>
      </div>

      {/* Protocol Architecture Details */}
      <div className="p-4 bg-[#F3EDF7] rounded-2xl border border-[#CAC4D0]/40 space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#49454F]">
          Transport &amp; Protocol Stack
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 bg-[#FEF7FF] rounded-xl border border-[#CAC4D0]/30">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#6750A4]" />
              <span className="font-medium text-[#1D1B20]">Data Transport</span>
            </div>
            <span className="font-mono text-[#49454F]">WebRTC DataChannel / Local Mesh</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-[#FEF7FF] rounded-xl border border-[#CAC4D0]/30">
            <div className="flex items-center gap-2">
              <ServerOff className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-[#1D1B20]">Relay Architecture</span>
            </div>
            <span className="font-mono text-emerald-700 font-semibold">Zero-Relay Direct Mesh</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-[#FEF7FF] rounded-xl border border-[#CAC4D0]/30">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#6750A4]" />
              <span className="font-medium text-[#1D1B20]">Ephemeral Volatility</span>
            </div>
            <span className="font-mono text-[#21005D] font-semibold">{ramMessageCount} objects in RAM</span>
          </div>
        </div>
      </div>

      {/* Manual Direct Handshake Form */}
      <div className="p-4 bg-[#F3EDF7] rounded-2xl border border-[#CAC4D0]/40 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#49454F]">
          Manual Node Handshake
        </h3>
        <form onSubmit={handleManualPair} className="space-y-2">
          <input
            type="text"
            placeholder="Target Node ID (e.g. NODE_8A29F)"
            value={inputPeerId}
            onChange={(e) => setInputPeerId(e.target.value.toUpperCase())}
            className="w-full bg-[#FEF7FF] text-xs font-mono text-[#1D1B20] placeholder-[#49454F] px-3 py-2 rounded-xl border border-[#CAC4D0]/40 focus:border-[#6750A4] focus:outline-none uppercase"
          />
          <input
            type="text"
            placeholder="Peer Label / Nickname (optional)"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            className="w-full bg-[#FEF7FF] text-xs text-[#1D1B20] placeholder-[#49454F] px-3 py-2 rounded-xl border border-[#CAC4D0]/40 focus:border-[#6750A4] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputPeerId.trim()}
            className="w-full py-2 bg-[#6750A4] text-white rounded-xl text-xs font-semibold hover:bg-[#523d8c] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Send Cryptographic Handshake
          </button>
        </form>
      </div>

      {/* Quick Peer Simulator */}
      <div className="p-4 bg-[#F3EDF7] rounded-2xl border border-[#CAC4D0]/40 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#49454F]">
          Instant Demo Peers
        </h3>
        <p className="text-[11px] text-[#49454F]">
          Instantly instantiate local peer endpoints with separate keypairs for immediate end-to-end testing:
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onSimulatePeer('Alice Vance')}
            className="p-2.5 bg-[#FEF7FF] hover:bg-[#E8DEF8] text-[#21005D] text-xs font-semibold rounded-xl border border-[#CAC4D0]/40 text-left transition-colors"
          >
            <p className="font-bold">Alice Vance</p>
            <p className="text-[10px] text-[#49454F] font-mono">Simulate E2EE Node</p>
          </button>
          <button
            onClick={() => onSimulatePeer('Bob Miller')}
            className="p-2.5 bg-[#FEF7FF] hover:bg-[#E8DEF8] text-[#21005D] text-xs font-semibold rounded-xl border border-[#CAC4D0]/40 text-left transition-colors"
          >
            <p className="font-bold">Bob Miller</p>
            <p className="text-[10px] text-[#49454F] font-mono">Simulate E2EE Node</p>
          </button>
        </div>
      </div>
    </div>
  );
};
