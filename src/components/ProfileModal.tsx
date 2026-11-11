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
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PremiumModal } from './PremiumModal';
import { ProfileXpProgressBar } from './ProfileXpProgressBar';
import { IOSSwitch } from './IOSSwitch';
import { NotificationsModal } from './NotificationsModal';
import { persistUserToFirestore } from '../services/firestoreSync';
import {
  HelpAndLegalView,
  HelpLegalPageId,
} from './HelpAndLegalSection';

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
  onLogout?: () => void;
}

type SubView =
  | 'main'
  | 'edit-profile'
  | 'curtidos'
  | 'permissoes'
  | 'ajuda-informacoes'
  | 'logout-confirm';

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
  onSubViewChange,
  communityUrl = 'https://chat.whatsapp.com/invite/monvian-campos',
  instagramUrl = 'https://instagram.com/monvian.campos',
  onLogout,
}) => {
  const getInitialAvatar = (u: any) => {
    try {
      const email = (u?.email || u?.whatsapp || '').trim().toLowerCase();
      const username = (u?.username || '').trim().toLowerCase();
      const isMario =
        ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(email) ||
        username === 'marioyesk';

      if (u?.avatar_url && u.avatar_url.trim().length > 0) {
        if (!isMario && (u.avatar_url === '/fotoperfil.png' || u.avatar_url.endsWith('fotoperfil.png'))) {
          return null;
        }
        return u.avatar_url;
      }
      const userKey = u?.id || email;
      if (userKey) {
        const scopedAv = typeof window !== 'undefined' ? localStorage.getItem(`monvian_user_avatar_${userKey}`) : null;
        if (scopedAv && scopedAv.trim().length > 0) return scopedAv;
      }
      if (isMario) return '/fotoperfil.png';
    } catch {}
    return null;
  };

  const [activeSubView, setActiveSubView] = useState<SubView>('main');
  const [helpLegalPage, setHelpLegalPage] = useState<HelpLegalPageId>('hub');
  const [helpReturnView, setHelpReturnView] = useState<'main' | 'permissoes'>('main');

  const handleSetSubView = (subView: SubView) => {
    setActiveSubView(subView);
    onSubViewChange?.(subView);
  };

  const openHelpLegalPage = (page: HelpLegalPageId, fromView: 'main' | 'permissoes' = 'main') => {
    setHelpReturnView(fromView);
    setHelpLegalPage(page);
    handleSetSubView('ajuda-informacoes');
  };

  // User profile state
  const [userName, setUserName] = useState(user?.name || '');
  const [userUsername, setUserUsername] = useState(user?.username || '');
  const [userBio, setUserBio] = useState(user?.bio || '');
  const [userEmail, setUserEmail] = useState(user?.email || user?.whatsapp || '');
  const [userAvatar, setUserAvatar] = useState(getInitialAvatar(user));
  const [tempAvatar, setTempAvatar] = useState(getInitialAvatar(user));

  const cleanUserEmail = (user?.email || user?.whatsapp || userEmail || '').trim().toLowerCase();
  const isUserAdmin = Boolean(
    user?.role === 'admin' ||
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanUserEmail) ||
    (user?.username || userUsername || '').trim().toLowerCase() === 'marioyesk'
  );

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
      setUserName(user.name || '');
      setUserUsername(user.username || '');
      setUserBio(user.bio || '');
      setUserEmail(user.email || user.whatsapp || '');
      const av = getInitialAvatar(user);
      setUserAvatar(av);
      setTempAvatar(av);
      setTempName(user.name || '');
      setTempUsername(user.username || '');
      setTempBio(user.bio || '');
      setTempEmail(user.email || user.whatsapp || '');
    } else {
      setUserName('');
      setUserUsername('');
      setUserBio('');
      setUserEmail('');
      setUserAvatar(null);
      setTempAvatar(null);
      setTempName('');
      setTempUsername('');
      setTempBio('');
      setTempEmail('');
      setActiveSubView('main');
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

  const isDark = false;
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
    const cleanUsername = usernameStr.trim().replace(/^@+/, '');
    const cleanEmailOrWhatsapp = emailOrWhatsapp.trim().toLowerCase();
    const isAdminAccount =
      ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmailOrWhatsapp) ||
      cleanUsername.toLowerCase() === 'marioyesk' ||
      user?.role === 'admin';
    const finalAvatarUrl = avatar || userAvatar || (isAdminAccount ? '/fotoperfil.png' : null);

    // 1. Immediately persist locally and update global React state so all screens reflect the photo right away
    const optimisticUser = {
      ...(user || {}),
      name: name.trim(),
      username: cleanUsername,
      bio: bioStr.trim(),
      email: emailOrWhatsapp.trim(),
      whatsapp: emailOrWhatsapp.trim(),
      avatar_url: finalAvatarUrl,
      ...(isAdminAccount
        ? {
            role: 'admin',
            isGold: true,
            isPremium: true,
            is_gold: 1,
            is_premium: 1,
            plan: 'gold',
          }
        : {}),
    };

    try {
      if (finalAvatarUrl && finalAvatarUrl !== '/fotoperfil.png') {
        const userKey = optimisticUser.id || optimisticUser.email;
        if (userKey) {
          localStorage.setItem(`monvian_user_avatar_${userKey}`, finalAvatarUrl);
        }
      }
      localStorage.setItem('monvian_user', JSON.stringify(optimisticUser));
      if (onUpdateUser) onUpdateUser(optimisticUser);
      window.dispatchEvent(new CustomEvent('monvian:user_updated', { detail: optimisticUser }));
    } catch {}

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (cleanEmailOrWhatsapp) {
        headers['x-user-email'] = cleanEmailOrWhatsapp;
      }

      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim(),
          username: cleanUsername,
          bio: bioStr.trim(),
          email: emailOrWhatsapp.trim(),
          whatsapp: emailOrWhatsapp.trim(),
          avatar_url: finalAvatarUrl,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const mergedUser = {
          ...optimisticUser,
          ...data.user,
          avatar_url: finalAvatarUrl || data.user.avatar_url,
          ...(isAdminAccount
            ? {
                role: 'admin',
                isGold: true,
                isPremium: true,
                is_gold: 1,
                is_premium: 1,
                plan: 'gold',
              }
            : {}),
        };
        localStorage.setItem('monvian_user', JSON.stringify(mergedUser));
        if (onUpdateUser) onUpdateUser(mergedUser);
        window.dispatchEvent(new CustomEvent('monvian:user_updated', { detail: mergedUser }));
      }

      await persistUserToFirestore({
        ...optimisticUser,
        password_hash: user?.password_hash || '',
        role: isAdminAccount ? 'admin' : user?.role || 'user',
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
      {isOpen && (
      <motion.div
        id="profile-fullscreen-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={onClose}
        className="fixed inset-0 z-45 flex flex-col justify-end md:justify-center md:items-center md:p-6 select-none overflow-hidden transition-colors duration-200 md:bg-black/50 md:backdrop-blur-xs"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full h-full md:h-[88vh] md:max-w-2xl rounded-none md:rounded-[30px] overflow-hidden flex flex-col justify-between shadow-2xl transition-colors duration-200 md:border ${
            isDark
              ? 'bg-[#000000] text-white md:border-white/10'
              : 'bg-[#ffffff] text-zinc-950 md:border-black/10'
          }`}
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif',
            overflow: 'hidden',
            willChange: 'opacity, transform',
          }}
        >
        {/* Top Header Bar */}
        {activeSubView !== 'ajuda-informacoes' && (
        <div
          className={`px-5 sm:px-6 pb-2 flex items-center justify-between z-10 shrink-0 transition-colors ${
            isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-zinc-950'
          }`}
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
                  isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-[#fefefe] hover:bg-[#E5E5EA] text-zinc-900 shadow-2xs'
                }`}
                title="Notificações"
                aria-label="Notificações"
              >
                <Bell className="w-5 h-5 stroke-[2]" />
              </button>
            )}
          </div>
        </div>
        )}

        {/* Main Content Area */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7 max-w-3xl mx-auto w-full flex flex-col transition-colors ${
            isDark
              ? 'bg-[#000000] text-white'
              : 'bg-[#ffffff] text-zinc-950'
          } ${activeSubView === 'ajuda-informacoes' ? 'pt-1 sm:pt-2' : ''}`}
          style={{
            WebkitOverflowScrolling: 'touch',
            paddingBottom:
              activeSubView === 'ajuda-informacoes'
                ? 'calc(env(safe-area-inset-bottom, 24px) + 140px)'
                : 'calc(env(safe-area-inset-bottom, 24px) + 90px)',
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
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeSubView}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col w-full transform-gpu"
          >
          {activeSubView === 'main' && (
            <div className="space-y-4 pt-1 pb-6">
              {/* 1. Main Profile Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.02 }}
                whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
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
                className={`w-full p-5 sm:p-6 rounded-[28px] border transition-colors cursor-pointer group flex flex-col items-center text-center ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 shadow-xs'
                    : 'bg-[#fefefe] border-black/5 shadow-xs'
                }`}
              >
                <div className="relative mb-3">
                  <div className={`w-[102px] h-[102px] sm:w-[108px] sm:h-[108px] rounded-full overflow-hidden shadow-md border-2 ${
                    isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-white'
                  }`}>
                    {userAvatar && !userAvatar.endsWith('fotoperfil.png') ? (
                      <motion.img
                        initial={{ opacity: 0, scale: 0.88, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.04 }}
                        src={userAvatar}
                        alt={userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#EBE9F9] dark:bg-[#2C283C] text-[#5851DB] dark:text-[#A29BFD] text-3xl font-bold flex items-center justify-center">
                        {(userName || 'M').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                <h2
                  className={`text-xl sm:text-2xl font-bold tracking-tight transition-colors ${
                    isDark ? 'text-white' : 'text-zinc-950'
                  }`}
                >
                  {userName || 'Mario Yesk'}
                </h2>
                {userUsername && (
                  <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                    @{userUsername}
                  </p>
                )}
              </motion.div>

              {/* 1.5. Barra de Progresso Monvian XP por Exploração */}
              <ProfileXpProgressBar isDark={isDark} />

              {/* 2. Feature Cards Grid (Viagens & Conexões) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                {/* Viagens */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.055 }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={`rounded-[24px] p-4 border transition-colors cursor-default flex flex-col justify-between ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-[#fefefe] border-black/5 shadow-xs'
                  }`}
                >
                  <div className="flex justify-end">
                    <span className="px-2 py-0.5 rounded-full bg-[#0079ff] text-[#ffffff] border-[#008eff] text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: '#0079ff' }}>
                      NOVO
                    </span>
                  </div>
                  <div className="my-2 flex justify-center items-center h-[46px]">
                    <motion.img
                      initial={{ opacity: 0, scale: 0.88, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.075 }}
                      src="/lugares.png"
                      alt="Viagens"
                      className="h-[64px] w-auto object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-bold tracking-tight leading-snug">
                        Viagens
                      </h3>
                      <Lock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                    </div>
                  </div>
                </motion.div>

                {/* Conexões */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.09 }}
                  whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                  whileTap={{ scale: 0.94, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                  onClick={() => {
                    window.open('https://chat.whatsapp.com/BS2Fu5Kws5qE8iaWHWrbCY?s=cl&p=i&mlu=4&ilr=4&iam=2', '_blank');
                  }}
                  className={`rounded-[24px] p-4 border transition-colors cursor-pointer flex flex-col justify-between ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-[#fefefe] border-black/5 shadow-xs'
                  }`}
                >
                  <div className="flex justify-end">
                    <span className="px-2 py-0.5 rounded-full bg-[#0079ff] text-white text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: '#0079ff' }}>
                      NOVO
                    </span>
                  </div>
                  <div className="my-2 flex justify-center items-center h-[46px]">
                    <motion.img
                      initial={{ opacity: 0, scale: 0.88, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.11 }}
                      src="/conexao.png"
                      alt="Conexões"
                      className="h-[64px] w-auto object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight leading-snug">
                      Conexões
                    </h3>
                  </div>
                </motion.div>
              </div>


              {/* 4. Options List */}
              <div className="space-y-2.5 pt-1">
                {isUserAdmin && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.16 }}
                    whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                    whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                    onClick={() => {
                      onClose();
                      onOpenAdmin?.();
                    }}
                    className={`w-full p-4 rounded-[22px] border transition-colors flex items-center justify-between text-left cursor-pointer ${
                      isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-[#fefefe] border-black/5 hover:bg-[#E5E5EA]/80'
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
                  </motion.button>
                )}

                {/* Configurações da Conta -> opens 'permissoes' */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.195 }}
                  whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                  whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                  onClick={() => handleSetSubView('permissoes')}
                  className={`w-full p-4 rounded-[22px] border transition-colors flex items-center justify-between text-left cursor-pointer ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-[#fefefe] border-black/5 hover:bg-[#E5E5EA]/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                      <Settings className="w-7 h-7 stroke-[1.8]" />
                      <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0079ff] ring-2 ${isDark ? 'ring-[#1C1C1E]' : 'ring-[#fefefe]'}`} style={{ backgroundColor: '#0079ff' }} />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                      Configurações da conta
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                </motion.button>

                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.23 }}
                  whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                  whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                  onClick={() => openHelpLegalPage('hub', 'main')}
                  className={`w-full p-4 rounded-[22px] border transition-colors flex items-center justify-between text-left cursor-pointer ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-[#fefefe] border-black/5 hover:bg-[#E5E5EA]/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                      <Star className="w-7 h-7 stroke-[1.8]" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                      Ajuda e informações
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                </motion.button>

                {/* Sair da conta */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.26 }}
                  whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                  whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                  onClick={() => handleSetSubView('logout-confirm')}
                  className={`w-full p-4 rounded-[22px] border transition-colors flex items-center justify-between text-left cursor-pointer ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-[#fefefe] border-black/5 hover:bg-[#E5E5EA]/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex items-center justify-center shrink-0 text-red-500">
                      <LogOut className="w-7 h-7 stroke-[1.8]" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-red-500 tracking-tight">
                      Sair da conta
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                </motion.button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 2: CONFIGURAÇÕES DA CONTA (NATIVE IPHONE SELECTORS)     */}
          {/* ============================================================ */}
          {activeSubView === 'permissoes' && (
            <div className="space-y-5 pt-2 pb-8">
              {/* GROUP 1: PREFERÊNCIAS & CLIMA */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.02 }}
              >
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Preferências & Efeitos
                </p>
                <div className={`rounded-[24px] border overflow-hidden ${
                  isDark ? 'bg-[#1C1C1E] border-white/10 divide-y divide-white/5' : 'bg-[#fefefe] border-black/5 divide-y divide-black/5'
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
                </div>
              </motion.div>

              {/* GROUP 2: PERMISSÕES & SENSORES */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.065 }}
              >
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
              </motion.div>

              {/* GROUP 3: CONTA & DADOS */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.11 }}
              >
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Conta
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

                  <button
                    type="button"
                    onClick={() => openHelpLegalPage('hub', 'permissoes')}
                    className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Star className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Ajuda e informações
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                          Suporte, privacidade, termos e exclusão de conta
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 2.5: AJUDA E INFORMAÇÕES (CENTRAL, PRIVACIDADE & LEGAL) */}
          {/* ============================================================ */}
          {activeSubView === 'ajuda-informacoes' && (
            <div className="py-1 pb-8">
              <HelpAndLegalView
                activePage={helpLegalPage}
                onNavigate={(page) => setHelpLegalPage(page)}
                onBackToProfile={() => handleSetSubView(helpReturnView)}
                user={user}
                onUpdateUser={onUpdateUser}
                theme={theme}
                onAccountDeleted={() => {
                  if (onLogout) {
                    onLogout();
                  } else {
                    window.location.reload();
                  }
                }}
              />
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 3: EDIT PROFILE                                         */}
          {/* ============================================================ */}
          {activeSubView === 'edit-profile' && (
            <div className="flex-1 flex flex-col justify-center my-auto w-full max-w-md mx-auto py-4">
              <form onSubmit={handleSaveProfile} className="space-y-4 w-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.02 }}
                  className={`p-5 rounded-[26px] border space-y-4 ${
                    isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-white border-black/5 shadow-xs'
                  }`}
                >
                  {/* Avatar Selector and Preview */}
                  <div className="flex flex-col items-center justify-center pb-2 pt-1">
                    <div className="relative group">
                      <div className={`w-[92px] h-[92px] rounded-full overflow-hidden border-2 shadow-lg relative ${
                        isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-white'
                      }`}>
                        <motion.img
                          initial={{ opacity: 0, scale: 0.88, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.05 }}
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
                    </div>
                    <div className="relative flex items-center">
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
                        className={`w-full pl-8 pr-11 py-3 rounded-2xl border text-sm font-medium focus:outline-none transition-colors ${
                          isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-white/30' : 'bg-zinc-50 border-black/10 text-zinc-900 focus:border-black/30'
                        }`}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      {/* Status indicator icon at the end of the input bar */}
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        {usernameStatus === 'checking' && (
                          <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                        )}
                        {usernameStatus === 'available' && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                        {usernameStatus === 'unavailable' && (
                          <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs">
                            <X className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </div>
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
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.065 }}
                  className="flex items-center gap-3 pt-1"
                >
                  <button
                    type="button"
                    onClick={() => handleSetSubView('main')}
                    className={`flex-1 py-3 rounded-full text-sm font-bold transition-all active:scale-95 cursor-pointer ${
                      isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'expo-liquid-glass-btn text-black border border-black/5 hover:bg-zinc-50 shadow-xs'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-full expo-liquid-glass-btn text-black dark:bg-white dark:text-zinc-900 border border-black/5 hover:bg-zinc-50 text-sm font-bold transition-all active:scale-95 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {saveToast ? <Check className="w-4 h-4 text-black dark:text-black" /> : null}
                    <span>{saveToast ? 'Salvo!' : 'Salvar alterações'}</span>
                  </button>
                </motion.div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 4: CURTIDOS (FAVORITES)                                  */}
          {/* ============================================================ */}
          {activeSubView === 'curtidos' && (
            <div className={`pt-2 ${favoriteSpots.length === 0 ? 'flex-1 flex flex-col justify-center min-h-[50vh]' : 'space-y-3'}`}>
              {favoriteSpots.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 flex flex-col items-center justify-center text-center py-16 text-zinc-500 transform-gpu"
                >
                  <Heart className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                  <p className="font-bold text-zinc-700 dark:text-zinc-200 text-base">Nenhum lugar curtido ainda.</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto">
                    Toque no coração de qualquer ponto para salvar aqui!
                  </p>
                </motion.div>
              ) : (
                favoriteSpots.map((spot, idx) => (
                  <motion.div
                    key={spot.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1], delay: Math.min(idx * 0.02, 0.18) }}
                    onClick={() => {
                      onSelectSpot(spot);
                      onClose();
                    }}
                    className={`w-full p-4 rounded-[24px] border transition-all duration-150 active:scale-[0.98] transform-gpu flex items-center justify-between text-left cursor-pointer ${
                      isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-white border-black/5 hover:bg-zinc-50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-16 h-16 rounded-[18px] overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 transform-gpu">
                        <img
                          src={spot.image}
                          alt={spot.name}
                          decoding="async"
                          loading="eager"
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
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 5: LOGOUT CONFIRMATION                                   */}
          {/* ============================================================ */}
          {activeSubView === 'logout-confirm' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="flex-1 flex flex-col items-center justify-center text-center my-auto w-full max-w-sm mx-auto py-8"
            >
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
                    setActiveSubView('main');
                    if (onLogout) {
                      onLogout();
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  Sim, sair
                </button>
              </div>
            </motion.div>
          )}
          </motion.div>
          </AnimatePresence>
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
          onClose={() => {
            setIsNotificationsOpen(false);
            handleSetSubView('main');
          }}
          onBack={() => {
            setIsNotificationsOpen(false);
            handleSetSubView('main');
          }}
          notifications={notificationsList}
          isLoading={false}
          theme={theme}
          onMarkAllAsRead={() => {
            setNotificationsList((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
          }}
        />
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};
export default ProfileModal;
