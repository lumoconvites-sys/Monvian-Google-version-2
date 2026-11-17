import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CAMPOS_SPOTS, INITIAL_WEATHER } from './data/spots';
import { Spot, MapVisualIcon, MapModeType } from './types';
import { MapComponent } from './components/MapComponent';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { SpotDetailSheet } from './components/SpotDetailSheet';
import { SpotPreviewBanner } from './components/SpotPreviewBanner';
import { SearchFilterDrawer } from './components/SearchFilterDrawer';
import { SavedView } from './components/SavedView';
import { ProfileModal } from './components/ProfileModal';
import { ItinerariesView } from './components/ItinerariesView';
import { Itinerary } from './types';
import { favoritesManager } from './services/favoritesManager';
import { CloudRain, SlidersHorizontal, MapPin, Navigation2, Compass, Mic, Search, X, ShieldCheck, Sun, Moon, Building2, UtensilsCrossed, Coffee, Cake, Mountain, Cross, Check, RotateCcw, Star, ChevronRight, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SettingsModal } from './components/SettingsModal';
import { AuthScreen } from './components/AuthScreen';
import { AdminLayout } from './components/admin/AdminLayout';
import { OnboardingFlow } from './components/OnboardingFlow';
import { OnboardingQuestionsModal } from './components/OnboardingQuestionsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Weather3DIcon } from './components/Weather3DIcon';
import { Map3DIcon } from './components/Map3DIcon';
import { RainEffect } from './components/RainEffect';
import { SnowEffect } from './components/SnowEffect';
import { GoldSuccessModal } from './components/GoldSuccessModal';
import { computeAdaptiveThemeColor, applySystemThemeColor } from './utils/themeColor';
import { gpsNavigationManager, calculateHaversineDistance } from './services/gpsNavigation';
import { ActiveMapRoute, acquireUserGpsForRoute, fetchRealRoadRoute } from './services/mapboxDirections';
import { deviceHeadingManager } from './utils/deviceHeading';
import { getSpotImage, getSpotFallbackImage } from './utils/spotImages';
import { VerifiedBadge } from './components/ui/VerifiedBadge';
import { DesktopSidebar } from './components/desktop/DesktopSidebar';
import { DesktopMapControls } from './components/desktop/DesktopMapControls';
import { DesktopExplorePanel } from './components/desktop/DesktopExplorePanel';
import { startPreloadResources } from './utils/preloadItineraries';
import { AirbnbPresentationCard, isPresentationCardSeen, markPresentationCardSeen, PresentationTab } from './components/AirbnbPresentationCard';
import { persistUserToFirestore, syncPermissionsFromDatabase, markWelcomeCardSeen, markGlobeIntroSeen } from './services/firestoreSync';
import { fetchSpotsFromSupabase, subscribeToSpotsChanges } from './services/supabaseSpots';
import { broadcastPlatanosWalletUpdate, getAuthHeaders } from './hooks/usePlatanos';
import { PlatanosWalletModal } from './components/platanos/PlatanosWalletModal';
import { CamposAchievementModal } from './components/CamposAchievementModal';
import { isWithinCamposRadius } from './utils/geoCache';
import { SignupIntroSequence, SignupIntroStage } from './components/SignupIntroSequence';
import { FirstSignupWelcomeScreen } from './components/FirstSignupWelcomeScreen';
import { WelcomeJourneyModal } from './components/WelcomeJourneyModal';
import { XpRewardNotificationOverlay } from './components/XpRewardNotificationOverlay';
import { WhiteConfettiOverlay } from './components/WhiteConfettiOverlay';
import {
  ClothingWeatherModal,
} from './components/ClothingWeatherWidget';
import { IOSInteractiveBackSystem } from './components/IOSInteractiveBackSystem';
import { useIOSBackEntry, iosNavigationManager } from './services/iosNavigationManager';
import { auth, signOut, setCachedAccessToken, waitForFirebaseAuthUser, getFreshFirebaseIdToken } from './lib/firebase';
import { supabase } from './lib/supabase';
import {
  savePersistentSession,
  loadPersistentSession,
  clearPersistentSession,
  clearSyncSessionStorage,
  hasSyncSessionToken,
} from './utils/persistentAuthStorage';
import {
  writeScopedJSON,
  writeScopedString,
  purgeLegacyUnscopedActivityKeys,
} from './utils/userScopedStorage';

const welcomeContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.032,
      delayChildren: 0.15,
    },
  },
};

const welcomeCharVariants = {
  hidden: {
    opacity: 0,
    y: 8,
    filter: 'blur(3px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring' as const,
      damping: 24,
      stiffness: 280,
      mass: 0.7,
    },
  },
};

const normalizeAppUser = (rawUser: any) => {
  if (!rawUser) return null;
  const parsed = { ...rawUser };
  const emailClean = (parsed.email || parsed.whatsapp || '').trim().toLowerCase();
  const usernameClean = (parsed.username || '').trim().toLowerCase();
  const isGoldAdmin =
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(emailClean) ||
    usernameClean === 'marioyesk';
  const isGold =
    isGoldAdmin ||
    Boolean(parsed.isGold || parsed.is_gold === 1 || parsed.isPremium || parsed.is_premium === 1 || parsed.plan === 'gold');
  if (isGoldAdmin) {
    parsed.role = 'admin';
    parsed.is_gold = 1;
    parsed.is_premium = 1;
    parsed.plan = 'gold';
  }
  parsed.isGold = isGold;
  parsed.isPremium = isGold;
  return parsed;
};

