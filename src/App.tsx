import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CAMPOS_SPOTS, INITIAL_WEATHER } from './data/spots';
import { Spot } from './types';
import { MapComponent } from './components/MapComponent';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { SpotDetailSheet } from './components/SpotDetailSheet';
import { SpotPreviewBanner } from './components/SpotPreviewBanner';
import { WeatherOverlay } from './components/WeatherOverlay';
import { SearchFilterDrawer } from './components/SearchFilterDrawer';
import { AIChatModal } from './components/AIChatModal';
import { ProfileModal } from './components/ProfileModal';
import { getRandomSpotFromPopularCategory, DailyTipResult } from './utils/dailyTip';
import { CloudRain, Sparkles, SlidersHorizontal, MapPin, Navigation2, Mic, Search, X, ShieldCheck, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthScreen } from './components/AuthScreen';
import { AdminLayout } from './components/admin/AdminLayout';
import { OnboardingFlow } from './components/OnboardingFlow';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [snowEnabled, setSnowEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_snow_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Global Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('monvian_theme') as 'dark' | 'light') || 'dark';
  });

  // Accessibility: High Contrast Mode State
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    const saved = localStorage.getItem('monvian_high_contrast');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const token = localStorage.getItem('monvian_token');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
          setIsAuthenticated(true);
          // Fetch real user settings from database
          fetch('/api/user/settings', {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(settings => {
              if (settings.success) {
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
            })
            .catch(() => {});
        } else {
          localStorage.removeItem('monvian_token');
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  // Save settings on change to localStorage and backend database
  useEffect(() => {
    localStorage.setItem('monvian_snow_enabled', JSON.stringify(snowEnabled));
    localStorage.setItem('monvian_theme', theme);
    localStorage.setItem('monvian_high_contrast', JSON.stringify(highContrast));

    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    const metaThemeColor = document.getElementById('theme-color-meta');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#000000';
      document.body.style.backgroundColor = '#000000';
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#000000');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#f4f4f5';
      document.body.style.backgroundColor = '#f4f4f5';
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#f4f4f5');
    }

    const token = localStorage.getItem('monvian_token');
    if (token) {
      fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ snow_enabled: snowEnabled, theme, high_contrast: highContrast })
      }).catch(() => {});
    }
  }, [snowEnabled, theme, highContrast]);

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
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);

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
    fetchSettings();
  }, []);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('explorar');

  // Spot card dynamic layout behavior
  const isSpotCardOpen = Boolean(selectedSpot && !isDetailOpen && activeTab === 'explorar');

  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(['itapeva', 'baden-baden', 'amantikir']);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [isCategoryCardOpen, setIsCategoryCardOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Dica do Dia / Sugestões state & logic
  const [dailyTip, setDailyTip] = useState<DailyTipResult | null>(null);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

  const refreshDailyTip = useCallback(() => {
    const tip = getRandomSpotFromPopularCategory(spots, favorites);
    if (tip) {
      setDailyTip(tip);
    }
  }, [spots, favorites]);

  // Initial load of suggestion spot
  useEffect(() => {
    if (!dailyTip && spots.length > 0) {
      refreshDailyTip();
    }
  }, [spots, dailyTip, refreshDailyTip]);

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
    if (!dailyTip && spots.length > 0) {
      refreshDailyTip();
    }
  }, [spots, dailyTip, refreshDailyTip]);

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
  }>({
    temperature: 18,
    condition: 'Parcialmente nublado',
  });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-22.7355&longitude=-45.5870&current=temperature_2m,weather_code');
        const data = await res.json();
        if (data && data.current) {
          const temp = Math.round(data.current.temperature_2m);
          const wcode = data.current.weather_code;
          let cond = 'Parcialmente nublado';
          if (wcode === 0) cond = 'Céu limpo';
          else if (wcode >= 1 && wcode <= 2) cond = 'Parcialmente nublado';
          else if (wcode === 3) cond = 'Nublado';
          else if (wcode === 45 || wcode === 48) cond = 'Nevoeiro na serra';
          else if (wcode >= 51 && wcode <= 67) cond = 'Chuva';
          else if (wcode >= 71 && wcode <= 77) cond = 'Neve / Geada';
          else if (wcode >= 80) cond = 'Pancadas de chuva';

          setRealWeather({
            temperature: temp,
            condition: cond,
          });
        }
      } catch (err) {
        console.warn('Error fetching real weather:', err);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredSpots = useMemo(() => {
    return spots.filter(spot => {
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
        const matchesName = spot.name.toLowerCase().includes(q);
        const matchesDesc = spot.description.toLowerCase().includes(q);
        const matchesCatLabel = spot.categoryLabel.toLowerCase().includes(q);
        const matchesAddress = spot.address.toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesCatLabel || matchesAddress;
      }

      return true;
    });
  }, [spots, selectedCategoryFilter, searchQuery]);

  const handleSelectSpot = useCallback((spot: Spot | null) => {
    setSelectedSpot(spot);
    setIsDetailOpen(false);
    setIsSuggestionsOpen(false);
  }, []);

  // Dismiss all cards, previews and overlays when touching the map (map acts like an "x")
  const handleMapDismiss = useCallback(() => {
    setSelectedSpot(null);
    setIsDetailOpen(false);
    setIsSuggestionsOpen(false);
    setIsCategoryCardOpen(false);
    setIsSearchOpen(false);
    setIsWeatherOpen(false);
  }, []);

  // User location state
  const [userCoords, setUserCoords] = useState<[number, number]>([-45.5870, -22.7355]);
  const [geoStatus, setGeoStatus] = useState<'prompt' | 'granted' | 'denied' | 'locating'>('locating');
  const [locationName, setLocationName] = useState<string>('Obtendo localização...');

  // Request and track user's real geolocation with robust fallback
  const requestRealLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('denied');
      setLocationName('Geolocalização indisponível');
      return;
    }

    setGeoStatus('locating');

    const handleSuccess = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setUserCoords((prev) => {
        const [prevLng, prevLat] = prev;
        if (Math.abs(prevLng - lng) < 0.0001 && Math.abs(prevLat - lat) < 0.0001) {
          return prev;
        }
        return [lng, lat];
      });
      setGeoStatus('granted');
      setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn('Geolocation high accuracy error:', error);
      // Fallback with enableHighAccuracy: false for desktop / IP geolocation
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (err2) => {
          console.warn('Geolocation fallback error:', err2);
          setGeoStatus('denied');
          setLocationName('GPS bloqueado pelo navegador');
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        }
      );
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    requestRealLocation();

    // Also watch for live updates with micro-jitter threshold
    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setUserCoords((prev) => {
              const [prevLng, prevLat] = prev;
              // Ignore GPS micro-jitter (less than ~10 meters) to avoid unnecessary re-renders
              if (Math.abs(prevLng - lng) < 0.0001 && Math.abs(prevLat - lat) < 0.0001) {
                return prev;
              }
              return [lng, lat];
            });
            setGeoStatus((prev) => (prev === 'granted' ? prev : 'granted'));
            const newLoc = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            setLocationName((prev) => (prev === newLoc ? prev : newLoc));
          },
          (err) => {
            console.warn('WatchPosition notice:', err);
          },
          { enableHighAccuracy: true, maximumAge: 10000 }
        );
      } catch (e) {
        console.warn('watchPosition failed', e);
      }
    }

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const handleToggleFavorite = (spotId: string) => {
    setFavorites((prev) =>
      prev.includes(spotId) ? prev.filter((id) => id !== spotId) : [...prev, spotId]
    );
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  if (isAuthenticated === null) {
    return (
      <div className="fixed inset-0 w-full h-full bg-[#111315] flex flex-col items-center justify-center gap-4 text-white select-none">
        <div className="w-10 h-10 border-3 border-white/20 border-t-[#0084ff] rounded-full animate-spin" />
        <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Carregando Monvian...</span>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <AuthScreen 
        onSuccess={(token, userData) => {
          setUser(userData);
          setIsAuthenticated(true);
          requestRealLocation();
        }} 
      />
    );
  }

  // Real Administrative Panel Fullscreen View
  if (isAdminOpen) {
    return (
      <AdminLayout
        currentUser={user}
        onExitAdmin={() => {
          setIsAdminOpen(false);
          fetchSpots();
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
          setIsAuthenticated(false);
          setIsAdminOpen(false);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-zinc-100 dark:bg-[#111315]">
      <OfflineIndicator />
      <main
        className="absolute inset-0 w-full h-full overflow-hidden bg-zinc-50 dark:bg-[#111315] select-none"
      >
        {/* 1. Interactive Map Engine */}
      <MapComponent
        spots={filteredSpots}
        selectedSpot={selectedSpot}
        onSelectSpot={handleSelectSpot}
        onMapClick={handleMapDismiss}
        userCoords={userCoords}
        theme={theme}
        userAvatar={user?.avatar_url}
        userName={user?.name}
        highContrast={highContrast}
        onMapLoad={handleMapLoad}
      />

      {/* 3. Top Floating Header Bar */}
      <header
        aria-label="Informações de Campos do Jordão"
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between pointer-events-none px-4 sm:px-6"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 24px)',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        }}
      >
        {/* Left: Big Weather Temperature & Yellow Sun (Apple Weather aesthetic matching screenshot) */}
        <div className="flex items-center pointer-events-auto">
          <button
            id="btn-weather-header"
            onClick={() => setIsWeatherOpen(true)}
            className="flex items-center gap-1.5 pointer-events-auto active:scale-95 transition-transform duration-200 cursor-pointer select-none group"
            title="Clima em Campos do Jordão - Clique para previsão completa"
          >
            <span className="text-5xl sm:text-6xl font-extrabold tracking-tighter text-zinc-900 dark:text-white leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
              {realWeather.temperature}°
            </span>
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0 -mt-1 group-hover:scale-105 transition-transform duration-300">
              {/* Apple-style 3D Vibrant Yellow Sun with Fluffy White Cloud */}
              <svg className="w-full h-full" viewBox="0 0 48 48" fill="none">
                <defs>
                  <radialGradient id="sunRealistic" cx="35%" cy="30%" r="65%">
                    <stop offset="0%" stopColor="#FFF275" />
                    <stop offset="35%" stopColor="#FFC800" />
                    <stop offset="75%" stopColor="#FFA000" />
                    <stop offset="100%" stopColor="#FF7A00" />
                  </radialGradient>
                  <linearGradient id="cloudRealistic" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="70%" stopColor="#F0F4F8" />
                    <stop offset="100%" stopColor="#D9E2EC" />
                  </linearGradient>
                  <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.35" />
                  </filter>
                  <filter id="cloudShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.3" />
                  </filter>
                </defs>
                {/* Sun Orb */}
                <circle cx="21" cy="20" r="14.5" fill="url(#sunRealistic)" filter="url(#softShadow)" />
                {/* Soft Highlight on Sun */}
                <ellipse cx="17" cy="14" rx="5" ry="3.5" fill="#FFFFFF" fillOpacity="0.4" transform="rotate(-20 17 14)" />
                {/* Puffy 3D Cloud resting over bottom right of sun */}
                <g filter="url(#cloudShadow)">
                  <path
                    d="M20 37C17.79 37 16 35.21 16 33C16 31.06 17.38 29.45 19.23 29.08C19.78 26.24 22.25 24 25.25 24C28.75 24 31.62 26.71 31.74 30.18C33.62 30.68 35 32.4 35 34.45C35 36.96 32.96 39 30.45 39H20V37Z"
                    fill="url(#cloudRealistic)"
                  />
                </g>
              </svg>
            </div>
          </button>
        </div>

        {/* Right: Circular Theme Button + Circular Search Button + Category Filter Button */}
        <div className="flex items-center gap-2.5 pointer-events-auto relative">
          {/* Circular Theme Toggle Button */}
          <button
            id="btn-theme-toggle"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="w-12 h-12 rounded-full bg-white/95 dark:bg-[#16171a]/90 hover:bg-zinc-100 dark:hover:bg-[#1f2128] text-zinc-900 dark:text-white shadow-xl border border-zinc-200/80 dark:border-white/15 backdrop-blur-xl flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer group"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? (
              <div className="relative w-6 h-6 flex items-center justify-center text-zinc-900 dark:text-white group-hover:rotate-45 transition-transform duration-500">
                <svg className="w-full h-full text-zinc-900 dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" className="fill-zinc-900 dark:fill-white" />
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
              <div className="relative w-6 h-6 flex items-center justify-center text-zinc-900 dark:text-white group-hover:-rotate-12 transition-transform duration-500">
                <svg className="w-full h-full text-zinc-900 dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" className="fill-zinc-900 dark:fill-white" />
                </svg>
              </div>
            )}
          </button>

          {/* Circular Search Button */}
          <button
            id="btn-search-toggle"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className={`w-12 h-12 rounded-full shadow-xl border backdrop-blur-xl flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer group ${
              isSearchOpen || searchQuery
                ? 'bg-[#00C896] text-white border-transparent shadow-[0_0_20px_rgba(0,200,150,0.5)]'
                : 'bg-white/95 dark:bg-[#16171a]/90 hover:bg-zinc-100 dark:hover:bg-[#1f2128] text-zinc-900 dark:text-white border-zinc-200/80 dark:border-white/15'
            }`}
            title="Pesquisar no mapa"
          >
            <div className={`relative w-6 h-6 flex items-center justify-center group-hover:scale-110 transition-transform ${isSearchOpen || searchQuery ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
              <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" className={isSearchOpen || searchQuery ? 'fill-white/20' : 'fill-zinc-900/10 dark:fill-white/10'} />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </button>

          {selectedCategoryFilter ? (
            <button
              id="btn-reset-filters"
              onClick={() => setSelectedCategoryFilter(null)}
              className="h-12 px-4 rounded-full bg-[#00C896] hover:bg-[#00b085] text-white text-xs font-black shadow-2xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              title="Voltar ao normal sem filtros"
            >
              <span>Voltar ao normal</span>
            </button>
          ) : (
            <div className="relative">
              <button
                id="btn-category-icon-toggle"
                onClick={() => setIsCategoryCardOpen(!isCategoryCardOpen)}
                className="w-12 h-12 rounded-full bg-white/95 dark:bg-[#16171a]/90 hover:bg-zinc-100 dark:hover:bg-[#1f2128] active:scale-95 text-zinc-900 dark:text-white shadow-xl border border-zinc-200/80 dark:border-white/15 backdrop-blur-xl flex items-center justify-center transition-all duration-300 cursor-pointer group"
                title="Filtrar por Categoria"
              >
                {/* New Modern Funnel / Sliders Filter Icon */}
                <div className="relative w-6 h-6 flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-110 transition-transform duration-300">
                  <SlidersHorizontal className="w-5 h-5 text-zinc-900 dark:text-white stroke-[2.2]" />
                </div>
              </button>

              {/* Small Category Card / Dropdown */}
              {isCategoryCardOpen && (
                <div className="absolute right-0 top-14 w-52 p-2 rounded-3xl bg-white dark:bg-[#181a1e] border border-zinc-200 dark:border-white/10 shadow-2xl z-50 space-y-1">
                  <div className="px-3 py-2 text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-white/5">
                    Categorias
                  </div>
                  {[
                    { id: 'hotels', label: 'Hotéis e Pousadas', emoji: '🏨' },
                    { id: 'restaurants', label: 'Restaurantes', emoji: '🍽️' },
                    { id: 'cafes', label: 'Cafés', emoji: '☕' },
                    { id: 'sweets', label: 'Chocolates & Doces', emoji: '🍫' },
                    { id: 'attractions', label: 'Atrações & Parques', emoji: '⛰️' },
                    { id: 'pharmacies', label: 'Farmácias', emoji: '💊' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryFilter(cat.id);
                        setIsCategoryCardOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-2xl hover:bg-zinc-100 dark:hover:bg-[#252830] text-zinc-800 dark:text-zinc-200 text-xs font-black flex items-center gap-2.5 transition-all text-left cursor-pointer"
                    >
                      <span className="text-base">{cat.emoji}</span>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Floating Search Bar (Opened by the circular search button) */}
      <AnimatePresence>
        {(isSearchOpen || searchQuery) && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm pointer-events-auto"
            style={{
              top: 'max(calc(env(safe-area-inset-top, 0px) + 72px), 84px)',
            }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/95 dark:bg-[#1b1c20]/95 backdrop-blur-2xl border border-zinc-200 dark:border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8)] transition-all">
              <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isListening ? 'Ouvindo... Fale o local' : 'O que você quer encontrar?'}
                className="w-full bg-transparent border-none outline-none text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 font-black"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-400 transition-colors cursor-pointer"
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Bottom Floating Navigation Pill with Integrated Suggestions Chevron & Card */}
      <BottomNavigation
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setIsSuggestionsOpen(false);
          handleTabChange(tab);
        }}
        unreadCount={2}
        isSuggestionsOpen={isSuggestionsOpen}
        onToggleSuggestions={() => {
          if (!isSuggestionsOpen) {
            setSelectedSpot(null);
            if (!dailyTip) {
              refreshDailyTip();
            }
          }
          setIsSuggestionsOpen((prev) => !prev);
        }}
        suggestionSpot={dailyTip?.spot || null}
        popularCategoryLabel={dailyTip?.popularCategoryLabel || 'Mais Populares'}
        onSelectSpot={(spot) => {
          setIsSuggestionsOpen(false);
          handleSelectSpot(spot);
        }}
        showSuggestionsChevron={activeTab === 'explorar' && !isSearchOpen}
      />

      {/* 5. Mini Banner Preview (occupies the space freed by the retracted search bar when a spot is opened) */}
      <AnimatePresence>
        {isSpotCardOpen && selectedSpot && (
          <SpotPreviewBanner
            key={`preview-${selectedSpot.id}`}
            spot={selectedSpot}
            onClose={() => setSelectedSpot(null)}
            onOpenDetails={(spot) => {
              setSelectedSpot(spot);
              setIsDetailOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* 6. Spot Detail Modal / Bottom Sheet (opened ONLY when user clicks "Ver Local") */}
      <SpotDetailSheet
        spot={isDetailOpen ? selectedSpot : null}
        onClose={() => setIsDetailOpen(false)}
        onNavigateTo={(spot) => {
          setSelectedSpot(spot);
          setIsDetailOpen(true);
        }}
        isFavorite={selectedSpot ? favorites.includes(selectedSpot.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onUpdateSpot={(updatedSpot) => {
          setSpots((prev) => prev.map((s) => (s.id === updatedSpot.id ? updatedSpot : s)));
          setSelectedSpot(updatedSpot);
        }}
      />

      {/* 7. Weather iOS Overlay (matches screenshot with loading effect and 3-second auto dismiss) */}
      <WeatherOverlay
        locationName="Campos do Jordão"
        temperature={20}
        condition="Parcialmente nublado"
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
      />

      {/* 8. Search & Discovery Drawer (Tab: 'buscar') */}
      <SearchFilterDrawer
        isOpen={activeTab === 'buscar'}
        onClose={() => setActiveTab('explorar')}
        spots={spots}
        onSelectSpot={(spot) => {
          handleSelectSpot(spot);
          setActiveTab('explorar');
        }}
      />

      {/* 9. AI Travel Guide Chat (Tab: 'chat') matching screenshot */}
      <AIChatModal
        isOpen={activeTab === 'chat'}
        onClose={() => setActiveTab('explorar')}
        userCoords={userCoords ? { lat: userCoords[1], lng: userCoords[0] } : null}
        onSelectSpotByName={(name) => {
          const found = spots.find(
            (s) => s.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(s.name.toLowerCase())
          );
          if (found) {
            handleSelectSpot(found);
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
        communityUrl={systemSettings.community_url}
        instagramUrl={systemSettings.instagram_url}
      />
    </main>
  </div>
  );
}
