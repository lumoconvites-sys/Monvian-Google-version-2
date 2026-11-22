import React, { useState, useRef, useEffect } from 'react';
import { uploadMediaToSupabaseStorage } from '../lib/supabase';
import { Spot, Itinerary } from '../types';
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
  Globe,
} from 'lucide-react';
import { AppleBackButton } from './ui/AppleBackButton';
import {
  CircularLanguageFlag,
  MONVIAN_LANGUAGE_OPTIONS,
  getLanguageOptionByCode,
} from './ui/CircularLanguageFlag';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
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
import { PlatanoLeafIcon } from './platanos/PlatanoLeafIcon';
import { usePlatanos } from '../hooks/usePlatanos';
import { MyItinerariesView } from './itineraries/MyItinerariesView';
import foldedMap3dIcon from '../assets/images/folded_map_pin_3d.png';
import platanosLeaf3dIcon from '../assets/images/platanos_leaf_hero_3d.png';
import { isAppSoundEnabled, setAppSoundEnabled } from '../utils/soundEffects';

interface ProfileModalProps {
  isOpen: boolean;
  isActive?: boolean;
  onClose: () => void;
  favorites: string[];
  spots: Spot[];
  onSelectSpot: (spot: Spot) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
  zoomDurationMs?: number;
  onChangeZoomDuration?: (ms: number) => void;
  user: any;
  onUpdateUser?: (updatedUser: any) => void;
  onOpenAdmin?: () => void;
  onSubViewChange?: (subView: SubView) => void;
  communityUrl?: string;
  instagramUrl?: string;
  onLogout?: () => void;
  onStartCreateItinerary?: () => void;
  onOpenUserItineraryOnMap?: (itinerary: Itinerary) => void;
  onEditUserItinerary?: (itinerary: Itinerary) => void;
  onDeleteUserItinerary?: (itineraryId: string) => void;
  openMyItinerariesSignal?: number;
}

type SubView =
  | 'main'
  | 'meus-roteiros'
  | 'edit-profile'
  | 'traveler-profile'
  | 'curtidos'
  | 'permissoes'
  | 'ajuda-informacoes'
  | 'logout-confirm';