export default function App() {
  const [pendingResetOobCode, setPendingResetOobCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'resetPassword' && params.get('oobCode')) {
        return params.get('oobCode');
      }
    } catch {}
    return null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !pendingResetOobCode && hasSyncSessionToken()
  );
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(
    () => !pendingResetOobCode && !hasSyncSessionToken()
  );
  const [authInitialMode, setAuthInitialMode] = useState<'landing' | 'login'>('landing');
  const manualLogoutRef = useRef<boolean>(false);
  const [user, setUser] = useState<any>(() => {
    try {
      const token = localStorage.getItem('monvian_token');
      const savedUser = localStorage.getItem('monvian_user');
      if (token && savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && (parsed.id || parsed.email || parsed.whatsapp || parsed.username)) {
          return normalizeAppUser(parsed);
        }
      }
    } catch {}
    return null;
  });
  const [snowEnabled, setSnowEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_snow_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [rainEnabled, setRainEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_rain_user_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Global Theme State: persisted across sessions ('light' | 'dark')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('monvian_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Sync DOM theme classes immediately on mount & change
  useEffect(() => {
    const isDarkTheme = theme === 'dark';
    const bg = isDarkTheme ? '#000000' : '#ffffff';
    try {
      localStorage.setItem('monvian_theme', theme);
      localStorage.setItem('monvian_theme_mode', theme);
    } catch {}
    document.documentElement.classList.toggle('dark', isDarkTheme);
    document.documentElement.classList.toggle('light', !isDarkTheme);
    document.documentElement.style.colorScheme = isDarkTheme ? 'dark' : 'light';
    document.documentElement.style.backgroundColor = bg;
    if (document.body) document.body.style.backgroundColor = bg;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', bg);
    });
  }, [theme]);

  // Preload all itinerary images in background as soon as app opens, even if user is on another tab
  useEffect(() => {
    startPreloadResources();

    // Referral tracking listener on mount (/indique/:code or ?ref=code)
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const queryRef = searchParams.get('ref') || searchParams.get('indique') || searchParams.get('referral');
      const pathname = window.location.pathname;
      let refCode = queryRef;
      if (!refCode && pathname.includes('/indique/')) {
        refCode = pathname.split('/indique/')[1]?.split('/')[0];
      }
      if (refCode) {
        const cleanCode = refCode.trim().toLowerCase();
        localStorage.setItem('monvian_referral_code', cleanCode);
        fetch('/api/referral/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cleanCode }),
        }).catch(() => {});
      }
    } catch {}
  }, []);

  // Map style mode state
  const [mapStyle, setMapStyle] = useState<MapModeType>('animado');

  // Desktop Sidebar Compact Mode: Collapsed by default (72px)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState<boolean>(true);

  useEffect(() => {
    const w = isDesktopSidebarCollapsed ? '72px' : '250px';
    document.documentElement.style.setProperty('--desktop-sidebar-width', w);
  }, [isDesktopSidebarCollapsed]);

  // Accessibility: High Contrast Mode State
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_high_contrast');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Map interaction state for Apple iOS translucent dynamic effects
  const [isMapInteracting, setIsMapInteracting] = useState<boolean>(false);
  const [isMapOrbiting, setIsMapOrbiting] = useState<boolean>(false);

  // Welcome translucent overlay & Onboarding questionnaire on new account creation
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState<boolean>(false);
  const [showOnboardingQuestions, setShowOnboardingQuestions] = useState<boolean>(() => {
    try {
      const token = localStorage.getItem('monvian_token');
      const savedUser = localStorage.getItem('monvian_user');
      if (!token || !savedUser) return false;
      const parsed = JSON.parse(savedUser);
      const cleanEmail = String(parsed?.email || parsed?.whatsapp || '').trim().toLowerCase();
      if (!cleanEmail) return false;
      if (parsed?.onboarding_completed === 0) return true;
      return (
        parsed?.onboarding_completed !== 1 &&
        localStorage.getItem(`monvian_smart_onboarding_pending_${cleanEmail}`) === '1'
      );
    } catch {
      return false;
    }
  });
  const [airbnbCardTab, setAirbnbCardTab] = useState<PresentationTab | null>(null);
  const [showFirstSignupWelcome, setShowFirstSignupWelcome] = useState<boolean>(() => {
    try {
      const savedUser = localStorage.getItem('monvian_user');
      if (!savedUser) return false;
      const parsed = JSON.parse(savedUser);
      const email = String(parsed?.email || parsed?.whatsapp || '').trim().toLowerCase();
      if (!email) return false;
      if (parsed?.onboarding_completed === 0) return false;
      if (parsed?.welcome_card_seen === 1) return false;
      if (localStorage.getItem(`monvian_first_welcome_seen_${email}`) === '1') return false;
      return localStorage.getItem(`monvian_first_welcome_pending_${email}`) === '1';
    } catch {
      return false;
    }
  });
  const [isGlobeIntroPending, setIsGlobeIntroPending] = useState<boolean>(() => {
    try {
      const savedUser = localStorage.getItem('monvian_user');
      if (!savedUser) return false;
      const parsed = JSON.parse(savedUser);
      const email = String(parsed?.email || parsed?.whatsapp || '').trim().toLowerCase();
      if (!email) return false;
      if (parsed?.globe_intro_seen === 1) return false;
      if (localStorage.getItem(`monvian_globe_intro_seen_${email}`) === '1') return false;
      return localStorage.getItem(`monvian_globe_intro_pending_${email}`) === '1';
    } catch {
      return false;
    }
  });
  const [isGlobeIntroPlaying, setIsGlobeIntroPlaying] = useState<boolean>(false);
  const [arrivalConfettiTrigger, setArrivalConfettiTrigger] = useState<number>(0);
  const [signupIntroStage, setSignupIntroStage] = useState<SignupIntroStage>('idle');
  const [isWelcomeJourneyOpen, setIsWelcomeJourneyOpen] = useState<boolean>(false);
  const [pendingWelcomeJourney, setPendingWelcomeJourney] = useState<boolean>(false);
  const [isOnboardingItinerarySelection, setIsOnboardingItinerarySelection] = useState<boolean>(false);
  const [isUserLocationSpotlightActive, setIsUserLocationSpotlightActive] = useState<boolean>(false);
  const hasExecutedSignupIntroRef = useRef<boolean>(false);
  const authEpochRef = useRef<number>(0);
  const isSignupRevealActive = signupIntroStage !== 'idle';
  const isOnboardingRevealReady = signupIntroStage === 'revealing' || signupIntroStage === 'idle';
  const [explorarEntranceTick, setExplorarEntranceTick] = useState<number>(0);
  const [zoomToUserTrigger, setZoomToUserTrigger] = useState<number>(0);
  const [revertSpotZoomTrigger, setRevertSpotZoomTrigger] = useState<number>(0);
  const [spotPreviewMode, setSpotPreviewMode] = useState<'card' | 'bar'>('bar');

  // Settings & Theme modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState<boolean>(false);
  const [isGoldSuccessModalOpen, setIsGoldSuccessModalOpen] = useState<boolean>(false);
  const [isChatKeyboardOpen, setIsChatKeyboardOpen] = useState<boolean>(false);
  const [isPlatanosWalletOpen, setIsPlatanosWalletOpen] = useState<boolean>(false);
  const [platanosWalletTab, setPlatanosWalletTab] = useState<'topup' | 'history'>('topup');
  const [isCamposAchievementOpen, setIsCamposAchievementOpen] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('conquista') === 'campos';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleOpenWallet = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setPlatanosWalletTab(detail?.tab === 'history' ? 'history' : 'topup');
      setIsPlatanosWalletOpen(true);
    };
    const handleOpenCamposAchievement = () => {
      setIsCamposAchievementOpen(true);
    };
    const handleCloseAll = () => {
      setIsPlatanosWalletOpen(false);
      setIsCamposAchievementOpen(false);
    };
    window.addEventListener('monvian:open_platanos_wallet', handleOpenWallet);
    window.addEventListener('monvian:open_campos_achievement', handleOpenCamposAchievement);
    window.addEventListener('monvian-close-modals', handleCloseAll);
    return () => {
      window.removeEventListener('monvian:open_platanos_wallet', handleOpenWallet);
      window.removeEventListener('monvian:open_campos_achievement', handleOpenCamposAchievement);
      window.removeEventListener('monvian-close-modals', handleCloseAll);
    };
  }, []);

  // Handle Stripe Checkout return & Official Webhook / Backend Verification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    const platanosPayment = params.get('platanos_payment');
    const packageIdParam = params.get('package_id');

    if (platanosPayment === 'success' && sessionId) {
      fetch(`/api/platanos/verify-session?session_id=${encodeURIComponent(sessionId)}`, {
        headers: getAuthHeaders(),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.wallet) {
            broadcastPlatanosWalletUpdate(data.wallet);
          } else {
            broadcastPlatanosWalletUpdate();
          }
          setActiveTab('roteiros');
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('monvian:open_platanos_wallet', { detail: { tab: 'history' } })
            );
          }, 250);
        })
        .catch((err) => {
          console.error('Error verifying Plátanos Stripe session:', err);
        })
        .finally(() => {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        });
      return;
    } else if (platanosPayment === 'cancelled') {
      fetch('/api/platanos/cancel-order', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sessionId, packageId: packageIdParam }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.wallet) broadcastPlatanosWalletUpdate(data.wallet);
        })
        .catch(() => {})
        .finally(() => {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        });
      return;
    }

    if (payment === 'success' && sessionId) {
      const token = localStorage.getItem('monvian_token');
      fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && (data.is_gold === 1 || data.isGold)) {
            setUser((prev: any) => {
              const updated = {
                ...(prev || data.user || {}),
                plan: 'gold' as const,
                isGold: true,
                isPremium: true,
                is_gold: 1,
                is_premium: 1,
              };
              localStorage.setItem('monvian_user', JSON.stringify(updated));
              localStorage.setItem('monvian_is_gold', 'true');
              localStorage.setItem('monvian_is_premium', 'true');
              if (token) {
                savePersistentSession(token, updated).catch(() => {});
              }
              return updated;
            });
            setIsGoldSuccessModalOpen(true);
          }
        })
        .catch((err) => {
          console.error('Error verifying Stripe session:', err);
        })
        .finally(() => {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        });
    } else if (payment === 'cancelled') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // Standalone PWA detection vs standard mobile web browser
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
    };
    checkStandalone();
    const mql = window.matchMedia('(display-mode: standalone)');
    mql.addEventListener?.('change', checkStandalone);
    window.addEventListener('resize', checkStandalone);
    return () => {
      mql.removeEventListener?.('change', checkStandalone);
      window.removeEventListener('resize', checkStandalone);
    };
  }, []);

  // Viewport real & dynamic height syncing for iOS PWA and mobile devices
  useEffect(() => {
    const isTextInputActive = () => {
      try {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return false;
        const tag = (el.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(el.isContentEditable);
      } catch {
        return false;
      }
    };

    const updateAppHeight = () => {
      try {
        const globalUpdater = (window as any).__monvianUpdateViewportHeight;
        if (typeof globalUpdater === 'function') {
          globalUpdater();
          return;
        }

        const isStandaloneMode =
          window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          (window.navigator as any).standalone === true;

        let isLandscape = false;
        if (window.screen?.orientation && typeof window.screen.orientation.angle === 'number') {
          isLandscape = Math.abs(window.screen.orientation.angle) === 90;
        } else if (typeof window.orientation === 'number') {
          isLandscape = Math.abs(Number(window.orientation)) === 90;
        } else if (window.matchMedia) {
          isLandscape = window.matchMedia('(orientation: landscape)').matches;
        }

        let screenH = 0;
        if (typeof window !== 'undefined' && window.screen && window.screen.height && window.screen.width) {
          screenH = isLandscape
            ? Math.min(window.screen.width, window.screen.height)
            : Math.max(window.screen.width, window.screen.height);
        }

        const innerH = window.innerHeight || 0;
        const clientH = document.documentElement?.clientHeight || 0;
        const vvH = window.visualViewport?.height || 0;
        const vvOffsetTop = window.visualViewport?.offsetTop || 0;

        let h = 0;
        const isIOS =
          /iPhone|iPod|iPad/i.test(navigator.userAgent || '') ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isStandaloneMode && screenH > 0) {
          h = Math.round(Math.max(innerH, clientH, screenH));
        } else {
          const candidate = Math.max(innerH, clientH);
          if (isIOS && screenH > candidate && screenH - candidate <= 105) {
            h = Math.round(screenH);
          } else {
            h = Math.round(candidate || screenH);
          }
        }

        const fullH = h > 0 ? `max(${h}px, 100dvh)` : '100dvh';
        if (h > 0) {
          document.documentElement.style.setProperty('--app-height-px', `${h}px`);
        }
        document.documentElement.style.setProperty('--app-height', fullH);
        document.documentElement.style.height = fullH;
        document.documentElement.style.minHeight = fullH;
        if (document.body) {
          document.body.style.height = fullH;
          document.body.style.minHeight = fullH;
        }
        const rootEl = document.getElementById('root');
        if (rootEl) {
          rootEl.style.height = fullH;
          rootEl.style.minHeight = fullH;
        }

        if (
          typeof window !== 'undefined' &&
          !document.body.classList.contains('is-login-screen') &&
          !document.documentElement.classList.contains('is-login-screen')
        ) {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          const rootEl = document.getElementById('root');
          if (rootEl) rootEl.scrollTop = 0;
        }
        try {
          window.dispatchEvent(new CustomEvent('monvian:viewport-stabilized', { detail: { height: h } }));
        } catch {}
      } catch (e) {}
    };

    const timers: number[] = [];
    const scheduleStabilization = () => {
      updateAppHeight();
      requestAnimationFrame(updateAppHeight);
      [50, 150, 300, 600, 1000].forEach((ms) => {
        timers.push(window.setTimeout(updateAppHeight, ms));
      });
    };

    scheduleStabilization();
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo(0, 0);
    }

    window.addEventListener('resize', updateAppHeight, { passive: true });
    window.addEventListener('orientationchange', scheduleStabilization, { passive: true });
    window.addEventListener('pageshow', scheduleStabilization, { passive: true });
    window.addEventListener('focus', scheduleStabilization, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateAppHeight, { passive: true });
      window.visualViewport.addEventListener('scroll', updateAppHeight, { passive: true });
    }

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', scheduleStabilization, { passive: true });
    }

    const mql = window.matchMedia('(display-mode: standalone)');
    mql.addEventListener?.('change', scheduleStabilization);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        scheduleStabilization();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility, { passive: true });

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', updateAppHeight);
      window.removeEventListener('orientationchange', scheduleStabilization);
      window.removeEventListener('pageshow', scheduleStabilization);
      window.removeEventListener('focus', scheduleStabilization);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateAppHeight);
        window.visualViewport.removeEventListener('scroll', updateAppHeight);
      }
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', scheduleStabilization);
      }
      mql.removeEventListener?.('change', scheduleStabilization);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Ensure iOS keyboard and scroll offsets from login/landing never leave a bottom gap when entering the main app
  useEffect(() => {
    if (!isAuthenticated) return;
    const resetViewportPosition = () => {
      try {
        document.documentElement.classList.remove('is-login-screen');
        document.body.classList.remove('is-login-screen');
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        const rootEl = document.getElementById('root');
        if (rootEl) rootEl.scrollTop = 0;
      } catch {}
    };
    resetViewportPosition();
    const rafId = requestAnimationFrame(resetViewportPosition);
    const t1 = window.setTimeout(resetViewportPosition, 100);
    const t2 = window.setTimeout(resetViewportPosition, 350);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isAuthenticated]);

  const handleToggleWeather = useCallback(() => {
    setIsWeatherModalOpen((prev) => !prev);
  }, []);

  const performFullLogout = useCallback((options?: { redirectToLogin?: boolean }) => {
    const shouldRedirectToLogin = Boolean(options?.redirectToLogin);
    authEpochRef.current += 1;
    manualLogoutRef.current = true;
    let token: string | null = null;
    try {
      token = localStorage.getItem('monvian_token');
    } catch {}

    // 1. Immediately wipe synchronous storage & cookies; keep manual logout guard only for explicit logouts
    clearSyncSessionStorage({ preserveManualLogoutFlag: shouldRedirectToLogin });
    purgeLegacyUnscopedActivityKeys();
    favoritesManager.reset();
    if (shouldRedirectToLogin) {
      try {
        localStorage.setItem('monvian_manual_logout', '1');
      } catch {}
    }
    setCachedAccessToken(null);

    // 2. Keep 'landing' as default on session expiration; open 'login' only on explicit Profile sign-out
    setAuthInitialMode(shouldRedirectToLogin ? 'login' : 'landing');
    hasExecutedSignupIntroRef.current = false;
    setIsOnboardingItinerarySelection(false);
    setShowFirstSignupWelcome(false);
    setIsGlobeIntroPending(false);
    setIsGlobeIntroPlaying(false);
    setArrivalConfettiTrigger(0);
    setSignupIntroStage('idle');
    setPendingWelcomeJourney(false);
    setSelectedItinerary(null);
    setSelectedSpot(null);
    setIsDetailOpen(false);
    setIsAdminOpen(false);
    setIsSettingsModalOpen(false);
    setUser(null);
    setIsAuthChecking(false);
    setIsAuthenticated(false);
    setActiveTab('explorar');
    setTabHistory([]);
    iosNavigationManager.resetAll();
    window.dispatchEvent(new CustomEvent('monvian:user_logged_out'));

    // 3. Revoke token on backend, sign out Firebase & Supabase, and clear IndexedDB asynchronously
    void Promise.allSettled([
      fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ token: token || undefined }),
      }),
      supabase ? supabase.auth.signOut() : Promise.resolve(),
      signOut(auth),
      clearPersistentSession({ preserveManualLogoutFlag: shouldRedirectToLogin }),
    ]);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const myEpoch = authEpochRef.current;

    const applyAuthenticatedUser = async (token: string, rawUser: any) => {
      if (!isMounted || myEpoch !== authEpochRef.current) return;
      const normalized = normalizeAppUser(rawUser);
      if (!normalized) return;

      if (normalized.location_permission_granted === 1) {
        try {
          localStorage.setItem('monvian_location_permission_granted', 'true');
          document.cookie = 'monvian_location_granted=true; max-age=315360000; path=/; SameSite=Lax';
        } catch {}
      }
      if (normalized.motion_permission_granted === 1) {
        try {
          localStorage.setItem('monvian_motion_permission_granted', 'true');
          localStorage.setItem('monvian_compass_permission_handled', 'true');
          document.cookie = 'monvian_motion_granted=true; max-age=315360000; path=/; SameSite=Lax';
        } catch {}
      }

      purgeLegacyUnscopedActivityKeys();
      try {
        localStorage.setItem('monvian_token', token);
        localStorage.setItem('monvian_user', JSON.stringify(normalized));
      } catch {}
      await savePersistentSession(token, normalized);
      if (!isMounted || myEpoch !== authEpochRef.current) return;

      const userEmail = (normalized.email || normalized.whatsapp || '').trim().toLowerCase();
      if (userEmail) {
        syncPermissionsFromDatabase(userEmail).catch(() => {});
        try {
          const needsSmartOnboarding = Boolean(
            normalized.onboarding_completed === 0 ||
              (normalized.onboarding_completed !== 1 &&
                localStorage.getItem(`monvian_smart_onboarding_pending_${userEmail}`) === '1')
          );
          if (needsSmartOnboarding) {
            localStorage.setItem(`monvian_smart_onboarding_pending_${userEmail}`, '1');
            setShowOnboardingQuestions(true);
            setShowFirstSignupWelcome(false);
          } else {
            localStorage.removeItem(`monvian_smart_onboarding_pending_${userEmail}`);
            setShowOnboardingQuestions(false);
            if (normalized.welcome_card_seen === 1) {
              localStorage.setItem(`monvian_first_welcome_seen_${userEmail}`, '1');
              localStorage.removeItem(`monvian_first_welcome_pending_${userEmail}`);
              setShowFirstSignupWelcome(false);
            } else if (
              localStorage.getItem(`monvian_first_welcome_seen_${userEmail}`) !== '1' &&
              localStorage.getItem(`monvian_first_welcome_pending_${userEmail}`) === '1'
            ) {
              setShowFirstSignupWelcome(true);
            }
          }
          if (normalized.globe_intro_seen === 1) {
            localStorage.setItem(`monvian_globe_intro_seen_${userEmail}`, '1');
            localStorage.removeItem(`monvian_globe_intro_pending_${userEmail}`);
            setIsGlobeIntroPending(false);
            setIsGlobeIntroPlaying(false);
          } else if (
            localStorage.getItem(`monvian_globe_intro_seen_${userEmail}`) !== '1' &&
            localStorage.getItem(`monvian_globe_intro_pending_${userEmail}`) === '1'
          ) {
            setIsGlobeIntroPending(true);
          }
        } catch {}
      }
      if (!isMounted || myEpoch !== authEpochRef.current) return;
      favoritesManager.setActiveAccount(normalized);
      window.dispatchEvent(new CustomEvent('monvian:account_switched', { detail: normalized }));
      setUser(normalized);
      setIsAuthenticated(true);
      setIsAuthChecking(false);
    };

    const restoreFromOfficialProviders = async (): Promise<{ token: string; user: any } | null> => {
      try {
        if (manualLogoutRef.current || localStorage.getItem('monvian_manual_logout') === '1') {
          return null;
        }
      } catch {
        if (manualLogoutRef.current) return null;
      }

      // 1. Try official Supabase Auth (backed by IndexedDB adapter + automatic refresh_token renewal)
      if (supabase) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          let supaAccessToken = sessionData?.session?.access_token || null;

          if (sessionData?.session?.expires_at && sessionData.session.expires_at * 1000 < Date.now() + 60_000) {
            try {
              const { data: refreshed } = await supabase.auth.refreshSession();
              if (refreshed?.session?.access_token) {
                supaAccessToken = refreshed.session.access_token;
              }
            } catch {}
          }

          if (supaAccessToken) {
            const syncRes = await fetch('/api/auth/supabase-sync', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: supaAccessToken }),
            });
            if (syncRes.ok) {
              const syncData = await syncRes.json();
              if (syncData?.success && syncData?.token && syncData?.user) {
                return { token: syncData.token, user: syncData.user };
              }
            }
          }
        } catch {}
      }

      // 2. Try official Firebase Auth IndexedDB persistence (waits cleanly for hydration)
      try {
        const fbUser = await waitForFirebaseAuthUser(2500);
        if (fbUser?.email && !manualLogoutRef.current) {
          const idToken = await getFreshFirebaseIdToken(false);
          const googleRes = await fetch('/api/auth/google', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: fbUser.email,
              name: fbUser.displayName || fbUser.email.split('@')[0],
              avatar_url: fbUser.photoURL || undefined,
              google_uid: fbUser.uid || undefined,
              idToken: idToken || undefined,
            }),
          });
          if (googleRes.ok) {
            const googleData = await googleRes.json();
            if (googleData?.success && googleData?.token && googleData?.user) {
              return { token: googleData.token, user: googleData.user };
            }
          }
        }
      } catch {}

      return null;
    };

    const bootstrapSession = async () => {
      if (pendingResetOobCode) {
        if (isMounted) setIsAuthChecking(false);
        return;
      }
      try {
        const stored = await loadPersistentSession();

        if (!isMounted || myEpoch !== authEpochRef.current) return;

        if (!stored?.token) {
          // Wait for official Firebase IndexedDB & Supabase IndexedDB sessions before concluding logged-out
          const restored = await restoreFromOfficialProviders();
          if (!isMounted || myEpoch !== authEpochRef.current) return;
          if (restored && !manualLogoutRef.current) {
            await applyAuthenticatedUser(restored.token, restored.user);
            return;
          }
          setUser(null);
          setIsAuthenticated(false);
          return;
        }

        // If restored from IndexedDB or cookie when localStorage was empty, enter app immediately while verifying
        if (stored.user && isMounted && myEpoch === authEpochRef.current) {
          setUser(normalizeAppUser(stored.user));
          setIsAuthenticated(true);
          setIsAuthChecking(false);
        }

        const savedEmail = String(stored.user?.email || stored.user?.whatsapp || '').trim().toLowerCase();

        const res = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${stored.token}`,
            ...(savedEmail ? { 'x-user-email': savedEmail } : {}),
          },
          cache: 'no-store',
        });

        if (!isMounted || myEpoch !== authEpochRef.current) return;

        if (res.status === 401 || res.status === 403) {
          // Token was rejected or expired: attempt silent official provider renewal before logging out
          const restored = await restoreFromOfficialProviders();
          if (!isMounted || myEpoch !== authEpochRef.current) return;
          if (restored && !manualLogoutRef.current) {
            await applyAuthenticatedUser(restored.token, restored.user);
            return;
          }
          await performFullLogout();
          return;
        }

        if (!res.ok) {
          // On transient 5xx cold start, preserve cached IndexedDB/localStorage session if valid user exists
          if (!stored.user && isMounted && myEpoch === authEpochRef.current) {
            await performFullLogout();
          }
          return;
        }

        const data = await res.json();
        if (!isMounted || myEpoch !== authEpochRef.current) return;
        if (!data?.success || !data?.user) {
          const restored = await restoreFromOfficialProviders();
          if (!isMounted || myEpoch !== authEpochRef.current) return;
          if (restored && !manualLogoutRef.current) {
            await applyAuthenticatedUser(restored.token, restored.user);
            return;
          }
          await performFullLogout();
          return;
        }

        if (!manualLogoutRef.current) {
          const activeToken = data.refreshedToken || stored.token;
          await applyAuthenticatedUser(activeToken, data.user);
        }
      } catch {
        // Offline or transient network failure: preserve persisted IndexedDB/localStorage session cleanly
        if (isMounted && myEpoch === authEpochRef.current) {
          const fallback = await loadPersistentSession().catch(() => null);
          if (!isMounted || myEpoch !== authEpochRef.current) return;
          if (fallback?.token && fallback?.user) {
            setUser(normalizeAppUser(fallback.user));
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } finally {
        if (isMounted && myEpoch === authEpochRef.current) {
          setIsAuthChecking(false);
        }
      }
    };

    bootstrapSession();

    // Single coordinated Supabase auth state listener (handles silent refresh updates without duplicate listeners)
    const supaSub = supabase
      ? supabase.auth.onAuthStateChange((event: string, session: any) => {
          if (!isMounted || manualLogoutRef.current) return;
          if (event === 'TOKEN_REFRESHED' && session?.access_token) {
            // Backend persistent token remains active; optionally refresh backend mirror silently if token missing
            loadPersistentSession().then((curr) => {
              if (!curr?.token && session?.access_token && isMounted && !manualLogoutRef.current) {
                fetch('/api/auth/supabase-sync', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ access_token: session.access_token }),
                })
                  .then((r) => (r.ok ? r.json() : null))
                  .then((d) => {
                    if (d?.success && d?.token && d?.user && isMounted && !manualLogoutRef.current) {
                      applyAuthenticatedUser(d.token, d.user);
                    }
                  })
                  .catch(() => {});
              }
            });
          }
        })
      : null;

    const handleUserUpdated = (e: any) => {
      if (e?.detail && isMounted && !manualLogoutRef.current) {
        const activeToken = localStorage.getItem('monvian_token');
        if (activeToken) {
          setUser((prev: any) => {
            const merged = normalizeAppUser({ ...(prev || {}), ...e.detail });
            savePersistentSession(activeToken, merged).catch(() => {});
            favoritesManager.setActiveAccount(merged);
            return merged;
          });
        }
      }
    };
    window.addEventListener('monvian:user_updated', handleUserUpdated);

    return () => {
      isMounted = false;
      supaSub?.data?.subscription?.unsubscribe?.();
      window.removeEventListener('monvian:user_updated', handleUserUpdated);
    };
  }, [performFullLogout]);

  // Save settings on change to localStorage and backend database
  useEffect(() => {
    localStorage.setItem('monvian_rain_user_enabled', JSON.stringify(rainEnabled));
    localStorage.setItem('monvian_snow_enabled', JSON.stringify(snowEnabled));
    localStorage.setItem('monvian_theme', theme);
    localStorage.setItem('monvian_high_contrast', JSON.stringify(highContrast));

    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    const isDarkTheme = theme === 'dark';
    const bg = isDarkTheme ? '#000000' : '#ffffff';
    document.documentElement.classList.toggle('dark', isDarkTheme);
    document.documentElement.classList.toggle('light', !isDarkTheme);
    document.documentElement.style.colorScheme = isDarkTheme ? 'dark' : 'light';
    document.documentElement.style.backgroundColor = bg;
    if (document.body) document.body.style.backgroundColor = bg;

    const token = localStorage.getItem('monvian_token');

    if (token && user) {
      fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rain_enabled: rainEnabled, snow_enabled: snowEnabled, theme, high_contrast: highContrast })
      }).catch(() => {});

      persistUserToFirestore({
        ...user,
        snow_enabled: snowEnabled ? 1 : 0,
        theme: theme,
        high_contrast: highContrast ? 1 : 0,
      }).catch(() => {});
    }
  }, [rainEnabled, snowEnabled, theme, highContrast, user]);

  const [spots, setSpots] = useState<Spot[]>(() => {
    try {
      const cached = localStorage.getItem('monvian_cached_spots');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return CAMPOS_SPOTS;
  });
  const [mapVisualIcons, setMapVisualIcons] = useState<MapVisualIcon[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveMapRoute | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const routeErrorTimerRef = useRef<number | null>(null);
  const routeFitCounterRef = useRef<number>(0);
  const isBackgroundReroutingRef = useRef<boolean>(false);
  const selectedSpotIdRef = useRef<string | null>(null);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [hasToggled3D, setHasToggled3D] = useState<boolean>(false);

  useEffect(() => {
    selectedSpotIdRef.current = selectedSpot?.id || null;
  }, [selectedSpot?.id]);

  const fetchSpots = async () => {
    try {
      const spotsData = await fetchSpotsFromSupabase();
      if (spotsData && spotsData.length > 0) {
        setSpots(spotsData);
      }
    } catch (e) {
      console.warn('Using offline spots fallback', e);
    }
  };

  const fetchVisualIcons = async () => {
    setMapVisualIcons([]);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSystemSettings(data.settings);
        if (typeof data.settings.mapbox_access_token === 'string' && data.settings.mapbox_access_token.trim()) {
          try {
            localStorage.setItem('monvian_mapbox_token', data.settings.mapbox_access_token.trim());
          } catch {}
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchSpots();
    fetchVisualIcons();
    fetchSettings();

    const unsubscribeRealtime = subscribeToSpotsChanges(() => {
      fetchSpots();
    });

    const handleSpotsUpdated = (e: any) => {
      const updated = e.detail?.spot || e.detail;
      if (updated && updated.id) {
        setSpots((prev) => {
          const exists = prev.some((s) => s.id === updated.id);
          const next = exists
            ? prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
            : [updated, ...prev];
          try {
            localStorage.setItem('monvian_cached_spots', JSON.stringify(next));
          } catch (err) {}
          return next;
        });
        setSelectedSpot((prev) =>
          prev && prev.id === updated.id ? { ...prev, ...updated } : prev
        );
      }
      fetchSpots();
    };

    const handleVisualIconsUpdated = (e: any) => {
      const updated = e?.detail;
      if (updated && updated.id) {
        setMapVisualIcons((prev) => {
          const exists = prev.some((i) => i.id === updated.id);
          if (exists) {
            return prev.map((i) => (i.id === updated.id ? updated : i));
          } else {
            return [updated, ...prev];
          }
        });
      }
      fetchVisualIcons();
    };

    let lastFocusFetch = 0;
    const handleWindowFocus = () => {
      const now = Date.now();
      if (now - lastFocusFetch > 45000) {
        lastFocusFetch = now;
        fetchSpots();
        fetchVisualIcons();
      }
    };

    window.addEventListener('monvian:spots_updated', handleSpotsUpdated);
    window.addEventListener('monvian:visual_icons_updated', handleVisualIconsUpdated);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('monvian:spots_updated', handleSpotsUpdated);
      window.removeEventListener('monvian:visual_icons_updated', handleVisualIconsUpdated);
      window.removeEventListener('focus', handleWindowFocus);
      unsubscribeRealtime();
    };
  }, []);

  const wasAdminOpenRef = useRef(false);
  useEffect(() => {
    if (wasAdminOpenRef.current && !isAdminOpen) {
      fetchSpots();
      fetchVisualIcons();
    }
    wasAdminOpenRef.current = isAdminOpen;
  }, [isAdminOpen]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('explorar');
  const [tabHistory, setTabHistory] = useState<TabType[]>([]);

  // Spot card dynamic layout behavior
  const isSpotCardOpen = Boolean(selectedSpot && !isDetailOpen && activeTab === 'explorar');

  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);

  const [favorites, setFavorites] = useState<string[]>(() => {
    const s = favoritesManager.getState();
    return Array.from(new Set([...s.spots, ...s.places]));
  });

  useEffect(() => {
    const unsubscribe = favoritesManager.subscribe(() => {
      const s = favoritesManager.getState();
      setFavorites(Array.from(new Set([...s.spots, ...s.places])));
    });
    return () => unsubscribe();
  }, []);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [isCategoryCardOpen, setIsCategoryCardOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Dynamic adaptive system & status bar color based on current screen / modal / theme
  const currentAdaptiveColor = useMemo(() => {
    return computeAdaptiveThemeColor({
      theme,
      activeTab,
      isAuthenticated,
      mapStyle,
      isDetailOpen,
      isWeatherModalOpen,
      isAdminOpen,
      isCategoryCardOpen,
      isSearchOpen,
    });
  }, [
    theme,
    activeTab,
    isAuthenticated,
    mapStyle,
    isDetailOpen,
    isWeatherModalOpen,
    isAdminOpen,
    isCategoryCardOpen,
    isSearchOpen,
  ]);

  // Synchronize mobile browser address/status bar and root theme-color
  useEffect(() => {
    applySystemThemeColor(currentAdaptiveColor);
  }, [currentAdaptiveColor]);

  // Handle URL deep link from QR Code (?spot=spotId)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (spots.length === 0) return;
      const spotParam = params.get('spot');
      if (spotParam) {
        const found = spots.find(
          (s) =>
            s.id.toLowerCase() === spotParam.toLowerCase() ||
            s.name.toLowerCase() === spotParam.toLowerCase()
        );
        if (found) {
          setSelectedSpot(found);
          setIsDetailOpen(true);
        }
      }
    } catch (e) {
      console.warn('Error processing deep link param from URL:', e);
    }
  }, [spots]);

  // Keep URL query parameter in sync with currently viewed spot
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (isDetailOpen && selectedSpot) {
        url.searchParams.set('spot', selectedSpot.id);
        window.history.replaceState({}, '', url.toString());
      } else if (!isDetailOpen && !selectedSpot) {
        if (url.searchParams.has('spot')) {
          url.searchParams.delete('spot');
          window.history.replaceState({}, '', url.toString());
        }
      }
    } catch (e) {}
  }, [isDetailOpen, selectedSpot]);

  const handleMapLoad = useCallback(() => {
    if (
      isAuthenticated &&
      activeTab === 'explorar' &&
      !selectedSpot &&
      !isDetailOpen &&
      !isUserLocationSpotlightActive &&
      !isOnboardingItinerarySelection &&
      !showFirstSignupWelcome &&
      !isGlobeIntroPending &&
      !isGlobeIntroPlaying
    ) {
      setZoomToUserTrigger((prev) => prev + 1);
    }
  }, [
    isAuthenticated,
    activeTab,
    selectedSpot,
    isDetailOpen,
    isUserLocationSpotlightActive,
    isOnboardingItinerarySelection,
    showFirstSignupWelcome,
    isGlobeIntroPending,
    isGlobeIntroPlaying,
  ]);

  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  // Real Weather State from Open-Meteo for Campos do Jordão
  const [realWeather, setRealWeather] = useState<{
    temperature: number;
    condition: string;
    isDay: boolean;
    weatherCode: number;
    isRaining: boolean;
    rainIntensity: 'none' | 'fraca' | 'moderada' | 'forte';
    hasLightning: boolean;
    precipitationMm: number;
  }>(() => {
    try {
      const cached = localStorage.getItem('monvian_cached_weather');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.temperature === 'number' && parsed.condition) {
          return {
            temperature: parsed.temperature,
            condition: parsed.condition,
            isDay: parsed.isDay ?? true,
            weatherCode: parsed.weatherCode ?? 2,
            isRaining: Boolean(parsed.isRaining),
            rainIntensity: parsed.rainIntensity || 'none',
            hasLightning: Boolean(parsed.hasLightning),
            precipitationMm: Number(parsed.precipitationMm || 0),
          };
        }
      }
    } catch {}
    return {
      temperature: 17,
      condition: 'Parcialmente nublado',
      isDay: true,
      weatherCode: 2,
      isRaining: false,
      rainIntensity: 'none',
      hasLightning: false,
      precipitationMm: 0,
    };
  });

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'explorar') return;
    let isSubscribed = true;
    let activeController: AbortController | null = null;
    let timeoutId: number | null = null;

    const fetchWeather = async () => {
      try {
        activeController?.abort();
        const controller = new AbortController();
        activeController = controller;
        if (timeoutId) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => controller.abort(), 5000);

        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-22.7394&longitude=-45.5914&current=temperature_2m,relative_humidity_2m,is_day,weather_code,precipitation,rain,showers&timezone=America%2FSao_Paulo',
          { signal: controller.signal, cache: 'no-cache' }
        );
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }

        const data = await res.json();
        if (data && data.current && isSubscribed && !controller.signal.aborted) {
          const temp = Math.round(data.current.temperature_2m);
          const wcode = Number(data.current.weather_code ?? 0);
          const isDay = data.current.is_day !== 0;
          const precip = Number(data.current.precipitation ?? 0);
          const rainMm = Number(data.current.rain ?? 0);
          const showersMm = Number(data.current.showers ?? 0);
          const totalRainMm = Math.max(precip, rainMm + showersMm);

          let cond = isDay ? 'Parcialmente nublado' : 'Céu parcialmente encoberto';
          let isRainingNow = false;
          let rainIntensity: 'none' | 'fraca' | 'moderada' | 'forte' = 'none';
          let hasLightning = false;

          if (wcode === 0) {
            cond = isDay ? 'Céu limpo' : 'Céu estrelado';
          } else if (wcode === 1) {
            cond = isDay ? 'Ensolarado' : 'Noite de céu limpo';
          } else if (wcode === 2) {
            cond = 'Parcialmente nublado';
          } else if (wcode === 3) {
            cond = 'Tempo nublado';
          } else if (wcode === 45 || wcode === 48) {
            cond = 'Nevoeiro na serra';
          } else if (wcode >= 51 && wcode <= 57) {
            cond = wcode <= 55 ? 'Chuva leve' : 'Garoa gélida';
            isRainingNow = true;
            rainIntensity = 'fraca';
          } else if (wcode === 61 || wcode === 80) {
            cond = 'Chuva leve';
            isRainingNow = true;
            rainIntensity = 'fraca';
          } else if (wcode === 63 || wcode === 66 || wcode === 81) {
            cond = 'Chuva moderada';
            isRainingNow = true;
            rainIntensity = 'moderada';
          } else if (wcode === 65 || wcode === 67 || wcode === 82) {
            cond = 'Chuva forte';
            isRainingNow = true;
            rainIntensity = 'forte';
            hasLightning = true;
          } else if (wcode >= 71 && wcode <= 77) {
            cond = 'Frio de serra / Geada';
          } else if (wcode >= 85 && wcode <= 86) {
            cond = 'Pancadas de neve';
          } else if (wcode >= 95) {
            cond = 'Tempestade com raios';
            isRainingNow = true;
            rainIntensity = 'forte';
            hasLightning = true;
          }

          // Refine with real measured precipitation (mm) in Campos do Jordão
          if (totalRainMm > 0) {
            isRainingNow = true;
            if (totalRainMm >= 4.0 || wcode >= 95 || wcode === 65 || wcode === 82) {
              rainIntensity = 'forte';
              hasLightning = true;
              if (wcode < 51) cond = 'Chuva forte com raios';
            } else if (totalRainMm >= 1.2 || wcode === 63 || wcode === 81) {
              if (rainIntensity !== 'forte') rainIntensity = 'moderada';
              if (wcode < 51) cond = 'Chuva moderada';
            } else if (rainIntensity === 'none') {
              rainIntensity = 'fraca';
              if (wcode < 51) cond = 'Chuva leve';
            }
          }

          const newWeather = {
            temperature: temp,
            condition: cond,
            isDay,
            weatherCode: wcode,
            isRaining: isRainingNow,
            rainIntensity,
            hasLightning,
            precipitationMm: totalRainMm,
          };

          setRealWeather(newWeather);
          localStorage.setItem('monvian_cached_weather', JSON.stringify(newWeather));
        }
      } catch (err) {
        // Silently use cached weather fallback
      }
    };

    fetchWeather();
    // Fast polling every 2 minutes + on window focus only while Explorar (map) is active
    const interval = setInterval(fetchWeather, 2 * 60 * 1000);
    const onFocus = () => fetchWeather();
    window.addEventListener('focus', onFocus);

    return () => {
      isSubscribed = false;
      activeController?.abort();
      if (timeoutId) window.clearTimeout(timeoutId);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [rainEnabled, isAuthenticated, activeTab]);

  const filteredSpots = useMemo(() => {
    return spots.filter(spot => {
      // Hide deactivated spots
      if (spot.isActive === false) return false;

      // Category filter
      if (selectedCategoryFilter) {
        let matchesCat = true;
        if (selectedCategoryFilter === 'hotels') matchesCat = spot.category === 'hotels';
        else if (selectedCategoryFilter === 'restaurants') matchesCat = spot.category === 'gastronomy' || spot.category === 'restaurants';
        else if (selectedCategoryFilter === 'cafes') matchesCat = spot.category === 'cafes';
        else if (selectedCategoryFilter === 'sweets') matchesCat = spot.category === 'sweets';
        else if (selectedCategoryFilter === 'attractions') matchesCat = spot.category === 'attractions' || spot.category === 'viewpoint' || spot.category === 'parks';
        else if (selectedCategoryFilter === 'pharmacies') matchesCat = spot.category === 'pharmacies' || spot.category === 'services';
        if (!matchesCat) return false;
      }

      // Search query filter (covers spot name, description, category label, address)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (spot.name || '').toLowerCase().includes(q);
        const matchesDesc = (spot.description || '').toLowerCase().includes(q);
        const matchesCatLabel = (spot.categoryLabel || '').toLowerCase().includes(q);
        const matchesAddress = (spot.address || '').toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesCatLabel || matchesAddress;
      }

      return true;
    });
  }, [spots, selectedCategoryFilter, searchQuery]);

  // Floating search bar results (places appearing right below search bar)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return spots.filter((s) => s.isActive !== false && (s.highlighted || (s.rating && s.rating >= 4.7))).slice(0, 5);
    }
    const q = searchQuery.toLowerCase().trim();
    return spots
      .filter((s) => {
        if (s.isActive === false) return false;
        const matchesName = (s.name || '').toLowerCase().includes(q);
        const matchesDesc = (s.description || '').toLowerCase().includes(q);
        const matchesCat = (s.category || '').toLowerCase().includes(q);
        const matchesCatLabel = (s.categoryLabel || '').toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesCat || matchesCatLabel;
      })
      .slice(0, 8);
  }, [spots, searchQuery]);

  const isBlurActive = Boolean(isCategoryCardOpen || isSearchOpen);
  const isSpotFocusActive = false;

  const clearActiveRoute = useCallback(() => {
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
      routeAbortControllerRef.current = null;
    }
    if (routeErrorTimerRef.current !== null) {
      window.clearTimeout(routeErrorTimerRef.current);
      routeErrorTimerRef.current = null;
    }
    isBackgroundReroutingRef.current = false;
    setIsRouteLoading(false);
    setRouteError(null);
    setActiveRoute(null);
  }, []);

  const showDiscreetRouteError = useCallback((message: string) => {
    if (routeErrorTimerRef.current !== null) {
      window.clearTimeout(routeErrorTimerRef.current);
      routeErrorTimerRef.current = null;
    }
    setRouteError(message);
    routeErrorTimerRef.current = window.setTimeout(() => {
      setRouteError(null);
      routeErrorTimerRef.current = null;
    }, 4500);
  }, []);

  const handleToggleSpotRoute = useCallback(async (spot: Spot) => {
    if (activeRoute?.spotId === spot.id) {
      clearActiveRoute();
      return;
    }

    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    routeAbortControllerRef.current = controller;

    if (routeErrorTimerRef.current !== null) {
      window.clearTimeout(routeErrorTimerRef.current);
      routeErrorTimerRef.current = null;
    }
    setRouteError(null);
    setIsRouteLoading(true);

    try {
      const origin = await acquireUserGpsForRoute(8000);
      if (controller.signal.aborted || selectedSpotIdRef.current !== spot.id) {
        return;
      }

      const destLng = Number(spot.lng);
      const destLat = Number(spot.lat);
      if (!Number.isFinite(destLng) || !Number.isFinite(destLat)) {
        showDiscreetRouteError('Coordenadas indisponíveis para este local.');
        return;
      }

      const nextFitRevision = ++routeFitCounterRef.current;
      const route = await fetchRealRoadRoute({
        spotId: spot.id,
        spotName: spot.name,
        origin,
        destination: [destLng, destLat],
        fitRevision: nextFitRevision,
        signal: controller.signal,
      });

      if (controller.signal.aborted || selectedSpotIdRef.current !== spot.id) {
        return;
      }

      setActiveRoute(route);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      showDiscreetRouteError(
        err?.message || 'Não foi possível calcular a rota no momento.'
      );
    } finally {
      if (routeAbortControllerRef.current === controller) {
        setIsRouteLoading(false);
        routeAbortControllerRef.current = null;
      }
    }
  }, [activeRoute?.spotId, clearActiveRoute, showDiscreetRouteError]);

  const handleSelectSpot = useCallback((spot: Spot | null) => {
    if (!spot || (activeRoute && spot.id !== activeRoute.spotId)) {
      clearActiveRoute();
    }
    setSelectedSpot(spot);
    setSpotPreviewMode('bar');
    setIsDetailOpen(false);
  }, [activeRoute, clearActiveRoute]);

  // Dismiss all cards, previews and overlays when touching the map and restore previous zoom/camera if a spot was selected
  const handleMapDismiss = useCallback(() => {
    clearActiveRoute();
    setSelectedSpot((prev) => {
      if (prev) {
        setRevertSpotZoomTrigger((t) => t + 1);
      }
      return null;
    });
    setIsDetailOpen(false);
    setIsCategoryCardOpen(false);
    setIsSearchOpen(false);
  }, [clearActiveRoute]);

  // User location state
  const [userCoords, setUserCoords] = useState<[number, number]>(
    () => gpsNavigationManager.getState().coords
  );
  const [geoStatus, setGeoStatus] = useState<'prompt' | 'granted' | 'denied' | 'locating'>(
    () => gpsNavigationManager.getState().status
  );
  const [locationName, setLocationName] = useState<string>('Obtendo localização...');

  // Request or re-trigger high accuracy real geolocation
  const requestRealLocation = () => {
    gpsNavigationManager.refreshPositionNow();
  };

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'explorar') {
      gpsNavigationManager.stop();
      deviceHeadingManager.stop();
      return;
    }

    let lastReactSync = 0;
    let hasSyncedFirstRealFix = false;
    let lastStatus: string = '';
    let lastLng = -45.5870;
    let lastLat = -22.7355;

    const unsubscribe = gpsNavigationManager.subscribe((navState) => {
      if (navState.status !== lastStatus) {
        lastStatus = navState.status;
        setGeoStatus(navState.status);
      }

      const now = performance.now();
      const shouldSyncImmediately = Boolean(navState.hasRealFix && !hasSyncedFirstRealFix);
      if (shouldSyncImmediately || now - lastReactSync > 500) {
        const [lng, lat] = navState.coords;
        if (
          shouldSyncImmediately ||
          Math.abs(lng - lastLng) > 0.00004 ||
          Math.abs(lat - lastLat) > 0.00004
        ) {
          if (navState.hasRealFix) {
            hasSyncedFirstRealFix = true;
          }
          lastReactSync = now;
          lastLng = lng;
          lastLat = lat;
          setUserCoords([lng, lat]);
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, activeTab]);

  // Unlock "Eu visitei Campos do Jordão" achievement once when real GPS confirms presence in Campos do Jordão
  useEffect(() => {
    if (
      !isAuthenticated ||
      activeTab !== 'explorar' ||
      showOnboardingQuestions ||
      showFirstSignupWelcome ||
      isGlobeIntroPending ||
      isGlobeIntroPlaying ||
      isOnboardingItinerarySelection ||
      isWelcomeJourneyOpen ||
      isCamposAchievementOpen
    ) {
      return;
    }

    const userKey = String(user?.id || user?.email || user?.whatsapp || 'default')
      .trim()
      .toLowerCase();
    const storageKey = `monvian_achievement_campos_seen_${userKey}`;

    try {
      if (localStorage.getItem(storageKey) === '1') {
        return;
      }
    } catch {
      return;
    }

    const navState = gpsNavigationManager.getState();
    if (!navState.hasRealFix || navState.status !== 'granted') {
      return;
    }

    if (isWithinCamposRadius(navState.coords, 18)) {
      try {
        localStorage.setItem(storageKey, '1');
      } catch {}
      setIsCamposAchievementOpen(true);
    }
  }, [
    isAuthenticated,
    activeTab,
    userCoords,
    geoStatus,
    user?.id,
    user?.email,
    user?.whatsapp,
    showOnboardingQuestions,
    showFirstSignupWelcome,
    isGlobeIntroPending,
    isGlobeIntroPlaying,
    isOnboardingItinerarySelection,
    isWelcomeJourneyOpen,
    isCamposAchievementOpen,
  ]);

  // Smoothly recalculate the active road route when user's real GPS position moves significantly
  useEffect(() => {
    if (!activeRoute || activeTab !== 'explorar' || isRouteLoading || isBackgroundReroutingRef.current) {
      return;
    }

    const navState = gpsNavigationManager.getState();
    if (!navState.hasRealFix || navState.status !== 'granted') {
      return;
    }

    const movedMeters = calculateHaversineDistance(
      activeRoute.origin[0],
      activeRoute.origin[1],
      userCoords[0],
      userCoords[1]
    );
    const elapsedMs = Date.now() - activeRoute.updatedAt;
    if (movedMeters < 35 || elapsedMs < 6000) {
      return;
    }

    const controller = new AbortController();
    isBackgroundReroutingRef.current = true;

    fetchRealRoadRoute({
      spotId: activeRoute.spotId,
      spotName: activeRoute.spotName,
      origin: userCoords,
      destination: activeRoute.destination,
      fitRevision: activeRoute.fitRevision,
      signal: controller.signal,
    })
      .then((updatedRoute) => {
        if (controller.signal.aborted) return;
        setActiveRoute((prev) =>
          prev && prev.spotId === updatedRoute.spotId ? updatedRoute : prev
        );
      })
      .catch(() => {})
      .finally(() => {
        isBackgroundReroutingRef.current = false;
      });

    return () => {
      controller.abort();
      isBackgroundReroutingRef.current = false;
    };
  }, [activeRoute, activeTab, userCoords, isRouteLoading]);

  const handleToggleFavorite = useCallback((spotId: string) => {
    favoritesManager.toggleSpot(spotId);
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    if (tab === 'explorar') {
      setZoomToUserTrigger((prev) => prev + 1);
      if (gpsNavigationManager.getState().status !== 'granted') {
        gpsNavigationManager.requestPermissionAndStartFromGesture();
      } else {
        gpsNavigationManager.refreshPositionNow();
      }
      if (deviceHeadingManager.isPermissionRequired() && !deviceHeadingManager.isPermissionHandled()) {
        deviceHeadingManager.requestPermission().catch(() => {});
      }
      deviceHeadingManager.start();
    } else {
      gpsNavigationManager.stop();
      deviceHeadingManager.stop();
    }

    // Always immediately close any open spot details, itinerary details, search drawers, etc.
    clearActiveRoute();
    setIsDetailOpen(false);
    setSelectedSpot(null);
    setSelectedItinerary(null);
    setIsSearchOpen(false);
    setIsCategoryCardOpen(false);
    setIsChatKeyboardOpen(false);
    setIsAdminOpen(false);
    setAirbnbCardTab(null);

    // Dispatch global event so child explorer components immediately close their modals
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('monvian-close-modals'));
    }

    setActiveTab((prevTab) => {
      if (prevTab !== tab) {
        if (tab === 'explorar') {
          setTabHistory([]);
        } else {
          setTabHistory((hist) => {
            const filtered = hist.filter((t) => t !== tab);
            return [...filtered, prevTab];
          });
        }
      }
      return tab;
    });
  }, [clearActiveRoute]);

  // Sempre que entrar no aplicativo, carregar Explorar ou voltar de outra aba/segundo plano, dá zoom automático na localização do usuário
  const prevActiveTabForZoomRef = useRef<TabType>(activeTab);
  const prevAuthForZoomRef = useRef<boolean>(false);
  useEffect(() => {
    const prevTab = prevActiveTabForZoomRef.current;
    const prevAuth = prevAuthForZoomRef.current;
    prevActiveTabForZoomRef.current = activeTab;
    prevAuthForZoomRef.current = isAuthenticated;

    const justEnteredApp = !prevAuth && isAuthenticated;
    const justReturnedToExplorar = prevTab !== 'explorar' && activeTab === 'explorar';

    if (
      isAuthenticated &&
      activeTab === 'explorar' &&
      (justEnteredApp || justReturnedToExplorar) &&
      !isUserLocationSpotlightActive &&
      !isOnboardingItinerarySelection &&
      !showFirstSignupWelcome &&
      !isGlobeIntroPending &&
      !isGlobeIntroPlaying
    ) {
      setZoomToUserTrigger((prev) => prev + 1);
    }
  }, [isAuthenticated, activeTab, isUserLocationSpotlightActive, isOnboardingItinerarySelection, showFirstSignupWelcome, isGlobeIntroPending, isGlobeIntroPlaying]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'explorar') return;

    const handleReturnToForeground = () => {
      if (document.visibilityState !== 'visible') return;
      if (
        selectedSpot ||
        isDetailOpen ||
        isUserLocationSpotlightActive ||
        isOnboardingItinerarySelection ||
        showFirstSignupWelcome ||
        isGlobeIntroPending ||
        isGlobeIntroPlaying
      ) {
        return;
      }
      gpsNavigationManager.refreshPositionNow();
      setZoomToUserTrigger((prev) => prev + 1);
    };

    document.addEventListener('visibilitychange', handleReturnToForeground, { passive: true });
    return () => {
      document.removeEventListener('visibilitychange', handleReturnToForeground);
    };
  }, [
    isAuthenticated,
    activeTab,
    selectedSpot,
    isDetailOpen,
    isUserLocationSpotlightActive,
    isOnboardingItinerarySelection,
    showFirstSignupWelcome,
    isGlobeIntroPending,
    isGlobeIntroPlaying,
  ]);


  // Resolve foreground selector for the currently active tab
  const activeTabForegroundSelector = useMemo(() => {
    switch (activeTab) {
      case 'roteiros':
        return '#itineraries-root-container';
      case 'salvos':
        return '#saved-view-root';
      case 'buscar':
        return '#search-filter-panel';
      case 'perfil':
        return '#profile-modal-panel';
      default:
        return '#main-app-content';
    }
  }, [activeTab]);

  // Global iOS Edge-Swipe Back Gesture: Non-map tabs -> previous tab (or 'explorar')
  useIOSBackEntry({
    id: `app:tab:${activeTab}`,
    enabled:
      isAuthenticated &&
      !isAdminOpen &&
      !isOnboardingItinerarySelection &&
      activeTab !== 'explorar',
    priority: 40,
    label: 'Voltar',
    foregroundSelector: activeTabForegroundSelector,
    backgroundSelector: '#app-map-layer',
    onPop: () => {
      setTabHistory((hist) => {
        if (hist.length === 0) {
          setActiveTab('explorar');
          return [];
        }
        const nextHist = [...hist];
        const prevTab = nextHist.pop() || 'explorar';
        setActiveTab(prevTab);
        return nextHist;
      });
    },
  });

  // Global iOS Edge-Swipe Back Gesture: Spot Preview Banner on Map
  useIOSBackEntry({
    id: 'app:spot-preview-banner',
    enabled:
      isAuthenticated &&
      !isAdminOpen &&
      activeTab === 'explorar' &&
      isSpotCardOpen &&
      Boolean(selectedSpot) &&
      !isDetailOpen,
    priority: 160,
    label: 'Mapa',
    foregroundSelector: '#spot-preview-banner-card',
    backgroundSelector: '#app-map-layer',
    onPop: () => {
      clearActiveRoute();
      setRevertSpotZoomTrigger((t) => t + 1);
      setSelectedSpot(null);
    },
  });

  // Global iOS Edge-Swipe Back Gesture: Category Dropdown & Floating Search on Map
  useIOSBackEntry({
    id: 'app:map-overlay-controls',
    enabled:
      isAuthenticated &&
      !isAdminOpen &&
      (isCategoryCardOpen || isSearchOpen),
    priority: 165,
    label: 'Mapa',
    foregroundSelector: '#global-blur-backdrop',
    backgroundSelector: '#app-map-layer',
    onPop: () => {
      setIsCategoryCardOpen(false);
      setIsSearchOpen(false);
    },
  });

  // Triggers the first-access welcome journey card when the app enters the real tela de roteiro
  useEffect(() => {
    if (
      pendingWelcomeJourney &&
      signupIntroStage === 'idle' &&
      activeTab === 'roteiros' &&
      !isOnboardingItinerarySelection
    ) {
      setIsWelcomeJourneyOpen(true);
      setPendingWelcomeJourney(false);
    }
  }, [pendingWelcomeJourney, signupIntroStage, activeTab, isOnboardingItinerarySelection]);

  useEffect(() => {
    if (!isUserLocationSpotlightActive) return;
    const timer = window.setTimeout(() => {
      setIsUserLocationSpotlightActive(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isUserLocationSpotlightActive]);

  useEffect(() => {
    if (signupIntroStage === 'white') {
      startPreloadResources();
    }
  }, [signupIntroStage]);

  // Automatically trigger native iOS/browser Geolocation & Motion prompts ONLY while Explorar map is active
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'explorar' || showFirstSignupWelcome) {
      gpsNavigationManager.stop();
      deviceHeadingManager.stop();
      return;
    }

    gpsNavigationManager.start();
    deviceHeadingManager.start();

    const triggerNativePermissionsOnClick = () => {
      if (isGlobeIntroPending || isGlobeIntroPlaying) return;
      if (gpsNavigationManager.getState().status !== 'granted') {
        gpsNavigationManager.requestPermissionAndStartFromGesture();
      }
      if (deviceHeadingManager.isPermissionRequired() && !deviceHeadingManager.isPermissionHandled()) {
        deviceHeadingManager.requestPermission().catch(() => {});
      }

      if (deviceHeadingManager.isPermissionHandled() && gpsNavigationManager.getState().status === 'granted') {
        window.removeEventListener('click', triggerNativePermissionsOnClick, true);
      }
    };

    if (!isGlobeIntroPending && !isGlobeIntroPlaying) {
      window.addEventListener('click', triggerNativePermissionsOnClick, { capture: true });
    }

    return () => {
      window.removeEventListener('click', triggerNativePermissionsOnClick, true);
      gpsNavigationManager.stop();
      deviceHeadingManager.stop();
    };
  }, [isAuthenticated, activeTab, showFirstSignupWelcome, isGlobeIntroPending, isGlobeIntroPlaying]);

  useEffect(() => {
    // Wait until full-screen onboarding modals, signup reveal, onboarding itinerary selection, first-signup welcome, and admin are closed
    if (
      isAdminOpen ||
      showOnboardingQuestions ||
      showWelcomeOverlay ||
      isSignupRevealActive ||
      isOnboardingItinerarySelection ||
      showFirstSignupWelcome ||
      isGlobeIntroPending ||
      isGlobeIntroPlaying
    ) {
      setAirbnbCardTab(null);
      return;
    }

    if (activeTab === 'explorar' && !isPresentationCardSeen('explorar')) {
      setAirbnbCardTab('explorar');
    } else if (activeTab === 'roteiros' && !isPresentationCardSeen('roteiros')) {
      setAirbnbCardTab('roteiros');
    } else if (activeTab === 'salvos' && !isPresentationCardSeen('salvos')) {
      setAirbnbCardTab('salvos');
    } else {
      setAirbnbCardTab(null);
    }
  }, [
    activeTab,
    showOnboardingQuestions,
    showWelcomeOverlay,
    isAdminOpen,
    isSignupRevealActive,
    isOnboardingItinerarySelection,
    showFirstSignupWelcome,
    isGlobeIntroPending,
    isGlobeIntroPlaying,
  ]);

  const handleDismissFirstSignupWelcome = useCallback(() => {
    // Synchronously capture user tap gesture on iOS Safari for real device geolocation
    try {
      if (gpsNavigationManager.getState().status !== 'granted') {
        gpsNavigationManager.requestPermissionAndStartFromGesture();
      } else {
        gpsNavigationManager.refreshPositionNow();
      }
      if (deviceHeadingManager.isPermissionRequired() && !deviceHeadingManager.isPermissionHandled()) {
        deviceHeadingManager.requestPermission().catch(() => {});
      }
      deviceHeadingManager.start();
    } catch {}

    setShowFirstSignupWelcome(false);
    const cleanEmail = (user?.email || user?.whatsapp || '').trim().toLowerCase();
    const token = (() => {
      try {
        return localStorage.getItem('monvian_token') || undefined;
      } catch {
        return undefined;
      }
    })();

    try {
      if (cleanEmail) {
        localStorage.setItem(`monvian_first_welcome_seen_${cleanEmail}`, '1');
        localStorage.removeItem(`monvian_first_welcome_pending_${cleanEmail}`);
      }
    } catch {}

    const shouldPlayGlobeFlight = Boolean(
      isGlobeIntroPending &&
        user?.globe_intro_seen !== 1 &&
        (!cleanEmail || localStorage.getItem(`monvian_globe_intro_seen_${cleanEmail}`) !== '1')
    );

    if (shouldPlayGlobeFlight) {
      try {
        if (cleanEmail) {
          localStorage.setItem(`monvian_globe_intro_seen_${cleanEmail}`, '1');
          localStorage.removeItem(`monvian_globe_intro_pending_${cleanEmail}`);
        }
      } catch {}

      setUser((prev: any) => {
        if (!prev) return prev;
        const updated = { ...prev, welcome_card_seen: 1, globe_intro_seen: 1 };
        if (token) {
          savePersistentSession(token, updated).catch(() => {});
        }
        return updated;
      });

      if (cleanEmail || token) {
        markWelcomeCardSeen(cleanEmail, token).catch(() => {});
        markGlobeIntroSeen(cleanEmail, token).catch(() => {});
      }

      setIsGlobeIntroPending(false);
      setIsGlobeIntroPlaying(true);
    } else {
      setExplorarEntranceTick((prev) => prev + 1);
      setUser((prev: any) => {
        if (!prev) return prev;
        const updated = { ...prev, welcome_card_seen: 1 };
        if (token) {
          savePersistentSession(token, updated).catch(() => {});
        }
        return updated;
      });

      if (cleanEmail || token) {
        markWelcomeCardSeen(cleanEmail, token).catch(() => {});
      }

      setZoomToUserTrigger((prev) => prev + 1);
    }
  }, [user, isGlobeIntroPending]);

  const handleGlobeIntroComplete = useCallback(() => {
    setIsGlobeIntroPlaying(false);
    setIsGlobeIntroPending(false);
    setExplorarEntranceTick((prev) => prev + 1);
    setArrivalConfettiTrigger((prev) => prev + 1);
  }, []);

  const handleAirbnbCardAction = () => {
    if (!airbnbCardTab) return;
    const current = airbnbCardTab;
    markPresentationCardSeen(current);
    setAirbnbCardTab(null);
    if (current === 'salvos') {
      handleTabChange('explorar');
    }
  };

  const handleAirbnbCardClose = () => {
    if (!airbnbCardTab) return;
    markPresentationCardSeen(airbnbCardTab);
    setAirbnbCardTab(null);
  };

  // User's first name for personalized greetings
  const userFirstName = (() => {
    if (!user?.name) return '';
    const clean = user.name.trim();
    const first = clean.split(/\s+/)[0];
    if (!first) return '';
    return first.charAt(0).toUpperCase() + first.slice(1);
  })();

  const welcomePhrase = userFirstName ? `Seja bem vindo ${userFirstName}!` : 'Seja bem vindo a Campos do Jordão!';

  const isWhiteMapUI = activeTab === 'explorar' && (theme === 'light' || mapStyle === 'animado' || mapStyle === 'satelite' || mapStyle === 'transporte');
  const isSatelliteExplore = activeTab === 'explorar' && mapStyle === 'satelite';
  const [isRoteirosSatelliteNav, setIsRoteirosSatelliteNav] = useState(false);

  const [isDesktopExplorePanelOpen, setIsDesktopExplorePanelOpen] = useState<boolean>(true);

  const isUserAdmin = Boolean(
    user?.role === 'admin' ||
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes((user?.email || user?.whatsapp || '').trim().toLowerCase()) ||
    (user?.username || '').trim().toLowerCase() === 'marioyesk'
  );

  const accountSessionKey = user?.id
    ? `acct-${String(user.id)}`
    : user?.email
      ? `acct-${String(user.email).trim().toLowerCase()}`
      : 'anon';

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <>
      <IOSInteractiveBackSystem />
      <SignupIntroSequence
        stage={signupIntroStage}
        onAdvanceStage={setSignupIntroStage}
      />
      <WelcomeJourneyModal
        isOpen={isWelcomeJourneyOpen}
        onFinish={() => setIsWelcomeJourneyOpen(false)}
      />
      <AnimatePresence>
      {isAuthChecking && !isAuthenticated && !pendingResetOobCode ? (
        <div
          key="monvian-auth-checking"
          className={`fixed inset-0 w-full z-[130] flex items-center justify-center ${
            theme === 'dark' ? 'bg-[#000000]' : 'bg-[#FFFFFF]'
          }`}
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
          }}
        >
          {theme === 'dark' ? (
            <img
              src="/logomodoescuro.png"
              alt="Monvian"
              draggable={false}
              className="w-[220px] max-w-[60vw] h-auto object-contain select-none pointer-events-none"
            />
          ) : (
            <div className="w-7 h-7 rounded-full border-2 animate-spin border-[#E5E7EB] border-t-[#080808]" />
          )}
        </div>
      ) : !isAuthenticated || pendingResetOobCode ? (
        <motion.div
          key="monvian-auth-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={
            isSignupRevealActive
              ? { opacity: 1, transition: { duration: 0 } }
              : { opacity: 0 }
          }
          transition={{
            duration: prefersReducedMotion ? 0.15 : 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`fixed inset-0 w-full z-[120] ${
            theme === 'dark' ? 'bg-[#000000]' : 'bg-[#ffffff]'
          }`}
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
          }}
        >
          <AuthScreen
            theme={theme}
            initialAuthMode={authInitialMode}
            initialResetOobCode={pendingResetOobCode}
            onResetHandled={() => {
              setPendingResetOobCode(null);
              clearPersistentSession().catch(() => {});
            }}
            onSuccess={(token, userData, isNewAccount) => {
              authEpochRef.current += 1;
              try {
                localStorage.removeItem('monvian_manual_logout');
              } catch {}
              setAuthInitialMode('landing');
              setPendingResetOobCode(null);
              manualLogoutRef.current = false;
              const cleanEmail = (userData?.email || userData?.whatsapp || '').trim().toLowerCase();
              const normalizedUser = normalizeAppUser(userData);

              // Ensure any residual unscoped or previous account state is wiped before initializing the new account
              purgeLegacyUnscopedActivityKeys();
              try {
                const prevUserRaw = localStorage.getItem('monvian_user');
                const prevUser = prevUserRaw ? JSON.parse(prevUserRaw) : null;
                const prevEmail = (prevUser?.email || prevUser?.whatsapp || '').trim().toLowerCase();
                if (!prevUser || prevEmail !== cleanEmail || String(prevUser?.id) !== String(normalizedUser?.id)) {
                  localStorage.removeItem('monvian_local_avatar');
                  setSelectedItinerary(null);
                  setSelectedSpot(null);
                  setIsDetailOpen(false);
                }
                if (token && normalizedUser) {
                  localStorage.setItem('monvian_token', token);
                  localStorage.setItem('monvian_user', JSON.stringify(normalizedUser));
                }
              } catch {}

              savePersistentSession(token, normalizedUser).catch(() => {});
              favoritesManager.setActiveAccount(normalizedUser);
              window.dispatchEvent(new CustomEvent('monvian:account_switched', { detail: normalizedUser }));

              if (normalizedUser?.location_permission_granted === 1) {
                localStorage.setItem('monvian_location_permission_granted', 'true');
                document.cookie = 'monvian_location_granted=true; max-age=315360000; path=/; SameSite=Lax';
              }
              if (normalizedUser?.motion_permission_granted === 1) {
                localStorage.setItem('monvian_motion_permission_granted', 'true');
                localStorage.setItem('monvian_compass_permission_handled', 'true');
                document.cookie = 'monvian_motion_granted=true; max-age=315360000; path=/; SameSite=Lax';
              }
              syncPermissionsFromDatabase(normalizedUser?.email || normalizedUser?.whatsapp).catch(() => {});
              setUser(normalizedUser);
              setActiveTab('explorar');
              setExplorarEntranceTick((prev) => prev + 1);
              setIsOnboardingItinerarySelection(false);
              setSignupIntroStage('idle');
              setPendingWelcomeJourney(false);
              setIsWelcomeJourneyOpen(false);
              setShowWelcomeOverlay(false);

              const needsSmartOnboarding = Boolean(
                (isNewAccount && normalizedUser?.onboarding_completed !== 1) ||
                  normalizedUser?.onboarding_completed === 0 ||
                  (normalizedUser?.onboarding_completed !== 1 &&
                    cleanEmail &&
                    localStorage.getItem(`monvian_smart_onboarding_pending_${cleanEmail}`) === '1')
              );
              if (needsSmartOnboarding) {
                try {
                  if (cleanEmail) {
                    localStorage.setItem(`monvian_smart_onboarding_pending_${cleanEmail}`, '1');
                    localStorage.setItem(`monvian_first_welcome_pending_${cleanEmail}`, '1');
                    localStorage.removeItem(`monvian_first_welcome_seen_${cleanEmail}`);
                  }
                } catch {}
                setShowOnboardingQuestions(true);
                setShowFirstSignupWelcome(false);
              } else {
                try {
                  if (cleanEmail) {
                    localStorage.removeItem(`monvian_smart_onboarding_pending_${cleanEmail}`);
                  }
                } catch {}
                setShowOnboardingQuestions(false);
                const needsWelcomeCard = Boolean(
                  !normalizedUser?.welcome_card_seen &&
                    cleanEmail &&
                    localStorage.getItem(`monvian_first_welcome_seen_${cleanEmail}`) !== '1' &&
                    localStorage.getItem(`monvian_first_welcome_pending_${cleanEmail}`) === '1'
                );
                setShowFirstSignupWelcome(needsWelcomeCard);
              }

              const hasSeenGlobeIntro = Boolean(
                normalizedUser?.globe_intro_seen === 1 ||
                  (cleanEmail && localStorage.getItem(`monvian_globe_intro_seen_${cleanEmail}`) === '1')
              );
              if (isNewAccount && !hasSeenGlobeIntro) {
                try {
                  if (cleanEmail) {
                    localStorage.setItem(`monvian_globe_intro_pending_${cleanEmail}`, '1');
                  }
                } catch {}
                setIsGlobeIntroPending(true);
                setIsGlobeIntroPlaying(false);
              } else {
                setIsGlobeIntroPending(false);
                setIsGlobeIntroPlaying(false);
              }

              if (isNewAccount) {
                markPresentationCardSeen('explorar');
                markPresentationCardSeen('roteiros');
              }
              try {
                (document.activeElement as HTMLElement | null)?.blur?.();
                document.documentElement.classList.remove('is-login-screen');
                document.body.classList.remove('is-login-screen');
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                const rootEl = document.getElementById('root');
                if (rootEl) rootEl.scrollTop = 0;
              } catch {}
              setIsAuthChecking(false);
              setIsAuthenticated(true);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="monvian-main-app"
          initial={false}
          animate={{ opacity: 1 }}
          transition={
            isSignupRevealActive
              ? { duration: 0 }
              : prefersReducedMotion
                ? { duration: 0.2 }
                : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
          }
          id="app-root-shell"
          className={`fixed inset-0 w-full h-full overflow-hidden select-none flex transition-colors duration-300 ${
            theme === 'dark'
              ? 'bg-[#000000]'
              : 'bg-[#ffffff]'
          }`}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
            boxSizing: 'border-box',
            margin: 0,
            padding: 0,
            backgroundColor:
              theme === 'dark'
                ? '#000000'
                : isOnboardingItinerarySelection ||
                    (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
                  ? '#ffffff'
                  : '#ffffff',
            pointerEvents:
              signupIntroStage === 'white' || signupIntroStage === 'video' ? 'none' : undefined,
          }}
        >
      <OfflineIndicator />

      {/* Desktop Left Sidebar (Only visible on md+ >= 768px, hidden during exclusive post-signup itinerary selection, welcome screen & spotlight) */}
      {!isOnboardingItinerarySelection && !isUserLocationSpotlightActive && !showFirstSignupWelcome && !isGlobeIntroPlaying && (
        <DesktopSidebar
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          unreadCount={2}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          realWeather={realWeather}
          onOpenWeatherModal={() => {}}
          user={user}
          onOpenAdmin={() => setIsAdminOpen(true)}
          isUserAdmin={isUserAdmin}
          isCollapsed={isDesktopSidebarCollapsed}
          onToggleCollapse={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
        />
      )}

      <main
        id="main-app-content"
        className={`relative flex-1 w-full h-full min-h-full overflow-hidden select-none transition-all duration-300 md:rounded-none ios-page-top-rounded ${
          theme === 'dark' ? 'bg-black' : 'bg-zinc-50'
        }`}
        style={{
          width: '100%',
          height: 'var(--app-height, 100dvh)',
          minHeight: 'var(--app-height, 100dvh)',
          boxSizing: 'border-box',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
        <div className="w-full h-full flex flex-row relative overflow-hidden">
          {/* DESKTOP EXPLORE PANEL (Side-by-side Discovery Column on md+ when activeTab === 'explorar') */}
          <AnimatePresence>
            {activeTab === 'explorar' && !isMapOrbiting && !isUserLocationSpotlightActive && !showFirstSignupWelcome && !isGlobeIntroPlaying && (
              <motion.div
                key={`desktop-explore-panel-wrapper-${explorarEntranceTick}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -16, filter: 'blur(6px)' }
                }
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -10, filter: 'blur(6px)' }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.16 }
                    : { type: 'spring', damping: 26, stiffness: 280, delay: 0.05 }
                }
                className="h-full shrink-0"
              >
                <DesktopExplorePanel
                  spots={filteredSpots}
                  selectedSpot={selectedSpot}
                  onSelectSpot={handleSelectSpot}
                  onOpenSpotDetails={(spot) => {
                    setSelectedSpot(spot);
                    setIsDetailOpen(true);
                  }}
                  selectedCategory={selectedCategoryFilter || 'all'}
                  onSelectCategory={(catId) => setSelectedCategoryFilter(catId === 'all' ? null : catId)}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  theme={theme}
                  realWeather={realWeather}
                  onOpenClothingGuide={() => setIsWeatherModalOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactive Map Canvas Column (Kept warm in GPU memory so tab switches have zero WebGL rebuild lag) */}
          <div
            id="app-map-layer"
            aria-hidden={activeTab !== 'explorar'}
            className={
              activeTab === 'explorar'
                ? 'flex-1 h-full relative overflow-hidden'
                : 'fixed inset-0 w-full h-full opacity-0 pointer-events-none -z-10 overflow-hidden'
            }
          >
            {/* 1. Interactive Map Engine */}
            <MapComponent
              spots={filteredSpots}
              selectedSpot={selectedSpot}
              onSelectSpot={handleSelectSpot}
              onMapClick={handleMapDismiss}
              userCoords={userCoords}
              theme={theme}
              visualIcons={mapVisualIcons}
              userAvatar={user?.avatar_url}
              userName={user?.name}
              highContrast={highContrast}
              onMapLoad={handleMapLoad}
              zoomToUserTrigger={zoomToUserTrigger}
              revertSpotZoomTrigger={revertSpotZoomTrigger}
              mapMode={mapStyle === 'satelite' ? 'satelite' : 'explorar'}
              onMapModeChange={setMapStyle}
              onStyleChange={setMapStyle}
              is3DMode={is3DMode}
              onOrbitChange={setIsMapOrbiting}
              isDetailOpen={isDetailOpen}
              snowEnabled={snowEnabled}
              rainEnabled={Boolean(rainEnabled && realWeather.isRaining)}
              isSpotlightActive={isUserLocationSpotlightActive}
              isFocusMode={isSpotFocusActive}
              activeTab={activeTab}
              isGlobeIntroPending={isGlobeIntroPending}
              isGlobeIntroPlaying={isGlobeIntroPlaying}
              onGlobeIntroComplete={handleGlobeIntroComplete}
              activeRoute={activeRoute}
            />

            {/* 2. Dynamic Rain Particle Effect Overlay (Only active when user enabled AND actually raining in Campos do Jordão) */}
            {activeTab === 'explorar' && (
              <RainEffect
                enabled={Boolean(rainEnabled && realWeather.isRaining)}
                weatherCode={realWeather.weatherCode}
                intensity={realWeather.rainIntensity === 'none' ? 'fraca' : realWeather.rainIntensity}
                hasLightning={realWeather.hasLightning}
                theme={theme}
              />
            )}

            {/* 2.5. Dynamic Snow Particle Effect Overlay (Neve nas Montanhas) */}
            {activeTab === 'explorar' && (
              <SnowEffect
                enabled={snowEnabled}
                intensity={(systemSettings.weather_snow_mode as any) || 'moderada'}
                theme={theme}
              />
            )}

            {/* DESKTOP MAP FLOATING CONTROLS (Top-Right Apple Style) */}
            {activeTab === 'explorar' && !isMapOrbiting && !isUserLocationSpotlightActive && !showFirstSignupWelcome && !isGlobeIntroPlaying && (
              <DesktopMapControls
                currentMode={mapStyle}
                onChangeMode={setMapStyle}
                is3DMode={is3DMode}
                onToggle3DMode={() => setIs3DMode((prev) => !prev)}
                realWeather={realWeather}
              />
            )}
          </div>
        </div>

      {/* 3. Top Floating Header Bar (MOBILE ONLY: md:hidden, mounted only on Explorar tab) */}
      <AnimatePresence>
        {activeTab === 'explorar' && !isMapOrbiting && !isUserLocationSpotlightActive && !showFirstSignupWelcome && !isGlobeIntroPlaying && (
          <motion.header
            key={`explore-mobile-header-${explorarEntranceTick}`}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -18, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.16 }
                : { type: 'spring', damping: 25, stiffness: 290, delay: 0.06 }
            }
            aria-label="Informações de Campos do Jordão"
            className="md:hidden absolute top-0 left-0 right-0 z-40 pointer-events-none px-4 sm:px-6"
            style={{
              paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 28px)',
              paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
            }}
          >
            <div
              className={`w-full flex items-start justify-between transition-[filter,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isSpotFocusActive
                  ? 'opacity-0 scale-95 blur-[4px] [&_*]:!pointer-events-none'
                  : isBlurActive
                    ? 'blur-[6px] opacity-40 scale-100 [&_*]:!pointer-events-none'
                    : 'blur-0 opacity-100 scale-100'
              }`}
            >
              {/* Left: Big Weather Temperature & Dynamic Condition */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.14 }
                    : { type: 'spring', damping: 24, stiffness: 280, delay: 0.08 }
                }
                className="flex items-center pointer-events-auto"
              >
                <div
                  id="weather-header-display"
                  onClick={() => setIsWeatherModalOpen(true)}
                  className="flex flex-col items-start select-none opacity-100 scale-100 cursor-pointer"
                  title={`Campos do Jordão: ${realWeather.temperature}°C — ${realWeather.condition}`}
                >
                  {/* Layout: Large beautiful 3D icon on the left, bold prominent degrees */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Weather 3D Icon */}
                    <div
                      id="weather-3d-icon-clean"
                      className="select-none flex items-center justify-center shrink-0 drop-shadow-md"
                    >
                      <Weather3DIcon
                        weatherCode={realWeather.weatherCode}
                        isDay={realWeather.isDay}
                        className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 -my-2.5"
                      />
                    </div>

                    {/* Temperature Degrees */}
                    <div
                      id="weather-degrees-clean"
                      className="flex items-baseline select-none text-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                    >
                      <span className={`text-5xl sm:text-6xl font-extrabold tracking-tighter leading-none text-[#ffffff] ${
                        mapStyle === 'animado'
                          ? '[-webkit-text-stroke:_0.6px_rgba(0,0,0,0.22)]'
                          : ''
                      }`}>
                        {realWeather.temperature}°
                      </span>
                    </div>
                  </div>

                  {/* Condition label under the temperature */}
                  <div
                    id="weather-condition-clean"
                    className="text-left mt-0.5 ml-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
                  >
                    <span className={`block text-[13px] sm:text-[14px] font-semibold tracking-tight whitespace-nowrap ${
                      isSatelliteExplore
                        ? 'text-white'
                        : mapStyle === 'animado'
                          ? 'text-white [-webkit-text-stroke:_0.35px_rgba(0,0,0,0.20)]'
                          : theme === 'dark'
                            ? 'text-white/95'
                            : 'text-zinc-800 dark:text-zinc-200'
                    }`}>
                      {realWeather.condition}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Right: Clean Header Action Icons with iOS Liquid Glass Buttons */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 12, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.14 }
                    : { type: 'spring', damping: 24, stiffness: 290, delay: 0.11 }
                }
                className="flex items-center gap-2.5 pointer-events-auto relative"
              >

                {/* 3D View Toggle Icon */}
                <button
                  id="btn-3d-toggle"
                  type="button"
                  onClick={() => {
                    setHasToggled3D(true);
                    setIs3DMode((prev) => !prev);
                  }}
                  className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer group shrink-0 ${
                    isSatelliteExplore || theme === 'dark' ? 'text-white' : 'text-black'
                  }`}
                  style={{ color: isSatelliteExplore || theme === 'dark' ? '#FFFFFF' : '#000000' }}
                  aria-label={is3DMode ? 'Alternar para visualização 2D' : 'Alternar para visualização 3D'}
                  title={is3DMode ? 'Alternar para visão 2D Plana' : 'Alternar para visão 3D com Relevo e Montanhas'}
                >
                  <div
                    className="relative z-10 flex items-center justify-center group-hover:scale-105 transition-transform duration-200"
                    style={{ color: isSatelliteExplore || theme === 'dark' ? '#FFFFFF' : '#000000' }}
                  >
                    <Map3DIcon
                      mode={!hasToggled3D || is3DMode ? '3D' : '2D'}
                      style={{ color: isSatelliteExplore || theme === 'dark' ? '#FFFFFF' : '#000000' }}
                    />
                  </div>
                </button>

                {/* Category Filter Button with Dropdown */}
                <div className="relative shrink-0">
                  <button
                    id="btn-category-icon-toggle"
                    type="button"
                    onClick={() => {
                      setIsCategoryCardOpen((prev) => !prev);
                      setIsSearchOpen(false);
                    }}
                    className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer group shrink-0 ${
                      isSatelliteExplore || theme === 'dark' ? 'text-white' : 'text-black'
                    }`}
                    style={{ color: isSatelliteExplore || theme === 'dark' ? '#FFFFFF' : '#000000' }}
                    title={selectedCategoryFilter ? 'Filtro de categoria ativo - Clique para alterar ou limpar' : 'Filtrar por Categoria'}
                  >
                    <div className="relative z-10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                      <SlidersHorizontal
                        className="w-6 h-6 sm:w-[29px] sm:h-[29px] stroke-[2]"
                        style={{ color: isSatelliteExplore || theme === 'dark' ? '#FFFFFF' : '#000000' }}
                      />
                    </div>
                    {selectedCategoryFilter && (
                      <span className="absolute top-0 right-0 z-20 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-[#1C1C1E]" />
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* 4. Bottom Floating Navigation Pill, Focus Mode Blur Backdrop & SpotPreviewBanner rendered at root level */}

      {/* 6. Spot Detail Modal / Bottom Sheet (opened ONLY when user clicks "Ver Local") */}
      <AnimatePresence>
        {isDetailOpen && selectedSpot && (
          <SpotDetailSheet
            key={`spot-detail-${selectedSpot.id}`}
            spot={selectedSpot}
            theme={theme}
            onClose={() => {
              setIsDetailOpen(false);
              if (activeTab !== 'explorar') {
                setSelectedSpot(null);
              }
            }}
            onNavigateTo={(spot) => {
              if (activeRoute && activeRoute.spotId !== spot.id) {
                clearActiveRoute();
              }
              setSelectedSpot(spot);
              setIsDetailOpen(false);
            }}
            isFavorite={favorites.includes(selectedSpot.id)}
            onToggleFavorite={handleToggleFavorite}
            onUpdateSpot={(updatedSpot) => {
              setSpots((prev) => prev.map((s) => (s.id === updatedSpot.id ? updatedSpot : s)));
              setSelectedSpot(updatedSpot);
            }}
          />
        )}
      </AnimatePresence>

      {/* 7. Search & Discovery Drawer (Mounted ONLY when Tab === 'buscar') */}
      {activeTab === 'buscar' && (
        <SearchFilterDrawer
          isOpen={true}
          onClose={() => setActiveTab('explorar')}
          spots={spots}
          theme={theme}
          onSelectSpot={(spot) => {
            handleSelectSpot(spot);
            setActiveTab('explorar');
          }}
        />
      )}

      {/* 8.5. Itineraries & Route Planning (Mounted ONLY when Tab === 'roteiros') */}
      {activeTab === 'roteiros' && (
        <motion.div
          key="itineraries-view-reveal-wrapper"
          initial={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 w-full z-40"
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
          }}
        >
          <ItinerariesView
            key={`itineraries-view-${accountSessionKey}`}
            isOpen={true}
            onClose={() => setActiveTab('explorar')}
            theme={theme}
            spots={spots}
            isOnboardingSelection={isOnboardingItinerarySelection}
            isOnboardingRevealReady={isOnboardingRevealReady}
            onSatelliteUiChange={setIsRoteirosSatelliteNav}
            onCompleteOnboardingSelection={(selectedItins, chosenInvestment) => {
              setIsOnboardingItinerarySelection(false);
              try {
                writeScopedJSON(
                  'monvian_selected_onboarding_itineraries',
                  selectedItins.map((i) => i.id),
                  user
                );
                writeScopedString('monvian_trip_budget', chosenInvestment, user);
                if (selectedItins.length > 0) {
                  writeScopedJSON('monvian_active_itinerary', selectedItins[0], user);
                  writeScopedString('monvian_itinerary_view_mode', 'map', user);
                  window.dispatchEvent(new CustomEvent('monvian:itinerary_applied', { detail: selectedItins[0] }));
                }
              } catch {}
              setActiveTab('roteiros');
              setIsUserLocationSpotlightActive(false);
            }}
          />
        </motion.div>
      )}

      {/* 9. Saved / Favorites Wishlists (Mounted ONLY when Tab === 'salvos') */}
      {(activeTab === 'salvos' || activeTab === ('chat' as any)) && (
        <motion.div
          key="saved-view-reveal-wrapper"
          initial={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 w-full z-40 bg-white dark:bg-black overflow-y-auto"
        >
          <SavedView
            key={`saved-view-${accountSessionKey}`}
            isOpen={true}
            theme={theme}
            spots={spots}
            onOpenSpot={(spot) => {
              setSelectedSpot(spot);
              setIsDetailOpen(true);
            }}
            onOpenItinerary={(itinerary) => {
              try {
                writeScopedJSON('monvian_active_itinerary', itinerary, user);
                writeScopedString('monvian_itinerary_view_mode', 'map', user);
                writeScopedString('monvian_itinerary_expanded', 'true', user);
                window.dispatchEvent(new CustomEvent('monvian:itinerary_applied', { detail: itinerary }));
              } catch {}
              setSelectedItinerary(null);
              setActiveTab('roteiros');
            }}
            onNavigateTab={(targetTab) => {
              setActiveTab(targetTab);
            }}
          />
        </motion.div>
      )}

      {/* 10. Profile & Favorites (Mounted ONLY when Tab === 'perfil') */}
      {activeTab === 'perfil' && (
        <motion.div
          key="profile-view-reveal-wrapper"
          initial={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 w-full z-40 bg-white dark:bg-black overflow-y-auto"
        >
          <ProfileModal
            key={`profile-modal-${accountSessionKey}`}
            isOpen={true}
            onClose={() => setActiveTab('explorar')}
            favorites={favorites}
            spots={spots}
            onSelectSpot={(spot) => {
              handleSelectSpot(spot);
              setActiveTab('explorar');
            }}
            rainEnabled={rainEnabled}
            onToggleRain={() => setRainEnabled(!rainEnabled)}
            snowEnabled={snowEnabled}
            onToggleSnow={() => setSnowEnabled(!snowEnabled)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            highContrast={highContrast}
            onToggleHighContrast={() => setHighContrast((prev) => !prev)}
            user={user}
            onUpdateUser={(updatedUser) => {
              setUser(updatedUser);
            }}
            onOpenAdmin={() => {
              setActiveTab('explorar');
              setIsAdminOpen(true);
            }}
            onSubViewChange={() => {}}
            communityUrl={systemSettings.community_url}
            instagramUrl={systemSettings.instagram_url}
            onLogout={() => {
              performFullLogout({ redirectToLogin: true });
            }}
          />
        </motion.div>
      )}

      {/* 10.6 Gold Success Celebration Modal */}
      <GoldSuccessModal
        isOpen={isGoldSuccessModalOpen}
        onClose={() => setIsGoldSuccessModalOpen(false)}
        theme={theme}
        onExplore={() => {
          setIsGoldSuccessModalOpen(false);
          setActiveTab('roteiros');
        }}
      />

    </main>

    {/* 3.8. Airbnb-Style Presentation Cards on first tab visit (Explorar, Roteiros, Salvos) */}
    <AirbnbPresentationCard
      isOpen={Boolean(airbnbCardTab)}
      tab={airbnbCardTab}
      onClose={handleAirbnbCardClose}
      onAction={handleAirbnbCardAction}
      theme={theme}
    />

    {/* 3.9. Clothing & Thermal Preparation Guide Modal for Campos do Jordão */}
    <ClothingWeatherModal
      isOpen={isWeatherModalOpen}
      onClose={() => setIsWeatherModalOpen(false)}
      weather={realWeather}
      theme={theme}
    />

    {/* Monvian iOS Expansion & Coins Burst Reward Overlay (Mounted ONLY while Explorar map is active) */}
    {activeTab === 'explorar' &&
      !isMapOrbiting &&
      !isOnboardingItinerarySelection &&
      !showFirstSignupWelcome &&
      !isGlobeIntroPlaying && (
        <XpRewardNotificationOverlay visible={true} />
      )}

    {/* Focus Mode Fullscreen Blur Backdrop when a Spot Card is active on mobile (matches filter blur style) */}
    <AnimatePresence>
      {isSpotFocusActive && (
        <motion.div
          id="spot-focus-blur-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleMapDismiss}
          className="md:hidden fixed inset-0 z-[60] bg-black/25 dark:bg-black/55 backdrop-blur-md cursor-pointer pointer-events-auto"
          style={{ WebkitBackdropFilter: 'blur(12px)' }}
        />
      )}
    </AnimatePresence>

    {/* 5. Floating Establishment Bottom Sheet Preview (Crisply above focus blur backdrop) */}
    <AnimatePresence>
      {activeTab === 'explorar' && isSpotCardOpen && selectedSpot && (
        <SpotPreviewBanner
          key="spot-preview-sheet"
          spot={selectedSpot}
          userCoords={userCoords}
          viewMode={spotPreviewMode}
          onViewModeChange={setSpotPreviewMode}
          theme={theme}
          isSatellite={isSatelliteExplore}
          onClose={() => {
            clearActiveRoute();
            setRevertSpotZoomTrigger((t) => t + 1);
            setSelectedSpot(null);
          }}
          onOpenDetails={(spot) => {
            setSelectedSpot(spot);
            setIsDetailOpen(true);
          }}
          onOpenItineraryTab={() => setActiveTab('roteiros')}
          onToggleRoute={handleToggleSpotRoute}
          isRouteActive={activeRoute?.spotId === selectedSpot.id}
          isRouteLoading={isRouteLoading}
          routeError={routeError}
        />
      )}
    </AnimatePresence>

    {/* 4. Bottom Navigation Pill rendered at root level (Visible ONLY on mobile, hidden during detail sheet, onboarding questions, globe intro & exclusive welcome) */}
    {!isMapOrbiting &&
      !isOnboardingItinerarySelection &&
      !isDetailOpen &&
      !showOnboardingQuestions &&
      !showFirstSignupWelcome &&
      !isGlobeIntroPending &&
      !isGlobeIntroPlaying && (
        <div
          key="bottom-nav-shell"
          className={`md:hidden fixed inset-0 pointer-events-none z-[250] transition-opacity duration-150 ${isChatKeyboardOpen ? 'opacity-0 [&_*]:!pointer-events-none' : 'opacity-100'}`}
        >
          <BottomNavigation
            activeTab={activeTab}
            onChangeTab={handleTabChange}
            unreadCount={2}
            isBlurred={isBlurActive}
            forceWhiteUI={isSatelliteExplore || (activeTab === 'roteiros' && isRoteirosSatelliteNav)}
            theme={theme}
          />
        </div>
      )}

    {/* 4.1. Minimalist iOS Radar Presentation on User Location (Map stays 100% visible without darkening) */}
    <AnimatePresence>
      {isUserLocationSpotlightActive && (
        <motion.div
          key="user-location-spotlight-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[42] pointer-events-none flex items-center justify-center overflow-hidden"
        >
          <div className="w-[132px] h-[132px] rounded-full border border-[#007AFF]/30 animate-pulse shadow-[0_0_24px_rgba(0,122,255,0.18)] pointer-events-none" />
        </motion.div>
      )}
    </AnimatePresence>

    {/* 4.5. Root-Level Fullscreen Blur Backdrop for Filters & Search (Covers map, header icons, and BottomNavigation) */}
    <AnimatePresence>
      {activeTab === 'explorar' && isBlurActive && (
        <motion.div
          id="global-blur-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[60] bg-black/25 dark:bg-black/55 backdrop-blur-md cursor-pointer pointer-events-auto"
          style={{ WebkitBackdropFilter: 'blur(12px)' }}
          onClick={() => {
            setIsCategoryCardOpen(false);
            setIsSearchOpen(false);
          }}
        />
      )}
    </AnimatePresence>

    {/* 4.6. Small Category Card / Dropdown (Floats crisply above global blur backdrop) */}
    <AnimatePresence>
      {activeTab === 'explorar' && isCategoryCardOpen && !isMapOrbiting && (
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -6 }}
          transition={{ type: 'spring', damping: 25, stiffness: 420 }}
          className="md:hidden fixed right-4 sm:right-6 w-64 p-2.5 rounded-[26px] ios26-liquid-glass z-[70] space-y-1 pointer-events-auto"
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 74px), 86px)',
          }}
        >
          <div className={`relative z-10 flex items-center justify-between px-3 py-2 border-b ${
            isSatelliteExplore || theme === 'dark' ? 'border-white/15' : 'border-black/10'
          }`}>
            <span className={`text-[11px] font-black uppercase tracking-wider ${
              isSatelliteExplore || theme === 'dark' ? 'text-white/75' : 'text-black/65'
            }`}>
              Categorias
            </span>
            {selectedCategoryFilter && (
              <button
                onClick={() => {
                  setSelectedCategoryFilter(null);
                  setIsCategoryCardOpen(false);
                }}
                className={`text-[11px] font-black hover:underline cursor-pointer flex items-center gap-1 ${
                  isSatelliteExplore || theme === 'dark' ? 'text-white' : 'text-black'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>

          {[
            { id: 'hotels', label: 'Hotéis e Pousadas', image: '/hotel.png' },
            { id: 'restaurants', label: 'Restaurantes', image: '/restaurante.png' },
            { id: 'cafes', label: 'Cafés', image: '/cafe.png' },
            { id: 'sweets', label: 'Chocolates & Doces', image: '/doce.png' },
            { id: 'attractions', label: 'Atrações & Parques', image: '/atracoes.png' },
            { id: 'pharmacies', label: 'Farmácias', image: '/medicacao.png' },
          ].map((cat) => {
            const CategoryIcon = 'icon' in cat ? (cat.icon as React.ComponentType<{ className?: string }>) : null;
            const isSelected = selectedCategoryFilter === cat.id;
            const useDarkDropdownUi = isSatelliteExplore || theme === 'dark';

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategoryFilter(isSelected ? null : cat.id);
                  setIsCategoryCardOpen(false);
                }}
                className={`relative z-10 w-full px-3 py-2.5 rounded-2xl active:scale-[0.98] text-xs font-black flex items-center justify-between gap-2.5 transition-all text-left cursor-pointer group ${
                  isSelected
                    ? useDarkDropdownUi
                      ? 'ios26-liquid-glass-pill text-white font-extrabold'
                      : 'ios26-liquid-glass-pill text-black font-extrabold'
                    : useDarkDropdownUi
                      ? 'hover:bg-white/10 text-white'
                      : 'hover:bg-white/25 text-black'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {'image' in cat && cat.image ? (
                    <div className="w-10.5 h-10.5 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <img
                        src={cat.image}
                        alt={cat.label}
                        className="w-full h-full object-contain select-none"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.endsWith('.png.png') && target.src.endsWith('.png')) {
                            target.src = target.src + '.png';
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`w-10.5 h-10.5 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                      isSelected
                        ? useDarkDropdownUi ? 'bg-white/25 text-white shadow-sm' : 'bg-white/60 text-black shadow-sm'
                        : useDarkDropdownUi ? 'bg-white/15 text-white' : 'bg-white/25 text-black'
                    }`}>
                      {CategoryIcon && <CategoryIcon className="w-4 h-4 stroke-[2]" />}
                    </div>
                  )}
                  <span className="truncate">{cat.label}</span>
                </div>
                {isSelected && (
                  <Check className={`w-4 h-4 shrink-0 stroke-[2.5] ${useDarkDropdownUi ? 'text-white' : 'text-black'}`} />
                )}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>

    {/* 4.7. Floating Search Bar and Results (Floats prominently above blur) */}
    <AnimatePresence>
      {activeTab === 'explorar' && isSearchOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed left-1/2 -translate-x-1/2 z-[70] w-[94%] max-w-md pointer-events-auto flex flex-col"
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 76px), 88px)',
          }}
        >
          {/* Search Input Bar (iOS Liquid Glass style) */}
          <div className="flex items-center gap-2 h-[44px] px-3.5 rounded-full expo-liquid-glass-bar transition-all">
            <Search className="w-[18px] h-[18px] text-[#8696a0] dark:text-[#8e8e93] shrink-0 mr-1 stroke-[2]" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isListening ? 'Ouvindo... Fale o local' : 'Buscar locais ou atrações...'}
              className="w-full bg-transparent border-none outline-none text-[15px] font-normal text-[#111b21] dark:text-white placeholder-[#8696a0] dark:placeholder-[#8e8e93]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="w-4 h-4 rounded-full expo-liquid-glass-btn text-[#111b21] dark:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Limpar pesquisa"
              >
                <X className="w-2.5 h-2.5 stroke-[2.5]" />
              </button>
            )}
            <button
              onClick={handleVoiceSearch}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-[#8696a0] dark:text-[#8e8e93] hover:text-[#111b21] dark:hover:text-white'
              }`}
              title="Pesquisar por voz"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="ml-1 px-2.5 py-1 rounded-full expo-liquid-glass-btn text-[12px] font-medium text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer shrink-0"
            >
              Fechar
            </button>
          </div>

          {/* Results appearing underneath the search bar */}
          <div className="mt-2.5 w-full max-h-[56vh] overflow-y-auto scrollbar-none rounded-[26px] expo-liquid-glass-bar p-2 flex flex-col gap-1">
            <div className="px-3 pt-2 pb-2 text-[11px] font-bold text-zinc-400 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200/50 dark:border-white/5">
              <span>{searchQuery.trim() ? `Locais encontrados (${searchResults.length})` : 'Sugestões em destaque'}</span>
            </div>

            {searchResults.length > 0 ? (
              <div className="flex flex-col gap-1 pt-1">
                {searchResults.map((spot) => (
                  <button
                    key={spot.id}
                    onClick={() => {
                      handleSelectSpot(spot);
                      setIsSearchOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-zinc-900/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all text-left cursor-pointer group"
                  >
                    <img
                      src={getSpotImage(spot)}
                      alt={spot.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-black/5 dark:border-white/10 shadow-xs group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                        <span className="text-[13.5px] font-bold text-zinc-900 dark:text-white truncate">
                          {spot.name}
                        </span>
                        <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                        {spot.rating && (
                          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black shrink-0 ml-auto">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>{spot.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 min-w-0">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[130px] sm:max-w-none">
                          {spot.categoryLabel}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-600 shrink-0">•</span>
                        <span className="truncate text-zinc-400 dark:text-zinc-500">
                          {spot.address || 'Campos do Jordão'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-7 px-4 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-zinc-500/10 flex items-center justify-center text-zinc-400 mb-2">
                  <MapPin className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  Nenhum local encontrado
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[260px]">
                  Não encontramos resultados para "{searchQuery}". Tente pesquisar por hotéis, restaurantes ou atrações.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Admin Fullscreen Layer (Mounted above #app-root-shell so map & app states remain preserved underneath) */}
    <AnimatePresence>
      {isAdminOpen && (
        <motion.div
          key="monvian-admin-screen"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 18 }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 w-full z-[130]"
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
          }}
        >
          <AdminLayout
            currentUser={user}
            onExitAdmin={() => {
              setIsAdminOpen(false);
              fetchSpots();
              fetchVisualIcons();
              fetchSettings();
            }}
            onLogout={() => {
              setIsAdminOpen(false);
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>

    {/* Uninterruptible Touch & Click Shield while Globe Flight Animation is running */}
    {isGlobeIntroPlaying && (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[245] pointer-events-auto touch-none select-none bg-transparent"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
        }}
        onWheel={(e) => {
          e.stopPropagation();
        }}
      />
    )}

    {/* White Confetti Burst Overlay (120fps) upon landing in Campos do Jordão */}
    {activeTab === 'explorar' && arrivalConfettiTrigger > 0 && (
      <WhiteConfettiOverlay
        triggerKey={arrivalConfettiTrigger}
        onComplete={() => setArrivalConfettiTrigger(0)}
      />
    )}

    {/* 4-Step Complementary Registration Flow followed by Original Welcome Screen */}
    <AnimatePresence mode="wait">
      {showOnboardingQuestions ? (
        <OnboardingFlow
          key="monvian-smart-onboarding"
          user={user}
          theme={theme}
          initialStep={user?.onboarding_step || 1}
          onComplete={(updatedUser, preferences) => {
            const cleanEmail = String(
              updatedUser?.email || user?.email || user?.whatsapp || ''
            )
              .trim()
              .toLowerCase();
            try {
              if (cleanEmail) {
                localStorage.removeItem(`monvian_smart_onboarding_pending_${cleanEmail}`);
                localStorage.setItem(`monvian_first_welcome_pending_${cleanEmail}`, '1');
                localStorage.removeItem(`monvian_first_welcome_seen_${cleanEmail}`);
              }
            } catch {}

            if (updatedUser || preferences) {
              const token = localStorage.getItem('monvian_token');
              const mergedForCloud = normalizeAppUser({
                ...(user || {}),
                ...(updatedUser || {}),
                ...(preferences || {}),
                onboarding_step: 4,
                onboarding_completed: 1,
              });
              if (mergedForCloud) {
                persistUserToFirestore(mergedForCloud).catch(() => {});
              }
              setUser((prev: any) => {
                const merged = normalizeAppUser({
                  ...(prev || {}),
                  ...(updatedUser || {}),
                  ...(preferences || {}),
                  onboarding_step: 4,
                  onboarding_completed: 1,
                });
                try {
                  localStorage.setItem('monvian_user', JSON.stringify(merged));
                  if (token) {
                    savePersistentSession(token, merged).catch(() => {});
                  }
                } catch {}
                return merged;
              });
            }
            setShowOnboardingQuestions(false);
            setShowFirstSignupWelcome(true);
          }}
        />
      ) : showFirstSignupWelcome ? (
        <FirstSignupWelcomeScreen
          key="monvian-first-signup-welcome"
          theme={theme}
          onComplete={handleDismissFirstSignupWelcome}
        />
      ) : null}
    </AnimatePresence>

    <PlatanosWalletModal
      isOpen={isPlatanosWalletOpen}
      onClose={() => setIsPlatanosWalletOpen(false)}
      theme={theme}
      initialTab={platanosWalletTab}
    />

    <CamposAchievementModal
      isOpen={isCamposAchievementOpen}
      onClose={() => setIsCamposAchievementOpen(false)}
    />

  </motion.div>
  )}
  </AnimatePresence>
  </>
  );
}
