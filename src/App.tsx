import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  SlidersHorizontal, 
  Sun, 
  Moon, 
  X, 
  ChevronRight, 
  MapPin, 
  Star, 
  Check, 
  RotateCcw, 
  Mic 
} from 'lucide-react';
import { Spot, WeatherInfo } from './types';
import { CAMPOS_SPOTS } from './data/spots';
import { MapComponent } from './components/MapComponent';
import { Map3DIcon } from './components/Map3DIcon';
import { Weather3DIcon } from './components/Weather3DIcon';
import { BottomNavigation } from './components/BottomNavigation';
import { DesktopSidebar } from './components/desktop/DesktopSidebar';
import { DesktopTopBar } from './components/desktop/DesktopTopBar';
import { DesktopExplorePanel } from './components/desktop/DesktopExplorePanel';
import { SpotPreviewBanner } from './components/SpotPreviewBanner';
import { SpotDetailSheet } from './components/SpotDetailSheet';
import { SearchFilterDrawer } from './components/SearchFilterDrawer';
import { ItinerariesView } from './components/ItinerariesView';
import { SavedView } from './components/SavedView';
import { ItineraryDetailModal } from './components/ItineraryDetailModal';
import { ProfileModal } from './components/ProfileModal';
import { GoldSuccessModal } from './components/GoldSuccessModal';
import { AirbnbPresentationCard } from './components/AirbnbPresentationCard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { RainEffect } from './components/RainEffect';
import { SnowEffect } from './components/SnowEffect';
import { AuthScreen } from './components/AuthScreen';
import { AdminLayout } from './components/admin/AdminLayout';
import { VerifiedBadge } from './components/ui/VerifiedBadge';
import { getSpotImage, getSpotFallbackImage } from './utils/spotImages';
import { favoritesManager } from './services/favoritesManager';

