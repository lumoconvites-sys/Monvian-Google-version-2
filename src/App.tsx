import React, { useState, useEffect } from 'react';
import { CAMPOS_SPOTS, INITIAL_WEATHER } from './data/spots';
import { Spot } from './types';
import { MapComponent } from './components/MapComponent';
import { SnowEffect } from './components/SnowEffect';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { SpotDetailSheet } from './components/SpotDetailSheet';
import { WeatherOverlay } from './components/WeatherOverlay';
import { SearchFilterDrawer } from './components/SearchFilterDrawer';
import { AIChatModal } from './components/AIChatModal';
import { ProfileModal } from './components/ProfileModal';
import { CloudRain, Sparkles, SlidersHorizontal, MapPin, Navigation2 } from 'lucide-react';

export default function App() {
  const [spots] = useState<Spot[]>(CAMPOS_SPOTS);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('explorar');
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [snowEnabled, setSnowEnabled] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(['itapeva', 'baden-baden', 'amantikir']);

  // User location state
  const [userCoords, setUserCoords] = useState<[number, number]>([-45.5870, -22.7355]);
  const [geoStatus, setGeoStatus] = useState<'prompt' | 'granted' | 'denied' | 'locating'>('locating');
  const [locationName, setLocationName] = useState<string>('Obtendo localização...');

  // Request and track user's real geolocation
  const requestRealLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('denied');
      setLocationName('Geolocalização indisponível');
      return;
    }

    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords([lng, lat]);
        setGeoStatus('granted');
        setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setGeoStatus('denied');
        setLocationName('Permissão não concedida (usando padrão)');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    requestRealLocation();

    // Also watch for live updates
    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setUserCoords([lng, lat]);
            setGeoStatus('granted');
            setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          },
          (err) => {
            console.warn('WatchPosition notice:', err);
          },
          { enableHighAccuracy: true, maximumAge: 5000 }
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

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#111315] select-none">
      {/* 1. Interactive Map Engine */}
      <MapComponent
        spots={spots}
        selectedSpot={selectedSpot}
        onSelectSpot={(spot) => setSelectedSpot(spot)}
        userCoords={userCoords}
      />

      {/* 2. Atmospheric Mountain Snowflakes Overlay (from screenshot) */}
      <SnowEffect enabled={snowEnabled} />

      {/* 3. Top Floating Header Bar */}
      <header aria-label="Informações de Campos do Jordão" className="absolute top-4 sm:top-6 left-4 right-4 z-25 flex items-center justify-between pointer-events-none">
        {/* Left: Round Weather Button and Real Location Status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            id="btn-weather-header"
            onClick={() => setIsWeatherOpen(true)}
            className="w-12 h-12 rounded-full bg-[#1b1c20]/90 hover:bg-[#282a30] text-white/95 shadow-2xl border border-white/15 backdrop-blur-md flex items-center justify-center transition-all active:scale-95 focus:outline-none"
            title="Ver Clima em Campos do Jordão"
          >
            <CloudRain className="w-5 h-5 stroke-[2.2] text-sky-300" />
          </button>

          {/* Quick Real Geolocation Pill */}
          <button
            id="btn-real-location-pill"
            onClick={requestRealLocation}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md border border-white/10 text-xs font-medium text-white shadow-lg transition-all"
            title="Clique para atualizar localização real GPS"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                geoStatus === 'granted'
                  ? 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]'
                  : geoStatus === 'locating'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-zinc-400'
              }`}
            />
            <span className="text-[11px] font-semibold text-zinc-100 flex items-center gap-1">
              <Navigation2 className="w-3 h-3 text-[#00ff88]" />
              {geoStatus === 'granted'
                ? 'GPS Ativo'
                : geoStatus === 'locating'
                ? 'Buscando GPS...'
                : 'Ativar GPS Real'}
            </span>
          </button>
        </div>

        {/* Right: Quick Discovery / Filter Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            id="btn-quick-explore"
            onClick={() => setActiveTab('buscar')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1b1c20]/90 hover:bg-[#282a30] active:scale-95 text-xs font-semibold text-white shadow-2xl border border-white/15 backdrop-blur-md transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Filtros</span>
          </button>
        </div>
      </header>

      {/* 4. Bottom Floating Navigation Pill (matches user screenshot) */}
      <BottomNavigation
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        unreadCount={2}
      />

      {/* 5. Spot Detail Modal / Bottom Sheet */}
      <SpotDetailSheet
        spot={selectedSpot}
        onClose={() => setSelectedSpot(null)}
        onNavigateTo={(spot) => {
          setSelectedSpot(spot);
        }}
        isFavorite={selectedSpot ? favorites.includes(selectedSpot.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* 6. Weather iOS Overlay (matches screenshot with loading effect and 3-second auto dismiss) */}
      <WeatherOverlay
        locationName="Campos do Jordão"
        temperature={20}
        condition="Parcialmente nublado"
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
      />

      {/* 7. Search & Discovery Drawer (Tab: 'buscar') */}
      <SearchFilterDrawer
        isOpen={activeTab === 'buscar'}
        onClose={() => setActiveTab('explorar')}
        spots={spots}
        onSelectSpot={(spot) => {
          setSelectedSpot(spot);
          setActiveTab('explorar');
        }}
      />

      {/* 8. AI Travel Guide Chat (Tab: 'chat') matching screenshot */}
      <AIChatModal
        isOpen={activeTab === 'chat'}
        onClose={() => setActiveTab('explorar')}
      />

      {/* 9. Profile & Favorites (Tab: 'perfil') */}
      <ProfileModal
        isOpen={activeTab === 'perfil'}
        onClose={() => setActiveTab('explorar')}
        favorites={favorites}
        spots={spots}
        onSelectSpot={(spot) => {
          setSelectedSpot(spot);
          setActiveTab('explorar');
        }}
        snowEnabled={snowEnabled}
        onToggleSnow={() => setSnowEnabled(!snowEnabled)}
      />
    </main>
  );
}
