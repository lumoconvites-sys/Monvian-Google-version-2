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
  Compass,
  Calendar,
  Users,
} from 'lucide-react';
import { AppleBackButton } from './ui/AppleBackButton';
import { motion, AnimatePresence } from 'motion/react';
import { PremiumModal } from './PremiumModal';
import { ProfileXpProgressBar } from './ProfileXpProgressBar';
import { IOSSwitch } from './IOSSwitch';
import { NotificationsModal } from './NotificationsModal';
import {
  persistUserToFirestore,
  persistUserOnboardingToFirestore,
} from '../services/firestoreSync';
import {
  CAMPOS_RELATIONSHIP_OPTIONS,
  NEXT_TRIP_TIMING_OPTIONS,
  INTEREST_CATEGORY_OPTIONS,
  TRAVEL_COMPANY_OPTIONS,
} from './OnboardingFlow';
import {
  HelpAndLegalView,
  HelpLegalPageId,
} from './HelpAndLegalSection';
import { useIOSBackEntry } from '../services/iosNavigationManager';

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
  | 'traveler-profile'
  | 'curtidos'
  | 'permissoes'
  | 'ajuda-informacoes'
  | 'logout-confirm';

const Responsive3DCompassIcon: React.FC<{ className?: string }> = ({ className = 'w-11 h-11' }) => (
  <div className={`relative shrink-0 flex items-center justify-center ${className}`} style={{ filter: 'drop-shadow(0 4px 8px rgba(0, 122, 255, 0.32))' }}>
    <svg viewBox="0 0 64 64" className="w-full h-full" fill="none">
      <defs>
        <radialGradient id="compassSphereProfile" cx="32" cy="24" r="28" fx="32" fy="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="40%" stopColor="#2563EB" />
          <stop offset="90%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </radialGradient>
        <linearGradient id="compassBezelProfile" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#1E40AF" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="needleRedProfile" x1="32" y1="14" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id="needleSilverProfile" x1="32" y1="32" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
        <radialGradient id="glassGlossProfile" cx="32" cy="18" r="20" fx="32" fy="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="34" r="26" fill="#1D4ED8" fillOpacity="0.28" filter="blur(4px)" />
      <circle cx="32" cy="32" r="26" fill="url(#compassSphereProfile)" />
      <circle cx="32" cy="32" r="25" stroke="url(#compassBezelProfile)" strokeWidth="2" />
      <path d="M32 10V14M32 50V54M10 32H14M50 32H54" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9" />
      <polygon points="32,14 27,32 32,32" fill="url(#needleRedProfile)" />
      <polygon points="32,14 37,32 32,32" fill="#B91C1C" />
      <polygon points="32,50 27,32 32,32" fill="#CBD5E1" />
      <polygon points="32,50 37,32 32,32" fill="url(#needleSilverProfile)" />
      <circle cx="32" cy="32" r="3.5" fill="#F8FAFC" />
      <circle cx="32" cy="32" r="2" fill="#3B82F6" />
      <circle cx="32" cy="32" r="25" fill="url(#glassGlossProfile)" />
    </svg>
  </div>
);

