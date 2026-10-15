import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Heart, Shield, CloudRain, Snowflake, Moon, Sun, LogOut, ExternalLink, Instagram, Users, Sparkles } from 'lucide-react';
import { Spot } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: string[];
  spots: Spot[];
  onSelectSpot: (spot: Spot) => void;
  rainEnabled: boolean;
  onToggleRain: () => void;
  snowEnabled: boolean;
  onToggleSnow: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  user: any;
  onUpdateUser: (u: any) => void;
  onOpenAdmin: () => void;
  onSubViewChange?: (view: any) => void;
  communityUrl?: string;
  instagramUrl?: string;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  favorites,
  spots,
  onSelectSpot,
  rainEnabled,
  onToggleRain,
  snowEnabled,
  onToggleSnow,
  theme,
  onToggleTheme,
  user,
  onOpenAdmin,
  instagramUrl = 'https://instagram.com'
}) => {
  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const isUserAdmin = Boolean(
    user?.role === 'admin' ||
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes((user?.email || '').trim().toLowerCase())
  );

  const handleLogout = () => {
    localStorage.removeItem('monvian_token');
    localStorage.removeItem('monvian_user');
    window.location.reload();
  };

  const favoriteSpots = spots.filter(s => favorites.includes(s.id));

  return (
    <div
      className="fixed inset-0 z-30 pt-20 pb-28 px-4 sm:px-6 overflow-y-auto bg-black/95 text-white select-none pointer-events-auto"
      style={{
        paddingTop: 'max(84px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(96px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="max-w-xl mx-auto space-y-6">
        {/* User Card */}
        <div className="flex items-center gap-4 p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl">
          <img
            src={user?.avatar_url || '/loogo.png'}
            alt={user?.name || 'User'}
            className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-white truncate">{user?.name || 'Turista'}</h2>
            <p className="text-xs text-zinc-400 truncate">@{user?.username || 'monvian_user'}</p>
            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{user?.email || 'Campos do Jordão'}</p>
          </div>
          {isUserAdmin && (
            <button
              onClick={onOpenAdmin}
              className="px-3.5 py-2 rounded-2xl bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30 flex items-center gap-1.5 hover:bg-amber-400/30 transition-all cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </button>
          )}
        </div>

        {/* Preferences / Experience Settings */}
        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-white/10 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Preferências & Efeitos</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CloudRain className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-semibold">Chuva Dinâmica no Relevo</span>
              </div>
              <button
                onClick={onToggleRain}
                className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${rainEnabled ? 'bg-blue-500 justify-end' : 'bg-zinc-700 justify-start'}`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Snowflake className="w-5 h-5 text-cyan-300" />
                <span className="text-sm font-semibold">Neve das Montanhas</span>
              </div>
              <button
                onClick={onToggleSnow}
                className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${snowEnabled ? 'bg-cyan-500 justify-end' : 'bg-zinc-700 justify-start'}`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isDark ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-zinc-400" />}
                <span className="text-sm font-semibold">Tema {isDark ? 'Escuro' : 'Claro'}</span>
              </div>
              <button
                onClick={onToggleTheme}
                className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/20 transition-all cursor-pointer"
              >
                Alternar
              </button>
            </div>
          </div>
        </div>

        {/* Favorites Quick List */}
        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500 fill-current" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Meus Favoritos ({favoriteSpots.length})</h3>
            </div>
          </div>

          {favoriteSpots.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3">Você ainda não favoritou locais em Campos do Jordão.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {favoriteSpots.map(s => (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelectSpot(s);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer"
                >
                  <img src={s.image} alt={s.name} className="w-10 h-10 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{s.name}</p>
                    <p className="text-xs text-zinc-400 truncate">{s.categoryLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Social Link & Logout */}
        <div className="flex flex-col gap-2">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl bg-zinc-900/60 border border-white/10 text-zinc-300 hover:text-white text-xs font-bold transition-all"
          >
            <Instagram className="w-4 h-4 text-pink-500" />
            <span>Siga o Monvian no Instagram</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold border border-rose-500/20 transition-all cursor-pointer mt-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default ProfileModal;