export const ProfileModal: React.FC<ProfileModalProps> = React.memo(({
  isOpen,
  isActive = true,
  onClose,
  favorites,
  spots,
  onSelectSpot,
  theme,
  onToggleTheme,
  highContrast = false,
  onToggleHighContrast,
  zoomDurationMs = 780,
  onChangeZoomDuration,
  user,
  onUpdateUser,
  onOpenAdmin,
  onSubViewChange,
  communityUrl = 'https://chat.whatsapp.com/invite/monvian-campos',
  instagramUrl = 'https://instagram.com/monvian.campos',
  onLogout,
  onStartCreateItinerary,
  onOpenUserItineraryOnMap,
  onEditUserItinerary,
  onDeleteUserItinerary,
  openMyItinerariesSignal = 0,
}) => {
  const isViewActive = Boolean(isOpen && isActive);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { wallet } = usePlatanos();
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

  const { language, setLanguage, tr } = useLanguage();
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);
  const currentLanguageOption = getLanguageOptionByCode(language);

  const [activeSubView, setActiveSubView] = useState<SubView>(() =>
    openMyItinerariesSignal > 0 ? 'meus-roteiros' : 'main'
  );
  const lastHandledMyItinerariesSignalRef = useRef<number>(openMyItinerariesSignal);
  const [helpLegalPage, setHelpLegalPage] = useState<HelpLegalPageId>('hub');
  const [helpReturnView, setHelpReturnView] = useState<'main' | 'permissoes'>('main');

  const handleSetSubView = (subView: SubView) => {
    setIsLanguageSheetOpen(false);
    setActiveSubView(subView);
    onSubViewChange?.(subView);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    if (isViewActive && scrollContainerRef.current && activeSubView === 'main') {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isViewActive, activeSubView]);

  useEffect(() => {
    if (
      openMyItinerariesSignal > 0 &&
      openMyItinerariesSignal !== lastHandledMyItinerariesSignalRef.current
    ) {
      lastHandledMyItinerariesSignalRef.current = openMyItinerariesSignal;
      setIsLanguageSheetOpen(false);
      setActiveSubView('meus-roteiros');
      onSubViewChange?.('meus-roteiros');
    }
  }, [openMyItinerariesSignal, onSubViewChange]);

  useEffect(() => {
    const handleOpenMyItineraries = () => {
      setIsLanguageSheetOpen(false);
      setActiveSubView('meus-roteiros');
      onSubViewChange?.('meus-roteiros');
    };
    window.addEventListener('monvian:open_my_itineraries', handleOpenMyItineraries);
    return () => {
      window.removeEventListener('monvian:open_my_itineraries', handleOpenMyItineraries);
    };
  }, [onSubViewChange]);

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
    if (!isViewActive || !cleanUserEmail) return;
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
  }, [isViewActive, cleanUserEmail]);

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

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isAppSoundEnabled());

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
    setAppSoundEnabled(val);
  };

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);

  // Register iOS Interactive Edge-Swipe Back Gesture for Profile subviews and modals
  useIOSBackEntry({
    id: `profile:help-legal:${helpLegalPage}`,
    enabled: isViewActive && activeSubView === 'ajuda-informacoes' && helpLegalPage !== 'hub',
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
      isViewActive &&
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
    enabled: isViewActive && isNotificationsOpen,
    priority: 245,
    label: 'Perfil',
    foregroundSelector: '#notifications-fullscreen-view',
    backgroundSelector: '#profile-modal-panel',
    onPop: () => {
      setIsNotificationsOpen(false);
      handleSetSubView('main');
    },
  });

  const isDark = theme === 'dark';
  const favoriteSpots = spots.filter((s) => favorites.includes(s.id));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSaveError('Selecione uma imagem válida (JPEG, PNG ou WEBP).');
      return;
    }

    setIsUploading(true);
    setSaveError('');
    try {
      const publicUrl = await uploadMediaToSupabaseStorage(file, 'avatars', {
        maxDimension: 384,
        quality: 0.82,
        filename: file.name,
      });
      if (!publicUrl) {
        setSaveError('Não foi possível enviar sua foto para o armazenamento. Tente novamente.');
        return;
      }
      setTempAvatar(publicUrl);
      setUserAvatar(publicUrl);
      await saveProfileToBackend(userName, userUsername, userBio, userEmail, publicUrl);
    } catch {
      setSaveError('Erro ao processar a foto selecionada.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
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
      ...(isAdminAccount ? { role: 'admin' } : {}),
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
          ...(isAdminAccount ? { role: 'admin' } : {}),
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
        className="fixed inset-0 z-45 flex flex-col justify-end md:justify-center md:items-center md:p-6 select-none overflow-hidden transition-colors duration-200 md:bg-black/50"
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
          ref={scrollContainerRef}
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
        {activeSubView !== 'ajuda-informacoes' && activeSubView !== 'meus-roteiros' && (
        <div
          className={`sticky top-0 z-20 w-full pb-2 shrink-0 transition-colors ${
            isDark ? 'text-white' : 'text-zinc-950'
          }`}
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 20px)',
            paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.40)' : 'rgba(255, 255, 255, 0.40)',
          }}
        >
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeSubView !== 'main' ? (
              <AppleBackButton
                theme={isDark ? 'dark' : 'light'}
                onClick={() => handleSetSubView('main')}
                title={tr('Voltar')}
                aria-label={tr('Voltar')}
              />
            ) : null}

            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">
              {activeSubView === 'main' && tr('Perfil')}
              {activeSubView === 'edit-profile' && tr('Editar Perfil')}
              {activeSubView === 'traveler-profile' && tr('Meu perfil de viajante')}
              {activeSubView === 'curtidos' && tr('Lugares Curtidos')}
              {activeSubView === 'permissoes' && tr('Configurações')}
              {activeSubView === 'logout-confirm' && tr('Encerrar Sessão')}
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
                title={tr('Notificações')}
                aria-label={tr('Notificações')}
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
          <div
            id="profile-subview-content"
            className="flex-1 flex flex-col w-full"
          >
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
                className={`w-full p-5 sm:p-6 rounded-[28px] border transition-transform duration-150 active:scale-[0.985] cursor-pointer group flex flex-col items-center text-center ${
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
                      <img
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
              </div>

              {/* 1.5. Barra de Progresso Monvian XP por Exploração */}
              <ProfileXpProgressBar isDark={isDark} />

              {/* 2. Feature Cards Grid (Viagens & Conexões) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                {/* Viagens */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={`rounded-[24px] p-4 border transition-colors cursor-default flex flex-col justify-between ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-[#fefefe] border-black/5 shadow-xs'
                  }`}
                >
                  <div className="flex justify-end">
                    <span className="px-2 py-0.5 rounded-full bg-[#0079ff] text-[#ffffff] border-[#008eff] text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: '#0079ff' }}>
                      {tr('NOVO')}
                    </span>
                  </div>
                  <div className="my-2 flex justify-center items-center h-[46px]">
                    <img
                      src="/lugares.png"
                      alt={tr('Viagens')}
                      className="h-[64px] w-auto object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-bold tracking-tight leading-snug">
                        {tr('Viagens')}
                      </h3>
                      <Lock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                    </div>
                  </div>
                </div>

                {/* Conexões */}
                <div
                  onClick={() => {
                    window.open('https://chat.whatsapp.com/BS2Fu5Kws5qE8iaWHWrbCY?s=cl&p=i&mlu=4&ilr=4&iam=2', '_blank');
                  }}
                  className={`rounded-[24px] p-4 border transition-transform duration-150 active:scale-[0.97] cursor-pointer flex flex-col justify-between ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-[#fefefe] border-black/5 shadow-xs'
                  }`}
                >
                  <div className="flex justify-end">
                    <span className="px-2 py-0.5 rounded-full bg-[#0079ff] text-white text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: '#0079ff' }}>
                      {tr('NOVO')}
                    </span>
                  </div>
                  <div className="my-2 flex justify-center items-center h-[46px]">
                    <img
                      src="/conexao.png"
                      alt={tr('Conexões')}
                      className="h-[64px] w-auto object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight leading-snug">
                      {tr('Conexões')}
                    </h3>
                  </div>
                </div>
              </div>


              {/* 3. Plátanos & Carteira + Meus roteiros (2-Column Bento Cards matching iOS Native Reference) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                {/* Plátanos & Carteira */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(
                      new CustomEvent('monvian:open_platanos_wallet', { detail: { tab: 'topup' } })
                    );
                  }}
                  className={`rounded-[24px] p-4 border transition-transform duration-150 active:scale-[0.97] cursor-pointer flex flex-col justify-between text-left ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-[#ffffff] border-black/5 shadow-xs'
                  }`}
                  style={{ backgroundColor: isDark ? undefined : '#ffffff' }}
                >
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </div>
                  <div className="my-2 flex justify-center items-center h-[46px]">
                    <img
                      src={platanosLeaf3dIcon}
                      alt="Plátanos"
                      className="h-[58px] w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
                      draggable={false}
                    />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight leading-snug text-zinc-950 dark:text-white">
                      {tr('Plátanos & Carteira')}
                    </h3>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                      {wallet.balance} {wallet.balance === 1 ? tr('Plátano disponível') : tr('Plátanos disponíveis')}
                    </p>
                  </div>
                </button>

                {/* Meus roteiros */}
                <button
                  type="button"
                  onClick={() => handleSetSubView('meus-roteiros')}
                  className={`rounded-[24px] p-4 border transition-transform duration-150 active:scale-[0.97] cursor-pointer flex flex-col justify-between text-left ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 shadow-xs' : 'bg-[#ffffff] border-black/5 shadow-xs'
                  }`}
                  style={{ backgroundColor: isDark ? undefined : '#ffffff' }}
                >
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </div>
                  <div className="my-2 flex justify-center items-center h-[46px]">
                    <img
                      src={foldedMap3dIcon}
                      alt={tr('Meus roteiros')}
                      className="h-[58px] w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
                      draggable={false}
                    />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight leading-snug text-zinc-950 dark:text-white">
                      {tr('Meus roteiros')}
                    </h3>
                  </div>
                </button>
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
                    className={`w-full p-4 rounded-[22px] border transition-all duration-150 active:scale-[0.985] flex items-center justify-between text-left cursor-pointer ${
                      isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-[#fefefe] border-black/5 hover:bg-[#E5E5EA]/80'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <ShieldCheck className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <h3 className="text-[15px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                        {tr('Painel ADM')}
                      </h3>
                    </div>
                  </button>
                )}

                {/* Configurações da Conta -> opens 'permissoes' */}
                <button
                  type="button"
                  onClick={() => handleSetSubView('permissoes')}
                  className={`w-full p-4 rounded-[22px] border transition-all duration-150 active:scale-[0.985] flex items-center justify-between text-left cursor-pointer ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-[#fefefe] border-black/5 hover:bg-[#E5E5EA]/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                      <Settings className="w-7 h-7 stroke-[1.8]" />
                      <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0079ff] ring-2 ${isDark ? 'ring-[#1C1C1E]' : 'ring-[#fefefe]'}`} style={{ backgroundColor: '#0079ff' }} />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                      {tr('Configurações da conta')}
                    </h3>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openHelpLegalPage('hub', 'main')}
                  className={`w-full p-4 rounded-[22px] border transition-all duration-150 active:scale-[0.985] flex items-center justify-between text-left cursor-pointer ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-[#fefefe] border-black/5 hover:bg-[#E5E5EA]/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                      <Star className="w-7 h-7 stroke-[1.8]" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                      {tr('Ajuda e informações')}
                    </h3>
                  </div>
                </button>

                {/* Sair da conta */}
                <button
                  type="button"
                  onClick={() => handleSetSubView('logout-confirm')}
                  className={`w-full p-4 rounded-[22px] border transition-all duration-150 active:scale-[0.985] flex items-center justify-between text-left cursor-pointer ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]' : 'bg-[#fefefe] border-black/5 hover:bg-[#E5E5EA]/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex items-center justify-center shrink-0 text-red-500">
                      <LogOut className="w-7 h-7 stroke-[1.8]" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-red-500 tracking-tight">
                      {tr('Sair da conta')}
                    </h3>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 1.5: MEUS ROTEIROS (iOS Native User & Purchased Routes) */}
          {/* ============================================================ */}
          {activeSubView === 'meus-roteiros' && (
            <MyItinerariesView
              user={user}
              spots={spots}
              isDark={isDark}
              onBack={() => handleSetSubView('main')}
              onStartCreateNewItinerary={() => {
                onClose();
                onStartCreateItinerary?.();
              }}
              onPlayItineraryOnMap={(itin) => {
                onClose();
                onOpenUserItineraryOnMap?.(itin);
              }}
              onEditItinerary={(itin) => {
                onClose();
                onEditUserItinerary?.(itin);
              }}
              onDeletedItinerary={(itinId) => {
                onDeleteUserItinerary?.(itinId);
              }}
            />
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

              {/* GROUP 1: PREFERÊNCIAS DE MAPA */}
              {onChangeZoomDuration && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.025 }}
                >
                  <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                    Preferências de Mapa
                  </p>
                  <div className={`rounded-[24px] border overflow-hidden ${
                    isDark ? 'bg-[#1C1C1E] border-white/10 divide-y divide-white/5' : 'bg-[#fefefe] border-black/5 divide-y divide-black/5'
                  }`}>
                    {/* Velocidade da Transição de Zoom no Mapa */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                            <Sliders className="w-6 h-6 stroke-[1.8]" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[15px] font-semibold tracking-tight">
                              Transição de Zoom no Mapa
                            </h4>
                            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                              Tempo da animação ao focar pontos
                            </p>
                          </div>
                        </div>
                        <span className="text-[12px] font-bold tabular-nums px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shrink-0">
                          {(zoomDurationMs / 1000).toFixed(2).replace('.', ',')}s
                        </span>
                      </div>

                      <div
                        className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${
                          isDark ? 'bg-black/60 border border-white/10' : 'bg-[#F2F2F2]'
                        }`}
                      >
                        {[
                          { label: 'Ágil', value: 450 },
                          { label: 'Suave', value: 780 },
                          { label: 'Cinemática', value: 1200 },
                        ].map((preset) => {
                          const isPresetActive = Math.abs(zoomDurationMs - preset.value) <= 60;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => onChangeZoomDuration(preset.value)}
                              className={`py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                                isPresetActive
                                  ? 'bg-white text-black shadow-xs'
                                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3 pt-0.5">
                        <span className="text-[11px] font-medium text-zinc-400 tabular-nums shrink-0">
                          0,3s
                        </span>
                        <input
                          type="range"
                          min={300}
                          max={1600}
                          step={50}
                          value={zoomDurationMs}
                          onChange={(e) => onChangeZoomDuration(Number(e.target.value))}
                          aria-label="Tempo da animação de zoom no mapa"
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-200 dark:bg-zinc-700 accent-black dark:accent-white"
                        />
                        <span className="text-[11px] font-medium text-zinc-400 tabular-nums shrink-0">
                          1,6s
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* GROUP 1.5: IDIOMA */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.045 }}
              >
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Idioma
                </p>
                <div
                  className={`rounded-[24px] border overflow-hidden ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 divide-y divide-white/10'
                      : 'bg-[#fefefe] border-black/5 divide-y divide-black/5'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setIsLanguageSheetOpen(true)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                        <Globe className="w-7 h-7 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold tracking-tight">
                          Idioma
                        </h4>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                          Idioma de exibição do aplicativo
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <CircularLanguageFlag
                        lang={language}
                        className="w-6 h-6 ring-1 ring-black/10 dark:ring-white/15 shadow-2xs"
                      />
                      <span
                        data-no-translate
                        className="text-[13.5px] font-semibold text-zinc-700 dark:text-zinc-200 whitespace-nowrap"
                      >
                        {currentLanguageOption.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 stroke-[2.2] shrink-0" />
                    </div>
                  </button>
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
                  {tr('Permanecer')}
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
                  {tr('Sim, sair')}
                </button>
              </div>
            </motion.div>
          )}
          </div>
          </div>
        </div>

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

        {/* Animated iOS Bottom Sheet Card for Language Selection */}
        <AnimatePresence>
          {isLanguageSheetOpen && activeSubView === 'permissoes' && (
            <motion.div
              key="monvian-language-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setIsLanguageSheetOpen(false)}
              className="fixed inset-0 z-[150] bg-black/55 backdrop-blur-[2px] flex flex-col justify-end items-center select-none"
            >
              <motion.div
                key="monvian-language-sheet-card"
                initial={{ y: '100%', opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 380,
                  damping: 34,
                  mass: 0.85,
                }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-lg rounded-t-[34px] border-t border-x overflow-hidden ${
                  isDark
                    ? 'bg-[#141416] border-white/[0.12] text-white shadow-[0_-20px_60px_rgba(0,0,0,0.88)]'
                    : 'bg-[#FFFFFF] border-black/[0.08] text-zinc-950 shadow-[0_-18px_50px_rgba(0,0,0,0.16)]'
                }`}
                style={{
                  paddingBottom: 'max(calc(env(safe-area-inset-bottom, 16px) + 18px), 26px)',
                }}
              >
                {/* iOS Grabber Pill */}
                <div className="w-full flex justify-center pt-3 pb-1.5">
                  <div
                    className={`w-12 h-1.5 rounded-full ${
                      isDark ? 'bg-white/25' : 'bg-black/15'
                    }`}
                  />
                </div>

                {/* Sheet Title Header */}
                <div className="px-6 pt-2.5 pb-4 flex items-center gap-3.5">
                  <Globe
                    className={`w-7 h-7 stroke-[1.85] shrink-0 ${
                      isDark ? 'text-white' : 'text-zinc-950'
                    }`}
                  />
                  <h3 className="text-[22px] font-bold tracking-tight">
                    Idioma
                  </h3>
                </div>

                {/* Language Options Card */}
                <div className="px-4">
                  <div
                    className={`rounded-[26px] border overflow-hidden divide-y ${
                      isDark
                        ? 'bg-[#1C1C1E] border-white/[0.08] divide-white/[0.07]'
                        : 'bg-[#F8F8FA] border-black/[0.06] divide-black/[0.06]'
                    }`}
                  >
                    {MONVIAN_LANGUAGE_OPTIONS.map((option) => {
                      const isSelected = language === option.code;
                      return (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => {
                            try {
                              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                navigator.vibrate(10);
                              }
                            } catch {}
                            setLanguage(option.code);
                            setIsLanguageSheetOpen(false);
                          }}
                          className={`w-full px-4 py-4 flex items-center justify-between gap-3.5 text-left transition-colors cursor-pointer ${
                            isDark
                              ? 'hover:bg-white/[0.04] active:bg-white/[0.08]'
                              : 'hover:bg-black/[0.03] active:bg-black/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <CircularLanguageFlag
                              lang={option.code}
                              className="w-9 h-9 ring-1 ring-black/10 dark:ring-white/10 shadow-xs"
                            />
                            <span
                              data-no-translate
                              className={`text-[17px] font-semibold tracking-tight truncate ${
                                isDark ? 'text-white' : 'text-zinc-950'
                              }`}
                            >
                              {option.label}
                            </span>
                          </div>

                          {isSelected && (
                            <Check
                              className={`w-5 h-5 stroke-[2.3] shrink-0 ${
                                isDark ? 'text-white' : 'text-zinc-950'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
});
export default ProfileModal;