export const ProfileModal: React.FC<ProfileModalProps> = React.memo(({
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
  const saveToastTimerRef = useRef<number | null>(null);
  const checkUsernameAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (checkUsernameTimerRef.current) clearTimeout(checkUsernameTimerRef.current);
      if (saveToastTimerRef.current) window.clearTimeout(saveToastTimerRef.current);
      checkUsernameAbortRef.current?.abort();
    };
  }, []);

  // Traveler Onboarding Preferences ("Meu perfil de viajante")
  const [camposRelationship, setCamposRelationship] = useState<string>(
    () => user?.campos_relationship || ''
  );
  const [nextTripTiming, setNextTripTiming] = useState<string>(
    () => user?.next_trip_timing || ''
  );
  const [nextTripDate, setNextTripDate] = useState<string>(
    () => user?.next_trip_date || ''
  );
  const [interestCategories, setInterestCategories] = useState<string[]>(() =>
    Array.isArray(user?.interest_categories) ? user.interest_categories : []
  );
  const [travelCompany, setTravelCompany] = useState<string>(
    () => user?.travel_company || ''
  );
  const [isSavingTravelerPrefs, setIsSavingTravelerPrefs] = useState<boolean>(false);
  const [travelerSavedToast, setTravelerSavedToast] = useState<boolean>(false);

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
      if (user.campos_relationship) setCamposRelationship(user.campos_relationship);
      if (user.next_trip_timing) setNextTripTiming(user.next_trip_timing);
      if (user.next_trip_date !== undefined) setNextTripDate(user.next_trip_date || '');
      if (Array.isArray(user.interest_categories)) {
        setInterestCategories(user.interest_categories);
      }
      if (user.travel_company) setTravelCompany(user.travel_company);
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
      setCamposRelationship('');
      setNextTripTiming('');
      setNextTripDate('');
      setInterestCategories([]);
      setTravelCompany('');
      setActiveSubView('main');
    }
  }, [user]);

  // Fetch latest saved traveler onboarding preferences when ProfileModal opens
  useEffect(() => {
    if (!isOpen || !cleanUserEmail) return;
    let active = true;
    const token = localStorage.getItem('monvian_token');
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    headers['x-user-email'] = cleanUserEmail;

    fetch(`/api/user/onboarding?email=${encodeURIComponent(cleanUserEmail)}`, {
      headers,
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.preferences) return;
        const p = data.preferences;
        if (p.campos_relationship) setCamposRelationship(p.campos_relationship);
        if (p.next_trip_timing) setNextTripTiming(p.next_trip_timing);
        if (p.next_trip_date !== undefined) setNextTripDate(p.next_trip_date || '');
        if (Array.isArray(p.interest_categories)) {
          setInterestCategories(p.interest_categories);
        }
        if (p.travel_company) setTravelCompany(p.travel_company);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isOpen, cleanUserEmail]);

  const handleSaveTravelerPreferences = async () => {
    if (isSavingTravelerPrefs) return;
    setIsSavingTravelerPrefs(true);

    const payload = {
      email: cleanUserEmail,
      campos_relationship: camposRelationship,
      next_trip_timing: nextTripTiming,
      next_trip_date: nextTripDate,
      interest_categories: interestCategories,
      travel_company: travelCompany,
      location_preference: locationPerm ? 'granted' : 'skipped',
      location_permission_granted: locationPerm ? 1 : 0,
      onboarding_completed: 1,
    };

    try {
      const optimisticUser = {
        ...(user || {}),
        ...payload,
      };
      localStorage.setItem('monvian_user', JSON.stringify(optimisticUser));
      if (cleanUserEmail) {
        localStorage.setItem(
          `monvian_onboarding_prefs_${cleanUserEmail}`,
          JSON.stringify(payload)
        );
      }
      onUpdateUser?.(optimisticUser);
      window.dispatchEvent(new CustomEvent('monvian:user_updated', { detail: optimisticUser }));

      if (cleanUserEmail) {
        persistUserOnboardingToFirestore({
          user_id: user?.id ? String(user.id) : '',
          user_email: cleanUserEmail,
          ...payload,
        }).catch(() => {});
      }

      const token = localStorage.getItem('monvian_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (cleanUserEmail) headers['x-user-email'] = cleanUserEmail;

      const res = await fetch('/api/user/onboarding/preferences', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          const merged = { ...optimisticUser, ...data.user };
          localStorage.setItem('monvian_user', JSON.stringify(merged));
          onUpdateUser?.(merged);
          window.dispatchEvent(new CustomEvent('monvian:user_updated', { detail: merged }));
        }
      }
    } catch {}

    setIsSavingTravelerPrefs(false);
    setTravelerSavedToast(true);
    window.setTimeout(() => {
      if (isMountedRef.current) {
        setTravelerSavedToast(false);
      }
    }, 1800);
  };

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
    checkUsernameAbortRef.current?.abort();
    checkUsernameTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      checkUsernameAbortRef.current = controller;
      try {
        const userIdParam = user?.id ? `&currentUserId=${encodeURIComponent(user.id)}` : '';
        const res = await fetch(
          `/api/users/check-username?username=${encodeURIComponent(clean)}${userIdParam}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!isMountedRef.current || controller.signal.aborted) return;
        if (data.available) {
          setUsernameStatus('available');
          setUsernameFeedback('Nome de usuário disponível');
        } else {
          setUsernameStatus('unavailable');
          setUsernameFeedback('Nome de usuário indisponível');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || !isMountedRef.current) return;
        setUsernameStatus('idle');
        setUsernameFeedback('');
      }
    }, 350);

    return () => {
      if (checkUsernameTimerRef.current) clearTimeout(checkUsernameTimerRef.current);
      checkUsernameAbortRef.current?.abort();
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

  // Register iOS Interactive Edge-Swipe Back Gesture for Profile subviews and modals
  useIOSBackEntry({
    id: `profile:help-legal:${helpLegalPage}`,
    enabled: isOpen && activeSubView === 'ajuda-informacoes' && helpLegalPage !== 'hub',
    priority: 130,
    label: 'Ajuda e Informações',
    foregroundSelector: '#profile-subview-content',
    backgroundSelector: '#profile-modal-panel',
    onPop: () => {
      setHelpLegalPage('hub');
    },
  });

  useIOSBackEntry({
    id: `profile:subview:${activeSubView}`,
    enabled:
      isOpen &&
      activeSubView !== 'main' &&
      !(activeSubView === 'ajuda-informacoes' && helpLegalPage !== 'hub'),
    priority: 125,
    label: 'Perfil',
    foregroundSelector: '#profile-subview-content',
    backgroundSelector: '#profile-modal-panel',
    onPop: () => {
      if (activeSubView === 'ajuda-informacoes') {
        handleSetSubView(helpReturnView);
      } else {
        handleSetSubView('main');
      }
    },
  });

  useIOSBackEntry({
    id: 'profile:notifications',
    enabled: isOpen && isNotificationsOpen,
    priority: 245,
    label: 'Perfil',
    foregroundSelector: '#notifications-fullscreen-view',
    backgroundSelector: '#profile-modal-panel',
    onPop: () => {
      setIsNotificationsOpen(false);
      handleSetSubView('main');
    },
  });

  useIOSBackEntry({
    id: 'profile:premium',
    enabled: isOpen && isPremiumModalOpen,
    priority: 245,
    label: 'Perfil',
    foregroundSelector: '#profile-modal-panel',
    onPop: () => {
      setIsPremiumModalOpen(false);
    },
  });

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
    if (!isMountedRef.current) return;

    setUserName(finalName);
    setUserUsername(cleanUsername);
    setUserBio(finalBio);
    setUserEmail(finalEmail);
    setUserAvatar(finalAvatar);

    setSaveToast(true);
    if (saveToastTimerRef.current) window.clearTimeout(saveToastTimerRef.current);
    saveToastTimerRef.current = window.setTimeout(() => {
      if (!isMountedRef.current) return;
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
        style={{
          height: 'var(--app-height, 100dvh)',
          minHeight: 'var(--app-height, 100dvh)',
        }}
      >
        <motion.div
          id="profile-modal-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full h-full md:h-[88vh] md:max-w-2xl rounded-none md:rounded-[30px] overflow-hidden flex flex-col justify-between shadow-2xl transition-colors duration-200 md:border ios-pushed-page ${
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
        {/* Main Content Area (single scroll container so scrolled items glide behind sticky translucent header) */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain w-full flex flex-col transition-colors ${
            isDark
              ? 'bg-[#000000] text-white'
              : 'bg-[#ffffff] text-zinc-950'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            paddingBottom:
              activeSubView === 'ajuda-informacoes'
                ? 'calc(env(safe-area-inset-bottom, 24px) + 140px)'
                : 'calc(env(safe-area-inset-bottom, 24px) + 90px)',
          }}
        >
        {/* Top Header Bar */}
        {activeSubView !== 'ajuda-informacoes' && (
        <div
          className={`sticky top-0 z-20 w-full pb-2 shrink-0 transition-colors ${
            isDark ? 'text-white' : 'text-zinc-950'
          }`}
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 20px)',
            paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.40)' : 'rgba(255, 255, 255, 0.40)',
            backdropFilter: 'blur(8px) saturate(150%)',
            WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          }}
        >
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeSubView !== 'main' ? (
              <AppleBackButton
                theme={isDark ? 'dark' : 'light'}
                onClick={() => handleSetSubView('main')}
                title="Voltar"
                aria-label="Voltar"
              />
            ) : null}

            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">
              {activeSubView === 'main' && 'Perfil'}
              {activeSubView === 'edit-profile' && 'Editar Perfil'}
              {activeSubView === 'traveler-profile' && 'Meu perfil de viajante'}
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
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-[#fefefe]/90 hover:bg-[#E5E5EA] text-zinc-900 shadow-2xs'
                }`}
                title="Notificações"
                aria-label="Notificações"
              >
                <Bell className="w-6 h-6 stroke-[2]" />
              </button>
            )}
          </div>
          </div>
        </div>
        )}

          {/* Hidden File Input for Avatar Upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png, image/jpeg, image/webp, image/jpg"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className={activeSubView === 'ajuda-informacoes' ? 'w-full flex-1 flex flex-col' : 'max-w-3xl mx-auto w-full px-5 sm:px-7 flex-1 flex flex-col'}>
          {/* ============================================================ */}
          {/* VIEW 1: MAIN PROFILE (Clean Native Airbnb / iOS Design)       */}
          {/* ============================================================ */}
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            id="profile-subview-content"
            key={activeSubView}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col w-full"
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
                  <div className={`w-[122px] h-[122px] sm:w-[130px] sm:h-[130px] rounded-full overflow-hidden shadow-md border-2 ${
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
                      <div className="w-full h-full bg-[#EBE9F9] dark:bg-[#2C283C] text-[#5851DB] dark:text-[#A29BFD] text-4xl font-bold flex items-center justify-center">
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
                  </motion.button>
                )}

                {/* Meu perfil de viajante (Onboarding Inteligente Summary & Editor) */}
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.14 }}
                  whileHover={{ scale: 1.015, y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => handleSetSubView('traveler-profile')}
                  className={`w-full p-4.5 sm:p-5 rounded-[26px] border transition-all flex flex-col gap-3.5 text-left cursor-pointer relative overflow-hidden ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
                      : 'bg-gradient-to-br from-blue-50/70 via-[#fefefe] to-blue-50/30 border-blue-100/80 shadow-[0_12px_32px_-8px_rgba(0,122,255,0.14)]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <Responsive3DCompassIcon className="w-12 h-12" />
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-bold text-zinc-950 dark:text-white tracking-tight">
                          Meu perfil de viajante
                        </h3>
                        <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                          {camposRelationship ||
                            travelCompany ||
                            (interestCategories.length > 0
                              ? `${interestCategories.length} interesses selecionados`
                              : 'Personalize suas preferências em Campos do Jordão')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                  </div>

                  {(camposRelationship || travelCompany || interestCategories.length > 0) && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {camposRelationship && (
                        <span
                          className={`px-3 py-1 rounded-full text-[11.5px] font-semibold tracking-tight ${
                            isDark
                              ? 'bg-white/10 text-white shadow-2xs'
                              : 'bg-zinc-100 text-zinc-900 border border-black/5 shadow-2xs'
                          }`}
                        >
                          {camposRelationship.replace(/\.$/, '')}
                        </span>
                      )}
                      {travelCompany && (
                        <span
                          className={`px-3 py-1 rounded-full text-[11.5px] font-semibold tracking-tight ${
                            isDark
                              ? 'bg-white/10 text-white shadow-2xs'
                              : 'bg-zinc-100 text-zinc-900 border border-black/5 shadow-2xs'
                          }`}
                        >
                          {travelCompany.replace(/\.$/, '')}
                        </span>
                      )}
                      {interestCategories.slice(0, 2).map((interest) => (
                        <span
                          key={interest}
                          className={`px-3 py-1 rounded-full text-[11.5px] font-medium tracking-tight ${
                            isDark
                              ? 'bg-white/[0.06] text-zinc-300 shadow-2xs'
                              : 'bg-zinc-100/90 text-zinc-700 border border-black/5 shadow-2xs'
                          }`}
                        >
                          {interest.replace(/\.$/, '')}
                        </span>
                      ))}
                      {interestCategories.length > 2 && (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium tracking-tight ${
                            isDark
                              ? 'bg-white/[0.06] text-zinc-400 shadow-2xs'
                              : 'bg-zinc-100/90 text-zinc-600 border border-black/5 shadow-2xs'
                          }`}
                        >
                          +{interestCategories.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </motion.button>

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
                </motion.button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 2: CONFIGURAÇÕES DA CONTA (NATIVE IPHONE SELECTORS)     */}
          {/* ============================================================ */}
          {activeSubView === 'permissoes' && (
            <div className="space-y-5 pt-2 pb-8">
              {/* GROUP 0: APARÊNCIA & MODO ESCURO */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.01 }}
              >
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Aparência
                </p>
                <div className={`rounded-[24px] border overflow-hidden ${
                  isDark ? 'bg-[#1C1C1E] border-white/10 divide-y divide-white/10' : 'bg-[#fefefe] border-black/5 divide-y divide-black/5'
                }`}>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Moon className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Modo Escuro
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                          Tema escuro em todo o aplicativo
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={isDark}
                      onChange={onToggleTheme}
                      ariaLabel="Modo Escuro"
                    />
                  </div>
                </div>
              </motion.div>

              {/* GROUP 1: PREFERÊNCIAS & CLIMA */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.025 }}
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
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetSubView('traveler-profile')}
                    className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Compass className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Meu perfil de viajante
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                          Relação com Campos, próxima visita e interesses
                        </p>
                      </div>
                    </div>
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
                    className={`flex-1 py-3 rounded-full text-sm font-bold transition-all active:scale-95 cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${
                      isDark
                        ? 'bg-white text-black hover:bg-zinc-200 border border-white/10'
                        : 'expo-liquid-glass-btn text-black border border-black/5 hover:bg-zinc-50'
                    }`}
                  >
                    {saveToast ? <Check className={`w-4 h-4 ${isDark ? 'text-black' : 'text-black'}`} /> : null}
                    <span>{saveToast ? 'Salvo!' : 'Salvar alterações'}</span>
                  </button>
                </motion.div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 3.5: MEU PERFIL DE VIAJANTE (ONBOARDING INTELIGENTE)     */}
          {/* ============================================================ */}
          {activeSubView === 'traveler-profile' && (
            <div className="space-y-6 pt-2 pb-10 max-w-xl mx-auto w-full">
              {/* 1. Relação com Campos do Jordão */}
              <div className="space-y-2.5">
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-2">
                  Sua relação com Campos do Jordão
                </p>
                <div className="space-y-2">
                  {CAMPOS_RELATIONSHIP_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = camposRelationship === option.value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setCamposRelationship(option.value)}
                        className={`w-full p-4 rounded-[22px] border text-left transition-all active:scale-[0.985] cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? isDark
                              ? 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF]'
                              : 'bg-[#080808] text-[#FFFFFF] border-[#080808]'
                            : isDark
                              ? 'bg-[#1C1C1E] text-white border-white/10 hover:bg-[#252528]'
                              : 'bg-white text-zinc-950 border-black/5 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="w-5 h-5 shrink-0 stroke-[1.9]" />
                          <span className="text-[15px] font-semibold tracking-tight">
                            {option.label}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0 stroke-[2.8]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Quando pretende visitar */}
              <div className="space-y-2.5">
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-2">
                  Próxima experiência em Campos
                </p>
                <div className="space-y-2">
                  {NEXT_TRIP_TIMING_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = nextTripTiming === option.value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setNextTripTiming(option.value)}
                        className={`w-full p-4 rounded-[22px] border text-left transition-all active:scale-[0.985] cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? isDark
                              ? 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF]'
                              : 'bg-[#080808] text-[#FFFFFF] border-[#080808]'
                            : isDark
                              ? 'bg-[#1C1C1E] text-white border-white/10 hover:bg-[#252528]'
                              : 'bg-white text-zinc-950 border-black/5 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="w-5 h-5 shrink-0 stroke-[1.9]" />
                          <span className="text-[15px] font-semibold tracking-tight">
                            {option.label}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0 stroke-[2.8]" />}
                      </button>
                    );
                  })}

                  <div
                    className={`p-4 rounded-[22px] border flex items-center justify-between gap-3 ${
                      isDark
                        ? 'bg-[#1C1C1E] border-white/10'
                        : 'bg-white border-black/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 shrink-0 stroke-[1.9]" />
                      <span className="text-[14.5px] font-semibold">
                        Data planejada (opcional)
                      </span>
                    </div>
                    <input
                      type="date"
                      value={nextTripDate}
                      onChange={(e) => setNextTripDate(e.target.value)}
                      className={`px-3 py-1.5 rounded-xl border text-[13.5px] font-medium focus:outline-none ${
                        isDark
                          ? 'bg-black border-white/15 text-white'
                          : 'bg-zinc-50 border-black/10 text-zinc-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* 3. O que você gosta de descobrir (Interesses) */}
              <div className="space-y-2.5">
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-2">
                  Seus interesses em Campos
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {INTEREST_CATEGORY_OPTIONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = interestCategories.includes(item.value);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setInterestCategories((prev) =>
                            prev.includes(item.value)
                              ? prev.filter((v) => v !== item.value)
                              : [...prev, item.value]
                          )
                        }
                        className={`p-3.5 rounded-[20px] border text-left transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[92px] ${
                          isSelected
                            ? isDark
                              ? 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF]'
                              : 'bg-[#080808] text-[#FFFFFF] border-[#080808]'
                            : isDark
                              ? 'bg-[#1C1C1E] text-white border-white/10 hover:bg-[#252528]'
                              : 'bg-white text-zinc-950 border-black/5 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between">
                          <Icon className="w-5 h-5 stroke-[1.9]" />
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
                        </div>
                        <span className="text-[13.5px] font-semibold leading-snug mt-2">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Com quem costuma viajar */}
              <div className="space-y-2.5">
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-2">
                  Quem acompanha suas viagens
                </p>
                <div className="space-y-2">
                  {TRAVEL_COMPANY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = travelCompany === option.value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTravelCompany(option.value)}
                        className={`w-full p-4 rounded-[22px] border text-left transition-all active:scale-[0.985] cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? isDark
                              ? 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF]'
                              : 'bg-[#080808] text-[#FFFFFF] border-[#080808]'
                            : isDark
                              ? 'bg-[#1C1C1E] text-white border-white/10 hover:bg-[#252528]'
                              : 'bg-white text-zinc-950 border-black/5 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="w-5 h-5 shrink-0 stroke-[1.9]" />
                          <span className="text-[15px] font-semibold tracking-tight">
                            {option.label}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0 stroke-[2.8]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSavingTravelerPrefs}
                  onClick={handleSaveTravelerPreferences}
                  className={`w-full h-[54px] rounded-full font-semibold text-[16px] flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                      : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                  }`}
                >
                  {isSavingTravelerPrefs ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : travelerSavedToast ? (
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  ) : null}
                  <span>
                    {travelerSavedToast
                      ? 'Preferências salvas!'
                      : 'Salvar preferências'}
                  </span>
                </button>
              </div>
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
});
export default ProfileModal;