export default function App() {
  const [spots, setSpots] = useState<Spot[]>(CAMPOS_SPOTS);
  const [activeTab, setActiveTab] = useState<'explorar' | 'roteiros' | 'salvos' | 'perfil'>('explorar');
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isCategoryCardOpen, setIsCategoryCardOpen] = useState<boolean>(false);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isMapOrbiting, setIsMapOrbiting] = useState<boolean>(false);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [rainEnabled, setRainEnabled] = useState<boolean>(false);
  const [snowEnabled, setSnowEnabled] = useState<boolean>(false);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [isGoldSuccessModalOpen, setIsGoldSuccessModalOpen] = useState<boolean>(false);
  const [selectedItinerary, setSelectedItinerary] = useState<any | null>(null);
  const [airbnbCardTab, setAirbnbCardTab] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  // User & Authentication State
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('monvian_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('monvian_token') || localStorage.getItem('monvian_user'));
    } catch {
      return false;
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return favoritesManager.getFavorites();
    } catch {
      return [];
    }
  });

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('monvian_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('monvian_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    } catch {}
  }, [theme]);

  // Weather in Campos do Jordão
  const realWeather = useMemo(() => ({
    temperature: 16,
    condition: 'Parcialmente Nublado',
    weatherCode: 2,
    isDay: true,
    humidity: 78,
    windSpeed: 12,
    altitude: '1.628m',
    thermalSensation: 15,
    rainChance: 20,
    forecast: [
      { day: 'Hoje', temp: 16, icon: 'cloud-sun' },
      { day: 'Amanhã', temp: 18, icon: 'sun' },
      { day: 'Sex', temp: 14, icon: 'cloud-rain' },
    ]
  }), []);

  // Filter spots by category
  const filteredSpots = useMemo(() => {
    if (!selectedCategoryFilter) return spots;
    return spots.filter((s) => s.category === selectedCategoryFilter);
  }, [spots, selectedCategoryFilter]);

  // Search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredSpots.slice(0, 10);
    return spots.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.categoryLabel && s.categoryLabel.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [spots, filteredSpots, searchQuery]);

  const handleSelectSpot = useCallback((spot: Spot) => {
    setSelectedSpot(spot);
    setIsSearchOpen(false);
    setIsCategoryCardOpen(false);
  }, []);

  const handleToggleFavorite = useCallback((spotId: string) => {
    favoritesManager.toggleFavorite(spotId);
    setFavorites(favoritesManager.getFavorites());
  }, []);

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Reconhecimento de voz não suportado neste navegador.');
      return;
    }
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const isUserAdmin = Boolean(
    user?.role === 'admin' ||
    ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes((user?.email || '').trim().toLowerCase())
  );

  const isBlurActive = isSearchOpen || isCategoryCardOpen;
  const isSpotCardOpen = Boolean(selectedSpot) && !isDetailOpen;

  return (
    <div className={`min-h-screen w-full select-none ${theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-900'}`}>
      {!isAuthenticated ? (
        <AuthScreen
          onSuccess={(token, loggedUser) => {
            if (token) localStorage.setItem('monvian_token', token);
            if (loggedUser) {
              localStorage.setItem('monvian_user', JSON.stringify(loggedUser));
              setUser(loggedUser);
            }
            setIsAuthenticated(true);
          }}
        />
      ) : isAdminOpen ? (
        <AdminLayout
          currentUser={user}
          onExitAdmin={() => setIsAdminOpen(false)}
          onLogout={() => {
            localStorage.removeItem('monvian_token');
            localStorage.removeItem('monvian_user');
            setIsAuthenticated(false);
            setIsAdminOpen(false);
          }}
        />
      ) : (
        <div id="app-root-shell" className="fixed inset-0 w-full h-full overflow-hidden flex">
          <OfflineIndicator />

          {/* Desktop Left Sidebar */}
          <DesktopSidebar
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            unreadCount={favorites.length}
            theme={theme}
            onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            realWeather={realWeather}
            user={user}
            onOpenAdmin={() => setIsAdminOpen(true)}
            isUserAdmin={isUserAdmin}
          />

          <main id="main-app-content" className="relative flex-1 w-full h-full overflow-hidden">
            {/* Interactive Map */}
            <MapComponent
              spots={filteredSpots}
              selectedSpot={selectedSpot}
              onSelectSpot={handleSelectSpot}
              onMapClick={() => {
                setSelectedSpot(null);
                setIsSearchOpen(false);
                setIsCategoryCardOpen(false);
              }}
              theme={theme}
              is3DMode={is3DMode}
            />

            {/* Dynamic Weather Overlays */}
            <RainEffect enabled={rainEnabled} weatherCode={realWeather.weatherCode} theme={theme} />
            <SnowEffect enabled={snowEnabled} theme={theme} />

            {/* Desktop Top Floating Bar */}
            <DesktopTopBar
              spots={spots}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategoryFilter || 'all'}
              onSelectCategory={(catId) => setSelectedCategoryFilter(catId === 'all' ? null : catId)}
              onSelectSpot={handleSelectSpot}
              theme={theme}
              realWeather={realWeather}
              onOpenWeatherModal={() => {}}
              is3DMode={is3DMode}
              onToggle3DMode={() => setIs3DMode((prev) => !prev)}
              onOpenMapModes={() => {}}
            />

            {/* Mobile Header */}
            {!isMapOrbiting && (
              <header
                className="md:hidden absolute top-0 left-0 right-0 z-40 flex items-center justify-between pointer-events-none px-4 pt-4"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 24px)',
                }}
              >
                {/* Weather widget */}
                <div className="flex items-center gap-2 pointer-events-auto select-none">
                  <Weather3DIcon weatherCode={realWeather.weatherCode} isDay={realWeather.isDay} className="w-12 h-12" />
                  <div>
                    <span className="text-4xl font-extrabold text-white tracking-tighter drop-shadow-md">
                      {realWeather.temperature}°
                    </span>
                    <span className="block text-xs font-semibold text-zinc-300 drop-shadow">
                      {realWeather.condition}
                    </span>
                  </div>
                </div>

                {/* Right Actions: Theme, 3D, Search, Filter */}
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button
                    onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                    className="w-11 h-11 rounded-full bg-zinc-950/80 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white active:scale-95 cursor-pointer shadow-md"
                    title="Mudar tema"
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIs3DMode((prev) => !prev)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 cursor-pointer transition-all shadow-md ${
                      is3DMode ? 'bg-white text-zinc-950 font-bold' : 'bg-zinc-950/80 backdrop-blur-xl border border-white/20 text-white'
                    }`}
                    title="Alternar Relevo 3D"
                  >
                    <Map3DIcon className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => {
                      setIsSearchOpen((prev) => !prev);
                      setIsCategoryCardOpen(false);
                    }}
                    className="w-11 h-11 rounded-full bg-zinc-950/80 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white active:scale-95 cursor-pointer shadow-md"
                    title="Pesquisar locais"
                  >
                    <Search className="w-5 h-5" />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setIsCategoryCardOpen((prev) => !prev);
                        setIsSearchOpen(false);
                      }}
                      className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 cursor-pointer transition-all shadow-md ${
                        selectedCategoryFilter ? 'bg-blue-500 text-white' : 'bg-zinc-950/80 backdrop-blur-xl border border-white/20 text-white'
                      }`}
                      title="Filtrar categorias"
                    >
                      <SlidersHorizontal className="w-5 h-5" />
                    </button>

                    {/* Category Dropdown */}
                    <AnimatePresence>
                      {isCategoryCardOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: -4 }}
                          className="absolute right-0 top-14 w-60 p-2.5 rounded-3xl bg-zinc-950/90 backdrop-blur-2xl border border-white/15 z-50 shadow-2xl space-y-1"
                        >
                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-xs font-bold text-zinc-400">
                            <span>CATEGORIAS</span>
                            {selectedCategoryFilter && (
                              <button
                                onClick={() => setSelectedCategoryFilter(null)}
                                className="text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" /> Limpar
                              </button>
                            )}
                          </div>
                          {[
                            { id: 'hotels', label: 'Hotéis e Pousadas' },
                            { id: 'restaurants', label: 'Restaurantes' },
                            { id: 'cafes', label: 'Cafés' },
                            { id: 'sweets', label: 'Chocolates & Doces' },
                            { id: 'attractions', label: 'Atrações & Parques' },
                            { id: 'pharmacies', label: 'Farmácias' },
                          ].map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => {
                                setSelectedCategoryFilter(selectedCategoryFilter === cat.id ? null : cat.id);
                                setIsCategoryCardOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                selectedCategoryFilter === cat.id ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-white/10'
                              }`}
                            >
                              <span>{cat.label}</span>
                              {selectedCategoryFilter === cat.id && <Check className="w-4 h-4 stroke-[2.5]" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </header>
            )}

            {/* Backdrop Blur when Search/Filter is Open */}
            <AnimatePresence>
              {isBlurActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setIsSearchOpen(false);
                    setIsCategoryCardOpen(false);
                  }}
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm pointer-events-auto"
                />
              )}
            </AnimatePresence>

            {/* Mobile Floating Search Overlay */}
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  className="fixed left-4 right-4 z-50 max-w-md mx-auto pointer-events-auto flex flex-col gap-2"
                  style={{
                    top: 'max(calc(env(safe-area-inset-top, 0px) + 76px), 88px)',
                  }}
                >
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-zinc-950/90 backdrop-blur-2xl border border-white/20 shadow-2xl">
                    <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isListening ? 'Ouvindo...' : 'O que você quer encontrar?'}
                      className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-zinc-500 font-bold"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="p-1 text-zinc-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={handleVoiceSearch}
                      className={`p-1.5 rounded-full ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/10 text-zinc-300'}`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Results List */}
                  <div className="max-h-[50vh] overflow-y-auto rounded-3xl bg-zinc-950/90 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl flex flex-col gap-1">
                    {searchResults.length > 0 ? (
                      searchResults.map((spot) => (
                        <div
                          key={spot.id}
                          onClick={() => handleSelectSpot(spot)}
                          className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/10 cursor-pointer active:scale-[0.98] transition-all"
                        >
                          <img src={getSpotImage(spot)} alt={spot.name} className="w-12 h-12 rounded-xl object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-white truncate">{spot.name}</span>
                              <VerifiedBadge className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs text-zinc-400 truncate block">{spot.categoryLabel}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs text-zinc-500">
                        Nenhum local encontrado para "{searchQuery}"
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Preview Banner when Spot is Selected */}
            <AnimatePresence>
              {isSpotCardOpen && selectedSpot && (
                <SpotPreviewBanner
                  spot={selectedSpot}
                  onClose={() => setSelectedSpot(null)}
                  onOpenDetails={(spot) => {
                    setSelectedSpot(spot);
                    setIsDetailOpen(true);
                  }}
                />
              )}
            </AnimatePresence>

            {/* Spot Detail Sheet Modal */}
            <AnimatePresence>
              {isDetailOpen && selectedSpot && (
                <SpotDetailSheet
                  spot={selectedSpot}
                  onClose={() => setIsDetailOpen(false)}
                  onNavigateTo={(spot) => {
                    setSelectedSpot(spot);
                    setIsDetailOpen(false);
                  }}
                  isFavorite={favorites.includes(selectedSpot.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onUpdateSpot={(updated) => {
                    setSpots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                    setSelectedSpot(updated);
                  }}
                />
              )}
            </AnimatePresence>

            {/* Drawer Tab: Roteiros */}
            {activeTab === 'roteiros' && (
              <ItinerariesView
                isOpen={true}
                onClose={() => setActiveTab('explorar')}
                theme={theme}
                spots={spots}
              />
            )}

            {/* Drawer Tab: Salvos */}
            <SavedView
              isOpen={activeTab === 'salvos'}
              theme={theme}
              spots={spots}
              onOpenSpot={(spot) => {
                setSelectedSpot(spot);
                setIsDetailOpen(true);
              }}
              onOpenItinerary={(itinerary) => setSelectedItinerary(itinerary)}
              onNavigateTab={(t: any) => setActiveTab(t)}
            />

            {/* Drawer Tab: Perfil */}
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
              onToggleHighContrast={() => setHighContrast(!highContrast)}
              user={user}
              onUpdateUser={setUser}
              onOpenAdmin={() => {
                setActiveTab('explorar');
                setIsAdminOpen(true);
              }}
            />

            {/* Gold Celebration Modal */}
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

          {/* Bottom Floating Navigation Bar */}
          <BottomNavigation
            activeTab={activeTab}
            onChangeTab={(t: any) => setActiveTab(t)}
            unreadCount={favorites.length}
            isBlurred={isBlurActive}
            theme={theme}
          />
        </div>
      )}
    </div>
  );
}
