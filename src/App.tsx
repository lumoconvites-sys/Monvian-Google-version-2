import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CAMPOS_SPOTS, INITIAL_WEATHER } from './data/spots';
import { Spot, MapVisualIcon, MapModeType } from './types';
import { MapComponent } from './components/MapComponent';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { SpotDetailSheet } from './components/SpotDetailSheet';
import { SpotPreviewBanner } from './components/SpotPreviewBanner';
import { SearchFilterDrawer } from './components/SearchFilterDrawer';
import { SavedView } from './components/SavedView';
import { ItineraryDetailModal } from './components/ItineraryDetailModal';
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
import { gpsNavigationManager } from './services/gpsNavigation';
import { deviceHeadingManager } from './utils/deviceHeading';
import { getSpotImage, getSpotFallbackImage } from './utils/spotImages';
import { VerifiedBadge } from './components/ui/VerifiedBadge';
import { DesktopSidebar } from './components/desktop/DesktopSidebar';
import { DesktopMapControls } from './components/desktop/DesktopMapControls';
import { DesktopExplorePanel } from './components/desktop/DesktopExplorePanel';
import { startPreloadResources } from './utils/preloadItineraries';
import { AirbnbPresentationCard, isPresentationCardSeen, markPresentationCardSeen, PresentationTab } from './components/AirbnbPresentationCard';
import { persistUserToFirestore, syncPermissionsFromDatabase } from './services/firestoreSync';
import { HostDashboard } from './components/HostDashboard';
import { fetchSpotsFromSupabase, subscribeToSpotsChanges } from './services/supabaseSpots';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const token = localStorage.getItem('monvian_token');
      const savedUser = localStorage.getItem('monvian_user');
      return Boolean(token && savedUser);
    } catch {
      return false;
    }
  });
  const [user, setUser] = useState<any>(() => {
    try {
      const localAv = localStorage.getItem('monvian_local_avatar');
      const savedUser = localStorage.getItem('monvian_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (localAv && localAv.trim().length > 0) {
          parsed.avatar_url = localAv;
        }
        const emailClean = (parsed.email || parsed.whatsapp || '').trim().toLowerCase();
        const usernameClean = (parsed.username || '').trim().toLowerCase();
        if (
          ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(emailClean) ||
          usernameClean === 'marioyesk'
        ) {
          parsed.role = 'admin';
          parsed.isGold = true;
          parsed.isPremium = true;
          parsed.is_gold = 1;
          parsed.is_premium = 1;
          parsed.plan = 'gold';
        }
        return parsed;
      }
    } catch (e) {}
    return {
      id: 47,
      name: 'Mario Yesk',
      username: 'marioyesk',
      email: 'marioyesk@gmail.com',
      whatsapp: 'marioyesk@gmail.com',
      role: 'admin',
      isGold: true,
      isPremium: true,
      is_gold: 1,
      is_premium: 1,
      plan: 'gold',
      avatar_url: '/fotoperfil.png',
    };
  });
  const [snowEnabled, setSnowEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_snow_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [rainEnabled, setRainEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_rain_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Global Theme State: supports dark & light mode with localStorage persistence
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('monvian_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

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
  const [showOnboardingQuestions, setShowOnboardingQuestions] = useState<boolean>(false);
  const [zoomToUserTrigger, setZoomToUserTrigger] = useState<number>(0);
  const [revertSpotZoomTrigger, setRevertSpotZoomTrigger] = useState<number>(0);

  // Settings & Theme modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState<boolean>(false);
  const [isGoldSuccessModalOpen, setIsGoldSuccessModalOpen] = useState<boolean>(false);
  const [isChatKeyboardOpen, setIsChatKeyboardOpen] = useState<boolean>(false);

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
    };
  }, []);

  const handleToggleWeather = useCallback(() => {
    setIsWeatherModalOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('monvian_token');
    if (!token) {
      setIsAuthenticated(true);
      return;
    }

    let isMounted = true;

    const checkSession = async () => {
      try {
        let savedEmail = '';
        try {
          const parsedSaved = JSON.parse(localStorage.getItem('monvian_user') || '{}');
          savedEmail = (parsedSaved.email || parsedSaved.whatsapp || '').trim().toLowerCase();
        } catch {}

        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (savedEmail) {
          headers['x-user-email'] = savedEmail;
        }

        const res = await fetch('/api/auth/me', { headers });

        if (!res.ok) {
          if (isMounted) setIsAuthenticated(true);
          return;
        }

        const data = await res.json();
        if (data.success && data.user && isMounted) {
          const userObj = data.user;
          const userEmail = (userObj.email || userObj.whatsapp || '').trim().toLowerCase();
          const isGoldAdmin =
            ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(userEmail) ||
            (userObj.username || '').trim().toLowerCase() === 'marioyesk';
          const isGold = isGoldAdmin || Boolean(userObj.isGold || userObj.is_gold === 1 || userObj.isPremium || userObj.is_premium === 1);
          
          if (isGoldAdmin) {
            userObj.role = 'admin';
            userObj.is_gold = 1;
            userObj.is_premium = 1;
            userObj.plan = 'gold';
          }
          userObj.isGold = isGold;
          userObj.isPremium = isGold;

          try {
            const localAv = localStorage.getItem('monvian_local_avatar');
            if (localAv && localAv.trim().length > 0 && (!userObj.avatar_url || userObj.avatar_url === '/fotoperfil.png')) {
              userObj.avatar_url = localAv;
            }
          } catch {}

          if (userObj.location_permission_granted === 1) {
            localStorage.setItem('monvian_location_permission_granted', 'true');
            document.cookie = 'monvian_location_granted=true; max-age=315360000; path=/; SameSite=Lax';
          }
          if (userObj.motion_permission_granted === 1) {
            localStorage.setItem('monvian_motion_permission_granted', 'true');
            localStorage.setItem('monvian_compass_permission_handled', 'true');
            document.cookie = 'monvian_motion_granted=true; max-age=315360000; path=/; SameSite=Lax';
          }

          setUser(userObj);
          localStorage.setItem('monvian_user', JSON.stringify(userObj));
          syncPermissionsFromDatabase(userEmail).catch(() => {});
          setIsAuthenticated(true);
        }
      } catch {
        if (isMounted) setIsAuthenticated(true);
      }
    };

    checkSession();

    const handleUserUpdated = (e: any) => {
      if (e?.detail && isMounted) {
        setUser((prev: any) => ({ ...(prev || {}), ...e.detail }));
      }
    };
    window.addEventListener('monvian:user_updated', handleUserUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('monvian:user_updated', handleUserUpdated);
    };
  }, []);

  // Save settings on change to localStorage and backend database
  useEffect(() => {
    localStorage.setItem('monvian_rain_enabled', JSON.stringify(rainEnabled));
    localStorage.setItem('monvian_snow_enabled', JSON.stringify(snowEnabled));
    localStorage.setItem('monvian_theme', theme);
    localStorage.setItem('monvian_high_contrast', JSON.stringify(highContrast));

    setMapStyle('animado');

    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.backgroundColor = '#000000';
      if (document.body) document.body.style.backgroundColor = '#000000';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.style.backgroundColor = '#ffffff';
      if (document.body) document.body.style.backgroundColor = '#ffffff';
    }

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
  const [isHostDashboardOpen, setIsHostDashboardOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = window.location.pathname.toLowerCase();
    const q = new URLSearchParams(window.location.search);
    return (
      p === '/anfitriao' ||
      p === '/area-do-anfitriao' ||
      p === '/dashboard-anfitriao' ||
      p === '/host' ||
      q.get('view') === 'anfitriao' ||
      q.get('anfitriao') === '1'
    );
  });
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);

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

  useEffect(() => {
    if (!isAdminOpen) {
      fetchSpots();
      fetchVisualIcons();
    }
  }, [isAdminOpen]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('roteiros');

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
    setSelectedSpot((prevSpot) => {
      if (prevSpot) {
        setRevertSpotZoomTrigger((prev) => prev + 1);
      }
      return null;
    });
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
    let lastStatus: string = '';
    let lastLng = -45.5870;
    let lastLat = -22.7355;

    const unsubscribe = gpsNavigationManager.subscribe((navState) => {
      if (navState.status !== lastStatus) {
        lastStatus = navState.status;
        setGeoStatus(navState.status);
      }

      const now = performance.now();
      if (now - lastReactSync > 500) {
        const [lng, lat] = navState.coords;
        if (Math.abs(lng - lastLng) > 0.00004 || Math.abs(lat - lastLat) > 0.00004) {
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
  }, []);

  const handleToggleFavorite = useCallback((spotId: string) => {
    const spot = spots.find((s) => s.id === spotId);
    const isTourist = spot
      ? ['attractions', 'viewpoint', 'parks', 'nature', 'culture', 'monument', 'trail'].includes(spot.category)
      : false;
    favoritesManager.toggleItem(isTourist ? 'spot' : 'place', spotId);
  }, [spots]);

  const handleTabChange = useCallback((tab: TabType) => {
    if (tab === 'explorar') {
      if (deviceHeadingManager.isPermissionRequired() && !deviceHeadingManager.isPermissionHandled()) {
        deviceHeadingManager
          .requestPermission()
          .then(() => {
            if (gpsNavigationManager.getState().status !== 'granted') {
              gpsNavigationManager.requestPermissionAndStartFromGesture();
            }
          })
          .catch(() => {});
      } else if (gpsNavigationManager.getState().status !== 'granted') {
        gpsNavigationManager.requestPermissionAndStartFromGesture();
      }
      deviceHeadingManager.start();
    }

    // Always immediately close any open spot details, itinerary details, search drawers, etc.
    setIsDetailOpen(false);
    setSelectedSpot(null);
    setSelectedItinerary(null);
    setIsSearchOpen(false);
    setIsCategoryCardOpen(false);
    setIsHostDashboardOpen(false);
    setIsChatKeyboardOpen(false);
    setIsAdminOpen(false);
    setAirbnbCardTab(null);

    // Dispatch global event so child explorer components immediately close their modals
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('monvian-close-modals'));
    }

    setActiveTab(tab);
  }, []);

  // Airbnb Presentation Cards logic (first visit to 'explorar', 'roteiros', 'salvos')
  const [airbnbCardTab, setAirbnbCardTab] = useState<PresentationTab | null>(null);
  const [isSignupRevealActive, setIsSignupRevealActive] = useState<boolean>(false);

  // Dismiss the post-signup translucent intro screen after 1 second and smoothly open Roteiros
  useEffect(() => {
    if (!isSignupRevealActive) return;
    startPreloadResources();
    const timer = window.setTimeout(() => {
      setIsSignupRevealActive(false);
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [isSignupRevealActive]);

  // Automatically trigger native iOS/browser Geolocation & Motion prompts without custom modal cards
  useEffect(() => {
    gpsNavigationManager.start();
    deviceHeadingManager.start();

    const triggerNativePermissionsOnClick = () => {
      if (deviceHeadingManager.isPermissionRequired() && !deviceHeadingManager.isPermissionHandled()) {
        deviceHeadingManager
          .requestPermission()
          .then(() => {
            if (gpsNavigationManager.getState().status !== 'granted') {
              gpsNavigationManager.requestPermissionAndStartFromGesture();
            }
          })
          .catch(() => {});
      } else if (gpsNavigationManager.getState().status !== 'granted') {
        gpsNavigationManager.requestPermissionAndStartFromGesture();
      }

      if (deviceHeadingManager.isPermissionHandled() && gpsNavigationManager.getState().status === 'granted') {
        window.removeEventListener('click', triggerNativePermissionsOnClick, true);
      }
    };

    window.addEventListener('click', triggerNativePermissionsOnClick, { capture: true });

    return () => {
      window.removeEventListener('click', triggerNativePermissionsOnClick, true);
    };
  }, []);

  useEffect(() => {
    // Wait until full-screen onboarding modals, signup reveal, and admin are closed
    if (isAdminOpen || showOnboardingQuestions || showWelcomeOverlay || isSignupRevealActive) {
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
  }, [activeTab, showOnboardingQuestions, showWelcomeOverlay, isAdminOpen, isSignupRevealActive]);

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

  const [isDesktopExplorePanelOpen, setIsDesktopExplorePanelOpen] = useState<boolean>(true);

  const isUserAdmin = Boolean(
    user?.role === 'admin' ||
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes((user?.email || user?.whatsapp || '').trim().toLowerCase()) ||
    (user?.username || '').trim().toLowerCase() === 'marioyesk'
  );

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <AnimatePresence>
      {!isAuthenticated ? (
        <motion.div
          key="monvian-auth-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, filter: 'blur(10px)', scale: 1.01 }
          }
          transition={{
            duration: prefersReducedMotion ? 0.15 : 0.3,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="fixed inset-0 w-full h-full z-[120] bg-[#ffffff]"
        >
          <AuthScreen
            onSuccess={(token, userData, isNewAccount) => {
              const cleanEmail = (userData?.email || userData?.whatsapp || '').trim().toLowerCase();
              const isPrimaryAdminAccount =
                ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail) ||
                (userData?.username || '').trim().toLowerCase() === 'marioyesk';
              const normalizedUser = isPrimaryAdminAccount
                ? {
                    ...userData,
                    role: 'admin',
                    isGold: true,
                    isPremium: true,
                    is_gold: 1,
                    is_premium: 1,
                    plan: 'gold',
                  }
                : userData;
              localStorage.setItem('monvian_token', token);
              localStorage.setItem('monvian_user', JSON.stringify(normalizedUser));
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
              setActiveTab('roteiros');
              if (isNewAccount) {
                markPresentationCardSeen('roteiros');
                setIsSignupRevealActive(true);
              }
              setIsAuthenticated(true);
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
            onLogout={() => {
              setIsAdminOpen(false);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="monvian-main-app"
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.99, filter: 'blur(4px)' }
          }
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={
            prefersReducedMotion
              ? { duration: 0.2 }
              : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
          }
          id="app-root-shell"
          className={`fixed inset-0 w-full h-full overflow-hidden select-none flex transition-colors duration-300 ${
            theme === 'dark' ? 'bg-black md:bg-[#ffffff]' : 'bg-[#ffffff]'
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
            backgroundColor:
              typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
                ? '#ffffff'
                : theme === 'dark'
                  ? currentAdaptiveColor
                  : '#ffffff',
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
        onOpenWeatherModal={() => {}}
        user={user}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenHostDashboard={() => setIsHostDashboardOpen(true)}
        isUserAdmin={isUserAdmin}
        isCollapsed={isDesktopSidebarCollapsed}
        onToggleCollapse={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
      />

      <main
        id="main-app-content"
        className={`relative flex-1 w-full h-[100dvh] overflow-hidden select-none transition-all duration-300 rounded-t-[26px] md:rounded-none ios-page-top-rounded ${
          theme === 'dark' ? 'bg-black' : 'bg-zinc-50'
        }`}
        style={{
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
            {activeTab === 'explorar' && !isMapOrbiting && (
              <motion.div
                key="desktop-explore-panel-wrapper"
                initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 6, filter: 'blur(6px)' }}
                transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
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
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactive Map Canvas Column */}
          <div className="flex-1 h-full relative overflow-hidden">
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
              revertSpotZoomTrigger={revertSpotZoomTrigger}
              onStyleChange={setMapStyle}
              is3DMode={is3DMode}
              onOrbitChange={setIsMapOrbiting}
              isDetailOpen={isDetailOpen}
              snowEnabled={snowEnabled}
              rainEnabled={rainEnabled}
            />

            {/* 2. Dynamic Rain Particle Effect Overlay */}
            <RainEffect
              enabled={rainEnabled}
              weatherCode={realWeather.weatherCode}
              intensity={(systemSettings.weather_rain_mode as any) || 'moderada'}
              theme={theme}
            />

            {/* 2.5. Dynamic Snow Particle Effect Overlay (Neve nas Montanhas) */}
            <SnowEffect
              enabled={snowEnabled}
              intensity={(systemSettings.weather_snow_mode as any) || 'moderada'}
              theme={theme}
            />

            {/* DESKTOP MAP FLOATING CONTROLS (Top-Right Apple Style) */}
            {!isMapOrbiting && (
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

      {/* 3. Top Floating Header Bar (MOBILE ONLY: md:hidden) */}
      {!isMapOrbiting && (
        <header
          aria-label="Informações de Campos do Jordão"
          className={`md:hidden absolute top-0 left-0 right-0 z-40 flex items-center justify-between pointer-events-none px-4 sm:px-6 transition-[filter,opacity,transform] duration-200 ease-out ${
            isBlurActive ? 'blur-[6px] opacity-40 [&_*]:!pointer-events-none' : 'blur-0 opacity-100'
          }`}
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 28px)',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
        {/* Left: Big Weather Temperature & Dynamic Condition (Clean display without card box) */}
        <div className="flex items-center pointer-events-auto">
          <div
            id="weather-header-display"
            className="flex flex-col items-start select-none opacity-100 scale-100"
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
                mapStyle === 'animado'
                  ? 'text-white [-webkit-text-stroke:_0.35px_rgba(0,0,0,0.20)]'
                  : theme === 'dark'
                    ? 'text-white/95'
                    : 'text-zinc-800 dark:text-zinc-200'
              }`}>
                {realWeather.condition}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Clean Header Action Icons */}
        <div className="flex items-center gap-3.5 pointer-events-auto relative">
          {/* Lightweight Linear Theme Mode Toggle Button */}
          <button
            id="btn-settings-toggle"
            type="button"
            onClick={() => {
              setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
              setIsCategoryCardOpen(false);
              setIsSearchOpen(false);
            }}
            className={`p-1 flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer group shrink-0 bg-transparent border-none shadow-none ${
              theme === 'dark'
                ? 'text-white hover:text-zinc-200'
                : 'text-black hover:text-zinc-800'
            }`}
            style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
            title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            aria-label="Alternar tema Claro/Escuro"
          >
            <div className="relative w-12 h-12 sm:w-13 sm:h-13 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              {theme === 'dark' ? (
                <Sun
                  className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2]"
                  style={{ color: '#FFFFFF' }}
                />
              ) : (
                <Moon
                  className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2]"
                  style={{ color: '#000000' }}
                />
              )}
            </div>
          </button>

          {/* 3D View Toggle Icon */}
          <button
            id="btn-3d-toggle"
            type="button"
            onClick={() => setIs3DMode((prev) => !prev)}
            className={`p-1 flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer group bg-transparent border-none shadow-none ${
              theme === 'dark'
                ? 'text-white hover:text-zinc-200'
                : 'text-black hover:text-zinc-800'
            }`}
            style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
            title={is3DMode ? 'Alternar para visão 2D Plana' : 'Alternar para visão 3D com Relevo e Montanhas'}
          >
            <div className="relative w-12 h-12 sm:w-13 sm:h-13 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Map3DIcon className="w-8 h-8 sm:w-9 sm:h-9" style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }} />
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
              className={`p-1 flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer group shrink-0 bg-transparent border-none shadow-none ${
                theme === 'dark'
                  ? 'text-white hover:text-zinc-200'
                  : 'text-black hover:text-zinc-800'
              }`}
              style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
              title={selectedCategoryFilter ? 'Filtro de categoria ativo - Clique para alterar ou limpar' : 'Filtrar por Categoria'}
            >
              <div className="relative w-12 h-12 sm:w-13 sm:h-13 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <SlidersHorizontal className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2]" style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }} />
              </div>
              {selectedCategoryFilter && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-black" />
              )}
            </button>
          </div>
        </div>
      </header>
      )}

      {/* 4. Bottom Floating Navigation Pill and Global Blur Overlays rendered at root level */}

      {/* 5. Mini Banner Preview (occupies the space freed by the retracted search bar when a spot is opened) */}
      <AnimatePresence>
        {isSpotCardOpen && selectedSpot && (
          <SpotPreviewBanner
            key={`preview-${selectedSpot.id}`}
            spot={selectedSpot}
            theme={theme}
            onClose={() => {
              setSelectedSpot(null);
              setRevertSpotZoomTrigger((prev) => prev + 1);
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
            onClose={() => {
              setIsDetailOpen(false);
              setSelectedSpot(null);
              setRevertSpotZoomTrigger((prev) => prev + 1);
            }}
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
      <AnimatePresence>
        {activeTab === 'roteiros' && (
          <motion.div
            key="itineraries-view-reveal-wrapper"
            initial={false}
            animate={
              isSignupRevealActive
                ? { opacity: 0, scale: 0.99 }
                : { opacity: 1, scale: 1 }
            }
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed inset-0 z-40 ${isSignupRevealActive ? 'pointer-events-none' : ''}`}
          >
            <ItinerariesView
              key="itineraries-view"
              isOpen={true}
              onClose={() => setActiveTab('explorar')}
              theme={theme}
              spots={spots}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 9. Saved / Favorites Wishlists (Tab: 'salvos', Airbnb-inspired) */}
      <SavedView
        isOpen={activeTab === 'salvos' || activeTab === ('chat' as any)}
        theme={theme}
        spots={spots}
        onOpenSpot={(spot) => {
          setSelectedSpot(spot);
          setIsDetailOpen(true);
        }}
        onOpenItinerary={(itinerary) => {
          setSelectedItinerary(itinerary);
        }}
        onNavigateTab={(targetTab) => {
          setActiveTab(targetTab);
        }}
      />

      {/* 9.5. Curated & Saved Itinerary Detail Modal */}
      <AnimatePresence>
        {selectedItinerary && (
          <ItineraryDetailModal
            isOpen={Boolean(selectedItinerary)}
            onClose={() => setSelectedItinerary(null)}
            itinerary={selectedItinerary}
            onSelectSpot={(spot) => {
              setSelectedItinerary(null);
              setSelectedSpot(spot);
              setIsDetailOpen(true);
            }}
            isSaved={selectedItinerary ? favoritesManager.isItinerarySaved(selectedItinerary.id) : false}
            onSaveItinerary={(itinerary) => {
              favoritesManager.toggleItinerary(itinerary.id);
            }}
          />
        )}
      </AnimatePresence>



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
        onOpenHostDashboard={() => {
          setIsHostDashboardOpen(true);
        }}
        onSubViewChange={() => {}}
        communityUrl={systemSettings.community_url}
        instagramUrl={systemSettings.instagram_url}
        onLogout={() => {
          localStorage.removeItem('monvian_token');
          localStorage.removeItem('monvian_user');
          localStorage.removeItem('monvian_active_itinerary');
          localStorage.removeItem('monvian_itinerary_session');
          setUser(null);
          setIsAuthenticated(false);
          setActiveTab('explorar');
        }}
      />

      {/* 10.5. Host Affiliate Area (Onboarding 'Configurar recebimentos' + Authorized Dashboard) */}
      <HostDashboard
        isOpen={isHostDashboardOpen}
        onClose={() => {
          setIsHostDashboardOpen(false);
          if (typeof window !== 'undefined') {
            const p = window.location.pathname.toLowerCase();
            if (
              p === '/anfitriao' ||
              p === '/area-do-anfitriao' ||
              p === '/dashboard-anfitriao' ||
              p === '/host'
            ) {
              window.history.replaceState({}, document.title, '/');
            }
          }
        }}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        user={user}
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

    {/* 3.8. Airbnb-Style Presentation Cards on first tab visit (Explorar, Roteiros, Salvos) */}
    <AirbnbPresentationCard
      isOpen={Boolean(airbnbCardTab)}
      tab={airbnbCardTab}
      onClose={handleAirbnbCardClose}
      onAction={handleAirbnbCardAction}
      theme={theme}
    />

    {/* 4. Bottom Navigation Pill rendered at root level (Visible ONLY on mobile) */}
    {!isMapOrbiting && (
      <div className={`md:hidden transition-opacity duration-150 ${isChatKeyboardOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
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

    {/* 4.5. Root-Level Fullscreen Blur Backdrop for Filters & Search (Covers map, header icons, and BottomNavigation) */}
    <AnimatePresence>
      {isBlurActive && (
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
      {isCategoryCardOpen && !isMapOrbiting && (
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -6 }}
          transition={{ type: 'spring', damping: 25, stiffness: 420 }}
          className="md:hidden fixed right-4 sm:right-6 w-64 p-2.5 rounded-[26px] ios-glass z-[70] space-y-1 shadow-[0_20px_50px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.85)] pointer-events-auto"
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 74px), 86px)',
          }}
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

    {/* 4.7. Floating Search Bar and Results (Floats prominently above blur) */}
    <AnimatePresence>
      {isSearchOpen && (
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
          {/* Search Input Bar (WhatsApp iOS style) */}
          <div className="flex items-center gap-2 h-[42px] px-3.5 rounded-full bg-[#f0f2f5] dark:bg-[#202124] shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-all">
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
                className="w-4 h-4 rounded-full bg-[#8696a0]/30 hover:bg-[#8696a0]/50 text-[#111b21] dark:text-white flex items-center justify-center transition-colors cursor-pointer"
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
              className="ml-1 px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
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

    {/* 5. Post-Signup Translucent Intro Overlay ("Vamos começar..." / "Escolha seu roteiro preferido...") */}
    <AnimatePresence>
      {isSignupRevealActive && (
        <motion.div
          key="signup-roteiros-depth-veil"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            backdropFilter: 'blur(0px)',
            transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
          }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => setIsSignupRevealActive(false)}
          style={{
            WebkitBackdropFilter: 'blur(28px)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
          className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-2xl flex flex-col items-center justify-center px-6 text-center select-none"
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              y: -8,
              scale: 0.985,
              filter: 'blur(6px)',
              transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
            }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center max-w-sm mx-auto space-y-2.5"
          >
            <h2 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-white leading-tight">
              Vamos começar...
            </h2>
            <p className="text-[16px] sm:text-[18px] font-normal tracking-tight text-zinc-300 leading-snug">
              Escolha seu roteiro preferido...
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
  )}
  </AnimatePresence>
  );
}
