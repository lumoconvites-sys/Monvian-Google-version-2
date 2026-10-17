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
  ArrowLeft,
  Star,
  MapPin,
  Check,
  Sliders,
  Loader2,
  CloudRain,
  Snowflake,
  Moon,
  Sun,
  Bell,
  Volume2,
  ExternalLink,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InstagramLogo, WhatsAppLogo } from './SocialIcons';
import { PremiumModal } from './PremiumModal';
import { IOSSwitch } from './IOSSwitch';
import { NotificationsModal } from './NotificationsModal';
import { persistUserToFirestore } from '../services/firestoreSync';

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
  onOpenHostDashboard?: () => void;
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
  rainEnabled = false,
  onToggleRain,
  snowEnabled = false,
  onToggleSnow,
  theme,
  onToggleTheme,
  highContrast = false,
  onToggleHighContrast,
  user,
  onUpdateUser,
  onOpenAdmin,
  onOpenHostDashboard,
  onSubViewChange,
  communityUrl = 'https://chat.whatsapp.com/invite/monvian-campos',
  instagramUrl = 'https://instagram.com/monvian.campos',
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

  const cleanUserEmail = (user?.email || user?.whatsapp || '').trim().toLowerCase();
  const isUserAdmin = Boolean(
    user?.role === 'admin' ||
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanUserEmail)
  );

  // User profile state
  const [userName, setUserName] = useState(user?.name || 'Mario Yesk');
  const [userUsername, setUserUsername] = useState(user?.username || 'marioyesk');
  const [userBio, setUserBio] = useState(user?.bio || '');
  const [userEmail, setUserEmail] = useState(user?.email || user?.whatsapp || 'marioyesk@gmail.com');
  const [userAvatar, setUserAvatar] = useState(getInitialAvatar(user));
  const [tempAvatar, setTempAvatar] = useState(getInitialAvatar(user));

  // Form states for editing profile
  const [tempName, setTempName] = useState(userName);
  const [tempUsername, setTempUsername] = useState(userUsername);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [usernameFeedback, setUsernameFeedback] = useState('');
  const [tempBio, setTempBio] = useState(userBio);
  const [tempEmail, setTempEmail] = useState(userEmail);
  const [saveToast, setSaveToast] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const checkUsernameTimerRef = useRef<any>(null);

  useEffect(() => {
    if (user) {
      setUserName(user.name || 'Mario Yesk');
      setUserUsername(user.username || 'marioyesk');
      setUserBio(user.bio || '');
      setUserEmail(user.email || user.whatsapp || 'marioyesk@gmail.com');
      const av = getInitialAvatar(user);
      setUserAvatar(av);
      setTempAvatar(av);
      setTempName(user.name || 'Mario Yesk');
      setTempUsername(user.username || 'marioyesk');
      setTempBio(user.bio || '');
      setTempEmail(user.email || user.whatsapp || 'marioyesk@gmail.com');
    }
  }, [user]);

  // Real-time verification of username availability
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
      setUsernameFeedback('Mínimo 3 caracteres');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameStatus('unavailable');
      setUsernameFeedback('Apenas letras, números e _');
      return;
    }

    if (user?.username && clean.toLowerCase() === user.username.toLowerCase()) {
      setUsernameStatus('available');
      setUsernameFeedback('Nome de usuário disponível');
      return;
    }

    setUsernameStatus('checking');
    setUsernameFeedback('Verificando...');

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

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const favoriteSpots = spots.filter((s) => favorites.includes(s.id));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida (JPEG, PNG ou WEBP).');
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
          saveProfileToBackend(userName, userUsername, userBio, userEmail, compressedBase64);
        }
        setIsUploading(false);
      };
      img.onerror = () => setIsUploading(false);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveProfileToBackend = async (
    name: string,
    usernameStr: string,
    bioStr: string,
    emailOrWhatsapp: string,
    avatar: string
  ): Promise<boolean> => {
    const token = localStorage.getItem('monvian_token');
    setSaveError('');
    try {
      const cleanUsername = usernameStr.trim().replace(/^@+/, '');
      if (token) {
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            username: cleanUsername,
            bio: bioStr.trim(),
            email: emailOrWhatsapp.trim(),
            whatsapp: emailOrWhatsapp.trim(),
            avatar_url: avatar,
          }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('monvian_user', JSON.stringify(data.user));
          if (onUpdateUser) onUpdateUser(data.user);
        }
      }

      await persistUserToFirestore({
        ...user,
        name: name.trim(),
        username: cleanUsername,
        bio: bioStr.trim(),
        email: emailOrWhatsapp.trim(),
        avatar_url: avatar,
        password_hash: user?.password_hash || '',
        role: user?.role || 'user',
      });

      return true;
    } catch (err) {
      console.error('Error saving user profile:', err);
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

    await saveProfileToBackend(finalName, cleanUsername, finalBio, finalEmail, finalAvatar);

    setUserName(finalName);
    setUserUsername(cleanUsername);
    setUserBio(finalBio);
    setUserEmail(finalEmail);
    setUserAvatar(finalAvatar);

    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      handleSetSubView('main');
    }, 600);
  };

  return (
    <AnimatePresence>
      <motion.div
        id="profile-fullscreen-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={onClose}
        className="fixed inset-0 z-45 flex flex-col justify-end md:justify-center md:items-center md:p-6 select-none overflow-hidden transition-colors duration-300 md:bg-black/50 md:backdrop-blur-xs"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full h-full md:h-[88vh] md:max-w-2xl rounded-none overflow-hidden flex flex-col justify-between shadow-2xl transition-colors duration-300 md:border ${
            isDark
              ? 'bg-[#000000] text-white md:border-white/10'
              : 'bg-[#F2F2F7] text-zinc-900 md:border-black/10'
          }`}
          style={{
            fontFamily: "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
            borderTopLeftRadius: '30px',
            borderTopRightRadius: '30px',
            overflow: 'hidden',
            willChange: 'opacity, transform',
          }}
        >
        {/* Top Header Bar */}
        <div
          className="px-5 sm:px-6 pb-2 flex items-center justify-between z-10 shrink-0"
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 20px)',
            paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
          }}
        >
          <div className="flex items-center gap-3">
            {activeSubView !== 'main' ? (
              <button
                type="button"
                onClick={() => handleSetSubView('main')}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-black/5 hover:bg-black/10 text-black'
                }`}
                title="Voltar"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
              </button>
            ) : null}

            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">
              {activeSubView === 'main' && 'Perfil'}
              {activeSubView === 'edit-profile' && 'Editar Perfil'}
              {activeSubView === 'curtidos' && 'Lugares Curtidos'}
              {activeSubView === 'permissoes' && 'Configurações'}
              {activeSubView === 'logout-confirm' && 'Encerrar Sessão'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {activeSubView === 'main' && (
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(true)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-2xs'
                }`}
                title="Notificações"
                aria-label="Notificações"
              >
                <Bell className="w-5 h-5 stroke-[2]" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-2xs'
              }`}
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7 max-w-3xl mx-auto w-full flex flex-col"
          style={{
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 24px) + 90px)',
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
          {/* VIEW 1: MAIN PROFILE (Clean Native Airbnb / iOS Design)       */}
          {/* ============================================================ */}
          {activeSubView === 'main' && (
            <div className="space-y-4 pt-1 pb-6">
              {/* 1. Main Profile Card */}
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
                className={`w-full p-5 sm:p-6 rounded-[28px] border transition-all cursor-pointer group active:scale-[0.98] flex flex-col items-center text-center ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 shadow-xs'
                    : 'bg-white border-black/5 shadow-xs'
                }`}
              >
                <div className="relative mb-3">
                  <div className={`w-24 h-24 sm:w-26 sm:h-26 rounded-full overflow-hidden shadow-md border-2 ${
                    isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-white'
                  }`}>
                    {userAvatar && !userAvatar.endsWith('fotoperfil.png') ? (
                      <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#EBE9F9] dark:bg-[#2C283C] text-[#5851DB] dark:text-[#A29BFD] text-3xl font-bold flex items-center justify-center">
                        {(userName || 'M').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {userName || 'Mario Yesk'}
                </h2>
                {userUsername && (
                  <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                    @{userUsername}
                  </p>
                )}
              </div>

              {/* 2. Feature Cards Grid (Viagens anteriores & Conexões) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                {/* Viagens anteriores */}
                <div
                  onClick={() => handleSetSubView('curtidos')}
                  className={`rounded-[24px] p-4 border transition-transform cursor-pointer active:scale-[0.98] flex flex-col justify-between ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-white border-black/5 shadow-xs'
                  }`}
                >
                  <div className="flex justify-end">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[9px] font-bold uppercase tracking-wider">
                      NOVO
                    </span>
                  </div>
                  <div className="my-2 flex justify-center items-center h-[46px]">
                    <img src="/lugares.png" alt="Viagens anteriores" className="h-[64px] w-auto object-contain" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight leading-snug">
                      Viagens anteriores
                    </h3>
                  </div>
                </div>

                {/* Conexões */}
                <div
                  onClick={() => window.open(communityUrl, '_blank')}
                  className={`rounded-[24px] p-4 border transition-transform cursor-pointer active:scale-[0.98] flex flex-col justify-between ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-white border-black/5 shadow-xs'
                  }`}
                >
                  <div className="flex justify-end">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[9px] font-bold uppercase tracking-wider">
                      NOVO
                    </span>
                  </div>
                  <div className="my-2 flex justify-center items-center h-[46px]">
                    <img src="/conexao.png" alt="Conexões" className="h-[64px] w-auto object-contain" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight leading-snug">
                      Conexões
                    </h3>
                  </div>
                </div>
              </div>

              {/* 3. Horizontal Promotional Card ("Torne-se um anfitrião" -> Área do anfitrião) */}
              <div
                onClick={() => {
                  if (onOpenHostDashboard) {
                    onOpenHostDashboard();
                  } else {
                    setIsPremiumModalOpen(true);
                  }
                }}
                className={`rounded-[24px] p-4 border transition-transform cursor-pointer active:scale-[0.98] flex items-center gap-3.5 ${
                  isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-white border-black/5 shadow-xs'
                }`}
              >
                <div className="shrink-0 flex items-center justify-center w-12 h-12">
                  <img src="/anfitriao.png" alt="Torne-se um anfitrião" className="h-14 w-auto object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-bold tracking-tight leading-tight">
                    Área do anfitrião
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">
                    Acompanhe suas indicações e seus ganhos no Monvians.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
              </div>

              {/* 4. Options List */}
              <div className="space-y-2.5 pt-1">
                {isUserAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin?.();
                    }}
                    className={`w-full p-4 rounded-[22px] border transition-all flex items-center justify-between text-left cursor-pointer active:scale-[0.98] ${
                      isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-white border-black/5 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <ShieldCheck className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <h3 className="text-[15px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                        Painel ADM
                      </h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                  </button>
                )}

                {/* Configurações da Conta -> opens 'permissoes' */}
                <button
                  type="button"
                  onClick={() => handleSetSubView('permissoes')}
                  className={`w-full p-4 rounded-[22px] border transition-all flex items-center justify-between text-left cursor-pointer active:scale-[0.98] ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-white border-black/5 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                      <Settings className="w-7 h-7 stroke-[1.8]" />
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF3B30] ring-2 ring-[#1C1C1E] dark:ring-[#1C1C1E]" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                      Configurações da conta
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => window.open(communityUrl, '_blank')}
                  className={`w-full p-4 rounded-[22px] border transition-all flex items-center justify-between text-left cursor-pointer active:scale-[0.98] ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-white border-black/5 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                      <Star className="w-7 h-7 stroke-[1.8]" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                      Obtenha ajuda
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 2: CONFIGURAÇÕES DA CONTA (NATIVE IPHONE SELECTORS)     */}
          {/* ============================================================ */}
          {activeSubView === 'permissoes' && (
            <div className="space-y-5 pt-2 pb-8">
              {/* GROUP 1: PREFERÊNCIAS & CLIMA */}
              <div>
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Preferências & Efeitos
                </p>
                <div className={`rounded-[24px] border overflow-hidden ${
                  isDark ? 'bg-[#1C1C1E] border-white/10 divide-y divide-white/5' : 'bg-white border-black/5 divide-y divide-black/5'
                }`}>
                  {/* Chuva Dinâmica */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <CloudRain className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Chuva Dinâmica no Relevo
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                          Simulação de precipitação no mapa 3D
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={Boolean(rainEnabled)}
                      onChange={() => onToggleRain?.()}
                      ariaLabel="Chuva dinâmica"
                    />
                  </div>

                  {/* Neve das Montanhas */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Snowflake className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Neve das Montanhas
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                          Flocos de neve caindo sobre Campos
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={Boolean(snowEnabled)}
                      onChange={() => onToggleSnow?.()}
                      ariaLabel="Neve das montanhas"
                    />
                  </div>

                  {/* Modo Escuro */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        {isDark ? <Moon className="w-7 h-7 stroke-[1.8]" /> : <Sun className="w-7 h-7 stroke-[1.8]" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Modo Escuro
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                          {isDark ? 'Tema escuro nativo ativo' : 'Tema claro ativo'}
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={isDark}
                      onChange={() => onToggleTheme?.()}
                      ariaLabel="Modo escuro"
                    />
                  </div>

                  {/* Alto Contraste */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Sliders className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Alto Contraste
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                          Aumenta o contraste visual da interface
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={Boolean(highContrast)}
                      onChange={() => onToggleHighContrast?.()}
                      ariaLabel="Alto contraste"
                    />
                  </div>
                </div>
              </div>

              {/* GROUP 2: PERMISSÕES & SENSORES */}
              <div>
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Permissões do Dispositivo
                </p>
                <div className={`rounded-[24px] border overflow-hidden ${
                  isDark ? 'bg-[#1C1C1E] border-white/10 divide-y divide-white/5' : 'bg-white border-black/5 divide-y divide-black/5'
                }`}>
                  {/* Localização GPS */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <MapPin className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Localização GPS
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                          Calcular rotas e proximidade de locais
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={locationPerm}
                      onChange={handleToggleLocation}
                      ariaLabel="Localização GPS"
                    />
                  </div>

                  {/* Alertas de Proximidade */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Bell className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Alertas por Proximidade
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                          Avisos quando estiver perto de atrações
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={proximityAlerts}
                      onChange={handleToggleProximity}
                      ariaLabel="Alertas por proximidade"
                    />
                  </div>

                  {/* Efeitos Sonoros */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Volume2 className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Sons do Aplicativo
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                          Efeitos sonoros e confirmações
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={soundEnabled}
                      onChange={handleToggleSound}
                      ariaLabel="Sons do aplicativo"
                    />
                  </div>
                </div>
              </div>

              {/* GROUP 3: CONTA & DADOS */}
              <div>
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Conta & Redes
                </p>
                <div className={`rounded-[24px] border overflow-hidden ${
                  isDark ? 'bg-[#1C1C1E] border-white/10 divide-y divide-white/5' : 'bg-white border-black/5 divide-y divide-black/5'
                }`}>
                  <button
                    type="button"
                    onClick={() => handleSetSubView('edit-profile')}
                    className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Pencil className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <h4 className="text-[15px] font-semibold tracking-tight">
                        Editar Perfil e Foto
                      </h4>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                  </button>

                  <a
                    href={communityUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <WhatsAppLogo className="w-7 h-7" />
                      </div>
                      <h4 className="text-[15px] font-semibold tracking-tight">
                        Comunidade Monvian no WhatsApp
                      </h4>
                    </div>
                    <ExternalLink className="w-4.5 h-4.5 text-zinc-400 shrink-0" />
                  </a>

                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <InstagramLogo className="w-7 h-7" />
                      </div>
                      <h4 className="text-[15px] font-semibold tracking-tight">
                        Instagram Oficial (@monvian.campos)
                      </h4>
                    </div>
                    <ExternalLink className="w-4.5 h-4.5 text-zinc-400 shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 3: EDIT PROFILE                                         */}
          {/* ============================================================ */}
          {activeSubView === 'edit-profile' && (
            <div className="flex-1 flex flex-col justify-center my-auto w-full max-w-md mx-auto py-4">
              <form onSubmit={handleSaveProfile} className="space-y-4 w-full">
                <div className={`p-5 rounded-[26px] border space-y-4 ${
                  isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-white border-black/5 shadow-xs'
                }`}>
                  {/* Avatar Selector and Preview */}
                  <div className="flex flex-col items-center justify-center pb-2 pt-1">
                    <div className="relative group">
                      <div className={`w-24 h-24 rounded-full overflow-hidden border-2 shadow-lg relative ${
                        isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-white'
                      }`}>
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
                        className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-lg border-2 border-zinc-200 transition-transform active:scale-95 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 text-xs font-bold text-zinc-900 dark:text-white hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Escolher foto do dispositivo</span>
                    </button>
                  </div>

                  {/* Nome de Exibição */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Nome
                    </label>
                    <input
                      type="text"
                      placeholder="Seu nome (ex: Mario Yesk)"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl border text-sm font-medium focus:outline-none ${
                        isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-white/30' : 'bg-zinc-50 border-black/10 text-zinc-900 focus:border-black/30'
                      }`}
                      required
                    />
                  </div>

                  {/* Nome de Usuário */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                        Nome de usuário
                      </label>
                      {usernameStatus === 'checking' && (
                        <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                        </span>
                      )}
                      {usernameStatus === 'available' && (
                        <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[2.5]" /> Disponível
                        </span>
                      )}
                      {usernameStatus === 'unavailable' && (
                        <span className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
                          <X className="w-3 h-3 stroke-[2.5]" /> Indisponível
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm pointer-events-none select-none">
                        @
                      </div>
                      <input
                        type="text"
                        placeholder="marioyesk"
                        value={tempUsername}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
                          setTempUsername(clean);
                        }}
                        className={`w-full pl-8 pr-4 py-3 rounded-2xl border text-sm font-medium focus:outline-none transition-colors ${
                          isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-white/30' : 'bg-zinc-50 border-black/10 text-zinc-900 focus:border-black/30'
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
                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Biografia
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Conte sobre sua paixão por Campos do Jordão..."
                      value={tempBio}
                      onChange={(e) => setTempBio(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-medium focus:outline-none resize-none ${
                        isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-white/30' : 'bg-zinc-50 border-black/10 text-zinc-900 focus:border-black/30'
                      }`}
                    />
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      E-mail de acesso
                    </label>
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={tempEmail}
                      onChange={(e) => setTempEmail(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl border text-sm font-medium focus:outline-none ${
                        isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-white/30' : 'bg-zinc-50 border-black/10 text-zinc-900 focus:border-black/30'
                      }`}
                      required
                    />
                  </div>

                  {saveError && (
                    <p className="text-xs text-rose-500 font-bold px-1 text-center">
                      {saveError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSetSubView('main')}
                    className={`flex-1 py-3 rounded-full text-sm font-bold transition-all cursor-pointer ${
                      isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 text-sm font-bold transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
                  >
                    {saveToast ? <Check className="w-4 h-4" /> : null}
                    <span>{saveToast ? 'Salvo!' : 'Salvar alterações'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 4: CURTIDOS (FAVORITES)                                  */}
          {/* ============================================================ */}
          {activeSubView === 'curtidos' && (
            <div className={`pt-2 ${favoriteSpots.length === 0 ? 'flex-1 flex flex-col justify-center min-h-[50vh]' : 'space-y-3'}`}>
              {favoriteSpots.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-zinc-500">
                  <Heart className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                  <p className="font-bold text-zinc-700 dark:text-zinc-200 text-base">Nenhum lugar curtido ainda.</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto">
                    Toque no coração de qualquer ponto para salvar aqui!
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
                    className={`w-full p-4 rounded-[24px] border transition-all flex items-center justify-between text-left cursor-pointer active:scale-[0.98] ${
                      isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-white border-black/5 hover:bg-zinc-50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-16 h-16 rounded-[18px] overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
                        <img
                          src={spot.image}
                          alt={spot.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-[16px] font-bold tracking-tight truncate">
                          {spot.name}
                        </h4>
                        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                          {spot.categoryLabel}
                        </p>
                        <div className="flex items-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
                          <span className="flex items-center gap-1 text-amber-500 font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
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
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 5: LOGOUT CONFIRMATION                                   */}
          {/* ============================================================ */}
          {activeSubView === 'logout-confirm' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto w-full max-w-sm mx-auto py-8">
              <div className="w-18 h-18 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mb-5">
                <LogOut className="w-8 h-8 stroke-[2]" />
              </div>

              <div className="space-y-2 mb-7">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Deseja encerrar a sessão?
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                  Você poderá entrar novamente a qualquer momento com sua conta {userEmail}.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => handleSetSubView('main')}
                  className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                    isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
                  }`}
                >
                  Permanecer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('monvian_token');
                    localStorage.removeItem('monvian_user');
                    localStorage.removeItem('monvian_active_itinerary');
                    localStorage.removeItem('monvian_itinerary_session');
                    window.location.reload();
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all cursor-pointer shadow-lg active:scale-95"
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
          isLoading={false}
          theme={theme}
          onMarkAllAsRead={() => {
            setNotificationsList((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
          }}
        />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
export default ProfileModal;
