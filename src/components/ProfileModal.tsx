import React, { useState, useRef, useEffect } from 'react';
import { Spot } from '../types';
import {
  X,
  Pencil,
  Camera,
  Upload,
  Heart,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Star,
  MapPin,
  Check,
  Sliders,
  Loader2,
  CloudRain,
  Crown,
  AtSign,
  Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InstagramLogo, WhatsAppLogo } from './SocialIcons';
import { PremiumModal } from './PremiumModal';
import { IOSSwitch } from './IOSSwitch';
import { NotificationsModal } from './NotificationsModal';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: string[];
  spots: Spot[];
  onSelectSpot: (spot: Spot) => void;
  rainEnabled?: boolean;
  onToggleRain?: () => void;
  snowEnabled?: boolean;
  onToggleSnow?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
  user: any;
  onUpdateUser?: (updatedUser: any) => void;
  onOpenAdmin?: () => void;
  onSubViewChange?: (subView: SubView) => void;
  communityUrl?: string;
  instagramUrl?: string;
}

type SubView = 'main' | 'edit-profile' | 'curtidos' | 'permissoes' | 'logout-confirm';

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  favorites,
  spots,
  onSelectSpot,
  rainEnabled = true,
  onToggleRain,
  snowEnabled,
  onToggleSnow,
  theme,
  onToggleTheme,
  highContrast = false,
  onToggleHighContrast,
  user,
  onUpdateUser,
  onOpenAdmin,
  onSubViewChange,
  communityUrl = 'https://chat.whatsapp.com/invite/monvian-campos',
  instagramUrl = 'https://instagram.com/monvian.campos'
}) => {
  const getInitialAvatar = (u: any) => {
    if (u?.avatar_url) return u.avatar_url;
    return '/fotoperfil.png';
  };

  const [activeSubView, setActiveSubView] = useState<SubView>('main');
  const handleSetSubView = (subView: SubView) => {
    setActiveSubView(subView);
    onSubViewChange?.(subView);
  };
  const isUserAdmin = Boolean(
    user?.role === 'admin' ||
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes((user?.email || '').trim().toLowerCase())
  );

  // User profile state matching screenshot
  const [userName, setUserName] = useState(user?.name || 'Viajante');
  const [userUsername, setUserUsername] = useState(user?.username || '');
  const [userBio, setUserBio] = useState(user?.bio || '');
  const [userEmail, setUserEmail] = useState(user?.email || user?.whatsapp || '');
  const [userAvatar, setUserAvatar] = useState(getInitialAvatar(user));
  const [tempAvatar, setTempAvatar] = useState(getInitialAvatar(user));

  // Form states for editing profile
  const [tempName, setTempName] = useState(userName);
  const [tempUsername, setTempUsername] = useState(user?.username || '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [usernameFeedback, setUsernameFeedback] = useState('');
  const [tempBio, setTempBio] = useState(user?.bio || '');
  const [tempEmail, setTempEmail] = useState(userEmail);
  const [saveToast, setSaveToast] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const checkUsernameTimerRef = useRef<any>(null);

  useEffect(() => {
    if (user) {
      setUserName(user.name || 'Viajante');
      setUserUsername(user.username || '');
      setUserBio(user.bio || '');
      setUserEmail(user.email || user.whatsapp || '');
      const av = getInitialAvatar(user);
      setUserAvatar(av);
      setTempAvatar(av);
      setTempName(user.name || 'Viajante');
      setTempUsername(user.username || '');
      setTempBio(user.bio || '');
      setTempEmail(user.email || user.whatsapp || '');
    }
  }, [user]);

  // Real-time verification of username availability in database
  useEffect(() => {
    if (activeSubView !== 'edit-profile') return;
    const clean = tempUsername.trim().replace(/^@+/, '');

    if (!clean) {
      setUsernameStatus('idle');
      setUsernameFeedback('');
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus('unavailable');
      setUsernameFeedback('Nome de usuário indisponível (mínimo 3 caracteres)');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameStatus('unavailable');
      setUsernameFeedback('Nome de usuário indisponível (use apenas letras, números e _)');
      return;
    }

    // If same as current user's username
    if (user?.username && clean.toLowerCase() === user.username.toLowerCase()) {
      setUsernameStatus('available');
      setUsernameFeedback('Nome de usuário disponível');
      return;
    }

    setUsernameStatus('checking');
    setUsernameFeedback('Verificando disponibilidade...');

    if (checkUsernameTimerRef.current) clearTimeout(checkUsernameTimerRef.current);
    checkUsernameTimerRef.current = setTimeout(async () => {
      try {
        const userIdParam = user?.id ? `&currentUserId=${encodeURIComponent(user.id)}` : '';
        const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(clean)}${userIdParam}`);
        const data = await res.json();
        if (data.available) {
          setUsernameStatus('available');
          setUsernameFeedback('Nome de usuário disponível');
        } else {
          setUsernameStatus('unavailable');
          setUsernameFeedback('Nome de usuário indisponível');
        }
      } catch {
        setUsernameStatus('idle');
        setUsernameFeedback('');
      }
    }, 350);

    return () => {
      if (checkUsernameTimerRef.current) clearTimeout(checkUsernameTimerRef.current);
    };
  }, [tempUsername, activeSubView, user]);

  // Persistent settings states
  const [locationPerm, setLocationPerm] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_location_perm');
    return saved !== null ? saved === 'true' : true;
  });

  const [proximityAlerts, setProximityAlerts] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_proximity_alerts');
    return saved !== null ? saved === 'true' : true;
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleLocation = (val: boolean) => {
    setLocationPerm(val);
    localStorage.setItem('monvian_location_perm', String(val));
    if (val && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }
  };

  const handleToggleProximity = (val: boolean) => {
    setProximityAlerts(val);
    localStorage.setItem('monvian_proximity_alerts', String(val));
  };

  const handleToggleSound = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem('monvian_sound_enabled', String(val));
    if (val) {
      localStorage.removeItem('monvian_sound_disabled');
    } else {
      localStorage.setItem('monvian_sound_disabled', 'true');
    }
  };

  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const cleanUserEmail = (user?.email || user?.whatsapp || '').trim().toLowerCase();
  const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanUserEmail);
  const isPremiumUser = isGoldAdmin || Boolean(user?.isGold || user?.is_gold === 1 || user?.isPremium || user?.is_premium === 1);

  if (!isOpen) return null;

  if (activeSubView === 'permissoes') {
    return (
      <div
        id="ios-settings-screen"
        className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none transition-colors duration-200 rounded-t-[26px] ios-page-top-rounded ${
          theme === 'dark' ? 'bg-black text-white' : 'bg-white text-zinc-900'
        }`}
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
          paddingTop: 'max(14px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          borderTopLeftRadius: '26px',
          borderTopRightRadius: '26px',
          overflow: 'hidden',
        }}
      >
        {/* Top iOS Navigation Bar with Back Button and Centered Large Title */}
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 relative z-30">
          <button
            type="button"
            id="btn-back-settings"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSetSubView('main');
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSetSubView('main');
            }}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-zinc-100 dark:bg-[#1c1c1e] hover:bg-zinc-200 dark:hover:bg-[#2c2c2e] active:scale-95 text-zinc-900 dark:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs border border-black/5 dark:border-white/10 shrink-0 pointer-events-auto z-40"
            title="Voltar ao Perfil"
            aria-label="Voltar ao Perfil"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight text-center">
            Configurações
          </h1>

          {/* Symmetrical placeholder for exact center alignment */}
          <div className="w-10 h-10 pointer-events-none shrink-0" />
        </div>

        {/* Scrollable Settings Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 max-w-2xl mx-auto w-full pt-2 pb-16">

          {/* SEÇÃO 1: EFEITOS DO MAPA */}
          <div className="mb-7">
            <h2 className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#8e8e93] px-2 mb-2">
              Efeitos do Mapa
            </h2>
            <div className="space-y-3">
              <div>
                <div className="p-4 sm:p-4.5 rounded-[16px] bg-[#f2f2f7] dark:bg-[#1c1c1e] flex items-center justify-between transition-colors">
                  <span className="text-[17px] sm:text-[18px] font-semibold text-zinc-900 dark:text-white leading-tight pr-4">
                    Efeito de chuva
                  </span>
                  <IOSSwitch
                    id="toggle-rain-effect"
                    ariaLabel="Efeito de chuva"
                    checked={rainEnabled}
                    onChange={() => onToggleRain && onToggleRain()}
                  />
                </div>
                <p className="text-[13px] sm:text-[14px] font-normal text-zinc-500 dark:text-[#8e8e93] px-2 pt-1.5 leading-relaxed">
                  Mostra uma animação de chuva sobre o mapa quando estiver chovendo.
                </p>
              </div>

              <div>
                <div className="p-4 sm:p-4.5 rounded-[16px] bg-[#f2f2f7] dark:bg-[#1c1c1e] flex items-center justify-between transition-colors">
                  <span className="text-[17px] sm:text-[18px] font-semibold text-zinc-900 dark:text-white leading-tight pr-4">
                    Efeito de neve
                  </span>
                  <IOSSwitch
                    id="toggle-snow-effect"
                    ariaLabel="Efeito de neve"
                    checked={Boolean(snowEnabled)}
                    onChange={() => onToggleSnow && onToggleSnow()}
                  />
                </div>
                <p className="text-[13px] sm:text-[14px] font-normal text-zinc-500 dark:text-[#8e8e93] px-2 pt-1.5 leading-relaxed">
                  Mostra partículas de neve caindo sobre as montanhas e picos da cidade.
                </p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: PRIVACIDADE */}
          <div className="mb-7">
            <h2 className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#8e8e93] px-2 mb-2">
              Privacidade
            </h2>
            <div className="space-y-3">
              <div>
                <div className="p-4 sm:p-4.5 rounded-[16px] bg-[#f2f2f7] dark:bg-[#1c1c1e] flex items-center justify-between transition-colors">
                  <span className="text-[17px] sm:text-[18px] font-semibold text-zinc-900 dark:text-white leading-tight pr-4">
                    Localização em Tempo Real
                  </span>
                  <IOSSwitch
                    id="toggle-location-perm"
                    ariaLabel="Localização em Tempo Real"
                    checked={locationPerm}
                    onChange={handleToggleLocation}
                  />
                </div>
                <p className="text-[13px] sm:text-[14px] font-normal text-zinc-500 dark:text-[#8e8e93] px-2 pt-1.5 leading-relaxed">
                  Exibir sua proximidade aos pontos turísticos.
                </p>
              </div>

              <div>
                <div className="p-4 sm:p-4.5 rounded-[16px] bg-[#f2f2f7] dark:bg-[#1c1c1e] flex items-center justify-between transition-colors">
                  <span className="text-[17px] sm:text-[18px] font-semibold text-zinc-900 dark:text-white leading-tight pr-4">
                    Alertas de Proximidade
                  </span>
                  <IOSSwitch
                    id="toggle-proximity-alerts"
                    ariaLabel="Alertas de Proximidade"
                    checked={proximityAlerts}
                    onChange={handleToggleProximity}
                  />
                </div>
                <p className="text-[13px] sm:text-[14px] font-normal text-zinc-500 dark:text-[#8e8e93] px-2 pt-1.5 leading-relaxed">
                  Avisar quando você estiver a menos de 200m de uma atração recomendada.
                </p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: APARÊNCIA */}
          <div className="mb-7">
            <h2 className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#8e8e93] px-2 mb-2">
              Aparência
            </h2>
            <div className="space-y-3">
              <div>
                <div className="p-4 sm:p-4.5 rounded-[16px] bg-[#f2f2f7] dark:bg-[#1c1c1e] flex items-center justify-between transition-colors">
                  <span className="text-[17px] sm:text-[18px] font-semibold text-zinc-900 dark:text-white leading-tight pr-4">
                    Modo Escuro
                  </span>
                  <IOSSwitch
                    id="toggle-dark-theme"
                    ariaLabel="Modo Escuro"
                    checked={theme === 'dark'}
                    onChange={() => onToggleTheme && onToggleTheme()}
                  />
                </div>
                <p className="text-[13px] sm:text-[14px] font-normal text-zinc-500 dark:text-[#8e8e93] px-2 pt-1.5 leading-relaxed">
                  Alternar entre o visual escuro e claro em todo o aplicativo.
                </p>
              </div>

              <div>
                <div className="p-4 sm:p-4.5 rounded-[16px] bg-[#f2f2f7] dark:bg-[#1c1c1e] flex items-center justify-between transition-colors">
                  <span className="text-[17px] sm:text-[18px] font-semibold text-zinc-900 dark:text-white leading-tight pr-4">
                    Alto Contraste
                  </span>
                  <IOSSwitch
                    id="toggle-high-contrast-mode"
                    ariaLabel="Alto Contraste"
                    checked={Boolean(highContrast)}
                    onChange={() => onToggleHighContrast && onToggleHighContrast()}
                  />
                </div>
                <p className="text-[13px] sm:text-[14px] font-normal text-zinc-500 dark:text-[#8e8e93] px-2 pt-1.5 leading-relaxed">
                  Aumentar a nitidez de linhas e elementos para maior visibilidade.
                </p>
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: ÁUDIO E RETORNO */}
          <div className="mb-8">
            <h2 className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#8e8e93] px-2 mb-2">
              Áudio e Retorno
            </h2>
            <div className="space-y-3">
              <div>
                <div className="p-4 sm:p-4.5 rounded-[16px] bg-[#f2f2f7] dark:bg-[#1c1c1e] flex items-center justify-between transition-colors">
                  <span className="text-[17px] sm:text-[18px] font-semibold text-zinc-900 dark:text-white leading-tight pr-4">
                    Efeitos Sonoros
                  </span>
                  <IOSSwitch
                    id="toggle-sound-effects"
                    ariaLabel="Efeitos Sonoros"
                    checked={soundEnabled}
                    onChange={handleToggleSound}
                  />
                </div>
                <p className="text-[13px] sm:text-[14px] font-normal text-zinc-500 dark:text-[#8e8e93] px-2 pt-1.5 leading-relaxed">
                  Reproduzir sons suaves de confirmação e navegação no app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const favoriteSpots = spots.filter((s) => favorites.includes(s.id));

  // Image resize and base64 helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecione uma imagem válida (JPEG, PNG ou WEBP).');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setTempAvatar(compressedBase64);
          setUserAvatar(compressedBase64);
          
          // Auto-sync if uploaded from main view
          saveProfileToBackend(userName, userUsername, userBio, userEmail, compressedBase64);
        }
        setIsUploading(false);
      };
      img.onerror = () => {
        setIsUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveProfileToBackend = async (name: string, usernameStr: string, bioStr: string, emailOrWhatsapp: string, avatar: string): Promise<boolean> => {
    const token = localStorage.getItem('monvian_token');
    if (!token) return false;

    setSaveError('');
    try {
      const cleanUsername = usernameStr.trim().replace(/^@+/, '');
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          username: cleanUsername,
          bio: bioStr.trim(),
          email: emailOrWhatsapp.trim(),
          whatsapp: emailOrWhatsapp.trim(),
          avatar_url: avatar
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveError(data.error || 'Erro ao salvar alterações.');
        return false;
      }
      if (data.success && data.user) {
        localStorage.setItem('monvian_user', JSON.stringify(data.user));
        setUserUsername(data.user.username || cleanUsername);
        setUserBio(data.user.bio || bioStr);
        if (onUpdateUser) {
          onUpdateUser(data.user);
        }
        return true;
      }
      return true;
    } catch (err) {
      console.error('Error saving user profile:', err);
      setSaveError('Erro de conexão ao salvar.');
      return false;
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');

    const cleanUsername = tempUsername.trim().replace(/^@+/, '');
    if (!cleanUsername) {
      setSaveError('O nome de usuário é obrigatório.');
      return;
    }

    if (usernameStatus === 'unavailable') {
      setSaveError('Nome de usuário indisponível. Escolha outro.');
      return;
    }

    const finalName = tempName.trim() || userName;
    const finalEmail = tempEmail.trim() || userEmail;
    const finalAvatar = tempAvatar || userAvatar;
    const finalBio = tempBio.trim();

    const ok = await saveProfileToBackend(finalName, cleanUsername, finalBio, finalEmail, finalAvatar);
    if (!ok) return;

    setUserName(finalName);
    setUserUsername(cleanUsername);
    setUserBio(finalBio);
    setUserEmail(finalEmail);
    setUserAvatar(finalAvatar);

    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      handleSetSubView('main');
    }, 800);
  };

  return (
    <div
      id="profile-fullscreen-overlay"
      onClick={onClose}
      className="fixed inset-0 z-45 flex flex-col justify-end md:justify-center md:items-center md:p-6 select-none overflow-hidden transition-colors duration-300 md:bg-black/50 md:backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-full md:h-[88vh] md:max-w-2xl bg-zinc-50 dark:bg-[#000000] md:dark:ios-glass text-zinc-900 dark:text-white rounded-t-[26px] md:rounded-[32px] overflow-hidden flex flex-col justify-between shadow-2xl md:border md:border-black/10 md:dark:border-white/15 ios-page-top-rounded"
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          borderTopLeftRadius: '26px',
          borderTopRightRadius: '26px',
          overflow: 'hidden',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        }}
      >
      {/* Top Header Bar identical to screenshot */}
      <div
        className="px-5 sm:px-6 pb-3 flex items-center justify-between z-10 shrink-0"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 14px), 24px)',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center gap-3">
          {activeSubView !== 'main' ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              id="btn-back-profile-main"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSetSubView('main');
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSetSubView('main');
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-zinc-200/80 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-black dark:text-white flex items-center justify-center transition-colors cursor-pointer mr-1 pointer-events-auto z-40"
              title="Voltar ao Perfil"
              aria-label="Voltar ao Perfil"
            >
              <ArrowLeft
                className="w-5 h-5 stroke-[2.2] text-black dark:text-white"
                style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
              />
            </motion.button>
          ) : null}

          <h1 className="text-2xl sm:text-[28px] font-black text-zinc-900 dark:text-white tracking-tight">
            {activeSubView === 'main' && 'Perfil'}
            {activeSubView === 'edit-profile' && 'Editar Perfil'}
            {activeSubView === 'curtidos' && 'Lugares Curtidos'}

            {activeSubView === 'logout-confirm' && 'Encerrar Sessão'}
          </h1>
        </div>

        {activeSubView === 'main' ? (
          <button
            type="button"
            onClick={() => setIsNotificationsOpen(true)}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors cursor-pointer shadow-xs"
            title="Notificações"
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5 stroke-[2]" />
          </button>
        ) : null}
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-8 max-w-3xl mx-auto w-full flex flex-col"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 32px) + 200px)',
        }}
      >
        {/* Hidden File Input for Avatar Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png, image/jpeg, image/webp, image/jpg"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* ============================================================ */}
        {/* VIEW 1: MAIN PROFILE (Exact Match to Screenshot)            */}
        {/* ============================================================ */}
        {activeSubView === 'main' && (
          <div className="space-y-4 pt-2 pb-12">
            {/* 1. Main Profile Card (Airbnb Style) */}
            <div
              onClick={() => {
                setTempName(userName);
                setTempUsername(userUsername);
                setTempBio(userBio);
                setTempEmail(userEmail);
                setTempAvatar(userAvatar);
                setUsernameStatus('idle');
                setUsernameFeedback('');
                setSaveError('');
                handleSetSubView('edit-profile');
              }}
              className="w-full p-6 rounded-[32px] bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 shadow-xs flex flex-col items-center text-center cursor-pointer group active:scale-[0.98] transition-all"
            >
              <div className="relative mb-3.5">
                {userAvatar && !userAvatar.endsWith('fotoperfil.png') ? (
                  <div className="w-28 h-28 rounded-full overflow-hidden shadow-md bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-800">
                    <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-full bg-[#EBE9F9] dark:bg-[#2c283c] text-[#5851DB] dark:text-[#a29bfd] text-4xl font-bold flex items-center justify-center shadow-md border-2 border-white dark:border-zinc-800">
                    {(userName || 'Mario').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <h2 className="text-2xl sm:text-[26px] font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
                {userName || 'Mario'}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                Viajante
              </p>
            </div>

            {/* 2. Feature Cards Grid (2 per row: Viagens anteriores & Conexões) */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Viagens anteriores */}
              <div
                onClick={() => {
                  handleSetSubView('curtidos');
                }}
                className="bg-white dark:bg-[#1c1c1e] rounded-[24px] p-4 border border-black/5 dark:border-white/10 shadow-xs flex flex-col justify-between relative cursor-pointer active:scale-[0.98] transition-transform group"
              >
                <div className="flex justify-end">
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[9.5px] font-bold uppercase tracking-wider shadow-xs">
                    NOVO
                  </span>
                </div>
                <div className="my-2 flex justify-center">
                  <span className="text-[40px] leading-none drop-shadow-xs">
                    🧳
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">
                    Viagens anteriores
                  </h3>
                </div>
              </div>

              {/* Conexões */}
              <div
                onClick={() => {
                  window.open(communityUrl, '_blank');
                }}
                className="bg-white dark:bg-[#1c1c1e] rounded-[24px] p-4 border border-black/5 dark:border-white/10 shadow-xs flex flex-col justify-between relative cursor-pointer active:scale-[0.98] transition-transform group"
              >
                <div className="flex justify-end">
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[9.5px] font-bold uppercase tracking-wider shadow-xs">
                    NOVO
                  </span>
                </div>
                <div className="my-2 flex justify-center">
                  <span className="text-[40px] leading-none drop-shadow-xs">
                    👥
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">
                    Conexões
                  </h3>
                </div>
              </div>
            </div>

            {/* 3. Horizontal Promotional Card ("Torne-se um anfitrião") */}
            <div
              onClick={() => {
                setIsPremiumModalOpen(true);
              }}
              className="bg-white dark:bg-[#1c1c1e] rounded-[24px] p-4.5 border border-black/5 dark:border-white/10 shadow-xs flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform group"
            >
              <div className="shrink-0 flex items-center justify-center text-[40px] leading-none pl-1">
                🏡
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
                  Torne-se um anfitrião
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">
                  É fácil começar a receber viajantes e ganhar uma renda extra.
                </p>
              </div>
            </div>

            {/* 4. Options List ("Configurações da conta", "Obtenha ajuda", "Sair da conta") */}
            <div className="space-y-3 pt-2">
              {isUserAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdmin?.();
                  }}
                  className="w-full p-4 rounded-3xl bg-white dark:bg-[#1c1c1e] hover:bg-zinc-50 dark:hover:bg-[#252528] active:scale-[0.98] border border-black/5 dark:border-white/10 transition-all flex items-center justify-between text-left cursor-pointer group shadow-xs"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 flex items-center justify-center text-indigo-500 shrink-0 bg-transparent border-0">
                      <ShieldCheck className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-indigo-500 dark:text-indigo-400 tracking-tight leading-tight">
                        Painel ADM
                      </h3>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors shrink-0" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSetSubView('permissoes')}
                className="w-full p-4 rounded-3xl bg-white dark:bg-[#1c1c1e] hover:bg-zinc-50 dark:hover:bg-[#252528] active:scale-[0.98] border border-black/5 dark:border-white/10 transition-all flex items-center justify-between text-left cursor-pointer group shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 flex items-center justify-center text-zinc-900 dark:text-white shrink-0 bg-transparent border-0 relative">
                    <Settings className="w-6 h-6 stroke-[1.8]" />
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF3B30] border-2 border-white dark:border-[#1c1c1e]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
                      Configurações da conta
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(communityUrl, '_blank');
                }}
                className="w-full p-4 rounded-3xl bg-white dark:bg-[#1c1c1e] hover:bg-zinc-50 dark:hover:bg-[#252528] active:scale-[0.98] border border-black/5 dark:border-white/10 transition-all flex items-center justify-between text-left cursor-pointer group shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 flex items-center justify-center text-zinc-900 dark:text-white shrink-0 bg-transparent border-0">
                    <Star className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
                      Obtenha ajuda
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleSetSubView('logout-confirm')}
                className="w-full p-4 rounded-3xl bg-white dark:bg-[#1c1c1e] hover:bg-zinc-50 dark:hover:bg-[#252528] active:scale-[0.98] border border-black/5 dark:border-white/10 transition-all flex items-center justify-between text-left cursor-pointer group shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 flex items-center justify-center text-rose-500 shrink-0 bg-transparent border-0">
                    <LogOut className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-rose-500 dark:text-rose-400 tracking-tight leading-tight">
                      Sair da conta
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: EDIT PROFILE                                         */}
        {/* ============================================================ */}
        {activeSubView === 'edit-profile' && (
          <div className="flex-1 flex flex-col justify-center my-auto w-full max-w-md mx-auto py-4">
            <form onSubmit={handleSaveProfile} className="space-y-4 w-full">
              <div className="p-5 rounded-3xl bg-white dark:bg-[#141518] border border-zinc-200 dark:border-white/10 space-y-4 shadow-sm">
                {/* Avatar Selector and Preview */}
                <div className="flex flex-col items-center justify-center pb-2 pt-1">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white ring-4 ring-white/20 bg-zinc-100 dark:bg-zinc-900 shadow-lg relative">
                      <img
                        src={tempAvatar || userAvatar}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Carregar imagem"
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-lg border-2 border-zinc-200 dark:border-white/20 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 text-xs font-black text-zinc-900 dark:text-white hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Escolher foto do dispositivo</span>
                  </button>
                </div>

                {/* Nome de Exibição */}
                <div>
                  <label className="block text-xs font-black text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Nome
                  </label>
                  <input
                    type="text"
                    placeholder="Seu nome (ex: Mariana Silva)"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                    required
                  />
                </div>

                {/* Nome de Usuário com validação em tempo real */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-zinc-500 dark:text-zinc-400">
                      Nome de usuário
                    </label>
                    {usernameStatus === 'checking' && (
                      <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Verificando...
                      </span>
                    )}
                    {usernameStatus === 'available' && (
                      <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        Nome de usuário disponível
                      </span>
                    )}
                    {usernameStatus === 'unavailable' && (
                      <span className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
                        <X className="w-3 h-3 stroke-[2.5]" />
                        Nome de usuário indisponível
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm pointer-events-none select-none">
                      @
                    </div>
                    <input
                      type="text"
                      placeholder="marianasilva"
                      value={tempUsername}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
                        setTempUsername(clean);
                      }}
                      className={`w-full pl-8 pr-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border text-zinc-900 dark:text-white text-sm focus:outline-none transition-colors ${
                        usernameStatus === 'available'
                          ? 'border-emerald-500/80 focus:border-emerald-500'
                          : usernameStatus === 'unavailable'
                          ? 'border-rose-500/80 focus:border-rose-500'
                          : 'border-zinc-200 dark:border-white/10 focus:border-zinc-900 dark:focus:border-white'
                      }`}
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  {usernameFeedback && (
                    <p className={`text-[11.5px] font-semibold mt-1 px-1 ${
                      usernameStatus === 'available' ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {usernameFeedback}
                    </p>
                  )}
                </div>

                {/* Biografia */}
                <div>
                  <label className="block text-xs font-black text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Biografia
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Conte sobre sua paixão por viajar e explorar Campos..."
                    value={tempBio}
                    onChange={(e) => setTempBio(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-500 dark:text-zinc-400 mb-1.5">
                    E-mail de acesso
                  </label>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={tempEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                    required
                  />
                </div>

                {saveError && (
                  <p className="text-xs text-rose-500 font-bold px-1 text-center">
                    {saveError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSetSubView('main')}
                  className="flex-1 py-3 rounded-full bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/15 text-sm font-black text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 text-sm font-black transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
                >
                  {saveToast ? <Check className="w-4 h-4" /> : null}
                  <span>{saveToast ? 'Salvo!' : 'Salvar alterações'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: CURTIDOS (FAVORITES)                                  */}
        {/* ============================================================ */}
        {activeSubView === 'curtidos' && (
          <div className={`pt-2 ${favoriteSpots.length === 0 ? 'flex-1 flex flex-col justify-center min-h-[65vh]' : 'space-y-3.5'}`}>
            {favoriteSpots.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-zinc-500 dark:text-zinc-400">
                <Heart className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="font-bold text-zinc-700 dark:text-zinc-200 text-base">Nenhum lugar curtido ainda.</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto">
                  Toque no coração de qualquer ponto turístico para salvar aqui!
                </p>
              </div>
            ) : (
              favoriteSpots.map((spot) => (
                <div
                  key={spot.id}
                  onClick={() => {
                    onSelectSpot(spot);
                    onClose();
                  }}
                  className="w-full p-4.5 sm:p-5 rounded-[28px] bg-white dark:bg-[#141518] hover:bg-zinc-50 dark:hover:bg-[#1a1c21] active:scale-[0.98] border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm dark:shadow-md"
                >
                  <div className="flex items-center gap-4 sm:gap-4.5 min-w-0 flex-1">
                    <div className="w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-[20px] overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-white/10">
                      <img
                        src={spot.image}
                        alt={spot.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-[16.5px] sm:text-[17px] font-bold text-zinc-900 dark:text-white tracking-tight truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                        {spot.name}
                      </h4>
                      <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                        {spot.categoryLabel}
                      </p>
                      <div className="flex items-center gap-2 text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                        <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-500 dark:fill-amber-400" />
                          {spot.rating}
                        </span>
                        <span>•</span>
                        <span className="truncate">{spot.address.split(',')[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div className="h-16 shrink-0" />
          </div>
        )}





        {/* ============================================================ */}
        {/* VIEW 7: LOGOUT CONFIRMATION                                   */}
        {/* ============================================================ */}
        {activeSubView === 'logout-confirm' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto w-full max-w-sm mx-auto py-8">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-rose-100/90 dark:bg-red-950/40 text-rose-500 flex items-center justify-center border border-rose-200/80 dark:border-red-900/50 mb-6 shadow-sm">
              <LogOut className="w-9 h-9 stroke-[2] translate-x-0.5" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2.5 mb-8">
              <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                Deseja encerrar a sessão?
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                Você poderá entrar novamente a qualquer momento com sua conta {userEmail}.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                id="btn-logout-cancel"
                onClick={() => handleSetSubView('main')}
                className="flex-1 py-3.5 rounded-2xl bg-zinc-200/80 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/15 text-sm font-bold text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer active:scale-95"
              >
                Permanecer
              </button>
              <button
                type="button"
                id="btn-logout-confirm"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('monvian_token');
                    if (token) {
                      await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                    }
                  } catch (e) {}
                  localStorage.removeItem('monvian_token');
                  localStorage.removeItem('monvian_user');
                  localStorage.removeItem('monvian_active_itinerary');
                  localStorage.removeItem('monvian_itinerary_session');
                  window.location.reload();
                }}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all cursor-pointer shadow-lg shadow-red-500/25 active:scale-95"
              >
                Sim, sair
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Monvian Premium Modal */}
      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        theme={theme}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notificationsList}
        isLoading={isLoadingNotifications}
        theme={theme}
        onMarkAllAsRead={() => {
          setNotificationsList(prev => prev.map(n => ({ ...n, is_read: 1 })));
        }}
      />
      </div>
    </div>
  );
};
