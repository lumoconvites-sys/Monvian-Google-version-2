import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CAMPOS_SPOTS, INITIAL_WEATHER } from './data/spots';
import { Spot, MapVisualIcon, MapModeType } from './types';
import { MapComponent } from './components/MapComponent';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { SpotDetailSheet } from './components/SpotDetailSheet';
import { SpotPreviewBanner } from './components/SpotPreviewBanner';
import { SearchFilterDrawer } from './components/SearchFilterDrawer';
import { AIChatModal } from './components/AIChatModal';
import { ProfileModal } from './components/ProfileModal';
import { ItinerariesView } from './components/ItinerariesView';
import { CloudRain, SlidersHorizontal, MapPin, Navigation2, Mic, Search, X, ShieldCheck, Sun, Moon, Building2, UtensilsCrossed, Coffee, Cake, Mountain, Cross, Check, RotateCcw, Star, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthScreen } from './components/AuthScreen';
import { AdminLayout } from './components/admin/AdminLayout';
import { OnboardingFlow } from './components/OnboardingFlow';
import { OnboardingQuestionsModal } from './components/OnboardingQuestionsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Weather3DIcon } from './components/Weather3DIcon';
import { WeatherModal } from './components/WeatherModal';
import { RainEffect } from './components/RainEffect';
import { SnowEffect } from './components/SnowEffect';
import { GoldSuccessModal } from './components/GoldSuccessModal';
import { computeAdaptiveThemeColor, applySystemThemeColor } from './utils/themeColor';
import { gpsNavigationManager } from './services/gpsNavigation';
import { getSpotImage, getSpotFallbackImage } from './utils/spotImages';
import { VerifiedBadge } from './components/ui/VerifiedBadge';
import { DesktopSidebar } from './components/desktop/DesktopSidebar';
import { DesktopTopBar } from './components/desktop/DesktopTopBar';
import { DesktopExplorePanel } from './components/desktop/DesktopExplorePanel';

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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(() => {
    try {
      const savedUser = localStorage.getItem('monvian_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [snowEnabled, setSnowEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_snow_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [rainEnabled, setRainEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_rain_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Global Theme State: Automatically synchronized with user's native device preference (prefers-color-scheme)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Dynamic automatic listener for OS Light / Dark mode changes (iOS, Android, Desktop)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applySystemTheme = (matches: boolean) => {
      const newTheme = matches ? 'dark' : 'light';
      setTheme(newTheme);
    };

    applySystemTheme(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      applySystemTheme(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handler);
      return () => (mediaQuery as any).removeListener(handler);
    }
  }, []);

  // 1-second initial loading splash screen
  const [isInitialSplash, setIsInitialSplash] = useState<boolean>(true);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setIsInitialSplash(false);
    }, 1000);
    return () => clearTimeout(splashTimer);
  }, []);

  // Map style mode state: synced with theme & user selection
  const [mapStyle, setMapStyle] = useState<MapModeType>(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'explorar';
    }
    return 'animado';
  });

  // Accessibility: High Contrast Mode State
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_high_contrast');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Map interaction state for Apple iOS translucent dynamic effects
  const [isMapInteracting, setIsMapInteracting] = useState<boolean>(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState<boolean>(false);

  // Welcome translucent overlay & Onboarding questionnaire on new account creation
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState<boolean>(false);
  const [showOnboardingQuestions, setShowOnboardingQuestions] = useState<boolean>(false);
  const [zoomToUserTrigger, setZoomToUserTrigger] = useState<number>(0);

  // Weather modal state
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState<boolean>(false);
  const [isGoldSuccessModalOpen, setIsGoldSuccessModalOpen] = useState<boolean>(false);

  // Handle Stripe Checkout return & Official Webhook / Backend Verification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

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
    const updateAppHeight = () => {
      try {
        const isLandscape =
          window.matchMedia('(orientation: landscape)').matches ||
          Math.abs(Number(window.orientation) || 0) === 90 ||
          window.innerWidth > window.innerHeight;

        let screenH = 0;
        if (typeof window !== 'undefined' && window.screen && window.screen.height) {
          screenH = isLandscape
            ? Math.min(window.screen.width, window.screen.height)
            : Math.max(window.screen.width, window.screen.height);
        }

        const h = Math.max(
          window.innerHeight || 0,
          document.documentElement?.clientHeight || 0,
          screenH || 0
        );

        if (h && h > 0) {
          document.documentElement.style.setProperty('--app-height', `${h}px`);
        }
        if (typeof window !== 'undefined' && window.scrollTo) {
          window.scrollTo(0, 0);
        }
      } catch (e) {}
    };

    updateAppHeight();
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo(0, 0);
    }

    const handleOrientation = () => {
      updateAppHeight();
      requestAnimationFrame(updateAppHeight);
      setTimeout(updateAppHeight, 50);
      setTimeout(updateAppHeight, 150);
      setTimeout(updateAppHeight, 300);
      setTimeout(updateAppHeight, 500);
    };

    window.addEventListener('resize', updateAppHeight, { passive: true });
    window.addEventListener('orientationchange', handleOrientation, { passive: true });
    window.addEventListener('pageshow', updateAppHeight, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateAppHeight, { passive: true });
    }

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientation, { passive: true });
    }

    const mql = window.matchMedia('(display-mode: standalone)');
    mql.addEventListener?.('change', updateAppHeight);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateAppHeight();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility, { passive: true });

    // Rapid orientation & layout cycle on entry as requested by user
    const triggerFastOrientationCycle = () => {
      try {
        if (typeof window !== 'undefined') {
          if (window.scrollTo) window.scrollTo(0, 1);
          
          // 1. Temporarily apply landscape geometry cycle
          const rootEl = document.getElementById('root');
          const shellEl = document.getElementById('app-root-shell');
          if (window.screen) {
            const sW = window.screen.width || 393;
            const sH = window.screen.height || 852;
            const maxD = Math.max(sW, sH);
            const minD = Math.min(sW, sH);
            if (rootEl) {
              rootEl.style.width = `${maxD}px`;
              rootEl.style.height = `${minD}px`;
            }
            if (shellEl) {
              shellEl.style.width = `${maxD}px`;
              shellEl.style.height = `${minD}px`;
            }
          }

          try { (window as any).orientation = 90; } catch (e) {}
          try { (window.screen?.orientation as any)?.lock?.('landscape')?.catch?.(() => {}); } catch (e) {}
          window.dispatchEvent(new Event('orientationchange'));
          window.dispatchEvent(new Event('resize'));
          if (window.visualViewport) {
            window.visualViewport.dispatchEvent(new Event('resize'));
          }

          setTimeout(() => {
            try { (window as any).orientation = 0; } catch (e) {}
            try { (window.screen?.orientation as any)?.unlock?.(); } catch (e) {}
            if (rootEl) {
              rootEl.style.width = '100%';
              rootEl.style.height = '100dvh';
            }
            if (shellEl) {
              shellEl.style.width = '100%';
              shellEl.style.height = '100dvh';
            }
            if (window.scrollTo) window.scrollTo(0, 0);
            updateAppHeight();
            window.dispatchEvent(new Event('orientationchange'));
            window.dispatchEvent(new Event('resize'));
            if (window.visualViewport) {
              window.visualViewport.dispatchEvent(new Event('resize'));
            }
            // Trigger layout recalculation reflow
            document.documentElement.style.height = '100.05%';
            void document.body.offsetHeight;
            document.documentElement.style.height = '';
          }, 50);

          setTimeout(() => {
            if (window.scrollTo) window.scrollTo(0, 0);
            updateAppHeight();
            window.dispatchEvent(new Event('resize'));
          }, 140);
        }
      } catch (err) {}
    };

    triggerFastOrientationCycle();
    const t0 = setTimeout(triggerFastOrientationCycle, 350);
    const t1 = setTimeout(triggerFastOrientationCycle, 1200);

    return () => {
      window.removeEventListener('resize', updateAppHeight);
      window.removeEventListener('orientationchange', handleOrientation);
      window.removeEventListener('pageshow', updateAppHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateAppHeight);
      }
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientation);
      }
      mql.removeEventListener?.('change', updateAppHeight);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, []);

  const handleToggleWeather = useCallback(() => {
    setIsWeatherModalOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('monvian_token');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    let isMounted = true;

    const checkSession = async (retriesLeft = 2) => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
          // Token is explicitly invalidated or user is banned
          localStorage.removeItem('monvian_token');
          localStorage.removeItem('monvian_user');
          if (isMounted) {
            setUser(null);
            setIsAuthenticated(false);
          }
          return;
        }

        const data = await res.json();
        if (data.success && isMounted) {
          const userObj = data.user;
          const userEmail = (userObj.email || userObj.whatsapp || '').trim().toLowerCase();
          const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(userEmail);
          const isGold = isGoldAdmin || Boolean(userObj.isGold || userObj.is_gold === 1 || userObj.isPremium || userObj.is_premium === 1);
          
          userObj.isGold = isGold;
          userObj.isPremium = isGold;
          setUser(userObj);
          localStorage.setItem('monvian_user', JSON.stringify(userObj));
          if (isGold) {
            localStorage.setItem('monvian_is_premium', 'true');
            localStorage.setItem('monvian_is_gold', 'true');
          } else {
            localStorage.removeItem('monvian_is_premium');
            localStorage.removeItem('monvian_is_gold');
          }
          setIsAuthenticated(true);

          // Fetch real user settings from database
          try {
            const settingsRes = await fetch('/api/user/settings', {
              headers: { Authorization: `Bearer ${token}` }
            });
            const settings = await settingsRes.json();
            if (settings.success && isMounted) {
              if (typeof settings.rain_enabled === 'boolean') {
                setRainEnabled(settings.rain_enabled);
                localStorage.setItem('monvian_rain_enabled', JSON.stringify(settings.rain_enabled));
              }
              if (typeof settings.snow_enabled === 'boolean') {
                setSnowEnabled(settings.snow_enabled);
                localStorage.setItem('monvian_snow_enabled', JSON.stringify(settings.snow_enabled));
              }
              if (settings.theme) {
                setTheme(settings.theme);
                localStorage.setItem('monvian_theme', settings.theme);
              }
              if (typeof settings.high_contrast === 'boolean') {
                setHighContrast(settings.high_contrast);
                localStorage.setItem('monvian_high_contrast', JSON.stringify(settings.high_contrast));
              }
            }
          } catch (e) {}
        } else if (isMounted) {
          if (retriesLeft > 0) {
            setTimeout(() => {
              if (isMounted) checkSession(retriesLeft - 1);
            }, 1200);
          } else {
            localStorage.removeItem('monvian_token');
            localStorage.removeItem('monvian_user');
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        // Network connection error or server cold start: retry before logging out
        if (retriesLeft > 0) {
          setTimeout(() => {
            if (isMounted) checkSession(retriesLeft - 1);
          }, 1500);
        } else if (isMounted) {
          // If we had a cached user, keep them in place instead of kicking them out abruptly
          const cachedUser = localStorage.getItem('monvian_user');
          if (cachedUser) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save settings on change to localStorage and backend database
  useEffect(() => {
    localStorage.setItem('monvian_rain_enabled', JSON.stringify(rainEnabled));
    localStorage.setItem('monvian_snow_enabled', JSON.stringify(snowEnabled));
    localStorage.setItem('monvian_theme', theme);
    localStorage.setItem('monvian_high_contrast', JSON.stringify(highContrast));

    if (theme === 'dark') {
      setMapStyle((prev) => (prev === 'animado' || prev === 'transporte' ? 'explorar' : prev));
    } else {
      setMapStyle('animado');
    }

    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }

    const token = localStorage.getItem('monvian_token');
    if (token) {
      fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rain_enabled: rainEnabled, snow_enabled: snowEnabled, theme, high_contrast: highContrast })
      }).catch(() => {});
    }
  }, [rainEnabled, snowEnabled, theme, highContrast]);

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
  const [is3DMode, setIs3DMode] = useState<boolean>(false);

  const fetchSpots = async () => {
    try {
      const res = await fetch('/api/spots');
      const data = await res.json();
      if (data.success && data.spots && data.spots.length > 0) {
        setSpots(data.spots);
        localStorage.setItem('monvian_cached_spots', JSON.stringify(data.spots));
      }
    } catch (e) {
      console.warn('Using offline spots fallback');
    }
  };

  const fetchVisualIcons = async () => {
    try {
      const res = await fetch('/api/map-visual-icons');
      const data = await res.json();
      if (data.success && Array.isArray(data.icons)) {
        setMapVisualIcons(data.icons);
      }
    } catch (e) {
      console.warn('Using offline visual icons fallback', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSystemSettings(data.settings);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchSpots();
    fetchVisualIcons();
    fetchSettings();

    const handleSpotsUpdated = (e: any) => {
      const updated = e.detail;
      if (updated && updated.id) {
        setSpots((prev) => {
          const exists = prev.some((s) => s.id === updated.id);
          const next = exists
            ? prev.map((s) => (s.id === updated.id ? updated : s))
            : [updated, ...prev];
          try {
            localStorage.setItem('monvian_cached_spots', JSON.stringify(next));
          } catch (err) {}
          return next;
        });
      }
      fetchSpots();
    };

    const handleWindowFocus = () => {
      fetchSpots();
    };

    window.addEventListener('monvian:spots_updated', handleSpotsUpdated);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('monvian:spots_updated', handleSpotsUpdated);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (!isAdminOpen) {
      fetchSpots();
    }
  }, [isAdminOpen]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('explorar');

  // Spot card dynamic layout behavior
  const isSpotCardOpen = Boolean(selectedSpot && !isDetailOpen && activeTab === 'explorar');

  const [favorites, setFavorites] = useState<string[]>(['itapeva', 'baden-baden', 'amantikir']);
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

  // Handle URL deep link (e.g. from QR Code scan: ?spot=spotId)
  useEffect(() => {
    if (spots.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
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
      console.warn('Error processing spot param from URL:', e);
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
    // Map loaded callback
  }, []);

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
  }>(() => {
    try {
      const cached = localStorage.getItem('monvian_cached_weather');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.temperature === 'number' && parsed.condition) {
          return parsed;
        }
      }
    } catch {}
    return {
      temperature: 17,
      condition: 'Parcialmente nublado',
      isDay: true,
      weatherCode: 2,
    };
  });

  useEffect(() => {
    let isSubscribed = true;

    const fetchWeather = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-22.7394&longitude=-45.5914&current=temperature_2m,relative_humidity_2m,is_day,weather_code&timezone=America%2FSao_Paulo',
          { signal: controller.signal, cache: 'no-cache' }
        );
        clearTimeout(timeoutId);

        const data = await res.json();
        if (data && data.current && isSubscribed) {
          const temp = Math.round(data.current.temperature_2m);
          const wcode = data.current.weather_code;
          const isDay = data.current.is_day !== 0;

          let cond = isDay ? 'Parcialmente nublado' : 'Céu parcialmente encoberto';

          if (wcode === 0) {
            cond = isDay ? 'Céu limpo' : 'Céu estrelado';
          } else if (wcode === 1) {
            cond = isDay ? 'Ensolarado' : 'Noite de céu limpo';
          } else if (wcode === 2) {
            cond = isDay ? 'Parcialmente nublado' : 'Parcialmente nublado';
          } else if (wcode === 3) {
            cond = 'Tempo nublado';
          } else if (wcode === 45 || wcode === 48) {
            cond = 'Nevoeiro na serra';
          } else if (wcode >= 51 && wcode <= 55) {
            cond = 'Garoa fraca';
          } else if (wcode === 56 || wcode === 57) {
            cond = 'Garoa gélida';
          } else if (wcode === 61 || wcode === 63) {
            cond = 'Chuva moderada';
          } else if (wcode === 65) {
            cond = 'Chuva forte';
          } else if (wcode === 66 || wcode === 67) {
            cond = 'Chuva congelante';
          } else if (wcode >= 71 && wcode <= 77) {
            cond = 'Frio de serra / Geada';
          } else if (wcode >= 80 && wcode <= 82) {
            cond = 'Pancadas de chuva';
          } else if (wcode >= 85 && wcode <= 86) {
            cond = 'Pancadas de neve';
          } else if (wcode >= 95) {
            cond = 'Tempestade com raios';
          }

          const newWeather = {
            temperature: temp,
            condition: cond,
            isDay,
            weatherCode: wcode,
          };

          setRealWeather(newWeather);
          localStorage.setItem('monvian_cached_weather', JSON.stringify(newWeather));
        }
      } catch (err) {
        // Silently use cached weather fallback
      }
    };

    fetchWeather();
    // Fast polling every 2.5 minutes + on window focus
    const interval = setInterval(fetchWeather, 2.5 * 60 * 1000);
    const onFocus = () => fetchWeather();
    window.addEventListener('focus', onFocus);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

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

  const handleSelectSpot = useCallback((spot: Spot | null) => {
    setSelectedSpot(spot);
    setIsDetailOpen(false);
  }, []);

  // Dismiss all cards, previews and overlays when touching the map (map acts like an "x")
  const handleMapDismiss = useCallback(() => {
    setSelectedSpot(null);
    setIsDetailOpen(false);
    setIsCategoryCardOpen(false);
    setIsSearchOpen(false);
  }, []);

  // User location state
  const [userCoords, setUserCoords] = useState<[number, number]>([-45.5870, -22.7355]);
  const [geoStatus, setGeoStatus] = useState<'prompt' | 'granted' | 'denied' | 'locating'>('locating');
  const [locationName, setLocationName] = useState<string>('Obtendo localização...');

  // Request or re-trigger high accuracy real geolocation
  const requestRealLocation = () => {
    gpsNavigationManager.start();
  };

  useEffect(() => {
    let lastReactSync = 0;
    const unsubscribe = gpsNavigationManager.subscribe((navState) => {
      setGeoStatus(navState.status);

      const now = performance.now();
      // Keep React state updated smoothly without re-rendering the whole page at 60fps
      if (now - lastReactSync > 350) {
        lastReactSync = now;
        setUserCoords(navState.coords);
        if (navState.isCarMode) {
          setLocationName(`Em trânsito • ${Math.round(navState.speed)} km/h`);
        } else {
          const [lng, lat] = navState.coords;
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleFavorite = (spotId: string) => {
    setFavorites((prev) =>
      prev.includes(spotId) ? prev.filter((id) => id !== spotId) : [...prev, spotId]
    );
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab !== 'perfil') {
      setIsProfileSettingsOpen(false);
    }
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

  const [isDesktopExplorePanelOpen, setIsDesktopExplorePanelOpen] = useState<boolean>(true);

  const isUserAdmin = Boolean(
    user?.role === 'admin' ||
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes((user?.email || '').trim().toLowerCase())
  );

  const isSplashVisible = isInitialSplash || isAuthenticated === null;

  return (
    <AnimatePresence mode="wait">
      {isSplashVisible ? (
        <motion.div
          key="monvian-splash-screen"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.04,
            filter: 'blur(8px)',
            transition: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
          }}
          className="fixed inset-0 w-full h-full flex flex-col items-center justify-center select-none z-50 bg-white text-black"
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '100%',
            minHeight: 'calc(100dvh + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box',
            margin: 0,
            padding: 0,
            backgroundColor: '#ffffff',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center p-6"
          >
            <motion.img
              src="/logocarregamento.png"
              alt="Monvian"
              className="h-24 sm:h-28 w-auto max-w-[340px] object-contain"
              animate={{
                scale: [1, 1.025, 1],
              }}
              transition={{
                duration: 2.0,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
            />
          </motion.div>
        </motion.div>
      ) : isAuthenticated === false ? (
        <motion.div
          key="monvian-auth-screen"
          initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 w-full h-full"
        >
          <AuthScreen 
            onSuccess={(token, userData, isNewAccount) => {
              setUser(userData);
              setIsAuthenticated(true);
              requestRealLocation();
              if (isNewAccount) {
                setShowOnboardingQuestions(true);
              }
            }} 
          />
        </motion.div>
      ) : isAdminOpen ? (
        <motion.div
          key="monvian-admin-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 w-full h-full"
        >
          <AdminLayout
            currentUser={user}
            onExitAdmin={() => {
              setIsAdminOpen(false);
              fetchSpots();
              fetchVisualIcons();
              fetchSettings();
            }}
            onLogout={async () => {
              const token = localStorage.getItem('monvian_token');
              if (token) {
                try {
                  await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                } catch (e) {}
              }
              localStorage.removeItem('monvian_token');
              localStorage.removeItem('monvian_user');
              localStorage.removeItem('monvian_active_itinerary');
              localStorage.removeItem('monvian_itinerary_session');
              setIsAuthenticated(false);
              setIsAdminOpen(false);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="monvian-main-app"
          initial={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          id="app-root-shell"
          className={`fixed inset-0 w-full h-full overflow-hidden select-none flex transition-colors duration-300 ${
            theme === 'dark' ? 'bg-black' : 'bg-[#f4f4f5]'
          }`}
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '100%',
            minHeight: 'calc(100dvh + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box',
            margin: 0,
            padding: 0,
            backgroundColor: currentAdaptiveColor,
          }}
        >
      <OfflineIndicator />

      {/* Desktop Left Sidebar (Only visible on md+ >= 768px, elegant native desktop vertical menu) */}
      <DesktopSidebar
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        unreadCount={2}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        realWeather={realWeather}
        onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
        user={user}
        onOpenAdmin={() => setIsAdminOpen(true)}
        isUserAdmin={isUserAdmin}
      />

      <main
        id="main-app-content"
        className={`relative flex-1 w-full h-full overflow-hidden select-none transition-all duration-300 ${
          theme === 'dark' ? 'bg-black' : 'bg-zinc-50'
        }`}
        style={{
          height: '100%',
          minHeight: '100%',
          boxSizing: 'border-box',
          margin: 0,
          padding: 0,
        }}
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
        onInteractionChange={setIsMapInteracting}
        zoomToUserTrigger={zoomToUserTrigger}
        onStyleChange={setMapStyle}
        onReturnToChat={() => {
          setActiveTab('chat');
        }}
        is3DMode={is3DMode}
      />

      {/* 2. Dynamic Rain Particle Effect Overlay */}
      <RainEffect
        enabled={rainEnabled}
        weatherCode={realWeather.weatherCode}
        theme={theme}
      />

      {/* 2.5. Dynamic Snow Particle Effect Overlay */}
      <SnowEffect
        enabled={snowEnabled}
        theme={theme}
      />

      {/* DESKTOP FLOATING TOP BAR (Visible on md+ >= 768px) */}
      <DesktopTopBar
        spots={spots}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategoryFilter || 'all'}
        onSelectCategory={(catId) => setSelectedCategoryFilter(catId === 'all' ? null : catId)}
        onSelectSpot={handleSelectSpot}
        theme={theme}
        realWeather={realWeather}
        onOpenWeatherModal={() => setIsWeatherModalOpen(true)}
        is3DMode={is3DMode}
        onToggle3DMode={() => setIs3DMode((prev) => !prev)}
        onOpenMapModes={() => {
          const btn = document.getElementById('btn-map-layer-switch');
          if (btn) btn.click();
        }}
      />

      {/* DESKTOP EXPLORE PANEL (Visible when activeTab === 'explorar' on desktop) */}
      {activeTab === 'explorar' && (
        <DesktopExplorePanel
          spots={filteredSpots}
          selectedSpot={selectedSpot}
          onSelectSpot={handleSelectSpot}
          selectedCategory={selectedCategoryFilter || 'all'}
          onSelectCategory={(catId) => setSelectedCategoryFilter(catId === 'all' ? null : catId)}
          theme={theme}
          isOpen={isDesktopExplorePanelOpen}
          onToggleOpen={() => setIsDesktopExplorePanelOpen((prev) => !prev)}
        />
      )}

      {/* 3. Top Floating Header Bar (MOBILE ONLY: md:hidden) */}
      <header
        aria-label="Informações de Campos do Jordão"
        className={`md:hidden absolute top-0 left-0 right-0 ${isCategoryCardOpen ? 'z-[60]' : 'z-40'} flex items-center justify-between pointer-events-none px-4 sm:px-6`}
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 28px)',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        }}
      >
        {/* Left: Big Weather Temperature & Dynamic Condition (Apple Weather aesthetic matching screenshot) */}
        <div className="flex items-center pointer-events-auto">
          <div
            id="weather-header-display"
            className={`flex flex-col items-start select-none transition-all duration-300 ease-out ${
              isMapInteracting
                ? 'opacity-20 scale-95'
                : 'opacity-90 hover:opacity-100 scale-100'
            }`}
            title={`Campos do Jordão: ${realWeather.temperature}°C — ${realWeather.condition}`}
          >
            {/* Layout: Large beautiful 3D icon on the left, bold prominent degrees */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Weather 3D Icon */}
              <button
                id="btn-icon-toggle-weather"
                type="button"
                onClick={handleToggleWeather}
                className="group relative cursor-pointer active:scale-95 transition-transform duration-200 focus:outline-none select-none flex items-center justify-center shrink-0"
                aria-label="Ver previsão completa do tempo em Campos do Jordão"
                title="Toque para ver a previsão do tempo"
              >
                <Weather3DIcon
                  weatherCode={realWeather.weatherCode}
                  isDay={realWeather.isDay}
                  className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 -my-2.5"
                />
              </button>

              {/* Temperature Degrees - Reinforced & Prominent */}
              <button
                id="btn-degrees-toggle-weather"
                type="button"
                onClick={handleToggleWeather}
                className="group relative flex items-baseline cursor-pointer active:scale-95 transition-transform duration-150 focus:outline-none select-none text-left"
                aria-label="Ver detalhes do clima em Campos do Jordão"
                title="Toque para ver a previsão do tempo"
              >
                <span className={`text-5xl sm:text-6xl font-extrabold tracking-tighter leading-none transition-colors group-hover:text-blue-400 ${
                  mapStyle === 'animado'
                    ? 'text-white [-webkit-text-stroke:_0.6px_rgba(0,0,0,0.22)]'
                    : theme === 'dark'
                      ? 'text-white'
                      : 'text-zinc-900 dark:text-white'
                }`}>
                  {realWeather.temperature}°
                </span>
              </button>
            </div>

            {/* Condition label under the temperature */}
            <button
              id="btn-phrase-toggle-weather"
              type="button"
              onClick={handleToggleWeather}
              className="cursor-pointer pointer-events-auto text-left focus:outline-none active:opacity-75 mt-0.5 ml-1"
              aria-label="Ver previsão completa do tempo"
              title="Toque para ver a previsão do tempo"
            >
              <span className={`block text-[13px] sm:text-[14px] font-semibold tracking-tight whitespace-nowrap ${
                mapStyle === 'animado'
                  ? 'text-white [-webkit-text-stroke:_0.35px_rgba(0,0,0,0.20)]'
                  : theme === 'dark'
                    ? 'text-white/95'
                    : 'text-zinc-800 dark:text-zinc-200'
              }`}>
                {realWeather.condition}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Circular Theme Button + Circular Search Button + Category Filter Button */}
        <div className="flex items-center gap-2.5 pointer-events-auto relative">
          {/* Circular Theme Toggle Button (Sol e Lua) */}
          <button
            id="btn-theme-toggle"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 cursor-pointer group transition-all ${
              isWhiteMapUI
                ? 'ios-glass-btn-white text-zinc-900'
                : 'ios-glass-btn text-zinc-700 dark:text-white'
            }`}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? (
              <div className="relative w-6 h-6 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500 text-[#FFD60A]">
                <svg className="w-full h-full text-[#FFD60A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" className="fill-[#FFD60A]" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </div>
            ) : (
              <div className="relative w-6 h-6 flex items-center justify-center group-hover:-rotate-12 transition-transform duration-500 text-[#5F55E8]">
                <svg className="w-full h-full text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" className="fill-[#5F55E8]" />
                </svg>
              </div>
            )}
          </button>

          {/* Circular 3D View Toggle Button */}
          <button
            id="btn-3d-toggle"
            type="button"
            onClick={() => setIs3DMode((prev) => !prev)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer group ${
              is3DMode
                ? 'ios-glass-btn ring-2 ring-blue-500/80 bg-blue-500/25 text-blue-400 border border-blue-400/40 shadow-[0_0_18px_rgba(59,130,246,0.5)]'
                : isWhiteMapUI
                ? 'ios-glass-btn-white text-zinc-900 border border-black/10'
                : 'ios-glass-btn text-zinc-700 dark:text-white border border-white/20 dark:border-white/15'
            }`}
            title={is3DMode ? 'Alternar para visão 2D Plana' : 'Alternar para visão 3D com Relevo e Montanhas'}
          >
            <div className="relative flex items-center justify-center font-black text-xs sm:text-[13.5px] tracking-tighter group-hover:scale-110 transition-transform">
              <span>3D</span>
            </div>
          </button>

          {/* Circular Category Filter Button with Dropdown */}
          <div className="relative shrink-0">
            <button
              id="btn-category-icon-toggle"
              onClick={() => {
                setIsCategoryCardOpen((prev) => !prev);
                setIsSearchOpen(false);
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer group shrink-0 ${
                isWhiteMapUI
                  ? selectedCategoryFilter || isCategoryCardOpen
                    ? 'ios-glass-btn-white ring-2 ring-black/20 text-zinc-950 bg-white'
                    : 'ios-glass-btn-white text-zinc-900'
                  : selectedCategoryFilter || isCategoryCardOpen
                    ? 'ios-glass-btn ring-2 ring-white/40 dark:ring-white/35 bg-white/25 dark:bg-white/20 text-zinc-900 dark:text-white'
                    : 'ios-glass-btn text-zinc-700 dark:text-white'
              }`}
              title={selectedCategoryFilter ? 'Filtro de categoria ativo - Clique para alterar ou limpar' : 'Filtrar por Categoria'}
            >
              <div className="relative w-6 h-6 flex items-center justify-center text-current group-hover:scale-110 transition-transform duration-300">
                <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
              </div>
              {selectedCategoryFilter && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] ring-1 ring-black/40" />
              )}
            </button>

            {/* Small Category Card / Dropdown */}
            <AnimatePresence>
              {isCategoryCardOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 420 }}
                  className="!absolute right-0 top-14 w-64 p-2.5 rounded-[26px] ios-glass z-[60] space-y-1 shadow-[0_20px_50px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.85)] pointer-events-auto"
                  style={{ position: 'absolute' }}
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900/10 dark:border-white/10">
                    <span className="text-[11px] font-black text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">
                      Categorias
                    </span>
                    {selectedCategoryFilter && (
                      <button
                        onClick={() => {
                          setSelectedCategoryFilter(null);
                          setIsCategoryCardOpen(false);
                        }}
                        className="text-[11px] font-black text-zinc-700 dark:text-white hover:underline cursor-pointer flex items-center gap-1"
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

                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategoryFilter(isSelected ? null : cat.id);
                          setIsCategoryCardOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-2xl active:scale-[0.98] text-xs font-black flex items-center justify-between gap-2.5 transition-all text-left cursor-pointer group ${
                          isSelected
                            ? 'bg-white/20 text-zinc-950 dark:text-white font-extrabold'
                            : 'hover:bg-zinc-900/5 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {'image' in cat && cat.image ? (
                            <div className="w-7 h-7 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
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
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                              isSelected
                                ? 'bg-white text-zinc-950 shadow-sm'
                                : 'bg-zinc-900/5 dark:bg-white/10 text-zinc-700 dark:text-white'
                            }`}>
                              {CategoryIcon && <CategoryIcon className="w-4 h-4 stroke-[2]" />}
                            </div>
                          )}
                          <span className="truncate">{cat.label}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-zinc-950 dark:text-white shrink-0 stroke-[2.5]" />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Fullscreen Blur Backdrop for Filters & Search (Smooth iOS symmetric fade) */}
      <AnimatePresence>
        {isBlurActive && (
          <motion.div
            id="global-blur-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[55] bg-black/25 dark:bg-black/55 backdrop-blur-md cursor-pointer pointer-events-auto"
            onClick={() => {
              setIsCategoryCardOpen(false);
              setIsSearchOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Search Bar and Results (Opened by circular search button, floats prominently above blur) */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed left-1/2 -translate-x-1/2 z-[60] w-[94%] max-w-md pointer-events-auto flex flex-col"
            style={{
              top: 'max(calc(env(safe-area-inset-top, 0px) + 76px), 88px)',
            }}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full ios-glass shadow-[0_12px_36px_rgba(0,0,0,0.25)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.7)] border border-white/30 dark:border-white/15 transition-all">
              <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isListening ? 'Ouvindo... Fale o local' : 'O que você quer encontrar?'}
                className="w-full bg-transparent border-none outline-none text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 font-bold"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-full hover:bg-zinc-200/60 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
                  title="Limpar pesquisa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleVoiceSearch}
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg'
                    : 'bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-200'
                }`}
                title="Pesquisar por voz"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="ml-1 px-2.5 py-1 rounded-full bg-zinc-900/5 dark:bg-white/10 hover:bg-zinc-900/10 dark:hover:bg-white/20 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              >
                Fechar
              </button>
            </div>

            {/* Results appearing underneath the search bar */}
            <div className="mt-2.5 w-full max-h-[56vh] overflow-y-auto scrollbar-none rounded-[26px] ios-glass p-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/25 dark:border-white/15 flex flex-col gap-1">
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
                        {/* Name row: Name followed by verified badge + Rating */}
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
                        {/* Subtitle row: Category • Address - NO BLUE, clean, single line, aligned */}
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
                      <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-0.5" />
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

      {/* 4. Bottom Floating Navigation Pill moved to root level */}

      {/* 5. Mini Banner Preview (occupies the space freed by the retracted search bar when a spot is opened) */}
      <AnimatePresence>
        {isSpotCardOpen && selectedSpot && (
          <SpotPreviewBanner
            key={`preview-${selectedSpot.id}`}
            spot={selectedSpot}
            onClose={() => {
              setSelectedSpot(null);
            }}
            onOpenDetails={(spot) => {
              setSelectedSpot(spot);
              setIsDetailOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* 6. Spot Detail Modal / Bottom Sheet (opened ONLY when user clicks "Ver Local") */}
      <AnimatePresence>
        {isDetailOpen && selectedSpot && (
          <SpotDetailSheet
            key={`spot-detail-${selectedSpot.id}`}
            spot={selectedSpot}
            onClose={() => setIsDetailOpen(false)}
            onNavigateTo={(spot) => {
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

      {/* 7. Search & Discovery Drawer (Tab: 'buscar') */}
      <SearchFilterDrawer
        isOpen={activeTab === 'buscar'}
        onClose={() => setActiveTab('explorar')}
        spots={spots}
        onSelectSpot={(spot) => {
          handleSelectSpot(spot);
          setActiveTab('explorar');
        }}
      />

      {/* 8.5. Itineraries & Route Planning (Tab: 'roteiros') */}
      <ItinerariesView
        isOpen={activeTab === 'roteiros'}
        onClose={() => setActiveTab('explorar')}
        theme={theme}
        spots={spots}
      />

      {/* 9. AI Travel Guide Chat (Tab: 'chat') matching screenshot */}
      <AIChatModal
        isOpen={activeTab === 'chat'}
        onClose={() => setActiveTab('explorar')}
        theme={theme}
        userCoords={userCoords ? { lat: userCoords[1], lng: userCoords[0] } : null}
        onOpenItineraries={() => {
          setActiveTab('roteiros');
        }}
        onSelectSpotByName={(name) => {
          const lower = name.toLowerCase().trim();
          const found = spots.find((s) => {
            const sName = s.name.toLowerCase();
            return sName.includes(lower) || lower.includes(sName) || (s.tagLabel && s.tagLabel.toLowerCase().includes(lower));
          });
          if (found) {
            handleSelectSpot(found);
            setActiveTab('explorar');
          } else {
            setActiveTab('explorar');
          }
        }}
      />

      {/* 10. Profile & Favorites (Tab: 'perfil') */}
      <ProfileModal
        isOpen={activeTab === 'perfil'}
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
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
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
        onSubViewChange={(subView) => {
          setIsProfileSettingsOpen(subView === 'permissoes');
        }}
        communityUrl={systemSettings.community_url}
        instagramUrl={systemSettings.instagram_url}
      />

      {/* 10.5 Weather Details Modal with full forecast and tips */}
      <WeatherModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        weather={{
          ...INITIAL_WEATHER,
          temperature: realWeather.temperature,
          condition: realWeather.condition,
        }}
        weatherCode={realWeather.weatherCode}
        isDay={realWeather.isDay}
        theme={theme}
      />

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

      {/* 11. Onboarding Preferences Questionnaire on Pure Black (Appears first for new accounts) */}
      <AnimatePresence>
        {showOnboardingQuestions && (
          <OnboardingQuestionsModal
            isOpen={showOnboardingQuestions}
            spots={spots}
            userName={user?.name}
            onComplete={() => {
              setShowOnboardingQuestions(false);
              setShowWelcomeOverlay(true);
            }}
            onClose={() => {
              setShowOnboardingQuestions(false);
              setShowWelcomeOverlay(true);
            }}
            theme="dark"
          />
        )}
      </AnimatePresence>

      {/* 12. Welcome to Campos do Jordão Translucent & Blurred Overlay (Appears after questions) */}
      <AnimatePresence>
        {showWelcomeOverlay && (
          <motion.div
            id="welcome-overlay-campos"
            key="welcome-campos-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              backdropFilter: 'blur(0px)',
              transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => {
              setShowWelcomeOverlay(false);
              setZoomToUserTrigger((prev) => prev + 1);
            }}
            className="fixed inset-0 z-[180] bg-black/75 backdrop-blur-xl md:backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer"
            style={{
              paddingTop: 'max(32px, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
            }}
          >
            <motion.div
              id="welcome-overlay-content"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ 
                opacity: 0, 
                scale: 1.05, 
                y: -12,
                filter: 'blur(12px)',
                transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
              }}
              transition={{ type: 'spring', damping: 26, stiffness: 240, delay: 0.08 }}
              className="flex flex-col items-center max-w-lg mx-auto pointer-events-none"
            >
              {/* Main Welcome Phrase - Apple Welcome Screen fluid character by character animation */}
              <motion.h1
                id="welcome-overlay-title"
                variants={welcomeContainerVariants}
                initial="hidden"
                animate="visible"
                className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] flex flex-wrap justify-center items-center gap-x-[0.28em] gap-y-1 text-center"
              >
                {welcomePhrase.split(' ').map((word, wordIdx) => (
                  <span key={wordIdx} className="inline-block whitespace-nowrap">
                    {Array.from(word).map((char, charIdx) => (
                      <motion.span
                        key={charIdx}
                        variants={welcomeCharVariants}
                        className="inline-block will-change-[transform,opacity,filter]"
                      >
                        {char}
                      </motion.span>
                    ))}
                  </span>
                ))}
              </motion.h1>

              {/* Tap to continue prompt */}
              <motion.p
                id="welcome-overlay-prompt"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.75, y: 0 }}
                transition={{ delay: 0.85, duration: 0.5, ease: 'easeOut' }}
                className="text-xs sm:text-sm font-semibold tracking-wider text-zinc-300 mt-6 uppercase text-center drop-shadow"
              >
                Toque na tela para começar
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>

    {/* 4. Bottom Navigation Pill rendered at root level (MOBILE ONLY) */}
    {!isProfileSettingsOpen && (
      <div className="md:hidden">
        <BottomNavigation
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          unreadCount={2}
          isBlurred={isBlurActive}
          forceWhiteUI={false}
          theme={theme}
        />
      </div>
    )}
  </motion.div>
  )}
  </AnimatePresence>
  );
}
