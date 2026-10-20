import React from 'react';
import { MessageSquare, Radio, Shield, Flame } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  unreadCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
}) => {
  return (
    <nav className="h-18 bg-[#F3EDF7] border-t border-[#CAC4D0]/30 flex items-center justify-around px-2 shrink-0 select-none">
      {/* Chats Tab */}
      <button
        onClick={() => onTabChange('chats')}
        className={`flex flex-col items-center gap-0.5 transition-all ${
          activeTab === 'chats' ? 'text-[#21005D]' : 'text-[#49454F] hover:text-[#1D1B20]'
        }`}
      >
        <div
          className={`px-5 py-1 rounded-full relative transition-colors ${
            activeTab === 'chats' ? 'bg-[#E8DEF8]' : 'bg-transparent'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-3 w-2 h-2 rounded-full bg-[#6750A4]" />
          )}
        </div>
        <span className="text-[11px] font-semibold">Chats</span>
      </button>

      {/* Network Tab */}
      <button
        onClick={() => onTabChange('node')}
        className={`flex flex-col items-center gap-0.5 transition-all ${
          activeTab === 'node' ? 'text-[#21005D]' : 'text-[#49454F] hover:text-[#1D1B20]'
        }`}
      >
        <div
          className={`px-5 py-1 rounded-full transition-colors ${
            activeTab === 'node' ? 'bg-[#E8DEF8]' : 'bg-transparent'
          }`}
        >
          <Radio className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-medium">Network</span>
      </button>

      {/* Vault Tab */}
      <button
        onClick={() => onTabChange('vault')}
        className={`flex flex-col items-center gap-0.5 transition-all ${
          activeTab === 'vault' ? 'text-[#21005D]' : 'text-[#49454F] hover:text-[#1D1B20]'
        }`}
      >
        <div
          className={`px-5 py-1 rounded-full transition-colors ${
            activeTab === 'vault' ? 'bg-[#E8DEF8]' : 'bg-transparent'
          }`}
        >
          <Shield className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-medium">Vault</span>
      </button>
    </nav>
  );
};
