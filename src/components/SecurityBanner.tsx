import React from 'react';
import { ShieldCheck, HardDriveDownload, Sparkles } from 'lucide-react';

interface SecurityBannerProps {
  onBannerClick?: () => void;
  messageCount: number;
}

export const SecurityBanner: React.FC<SecurityBannerProps> = ({
  onBannerClick,
  messageCount,
}) => {
  return (
    <div
      onClick={onBannerClick}
      className="mx-4 my-3 p-3 bg-[#F3EDF7] border border-[#CAC4D0]/40 rounded-xl flex items-center justify-between gap-3 shadow-xs cursor-pointer hover:bg-[#ece4f1] transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-[#E8DEF8] p-2 rounded-lg shrink-0 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-[#21005D]" />
        </div>
        <p className="text-xs text-[#49454F] leading-snug">
          <span className="font-bold text-[#1D1B20]">End-to-End Encrypted.</span> Messages are ephemeral &amp; stored only in RAM. Zero server logs.
        </p>
      </div>

      <div className="shrink-0 flex flex-col items-end pl-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#6750A4] font-medium bg-[#E8DEF8]/60 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          RAM Only
        </span>
        <span className="text-[10px] text-[#49454F]/70 font-mono mt-0.5">
          {messageCount} in mem
        </span>
      </div>
    </div>
  );
};
