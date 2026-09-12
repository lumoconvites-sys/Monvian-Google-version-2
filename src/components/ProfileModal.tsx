import React, { useState } from 'react';
import { Spot } from '../types';
import {
  X,
  Pencil,
  Instagram,
  MessageCircle,
  Heart,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Star,
  MapPin,
  Check,
  Snowflake,
  Bell,
  Sliders,
  ExternalLink,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: string[];
  spots: Spot[];
  onSelectSpot: (spot: Spot) => void;
  snowEnabled: boolean;
  onToggleSnow: () => void;
}

type SubView = 'main' | 'edit-profile' | 'curtidos' | 'permissoes' | 'painel-adm' | 'logout-confirm';

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  favorites,
  spots,
  onSelectSpot,
  snowEnabled,
  onToggleSnow,
}) => {
  // User profile state matching screenshot
  const [userName, setUserName] = useState('mariomeloz');
  const [userEmail, setUserEmail] = useState('mariomeloz@gmail.com');
  const [userAvatar, setUserAvatar] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'
  );

  // Sub-view management
  const [activeSubView, setActiveSubView] = useState<SubView>('main');

  // Form states for editing profile
  const [tempName, setTempName] = useState(userName);
  const [tempEmail, setTempEmail] = useState(userEmail);
  const [saveToast, setSaveToast] = useState(false);

  // Permissions state
  const [locationPerm, setLocationPerm] = useState(true);
  const [notificationsPerm, setNotificationsPerm] = useState(true);

  if (!isOpen) return null;

  const favoriteSpots = spots.filter((s) => favorites.includes(s.id));

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUserName(tempName.trim() || 'mariomeloz');
    setUserEmail(tempEmail.trim() || 'mariomeloz@gmail.com');
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      setActiveSubView('main');
    }, 800);
  };

  return (
    <div
      id="profile-fullscreen-overlay"
      className="fixed inset-0 z-45 bg-black text-white flex flex-col justify-between overflow-hidden animate-in fade-in duration-300"
      style={{
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top Header Bar identical to screenshot */}
      <div className="pt-6 sm:pt-8 px-5 sm:px-6 pb-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          {activeSubView !== 'main' ? (
            <button
              id="btn-back-profile-main"
              onClick={() => setActiveSubView('main')}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer mr-1"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
          ) : null}

          <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
            {activeSubView === 'main' && 'Perfil'}
            {activeSubView === 'edit-profile' && 'Editar Perfil'}
            {activeSubView === 'curtidos' && 'Lugares Curtidos'}
            {activeSubView === 'permissoes' && 'Permissões & Privacidade'}
            {activeSubView === 'painel-adm' && 'Painel ADM'}
            {activeSubView === 'logout-confirm' && 'Encerrar Sessão'}
          </h1>
        </div>

        {/* Top Right Close Button */}
        <button
          id="btn-close-profile"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
          title="Fechar perfil"
        >
          <X className="w-5 h-5 stroke-[2]" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 max-w-md mx-auto w-full pb-24 sm:pb-28">
        {/* ============================================================ */}
        {/* VIEW 1: MAIN PROFILE (Exact Match to Screenshot)            */}
        {/* ============================================================ */}
        {activeSubView === 'main' && (
          <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
            {/* 1. Header User Card */}
            <div
              id="card-user-info"
              className="w-full p-5 rounded-[24px] bg-[#141518] border border-white/10 flex items-center gap-4 shadow-xl"
            >
              {/* Avatar with bright neon green border */}
              <div className="relative shrink-0">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-[#00ff88] ring-4 ring-[#00ff88]/20 bg-zinc-900 shadow-md">
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* User details & Edit pill button */}
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-[22px] font-bold text-white tracking-tight truncate leading-tight">
                  {userName}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 font-normal truncate mt-0.5 mb-2.5">
                  {userEmail}
                </p>

                <button
                  id="btn-edit-profile"
                  onClick={() => {
                    setTempName(userName);
                    setTempEmail(userEmail);
                    setActiveSubView('edit-profile');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/40 text-[#00ff88] text-xs font-semibold tracking-tight transition-all active:scale-95 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Editar perfil</span>
                </button>
              </div>
            </div>

            {/* 2. Options List */}
            <div className="space-y-2.5">
              {/* Instagram */}
              <button
                id="btn-profile-instagram"
                onClick={() => {
                  window.open('https://instagram.com', '_blank');
                }}
                className="w-full p-4 rounded-2xl bg-[#141518] hover:bg-[#1a1c21] active:scale-[0.98] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[#202227] flex items-center justify-center text-pink-400 group-hover:text-pink-300 shrink-0">
                    <Instagram className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                      Instagram
                    </h3>
                    <p className="text-xs text-zinc-400 font-normal mt-0.5">
                      Configurar no ADM
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" />
              </button>

              {/* Grupo e comunidade */}
              <button
                id="btn-profile-community"
                onClick={() => {
                  alert('Comunidade oficial Campos do Jordão: participe dos grupos com dicas em tempo real de turistas e moradores locais!');
                }}
                className="w-full p-4 rounded-2xl bg-[#141518] hover:bg-[#1a1c21] active:scale-[0.98] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[#202227] flex items-center justify-center text-[#00ff88] group-hover:text-emerald-300 shrink-0">
                    <MessageCircle className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                      Grupo e comunidade
                    </h3>
                    <p className="text-xs text-zinc-400 font-normal mt-0.5">
                      Participe da nossa comunidade
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" />
              </button>

              {/* Curtidos */}
              <button
                id="btn-profile-curtidos"
                onClick={() => setActiveSubView('curtidos')}
                className="w-full p-4 rounded-2xl bg-[#141518] hover:bg-[#1a1c21] active:scale-[0.98] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[#202227] flex items-center justify-center text-rose-500 shrink-0">
                    <Heart className="w-5 h-5 fill-rose-500 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                      Curtidos
                    </h3>
                    <p className="text-xs text-zinc-400 font-normal mt-0.5">
                      Lugares que você amou
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center">
                    {favoriteSpots.length}
                  </span>
                  <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                </div>
              </button>

              {/* Permissões */}
              <button
                id="btn-profile-permissoes"
                onClick={() => setActiveSubView('permissoes')}
                className="w-full p-4 rounded-2xl bg-[#141518] hover:bg-[#1a1c21] active:scale-[0.98] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[#202227] flex items-center justify-center text-[#00ff88] shrink-0">
                    <ShieldCheck className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                      Permissões
                    </h3>
                    <p className="text-xs text-zinc-400 font-normal mt-0.5">
                      Privacidade e avisos
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" />
              </button>

              {/* Painel ADM */}
              <button
                id="btn-profile-painel-adm"
                onClick={() => setActiveSubView('painel-adm')}
                className="w-full p-4 rounded-2xl bg-[#141518] hover:bg-[#1a1c21] active:scale-[0.98] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[#202227] flex items-center justify-center text-zinc-300 shrink-0">
                    <Settings className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                      Painel ADM
                    </h3>
                    <p className="text-xs text-zinc-400 font-normal mt-0.5">
                      Console de controle
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" />
              </button>

              {/* logout (Highlighted Red Card from Screenshot) */}
              <button
                id="btn-profile-logout"
                onClick={() => setActiveSubView('logout-confirm')}
                className="w-full p-4 rounded-2xl bg-[#180f12] hover:bg-[#221318] active:scale-[0.98] border border-red-950/50 hover:border-red-900/60 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-red-950/40 flex items-center justify-center text-rose-400 shrink-0">
                    <LogOut className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-rose-400 tracking-tight leading-tight">
                      logout
                    </h3>
                    <p className="text-xs text-rose-400/70 font-normal mt-0.5">
                      Encerrar sessão ativa
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-rose-400/60 group-hover:text-rose-400 transition-colors shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: EDIT PROFILE                                         */}
        {/* ============================================================ */}
        {activeSubView === 'edit-profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-[#141518] border border-white/10 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Nome de usuário
                </label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00ff88]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00ff88]"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSubView('main')}
                className="flex-1 py-3 rounded-full bg-white/10 hover:bg-white/15 text-sm font-semibold text-zinc-300 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-full bg-[#00ff88] hover:bg-[#00e67a] text-black text-sm font-bold transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
              >
                {saveToast ? <Check className="w-4 h-4" /> : null}
                <span>{saveToast ? 'Salvo!' : 'Salvar alterações'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: CURTIDOS (FAVORITES)                                  */}
        {/* ============================================================ */}
        {activeSubView === 'curtidos' && (
          <div className="space-y-3 pt-2 animate-in fade-in duration-200">
            <p className="text-xs text-zinc-400">
              Você tem {favoriteSpots.length} lugares salvos para visitar em Campos do Jordão.
            </p>

            {favoriteSpots.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#141518] border border-white/10 text-zinc-400 text-sm">
                <Heart className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p>Nenhum lugar curtido ainda.</p>
                <p className="text-xs text-zinc-500 mt-1">Toque no coração de qualquer ponto turístico para salvar aqui!</p>
              </div>
            ) : (
              favoriteSpots.map((spot) => (
                <div
                  key={spot.id}
                  onClick={() => {
                    onSelectSpot(spot);
                    onClose();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-[#141518] hover:bg-[#1a1c21] active:scale-[0.98] border border-white/5 hover:border-white/20 transition-all flex items-center justify-between text-left cursor-pointer group shadow-md"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/10">
                      <img
                        src={spot.image}
                        alt={spot.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-[#00ff88] transition-colors">
                        {spot.name}
                      </h4>
                      <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">
                        {spot.categoryLabel}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                        <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {spot.rating}
                        </span>
                        <span>•</span>
                        <span className="truncate">{spot.address.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>

                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 shrink-0 ml-2" />
                </div>
              ))
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 4: PERMISSÕES & PRIVACIDADE                              */}
        {/* ============================================================ */}
        {activeSubView === 'permissoes' && (
          <div className="space-y-3 pt-2 animate-in fade-in duration-200">
            {/* Efeito de Neve */}
            <div className="p-4 rounded-2xl bg-[#141518] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Snowflake className="w-5 h-5 text-sky-400" />
                <div>
                  <div className="text-sm font-bold text-white">Efeito de Neve</div>
                  <div className="text-xs text-zinc-400">Animação suave de flocos caindo no mapa</div>
                </div>
              </div>
              <button
                onClick={onToggleSnow}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  snowEnabled ? 'bg-[#00ff88]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                    snowEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Localização GPS */}
            <div className="p-4 rounded-2xl bg-[#141518] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[#00ff88]" />
                <div>
                  <div className="text-sm font-bold text-white">Localização em Tempo Real</div>
                  <div className="text-xs text-zinc-400">Exibir sua proximidade aos pontos turísticos</div>
                </div>
              </div>
              <button
                onClick={() => setLocationPerm(!locationPerm)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  locationPerm ? 'bg-[#00ff88]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                    locationPerm ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Notificações */}
            <div className="p-4 rounded-2xl bg-[#141518] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-sm font-bold text-white">Alertas de Clima & Frio</div>
                  <div className="text-xs text-zinc-400">Avisos quando a temperatura cair de 10°C</div>
                </div>
              </div>
              <button
                onClick={() => setNotificationsPerm(!notificationsPerm)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  notificationsPerm ? 'bg-[#00ff88]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                    notificationsPerm ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 5: PAINEL ADM                                            */}
        {/* ============================================================ */}
        {activeSubView === 'painel-adm' && (
          <div className="space-y-3 pt-2 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-[#141518] border border-white/10">
              <div className="flex items-center gap-2 mb-2 text-sm font-bold text-white">
                <Sliders className="w-4 h-4 text-[#00ff88]" />
                <span>Console de Controle do Guia</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Gerencie atalhos de redes sociais, status da temporada de inverno e configurações gerais do aplicativo de Campos do Jordão.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#141518] border border-white/10 space-y-3">
              <div className="text-xs font-semibold text-zinc-400">Informações do Sistema</div>
              <div className="flex justify-between text-xs py-1 border-b border-white/5">
                <span className="text-zinc-400">Versão:</span>
                <span className="font-mono text-zinc-200">v2.4.0-campos</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-white/5">
                <span className="text-zinc-400">Pontos cadastrados:</span>
                <span className="font-mono text-zinc-200">{spots.length} atrações</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-zinc-400">IA Turística:</span>
                <span className="text-[#00ff88] font-semibold">Online (Gemini API)</span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 6: LOGOUT CONFIRMATION                                   */}
        {/* ============================================================ */}
        {activeSubView === 'logout-confirm' && (
          <div className="space-y-4 pt-4 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-950/40 text-rose-500 mx-auto flex items-center justify-center border border-red-900/50">
              <LogOut className="w-8 h-8 stroke-[1.8]" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Deseja encerrar a sessão?</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Você poderá entrar novamente a qualquer momento com sua conta mariomeloz@gmail.com.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveSubView('main')}
                className="flex-1 py-3 rounded-full bg-white/10 hover:bg-white/15 text-sm font-semibold text-zinc-300 transition-all cursor-pointer"
              >
                Permanecer
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Sessão encerrada com sucesso!');
                  setActiveSubView('main');
                  onClose();
                }}
                className="flex-1 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all cursor-pointer shadow-lg"
              >
                Sim, sair
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
