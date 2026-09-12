import React from 'react';
import { Compass, Search, User } from 'lucide-react';

export type TabType = 'explorar' | 'chat' | 'buscar' | 'perfil';

interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 2,
}) => {
  return (
    <nav
      id="bottom-floating-navigation"
      aria-label="Navegação Principal"
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm"
    >
      <div className="flex items-center justify-around py-2.5 px-3 rounded-[36px] bg-[#141518]/90 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
        {/* Explorar */}
        <button
          id="nav-btn-explorar"
          onClick={() => onChangeTab('explorar')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-2xl transition-all duration-200 ${
            activeTab === 'explorar'
              ? 'text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              activeTab === 'explorar'
                ? 'bg-white/15 ring-1 ring-white/30 text-emerald-400 scale-105'
                : ''
            }`}
          >
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] tracking-tight ${
              activeTab === 'explorar' ? 'font-bold text-white' : 'font-medium'
            }`}
          >
            Explorar
          </span>
        </button>

        {/* Chat / IA Guia */}
        <button
          id="nav-btn-chat"
          onClick={() => onChangeTab('chat')}
          className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-white/10 text-white ring-1 ring-white/20'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <div
              className={`w-7 h-7 rounded-full overflow-hidden border transition-all ${
                activeTab === 'chat'
                  ? 'border-[#00ff88] ring-2 ring-[#00ff88]/50 scale-105'
                  : 'border-white/30'
              }`}
            >
              <img
                src="/guide_avatar.jpg"
                alt="Chat Guia IA"
                className="w-full h-full object-cover"
              />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#00ff88] rounded-full ring-2 ring-[#141518]" />
            )}
          </div>
          <span
            className={`text-[11px] tracking-tight ${
              activeTab === 'chat' ? 'font-bold text-white' : 'font-medium'
            }`}
          >
            Chat
          </span>
        </button>

        {/* Buscar */}
        <button
          id="nav-btn-buscar"
          onClick={() => onChangeTab('buscar')}
          className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
            activeTab === 'buscar'
              ? 'bg-white/10 text-white ring-1 ring-white/20'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              activeTab === 'buscar'
                ? 'scale-105 text-white'
                : 'text-zinc-400'
            }`}
          >
            <Search className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] tracking-tight ${
              activeTab === 'buscar' ? 'font-bold text-white' : 'font-medium'
            }`}
          >
            Buscar
          </span>
        </button>

        {/* Perfil */}
        <button
          id="nav-btn-perfil"
          onClick={() => onChangeTab('perfil')}
          className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
            activeTab === 'perfil'
              ? 'bg-white/10 text-white ring-1 ring-white/20'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              activeTab === 'perfil'
                ? 'scale-105 text-white'
                : 'text-zinc-400'
            }`}
          >
            <User className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] tracking-tight ${
              activeTab === 'perfil' ? 'font-bold text-white' : 'font-medium'
            }`}
          >
            Perfil
          </span>
        </button>
      </div>
    </nav>
  );
};
