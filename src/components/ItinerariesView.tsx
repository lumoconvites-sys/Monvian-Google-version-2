import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getCachedGeoData, isWithinCamposRadius } from '../utils/geoCache';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { AppleBackButton } from './ui/AppleBackButton';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Edit3,
  ExternalLink,
  Layers,
  Maximize2,
  Mic,
  Navigation,
  Notebook,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Store,
  Trash2,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { Itinerary, ItineraryDay, ItineraryStep, Spot, SpotCategory } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { TripDateStep } from './itineraries/TripDateStep';
import { PeopleStep } from './itineraries/PeopleStep';
import { BudgetStep } from './itineraries/BudgetStep';
import { TinderDiscoveryStep } from './itineraries/TinderDiscoveryStep';
import { ItineraryEditModal } from './itineraries/ItineraryEditModal';
import { generateCustomItinerary } from './itineraries/routeGenerator';
import { RoundedNavigationIcon } from './RoundedNavigationIcon';
import { ItineraryStoreModal } from './itineraries/ItineraryStoreModal';
import { AirbnbItineraryExplorer } from './itineraries/AirbnbItineraryExplorer';
import { PlusActionMenuModal } from './itineraries/PlusActionMenuModal';
import { ImportSpotFloatingModal } from './itineraries/ImportSpotFloatingModal';
import { TripNotesModal } from './itineraries/TripNotesModal';
import { LazyImage } from './ui/LazyImage';
import { favoritesManager } from '../services/favoritesManager';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries';
import { useIOSBackEntry } from '../services/iosNavigationManager';

interface ItinerariesViewProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  spots?: Spot[];
  isOnboardingSelection?: boolean;
  isOnboardingRevealReady?: boolean;
  onCompleteOnboardingSelection?: (selectedItins: Itinerary[], chosenInvestment: string) => void;
  onSatelliteUiChange?: (isWhiteNav: boolean) => void;
}

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim();

// Smooth Apple QR-Code Spring Physics
const qrSpringTransition = {
  type: 'spring' as const,
  damping: 28,
  stiffness: 340,
  mass: 0.8,
};

// Map style helper
// Calibrated +40% brighter, high-contrast, crystal-clear satellite imagery with street & landmark labels
const getMapStyle = (
  mode: 'satelite' | 'escuro' = 'satelite',
  theme: 'dark' | 'light' = 'dark'
): maplibregl.StyleSpecification => {
  if (mode === 'satelite') {
    if (MAPBOX_TOKEN) {
      return {
        version: 8,
        projection: { type: 'globe' } as any,
        sources: {
          'mapbox-satellite': {
            type: 'raster',
            tiles: [
              `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
            ],
            tileSize: 256,
            attribution: '&copy; Mapbox &copy; OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'mapbox-satellite-layer',
            type: 'raster',
            source: 'mapbox-satellite',
            minzoom: 0,
            maxzoom: 22,
            paint: {
              'raster-brightness-min': 0.20, // +40% elevação de áreas de sombra e matas
              'raster-brightness-max': 1.0,
              'raster-contrast': 0.18,       // Contraste apurado de estradas e relevo
              'raster-saturation': 0.25,     // Cores naturais vivas
            },
          },
        ],
      };
    }

    // High-Resolution Esri World Imagery + Reference (Boundaries, Roads & Labels)
    // Calibrado para ficar 40% mais claro, nítido e altamente visível
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        },
        'esri-reference': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-brightness-min': 0.22, // +40% mais claro nas sombras e vegetação
            'raster-brightness-max': 1.0,
            'raster-contrast': 0.18,       // Maior nitidez de estradas e curvas de nível
            'raster-saturation': 0.26,     // Cores ricas e nítidas
          },
        },
        {
          id: 'esri-reference-layer',
          type: 'raster',
          source: 'esri-reference',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-opacity': 0.95,        // Nomes de cidades, bairros e vias 100% legíveis
          },
        },
      ],
    };
  }

  // Dark vector mode
  if (MAPBOX_TOKEN) {
    const tilePath = theme === 'light' ? 'streets-v12' : 'dark-v11';
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'mapbox-tiles': {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/${tilePath}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
          ],
          tileSize: 256,
          attribution: '&copy; Mapbox &copy; OpenStreetMap',
        },
      },
      layers: [
        {
          id: 'mapbox-layer',
          type: 'raster',
          source: 'mapbox-tiles',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };
  }

  if (theme === 'light') {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'osm-base': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-base-layer',
          type: 'raster',
          source: 'osm-base',
          minzoom: 0,
          maxzoom: 20,
          paint: {
            'raster-contrast': 0.1,
            'raster-brightness-min': 0.0,
            'raster-brightness-max': 1.0,
            'raster-saturation': 0.0, // Natural colors, zero fluorescence
          },
        },
      ],
    };
  }

  // Dark mode fallback (without Mapbox token): CartoDB Dark Matter high-DPI tiles
  return {
    version: 8,
    projection: { type: 'globe' } as any,
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    },
    layers: [
      {
        id: 'carto-dark-layer',
        type: 'raster',
        source: 'carto-dark',
        minzoom: 0,
        maxzoom: 20,
        paint: {
          'raster-contrast': 0.05,
          'raster-brightness-min': 0.0,
          'raster-brightness-max': 1.0,
          'raster-saturation': 0.0,
        },
      },
    ],
  };
};

interface SwipeableStopCardProps {
  step: ItineraryStep;
  idx: number;
  totalSteps: number;
  isSelected: boolean;
  isDark: boolean;
  isPremium?: boolean;
  shouldAnimate?: boolean;
  onSelect: (step: ItineraryStep) => void;
  onDelete: (stepId: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
}

const openDirectionsMap = (spotTarget?: Spot | { name?: string; address?: string; lat?: number; lng?: number; mapsUrl?: string }) => {
  if (!spotTarget) return;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  const destination = spotTarget.lat && spotTarget.lng 
    ? `${spotTarget.lat},${spotTarget.lng}` 
    : encodeURIComponent(spotTarget.address ? `${spotTarget.name}, ${spotTarget.address}` : `${spotTarget.name} Campos do Jordão`);

  if (isIOS) {
    window.open(`https://maps.apple.com/?daddr=${destination}&dirflg=d`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  }
};

const OPEN_OFFSET_LEFT = -84;
const getShortDisplayTitle = (title: string): string => {
  if (!title) return 'Meu Roteiro';
  const cleaned = title.replace(/\s*\([^)]*\)/g, '').trim();
  if (cleaned.length <= 22) return cleaned;
  return cleaned.slice(0, 20).trim() + '...';
};
const SPRING_IOS = { type: 'spring' as const, stiffness: 440, damping: 36, mass: 0.8 };
const SPRING_LAYOUT = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.6 };

const SwipeableStopCard: React.FC<SwipeableStopCardProps> = ({
  step,
  idx,
  totalSteps,
  isSelected,
  isDark,
  isPremium = false,
  shouldAnimate = true,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const x = useMotionValue(0);
  const spot = step.spot;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const wasOpenAtStartRef = useRef(false);

  // Smooth transforms for iOS swipe gestures
  // Swipe left: reveals red delete action on right
  const trashOpacity = useTransform(x, [0, -20, -75], [0, 0.45, 1]);
  const trashScale = useTransform(x, [0, -35, -84, -160], [0.75, 0.9, 1, 1.2]);
  const bgOpacity = useTransform(x, [0, -12, -60], [0, 0.7, 1]);

  const handleDragStart = () => {
    wasOpenAtStartRef.current = isOpenRef.current;
  };

  const handleDragEnd = (_e: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const cardWidth = containerRef.current?.offsetWidth || 320;
    const currentX = x.get();
    const velocityX = info.velocity.x;
    const wasOpen = wasOpenAtStartRef.current;

    // Bloqueia qualquer arrasto para a direita: se estiver com x > 0, reseta para 0
    if (currentX > 0) {
      animate(x, 0, SPRING_IOS);
      setIsOpen(false);
      return;
    }

    // 1. GESTO DE EXCLUIR: Arrastar para a esquerda ultrapassando pelo menos 65% apaga direto
    const deleteThreshold = cardWidth * 0.65;
    if (currentX <= -deleteThreshold) {
      setIsDeleting(true);
      setTimeout(() => {
        onDelete(step.id);
      }, 200);
      return;
    }

    // 2. SE O CARD JÁ ESTAVA ABERTO COM A LIXEIRA (x < 0)
    if (wasOpen) {
      const undoThreshold = cardWidth * 0.35;
      const isUndoing =
        info.offset.x > undoThreshold ||
        info.offset.x > 32 ||
        currentX > -46 ||
        velocityX > 180;

      if (isUndoing) {
        animate(x, 0, SPRING_IOS);
        setIsOpen(false);
      } else {
        animate(x, OPEN_OFFSET_LEFT, SPRING_IOS);
        setIsOpen(true);
      }
      return;
    }

    // 3. INICIADO DA POSIÇÃO NORMAL (FECHADO)
    if (currentX < -36 || info.offset.x < -36 || velocityX < -220) {
      // Abre a área de excluir
      animate(x, OPEN_OFFSET_LEFT, SPRING_IOS);
      setIsOpen(true);
    } else {
      // Arraste insuficiente: volta suavemente para a posição normal
      animate(x, 0, SPRING_IOS);
      setIsOpen(false);
    }
  };

  const handleDeleteItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    setTimeout(() => {
      onDelete(step.id);
    }, 200);
  };

  return (
      <motion.div
        initial={shouldAnimate ? { opacity: 0, scale: 0.88, y: 12 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 10 }}
        transition={
          shouldAnimate
            ? {
                type: 'spring',
                stiffness: 380,
                damping: 22,
                delay: Math.min(idx * 0.035, 0.35),
              }
            : { duration: 0 }
        }
        whileHover={{ scale: 1.015, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
        whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
        className="relative w-full rounded-[28px] overflow-hidden select-none touch-pan-y transform-gpu will-change-transform"
      >
      {/* Background Swipe Area (iOS Action - Right side, neutral background) */}
      <motion.div
        style={{ opacity: bgOpacity }}
        onClick={handleDeleteItem}
        className={`absolute inset-0 rounded-[28px] flex items-center justify-end px-5 z-0 cursor-pointer ${
          isDark ? 'bg-[#18191E] border border-white/10' : 'bg-zinc-200 border border-zinc-300'
        }`}
        aria-label="Excluir ponto turístico"
      >
        <motion.div
          style={{ opacity: trashOpacity, scale: trashScale }}
          className="flex items-center gap-1.5 text-red-500 font-bold select-none"
        >
          <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 shadow-xs">
            <Trash2 className="w-4 h-4 stroke-[2.2]" />
          </div>
        </motion.div>
      </motion.div>

      {/* Foreground Draggable Card - 100% OPAQUE to prevent any background tinting/bleeding */}
      <div
        ref={containerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpenRef.current) {
            // Tapping an open card smoothly closes it
            animate(x, 0, SPRING_IOS);
            setIsOpen(false);
            return;
          }
          if (Math.abs(x.get()) < 6) {
            onSelect(step);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Local ${idx + 1}: ${spot?.name || 'Local'}. Deslize para a esquerda para excluir.`}
        className={`relative z-10 py-2.5 px-4 rounded-3xl flex items-center justify-between gap-3 cursor-pointer transition-all border ${
          isDark
            ? isSelected
              ? 'border-white/40 ring-1 ring-white/20 shadow-sm'
              : 'border-white/10 hover:border-white/30'
            : isSelected
            ? 'border-zinc-300 ring-2 ring-black/10 shadow-sm'
            : 'border-zinc-200/80 hover:border-zinc-300 shadow-2xs'
        }`}
        style={{
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          color: isDark ? '#FFFFFF' : '#000000',
        }}
      >
        {/* Left: Stop Number + Compact Thumbnail */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 self-center">
          <div className="relative shrink-0 flex items-center justify-center self-center">
            <span
              className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full text-[11px] font-black flex items-center justify-center leading-none text-center tracking-tight transition-colors self-center ${
                isSelected
                  ? isPremium
                    ? 'bg-metallic-gold text-[#1A1202] shadow-md shadow-[#E5AC33]/40'
                    : isDark
                    ? 'bg-white text-black shadow-md'
                    : 'bg-black text-white shadow-md'
                  : isDark
                  ? isPremium
                    ? 'bg-zinc-800 text-[#F5BE38] dark:text-[#FDE073] border border-[#E5AC33]/45'
                    : 'bg-white text-black border border-white/40'
                  : isPremium
                  ? 'bg-white/30 text-[#B88214] border border-[#E5AC33]/55'
                  : 'bg-black text-white border border-black shadow-2xs'
              }`}
            >
              {String(idx + 1).padStart(2, '0')}
            </span>
          </div>

          {spot && (
            <div
              style={{
                overflow: 'clip',
                clipPath: 'inset(0 round 16px)',
                WebkitClipPath: 'inset(0 round 16px)',
                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                isolation: 'isolate',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
              }}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-[16px] overflow-hidden shrink-0 bg-zinc-800 relative select-none self-center hover:opacity-90 active:scale-98 transition-all"
            >
              <LazyImage
                src={getSpotImage(spot)}
                alt={spot.name}
                className="w-full h-full object-cover pointer-events-none"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
            </div>
          )}

          {/* Middle Column */}
          <div className="min-w-0 flex-1 flex flex-col justify-center self-center py-0.5 pointer-events-none">
            <div className="flex items-center gap-1.5 flex-nowrap leading-none">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold leading-none text-zinc-400">
                <Clock className="w-3 h-3 shrink-0 text-zinc-400" />
                <span>{step.suggestedTime || '09:30'}</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-600 font-bold leading-none">·</span>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate max-w-[130px] leading-none">
                {spot?.categoryLabel || 'ATRAÇÃO / TURÍSTICO'}
              </span>
              {spot?.highlighted && (
                <span className={`inline-flex items-center gap-0.5 text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full leading-none ${
                  isPremium
                    ? 'bg-metallic-gold-badge text-[#C28514] dark:text-[#FDE073] border'
                    : 'bg-white/10 text-white border border-white/20'
                }`}>
                  ★ Verificado
                </span>
              )}
            </div>

            <h4
              className={`text-[14px] sm:text-[15px] font-black uppercase truncate leading-tight my-1 ${
                isDark ? 'text-white' : 'text-black'
              }`}
              style={{ color: isDark ? '#FFFFFF' : '#000000' }}
            >
              {spot?.shortName || spot?.name || `Ponto ${idx + 1}`}
            </h4>

            {step.durationToNextMin ? (
              <p className="text-[10.5px] font-normal text-zinc-400 dark:text-zinc-400 truncate leading-none flex items-center gap-1 pointer-events-none">
                <RoundedNavigationIcon isGold={isPremium} className={`w-3 h-3 shrink-0 ${isPremium ? '' : (isDark ? 'text-white' : 'text-black')}`} size={12} />
                <span>{step.durationToNextMin} min até o próximo ponto</span>
              </p>
            ) : (
              <p className="text-[10.5px] font-normal text-zinc-400 dark:text-zinc-400 truncate leading-none pointer-events-none">
                {(spot as { shortDescription?: string })?.shortDescription || spot?.description || 'Local planejado do roteiro'}
              </p>
            )}
          </div>
        </div>

        {/* Right Action: Round Play Button to open map directions */}
        <div
          className="flex items-center gap-1.5 shrink-0 self-center z-10 pl-1"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              openDirectionsMap(spot);
            }}
            className="w-9 h-9 rounded-full bg-white text-zinc-900 shadow-md flex items-center justify-center hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer"
            title="Abrir rota no Maps"
            aria-label="Abrir rota no Maps"
          >
            <Play className="w-4 h-4 fill-zinc-900 text-zinc-900 ml-0.5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

let hasPlayedItinerariesMapEntranceAnimation = false;
if (typeof window !== 'undefined') {
  window.addEventListener('monvian:user_logged_out', () => {
    hasPlayedItinerariesMapEntranceAnimation = false;
  });
}

export const ItinerariesView: React.FC<ItinerariesViewProps> = memo(({
  isOpen,
  onClose,
  theme = 'light',
  spots = CAMPOS_SPOTS,
  isOnboardingSelection = false,
  isOnboardingRevealReady = true,
  onCompleteOnboardingSelection,
  onSatelliteUiChange,
}) => {
  const isDark = theme === 'dark';
  const [shouldAnimateEntrance] = useState(() => !hasPlayedItinerariesMapEntranceAnimation);

  useEffect(() => {
    if (isOpen) {
      hasPlayedItinerariesMapEntranceAnimation = true;
    }
  }, [isOpen]);

  // Get or initialize persistent session ID
  const sessionId = useMemo(() => {
    let sid = localStorage.getItem('monvian_itinerary_session');
    if (!sid) {
      sid = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('monvian_itinerary_session', sid);
    }
    return sid;
  }, []);

  // Wizard state: 'date' | 'people' | 'budget' | 'tinder' | 'generating'
  const [wizardStep, setWizardStep] = useState<'date' | 'people' | 'budget' | 'tinder' | 'generating'>('date');

  // Draft trip preferences
  const [tripDate, setTripDate] = useState<string>('');
  const [tripDateFormatted, setTripDateFormatted] = useState<string>('');
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [peopleCount, setPeopleCount] = useState<number>(2);
  const [budget, setBudget] = useState<string>('300-600');

  // User explicitly opened the store or modified the itinerary in this active session
  const userHasExplicitlyOpenedStoreRef = useRef(false);
  const hasUserModifiedItineraryRef = useRef(false);
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  const isMountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      if (isMountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  // Current active user itinerary
  const [userItinerary, setUserItinerary] = useState<Itinerary | null>(() => {
    try {
      const cached = localStorage.getItem('monvian_active_itinerary');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          (parsed.id || parsed.title) &&
          Array.isArray(parsed.days) &&
          parsed.days.length > 0
        ) {
          const isLivre =
            parsed.id === 'roteiro-classico-2-dias' ||
            parsed.id?.startsWith('roteiro-classico') ||
            parsed.id === 'roteiro-bate-volta-essencial' ||
            parsed.badgeText?.toLowerCase() === 'grátis' ||
            parsed.price === 'R$ 0' ||
            parsed.price === 'Grátis';
          if (isLivre) {
            parsed.isPremium = false;
            parsed.badgeText = 'Grátis';
          }
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });

  // Modal for editing stops
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Selected day index for multi-day itineraries
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Active view mode: always load 'map' if user has an active itinerary; otherwise 'explore' (Store)
  const [itineraryViewMode, setItineraryViewMode] = useState<'explore' | 'map'>(() => {
    if (isOnboardingSelection) return 'explore';
    try {
      const cached = localStorage.getItem('monvian_active_itinerary');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          (parsed.id || parsed.title) &&
          Array.isArray(parsed.days) &&
          parsed.days.length > 0
        ) {
          return 'map';
        }
      }
    } catch {}
    return 'explore';
  });

  useEffect(() => {
    if (isOnboardingSelection) {
      setItineraryViewMode('explore');
      return;
    }
    try {
      localStorage.setItem('monvian_itinerary_view_mode', itineraryViewMode);
    } catch {}
  }, [itineraryViewMode, isOnboardingSelection]);

  useEffect(() => {
    const handleExternalItineraryApplied = (e: any) => {
      const applied = e?.detail;
      if (!applied || !Array.isArray(applied.days) || applied.days.length === 0) return;
      hasUserModifiedItineraryRef.current = true;
      userHasExplicitlyOpenedStoreRef.current = false;
      setIsStoreOpen(false);
      setIsExpanded(true);
      setSelectedDayIndex(0);
      setUserItinerary(applied);
      const firstStep = applied.days?.[0]?.steps?.[0];
      if (firstStep?.id) {
        setSelectedStopId(firstStep.id);
      }
      try {
        localStorage.setItem('monvian_active_itinerary', JSON.stringify(applied));
        localStorage.setItem('monvian_itinerary_view_mode', 'map');
      } catch {}
      setItineraryViewMode('map');
    };

    const handleUserLoggedOut = () => {
      setUserItinerary(null);
      setSelectedStopId(null);
      setItineraryViewMode('explore');
    };

    window.addEventListener('monvian:itinerary_applied', handleExternalItineraryApplied);
    window.addEventListener('monvian:user_logged_out', handleUserLoggedOut);
    return () => {
      window.removeEventListener('monvian:itinerary_applied', handleExternalItineraryApplied);
      window.removeEventListener('monvian:user_logged_out', handleUserLoggedOut);
    };
  }, []);

  // Loja de Roteiros Premium Modal state
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [storeToast, setStoreToast] = useState<string | null>(null);

  // Active itinerary map style: default is 'satelite' (+40% mais claro e nítido)
  const [itineraryMapStyle, setItineraryMapStyle] = useState<'satelite' | 'escuro'>(() => {
    try {
      const saved = localStorage.getItem('monvian_itinerary_map_style');
      if (saved === 'escuro' || saved === 'satelite') return saved;
    } catch (e) {}
    return 'satelite';
  });

  const handleToggleMapStyle = () => {
    const next = itineraryMapStyle === 'satelite' ? 'escuro' : 'satelite';
    setItineraryMapStyle(next);
    try {
      localStorage.setItem('monvian_itinerary_map_style', next);
    } catch (e) {}
    setStoreToast(next === 'satelite' ? 'Satélite HD (40% Mais Claro)' : 'Mapa Noturno / Escuro');
    scheduleTimeout(() => setStoreToast(null), 2500);
  };

  const isSatelliteMap = itineraryMapStyle === 'satelite';

  // Plus menu & Import spot floating modal states
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Get active step spot IDs for quick import tracking
  const activeStepSpotIds = useMemo(() => {
    if (!userItinerary?.days?.[0]?.steps) return [];
    return userItinerary.days[0].steps.map((s) => s.spotId).filter(Boolean) as string[];
  }, [userItinerary]);

  // Handler to import a spot into current active itinerary
  const handleImportSpotToItinerary = (spot: Spot) => {
    const currentSteps = userItinerary?.days?.[0]?.steps || [];
    const nextOrder = currentSteps.length + 1;
    const lastTime = currentSteps[currentSteps.length - 1]?.suggestedTime || '09:30';
    const [h, m] = lastTime.split(':').map(Number);
    const nextHour = (h + 1) % 24;
    const formattedTime = `${String(nextHour).padStart(2, '0')}:${String(isNaN(m) ? 0 : m).padStart(2, '0')}`;

    const newStep: ItineraryStep = {
      id: `step-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      spotId: spot.id,
      title: spot.name,
      spotName: spot.name,
      category: spot.categoryLabel || spot.category || 'Atração',
      categoryLabel: spot.categoryLabel || 'Atração / Turística',
      description: spot.description || spot.address || '',
      suggestedTime: currentSteps.length === 0 ? '09:30' : formattedTime,
      durationMinutes: 90,
      travelTimeFromPrev: '15 min até o próximo ponto',
      image: spot.image || '',
      lat: spot.lat,
      lng: spot.lng,
      stepOrder: nextOrder,
      spot: spot,
    };

    const updatedDays = (userItinerary?.days && userItinerary.days.length > 0)
      ? userItinerary.days.map((day, dIdx) => {
          if (dIdx === 0) {
            return {
              ...day,
              steps: [...(day.steps || []), newStep],
            };
          }
          return day;
        })
      : [{ id: 'day-1', title: 'Dia 1', dayNumber: 1, theme: 'Dia 1', steps: [newStep] }];

    const updated: Itinerary = userItinerary ? {
      ...userItinerary,
      days: updatedDays,
    } : {
      id: `itinerary-user-${Date.now()}`,
      title: 'Meu Roteiro em Campos',
      description: 'Roteiro personalizado de Campos do Jordão',
      coverImage: spot.image || '/hotel.png',
      daysCount: 1,
      categories: ['Roteiro'],
      isActive: true,
      isRecommended: false,
      usageCount: 1,
      isPremium: isUserGold,
      badgeText: isUserGold ? 'ELITE GOLD' : undefined,
      days: updatedDays,
    };

    setUserItinerary(updated);
    setSelectedStopId(newStep.id);
    if (mapRef.current && spot.lng != null && spot.lat != null) {
      mapRef.current.easeTo({
        center: [spot.lng, spot.lat],
        zoom: 15.3,
        pitch: 52,
        bearing: -13,
        duration: 800,
      });
    }
    scheduleTimeout(() => {
      if (mapRef.current) {
        renderRouteAndMarkers(true);
      }
    }, 150);
    setStoreToast(`Local "${spot.name}" adicionado ao roteiro!`);
    scheduleTimeout(() => {
      setStoreToast(null);
    }, 2800);

    try {
      localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));
      if (userItinerary?.id) {
        fetch(`/api/user-itineraries/${userItinerary.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Error saving imported spot:', e);
    }
  };

  const handleApplyStoreItinerary = async (
    storeItin: Itinerary,
    options?: { fromOnboardingSelection?: boolean }
  ) => {
    const userItinId = 'user-itin-' + Date.now();
    const availableSpots = spots || CAMPOS_SPOTS;

    const hasValidSourceDays =
      Array.isArray(storeItin.days) &&
      storeItin.days.some((d) => Array.isArray(d.steps) && d.steps.length > 0);
    const fallbackTemplate =
      DEFAULT_CURATED_ITINERARIES.find(
        (def) =>
          def.id === storeItin.id ||
          def.title.trim().toLowerCase() === (storeItin.title || '').trim().toLowerCase()
      ) || DEFAULT_CURATED_ITINERARIES[0];
    const sourceDays = hasValidSourceDays ? storeItin.days : fallbackTemplate?.days || [];

    const clonedDays = sourceDays.map((d, dIdx) => ({
      id: `${userItinId}-d-${dIdx + 1}`,
      itineraryId: userItinId,
      dayNumber: d.dayNumber || dIdx + 1,
      title: d.title || `Dia ${dIdx + 1}`,
      summary: d.summary || '',
      steps: (d.steps || []).map((s, sIdx) => {
        const foundSpot = s.spot || availableSpots.find((sp) => sp.id === s.spotId);
        const lat =
          foundSpot && typeof foundSpot.lat === 'number'
            ? foundSpot.lat
            : typeof s.lat === 'number'
            ? s.lat
            : -22.7335 + sIdx * 0.004;
        const lng =
          foundSpot && typeof foundSpot.lng === 'number'
            ? foundSpot.lng
            : typeof s.lng === 'number'
            ? s.lng
            : -45.5921 + sIdx * 0.003;
        const spotWithCoords: Spot = foundSpot
          ? ({ ...foundSpot, lat, lng } as Spot)
          : ({
              id: s.spotId || `spot-${sIdx + 1}`,
              name: s.customName || s.spotName || `Parada ${sIdx + 1}`,
              shortName: s.customName || s.spotName || `Parada ${sIdx + 1}`,
              lat,
              lng,
              image: s.customImage || '',
              category: 'attractions' as SpotCategory,
              categoryLabel: 'Ponto Turístico',
            } as Spot);
        return {
          ...s,
          id: `${userItinId}-d-${dIdx + 1}-s-${sIdx + 1}`,
          itineraryId: userItinId,
          dayId: `${userItinId}-d-${dIdx + 1}`,
          dayNumber: d.dayNumber || dIdx + 1,
          stepOrder: sIdx + 1,
          spot: spotWithCoords,
          lat,
          lng,
        };
      }),
    }));

    const isStoreLivre =
      storeItin.id === 'roteiro-classico-2-dias' ||
      storeItin.id?.startsWith('roteiro-classico') ||
      storeItin.id === 'roteiro-bate-volta-essencial' ||
      storeItin.badgeText?.toLowerCase() === 'grátis' ||
      storeItin.price === 'R$ 0' ||
      storeItin.price === 'Grátis' ||
      storeItin.isPremium === false;

    const optimisticItinerary: Itinerary = {
      ...storeItin,
      id: userItinId,
      days: clonedDays,
      isPremium: isStoreLivre ? false : Boolean(storeItin.isPremium),
      badgeText: isStoreLivre ? 'Grátis' : storeItin.badgeText || '',
    };

    // 1. Update UI immediately (0ms perceived latency) and lock against stale background overwrites
    hasUserModifiedItineraryRef.current = true;
    userHasExplicitlyOpenedStoreRef.current = false;
    setIsStoreOpen(false);
    setIsExpanded(true);
    setSelectedDayIndex(0);
    setUserItinerary(optimisticItinerary);

    try {
      localStorage.setItem('monvian_active_itinerary', JSON.stringify(optimisticItinerary));
    } catch (e) {}

    const allDaySteps = optimisticItinerary.days?.[0]?.steps || [];
    const targetStep = allDaySteps[0];
    if (targetStep) {
      setSelectedStopId(targetStep.id);
    }

    if (options?.fromOnboardingSelection) {
      onCompleteOnboardingSelection?.([optimisticItinerary], 'Prefiro não informar');
    } else {
      setStoreToast('Roteiro carregado com sucesso!');
      scheduleTimeout(() => setStoreToast(null), 3000);
    }

    try {
      localStorage.setItem('monvian_itinerary_view_mode', 'map');
    } catch (e) {}
    setItineraryViewMode('map');

    // Re-render route, numerical location pins and fit map bounds immediately
    scheduleTimeout(() => {
      if (mapRef.current) {
        try {
          mapRef.current.resize();
        } catch (e) {}
        renderRouteAndMarkersRef.current?.(true, allDaySteps, targetStep?.id, false);
      }
    }, 80);

    // 2. Sync to backend asynchronously in the background WITHOUT triggering a second UI state update
    fetch(`/api/itineraries/${storeItin.id}/clone-to-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({ sessionId, itinerary: optimisticItinerary }),
    }).catch(() => {});
  };

  // Create an empty manual itinerary (0 pins / 0 spots) and open the Roteiros map area
  const handleCreateManualItinerary = () => {
    const userItinId = `manual-itin-${Date.now()}`;
    const manualItinerary: Itinerary = {
      id: userItinId,
      title: 'Meu Roteiro',
      description: 'Roteiro personalizado criado manualmente',
      coverImage: '/hotel.png',
      daysCount: 1,
      categories: ['Personalizado'],
      isActive: true,
      isRecommended: false,
      usageCount: 1,
      isPremium: false,
      badgeText: 'Grátis',
      days: [
        {
          id: `${userItinId}-d-1`,
          itineraryId: userItinId,
          dayNumber: 1,
          title: 'Dia 1',
          summary: '',
          steps: [],
        },
      ],
    };

    hasUserModifiedItineraryRef.current = true;
    userHasExplicitlyOpenedStoreRef.current = false;
    setIsStoreOpen(false);
    setIsExpanded(true);
    setSelectedDayIndex(0);
    setSelectedStopId(null);
    setUserItinerary(manualItinerary);

    try {
      localStorage.setItem('monvian_active_itinerary', JSON.stringify(manualItinerary));
      localStorage.setItem('monvian_itinerary_view_mode', 'map');
    } catch {}

    setItineraryViewMode('map');

    scheduleTimeout(() => {
      if (mapRef.current) {
        try {
          mapRef.current.resize();
        } catch {}
        renderRouteAndMarkersRef.current?.(false, [], null, true);
      }
    }, 80);

    fetch('/api/user-itineraries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({
        id: userItinId,
        title: manualItinerary.title,
        description: manualItinerary.description,
        coverImage: manualItinerary.coverImage,
        daysCount: manualItinerary.daysCount,
        tripDate: tripDate || '',
        days: manualItinerary.days,
      }),
    }).catch(() => {});
  };

  // Notes Modal state & persistent trip notes
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [tripNoteText, setTripNoteText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('monvian_trip_note_campos');
      if (saved) return saved;
    } catch (e) {}
    return '';
  });

  const handleSaveTripNote = (text: string) => {
    setTripNoteText(text);
    try {
      localStorage.setItem('monvian_trip_note_campos', text);
    } catch (e) {}
  };

  // Rename title inline
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Bottom Sheet expansion state: false = compact (inteiro e compacto acima da barra), true = 50% split
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem('monvian_active_itinerary');
      if (cached) {
        const parsed = JSON.parse(cached);
        const firstStep = parsed?.days?.[0]?.steps?.[0];
        if (firstStep?.id) return firstStep.id;
      }
    } catch (e) {}
    return null;
  });

  // Keep refs for selectedStopId and isExpanded so renderRouteAndMarkers stays stable
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  // Sync BottomNavigation white icon mode when Roteiros map is in satellite mode (collapsed or dark)
  const isSatelliteNavActive = Boolean(
    isOpen &&
      !isOnboardingSelection &&
      itineraryViewMode === 'map' &&
      isSatelliteMap &&
      (!isExpanded || isDark)
  );

  useEffect(() => {
    onSatelliteUiChange?.(isSatelliteNavActive);
    return () => {
      onSatelliteUiChange?.(false);
    };
  }, [isSatelliteNavActive, onSatelliteUiChange]);
  const selectedStopIdRef = useRef(selectedStopId);
  selectedStopIdRef.current = selectedStopId;

  // Map references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);
  const markerRecordsRef = useRef<Array<{
    stepId: string;
    marker: maplibregl.Marker;
    el: HTMLElement;
    containerEl: HTMLElement;
    badgeEl: HTMLElement;
    tipEl?: HTMLElement | null;
    arrowEl?: HTMLElement | null;
    pulseEl: HTMLElement | null;
  }>>([]);
  const renderRouteAndMarkersRef = useRef<((shouldFitBounds?: boolean, overrideSteps?: ItineraryStep[], overrideSelectedId?: string | null, instantFit?: boolean) => void) | null>(null);

  // Fetch saved user itinerary or draft on startup (only once per session, never overwriting active local state)
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const hasInitialLocalItinerary = Boolean(userItinerary && userItinerary.days && userItinerary.days.length > 0);

    const fetchSavedState = async () => {
      try {
        if (!hasInitialLocalItinerary && !hasUserModifiedItineraryRef.current) {
          const res = await fetch('/api/user-itineraries', {
            headers: { 'x-session-id': sessionId },
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            if (
              isMounted &&
              !controller.signal.aborted &&
              !hasUserModifiedItineraryRef.current &&
              data.success &&
              Array.isArray(data.itineraries) &&
              data.itineraries.length > 0
            ) {
              const first = data.itineraries[0];
              const isLivre =
                first.id === 'roteiro-classico-2-dias' ||
                first.id?.startsWith('roteiro-classico') ||
                first.id === 'roteiro-bate-volta-essencial' ||
                first.badgeText?.toLowerCase() === 'grátis' ||
                first.price === 'R$ 0' ||
                first.price === 'Grátis';

              const currentSpots = spotsRef.current || CAMPOS_SPOTS;
              const enriched: Itinerary = {
                ...first,
                isPremium: isLivre ? false : Boolean(first.isPremium),
                badgeText: isLivre ? 'Grátis' : (first.badgeText || ''),
                days: (first.days || []).map((day: ItineraryDay) => ({
                  ...day,
                  steps: (day.steps || []).map((step: ItineraryStep) => ({
                    ...step,
                    spot: currentSpots.find(s => s.id === step.spotId) || step.spot
                  }))
                }))
              };
              setUserItinerary(enriched);
              localStorage.setItem('monvian_active_itinerary', JSON.stringify(enriched));

              if (
                enriched.days &&
                enriched.days.some((d: any) => Array.isArray(d.steps) && d.steps.length > 0)
              ) {
                const firstStep = enriched.days?.[0]?.steps?.[0];
                if (firstStep?.id) {
                  setSelectedStopId((curr) => curr || firstStep.id);
                }
              }

              if (!userHasExplicitlyOpenedStoreRef.current && !isOnboardingSelection) {
                try {
                  localStorage.setItem('monvian_itinerary_view_mode', 'map');
                } catch {}
                setItineraryViewMode('map');
              }
              return;
            }
          }
        }

        // Check if there was an in-progress draft
        const draftRes = await fetch('/api/user-itineraries/draft', {
          headers: { 'x-session-id': sessionId },
          signal: controller.signal,
        });
        if (draftRes.ok) {
          const draftData = await draftRes.json();
          if (isMounted && !controller.signal.aborted && draftData.success && draftData.draft) {
            const d = draftData.draft;
            if (d.tripDate) setTripDate(d.tripDate);
            if (d.adultsCount !== undefined) setAdultsCount(d.adultsCount);
            if (d.childrenCount !== undefined) setChildrenCount(d.childrenCount);
            if (d.peopleCount) setPeopleCount(d.peopleCount);
            if (d.budget) setBudget(d.budget);
          }
        }
      } catch (err) {
        // Fallback to local storage
      }
    };

    fetchSavedState();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [sessionId]);

  // Save draft step changes to backend database
  const saveDraftToDatabase = async (updates: Partial<{ tripDate: string; peopleCount: number; adultsCount: number; childrenCount: number; budget: string }>) => {
    try {
      await fetch('/api/user-itineraries/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          sessionId,
          tripDate: updates.tripDate !== undefined ? updates.tripDate : tripDate,
          peopleCount: updates.peopleCount !== undefined ? updates.peopleCount : peopleCount,
          adultsCount: updates.adultsCount !== undefined ? updates.adultsCount : adultsCount,
          childrenCount: updates.childrenCount !== undefined ? updates.childrenCount : childrenCount,
          budget: updates.budget !== undefined ? updates.budget : budget
        })
      });
    } catch (e) {
      console.warn('Draft save error:', e);
    }
  };

  // Step 1: User completes date selection
  const handleDateContinue = (dateIso: string, formatted: string) => {
    setTripDate(dateIso);
    setTripDateFormatted(formatted);
    saveDraftToDatabase({ tripDate: dateIso });
    setWizardStep('people');
  };

  // Step 2: User completes people count (adults + children)
  const handlePeopleContinue = (adults: number, children: number, total: number) => {
    setAdultsCount(adults);
    setChildrenCount(children);
    setPeopleCount(total);
    saveDraftToDatabase({ adultsCount: adults, childrenCount: children, peopleCount: total });
    setWizardStep('budget');
  };

  // Step 3: User completes budget
  const handleBudgetContinue = (budgetValue: string) => {
    setBudget(budgetValue);
    saveDraftToDatabase({ budget: budgetValue });
    setWizardStep('tinder');
  };

  // Step 4: User finishes Tinder swipe deck -> Auto generates itinerary
  const handleTinderFinish = async (likedSpots: Spot[]) => {
    setWizardStep('generating');

    try {
      // Build optimized itinerary
      const generated = generateCustomItinerary(
        likedSpots,
        tripDate,
        tripDateFormatted,
        peopleCount,
        budget,
        adultsCount,
        childrenCount
      );

      // Save to database
      await fetch('/api/user-itineraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          title: generated.title,
          description: generated.description,
          coverImage: generated.coverImage,
          daysCount: generated.daysCount,
          tripDate: tripDate || '',
          preferences: {
            tripDate,
            tripDateFormatted,
            adultsCount,
            childrenCount,
            peopleCount,
            budget,
            likedSpotIds: likedSpots.map(s => s.id)
          },
          days: generated.days
        })
      });

      // Clear draft
      await fetch('/api/user-itineraries/draft', {
        method: 'DELETE',
        headers: { 'x-session-id': sessionId }
      }).catch(() => {});

      // Short aesthetic timeout for Apple-style reveal
      scheduleTimeout(() => {
        setUserItinerary(generated);
        localStorage.setItem('monvian_active_itinerary', JSON.stringify(generated));
        setWizardStep('date'); // Reset for next time
      }, 1000);
    } catch (err) {
      console.error('Error generating itinerary:', err);
      if (isMountedRef.current) setWizardStep('tinder');
    }
  };

  // Delete itinerary handler
  const handleDeleteItinerary = async () => {
    if (userItinerary) {
      try {
        await fetch(`/api/user-itineraries/${userItinerary.id}`, {
          method: 'DELETE',
          headers: { 'x-session-id': sessionId }
        });
      } catch (e) {}
    }
    setUserItinerary(null);
    localStorage.removeItem('monvian_active_itinerary');
    try {
      localStorage.setItem('monvian_itinerary_view_mode', 'explore');
    } catch {}
    setWizardStep('date');
    setSelectedStopId(null);
    setIsEditModalOpen(false);
    setItineraryViewMode('explore');
  };

  // Create new itinerary handler
  const handleCreateNewItinerary = () => {
    setUserItinerary(null);
    localStorage.removeItem('monvian_active_itinerary');
    try {
      localStorage.setItem('monvian_itinerary_view_mode', 'explore');
    } catch {}
    setWizardStep('date');
    setSelectedStopId(null);
    setIsEditModalOpen(false);
    setItineraryViewMode('explore');
  };

  // Save edited itinerary (reordered stops or removed stops)
  const handleSaveEditedItinerary = async (updated: Itinerary) => {
    if (userItinerary) {
      const oldSpotIds = new Set(
        (userItinerary.days || []).flatMap((d) =>
          (d.steps || []).map((s) => s.spotId || s.spot?.id).filter(Boolean)
        )
      );
      const newSpotIds = new Set(
        (updated.days || []).flatMap((d) =>
          (d.steps || []).map((s) => s.spotId || s.spot?.id).filter(Boolean)
        )
      );
      oldSpotIds.forEach((spotId) => {
        if (spotId && !newSpotIds.has(spotId)) {
          favoritesManager.addRemovedItem(spotId);
        }
      });
    }

    setUserItinerary(updated);
    localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));

    const firstStep = updated.days?.[0]?.steps?.[0];
    if (firstStep) {
      setSelectedStopId(firstStep.id);
    }
    renderRouteAndMarkers(false, updated.days?.[0]?.steps, firstStep?.id);

    try {
      await fetch(`/api/user-itineraries/${updated.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          coverImage: updated.coverImage,
          tripDate: tripDate || '',
          days: updated.days
        })
      });
    } catch (e) {
      console.error('Error saving updated itinerary:', e);
    }
  };

  // Remove individual stop via swipe or accessible action
  const handleDeleteStep = async (stepId: string) => {
    if (!userItinerary) return;

    (userItinerary.days || []).forEach((day) => {
      (day.steps || []).forEach((s) => {
        if (s.id === stepId) {
          const removedSpotId = s.spotId || s.spot?.id;
          if (removedSpotId) {
            favoritesManager.addRemovedItem(removedSpotId);
          }
        }
      });
    });

    const updatedDays = (userItinerary.days || []).map((day) => {
      const filtered = (day.steps || []).filter((s) => s.id !== stepId);
      return {
        ...day,
        steps: filtered.map((s, idx) => ({ ...s, stepOrder: idx + 1 })),
      };
    });

    const updated: Itinerary = {
      ...userItinerary,
      days: updatedDays
    };

    setUserItinerary(updated);
    localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));

    const nextActiveSteps = updatedDays[0]?.steps || [];
    const nextSelectedId = selectedStopId === stepId
      ? (nextActiveSteps.length > 0 ? nextActiveSteps[0].id : null)
      : selectedStopId;
    if (nextSelectedId !== selectedStopId) {
      setSelectedStopId(nextSelectedId);
    }

    // Instantly sync route line and numbered pins on delete
    renderRouteAndMarkers(false, nextActiveSteps, nextSelectedId);

    try {
      await fetch(`/api/user-itineraries/${updated.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          coverImage: updated.coverImage,
          tripDate: tripDate || '',
          days: updated.days
        })
      });
    } catch (e) {
      console.error('Error deleting step from itinerary:', e);
    }
  };

  // Rename itinerary title
  const handleRenameTitle = async (newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || !userItinerary) {
      setIsEditingTitle(false);
      return;
    }
    const updated: Itinerary = {
      ...userItinerary,
      title: trimmed,
    };
    setUserItinerary(updated);
    localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));
    setIsEditingTitle(false);

    try {
      await fetch(`/api/user-itineraries/${updated.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          coverImage: updated.coverImage,
          tripDate: tripDate || '',
          days: updated.days
        })
      });
    } catch (e) {
      console.warn('Title update error:', e);
    }
  };

  // Active steps from current user itinerary - single source of truth for ordinal numbers
  const activeSteps = useMemo(() => {
    if (!userItinerary?.days || userItinerary.days.length === 0) return [];
    const dayToUse = userItinerary.days[selectedDayIndex] || userItinerary.days[0];
    const rawSteps = [...(dayToUse?.steps || [])].sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));
    const availableSpots = spots || CAMPOS_SPOTS;
    return rawSteps.map((step, idx) => {
      const foundSpot = step.spot || availableSpots.find((sp) => sp.id === step.spotId);
      const lat =
        foundSpot && typeof foundSpot.lat === 'number'
          ? foundSpot.lat
          : typeof step.lat === 'number'
          ? step.lat
          : -22.734 + idx * 0.005;
      const lng =
        foundSpot && typeof foundSpot.lng === 'number'
          ? foundSpot.lng
          : typeof step.lng === 'number'
          ? step.lng
          : -45.591 + idx * 0.004;
      const spotToUse: Spot = foundSpot
        ? ({ ...foundSpot, lat, lng } as Spot)
        : ({
            id: step.spotId || `spot-${idx}`,
            name: step.spotName || step.title || 'Ponto Turístico',
            shortName: step.spotName || 'Ponto',
            tagLabel: 'Atração',
            category: 'attractions' as SpotCategory,
            categoryLabel: step.categoryLabel || 'Atração / Turística',
            lat,
            lng,
            image: step.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80',
            description: step.description || '',
            touristTip: '',
            rating: 4.8,
            reviewCount: 120,
            hours: '09:00 - 18:00',
            address: 'Campos do Jordão, SP',
            visitorsToday: 42,
          } as Spot);

      // Guaranteed stable, unique step ID
      const stepId = step.id || (step.spotId ? `step-${step.spotId}` : `step-item-${idx}`);

      return {
        ...step,
        id: stepId,
        stepOrder: idx + 1,
        spot: spotToUse,
        lat: typeof step.lat === 'number' ? step.lat : spotToUse.lat,
        lng: typeof step.lng === 'number' ? step.lng : spotToUse.lng,
      };
    });
  }, [userItinerary, selectedDayIndex, spots]);

  // Check if current logged-in user is Gold
  const isUserGold = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
      const cleanEmail = (u.email || u.whatsapp || '').trim().toLowerCase();
      const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail);
      return isGoldAdmin || Boolean(u.isGold || u.is_gold === 1 || u.isPremium || u.is_premium === 1);
    } catch {
      return false;
    }
  }, [userItinerary]);

  // All itineraries are 100% free and render in the clean default theme
  const isPremiumItinerary = false;

  // Reorder steps up / down directly from the order arrows on cards (matching IMG_7287)
  const handleMoveStepUp = async (index: number) => {
    if (!userItinerary || index <= 0 || !activeSteps[index]) return;
    const currentSteps = [...activeSteps];
    const temp = currentSteps[index - 1];
    currentSteps[index - 1] = currentSteps[index];
    currentSteps[index] = temp;

    // 1. Immediately update ordinal numbers (1, 2, 3...)
    const reorderedSteps = currentSteps.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    const movedStep = reorderedSteps[index - 1];

    if (movedStep?.id) {
      setSelectedStopId(movedStep.id);
    }

    // 2. Synchronize pins and route line on the map INSTANTLY using reorderedSteps
    renderRouteAndMarkers(false, reorderedSteps, movedStep?.id);

    // 3. Update active user itinerary state and persistence
    const updatedDays = (userItinerary.days || []).map((day, dIdx) => {
      if (dIdx === 0) {
        return { ...day, steps: reorderedSteps };
      }
      return day;
    });

    const updated: Itinerary = {
      ...userItinerary,
      days: updatedDays,
    };

    setUserItinerary(updated);
    localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));

    if (movedStep?.id) {
      if (mapRef.current && movedStep.spot && typeof movedStep.spot.lat === 'number' && typeof movedStep.spot.lng === 'number') {
        const verticalOffset = isExpanded
          ? -Math.round(window.innerHeight * 0.20)
          : -Math.round(window.innerHeight * 0.08);
        mapRef.current.easeTo({
          center: [movedStep.spot.lng, movedStep.spot.lat],
          zoom: 15.3,
          pitch: 52,
          bearing: -13,
          offset: [0, verticalOffset],
          duration: 600,
        });
      }
    }

    try {
      await fetch(`/api/user-itineraries/${updated.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          coverImage: updated.coverImage,
          tripDate: tripDate || '',
          days: updated.days,
        }),
      });
    } catch (e) {
      console.error('Error reordering steps up:', e);
    }
  };

  const handleMoveStepDown = async (index: number) => {
    if (!userItinerary || index >= activeSteps.length - 1 || !activeSteps[index]) return;
    const currentSteps = [...activeSteps];
    const temp = currentSteps[index + 1];
    currentSteps[index + 1] = currentSteps[index];
    currentSteps[index] = temp;

    // 1. Immediately update ordinal numbers (1, 2, 3...)
    const reorderedSteps = currentSteps.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    const movedStep = reorderedSteps[index + 1];

    if (movedStep?.id) {
      setSelectedStopId(movedStep.id);
    }

    // 2. Synchronize pins and route line on the map INSTANTLY using reorderedSteps
    renderRouteAndMarkers(false, reorderedSteps, movedStep?.id);

    // 3. Update active user itinerary state and persistence
    const updatedDays = (userItinerary.days || []).map((day, dIdx) => {
      if (dIdx === 0) {
        return { ...day, steps: reorderedSteps };
      }
      return day;
    });

    const updated: Itinerary = {
      ...userItinerary,
      days: updatedDays,
    };

    setUserItinerary(updated);
    localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));

    if (movedStep?.id) {
      if (mapRef.current && movedStep.spot && typeof movedStep.spot.lat === 'number' && typeof movedStep.spot.lng === 'number') {
        const verticalOffset = isExpanded
          ? -Math.round(window.innerHeight * 0.20)
          : -Math.round(window.innerHeight * 0.08);
        mapRef.current.easeTo({
          center: [movedStep.spot.lng, movedStep.spot.lat],
          zoom: 15.3,
          pitch: 52,
          bearing: -13,
          offset: [0, verticalOffset],
          duration: 600,
        });
      }
    }

    try {
      await fetch(`/api/user-itineraries/${updated.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          coverImage: updated.coverImage,
          tripDate: tripDate || '',
          days: updated.days,
        }),
      });
    } catch (e) {
      console.error('Error reordering steps down:', e);
    }
  };

  // Selected step or default first
  const currentSelectedStep = useMemo(() => {
    if (!activeSteps.length) return null;
    if (selectedStopId) {
      const found = activeSteps.find(s => s.id === selectedStopId);
      if (found) return found;
    }
    return activeSteps[0];
  }, [activeSteps, selectedStopId]);

  // In-place marker visual sync matching Foto 2 (with yellow/gold styling for premium itineraries)
  const syncMarkerHighlight = useCallback((activeStepId: string | null | undefined) => {
    const isPremium = isPremiumItinerary;
    markerRecordsRef.current.forEach((rec, idx) => {
      const isSelected = (activeStepId && rec.stepId === activeStepId) || (!activeStepId && idx === 0);
      rec.containerEl.style.transform = isSelected ? 'scale(1.22)' : 'scale(0.96)';
      rec.containerEl.style.zIndex = isSelected ? '50' : '20';

      const targetTip = rec.tipEl || rec.arrowEl;

      if (isPremium) {
        // Luxury Metallic Gold styling for Premium Itineraries (Matching 24k polished gold leaf)
        rec.badgeEl.style.background = isSelected
          ? 'linear-gradient(135deg, #B88214 0%, #E6AC33 22%, #FFF4A3 48%, #F5BE38 68%, #C98B18 88%, #9E6505 100%)'
          : (isDark ? '#222225' : '#FFFDF7');
        rec.badgeEl.style.color = isSelected ? '#1A1202' : (isDark ? '#FDE073' : '#B88214');
        rec.badgeEl.style.border = isSelected
          ? '3px solid #FFFFFF'
          : (isDark ? '2px solid rgba(245, 190, 56, 0.65)' : '2px solid rgba(230, 172, 51, 0.75)');
        rec.badgeEl.style.boxShadow = isSelected
          ? '0 6px 26px rgba(230, 172, 51, 0.85), 0 2px 8px rgba(0, 0, 0, 0.4)'
          : '0 2px 10px rgba(230, 172, 51, 0.25), 0 1px 4px rgba(0, 0, 0, 0.15)';

        if (targetTip) {
          targetTip.style.borderTop = isSelected
            ? '7px solid #FFF4A3'
            : (isDark ? '7px solid #FDE073' : '7px solid #E6AC33');
        }

        if (rec.pulseEl) {
          rec.pulseEl.style.background = 'radial-gradient(circle, rgba(230, 172, 51, 0.75) 0%, rgba(255, 244, 163, 0.35) 50%, transparent 75%)';
          rec.pulseEl.style.display = isSelected ? 'block' : 'none';
        }
      } else {
        // Pin da cor branca, número preto e contorno da cor branca
        rec.badgeEl.style.background = '#FFFFFF';
        rec.badgeEl.style.color = '#000000';
        rec.badgeEl.style.border = isSelected
          ? '3px solid #FFFFFF'
          : '2px solid #FFFFFF';
        rec.badgeEl.style.boxShadow = isSelected
          ? '0 6px 20px rgba(0, 0, 0, 0.35), 0 0 0 2px #FFFFFF'
          : '0 3px 10px rgba(0, 0, 0, 0.25)';

        if (targetTip) {
          targetTip.style.borderTop = '7px solid #FFFFFF';
        }

        if (rec.pulseEl) {
          rec.pulseEl.style.background = 'radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.2) 55%, transparent 75%)';
          rec.pulseEl.style.display = isSelected ? 'block' : 'none';
        }
      }
    });
  }, [isDark, isPremiumItinerary]);

  // Update Route Polyline and Markers efficiently with strictly synchronized numbering
  const renderRouteAndMarkers = useCallback((shouldFitBounds = false, overrideSteps?: ItineraryStep[], overrideSelectedId?: string | null, instantFit = false) => {
    const map = mapRef.current;
    if (!map) return;

    // Extract coordinates from activeSteps (or override steps passed during instant reordering)
    const steps = overrideSteps || activeSteps;
    const validSteps = steps
      .filter((s) => {
        const hasSpotCoords = s.spot && typeof s.spot.lat === 'number' && typeof s.spot.lng === 'number';
        const hasDirectCoords = typeof s.lat === 'number' && typeof s.lng === 'number';
        return hasSpotCoords || hasDirectCoords;
      })
      .map((s) => {
        const lat = (s.spot && typeof s.spot.lat === 'number') ? s.spot.lat : (s.lat as number);
        const lng = (s.spot && typeof s.spot.lng === 'number') ? s.spot.lng : (s.lng as number);
        return {
          ...s,
          spot: {
            ...(s.spot || {}),
            lat,
            lng,
          } as any,
        };
      });
    const coordinates: [number, number][] = validSteps.map((s) => [s.spot!.lng, s.spot!.lat]);
    const targetSelectedId = overrideSelectedId !== undefined ? overrideSelectedId : selectedStopIdRef.current;
    const isPremium = isPremiumItinerary;
    const routeColor = isPremium ? '#E5AC33' : '#FFFFFF';

    // 1. Cleanly recreate DOM Markers so that pin numbers strictly reflect the card sequence (1, 2, 3...)
    const currentRecords = markerRecordsRef.current;
    currentRecords.forEach((rec) => {
      try {
        rec.marker.remove();
      } catch (e) {}
    });
    markerRecordsRef.current = [];

    validSteps.forEach((step, idx) => {
      const stepNumberFormatted = String(idx + 1).padStart(2, '0');
      const isSelected = (targetSelectedId && targetSelectedId === step.id) || (!targetSelectedId && idx === 0);

      const el = document.createElement('div');
      el.className = 'monvian-route-marker group cursor-pointer select-none';

      const containerEl = document.createElement('div');
      containerEl.style.position = 'relative';
      containerEl.style.display = 'flex';
      containerEl.style.flexDirection = 'column';
      containerEl.style.alignItems = 'center';
      containerEl.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      containerEl.style.transform = isSelected ? 'scale(1.22)' : 'scale(0.96)';
      containerEl.style.zIndex = isSelected ? '50' : '20';

      // Glowing circular translucent aura/halo
      const pulseEl = document.createElement('div');
      pulseEl.style.position = 'absolute';
      pulseEl.style.width = '64px';
      pulseEl.style.height = '64px';
      pulseEl.style.borderRadius = '9999px';
      pulseEl.style.top = '-14px';
      pulseEl.style.left = '-14px';
      pulseEl.style.background = isPremium
        ? 'radial-gradient(circle, rgba(230, 172, 51, 0.75) 0%, rgba(255, 244, 163, 0.35) 50%, transparent 75%)'
        : 'radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.15) 55%, transparent 75%)';
      pulseEl.style.pointerEvents = 'none';
      pulseEl.style.zIndex = '-1';
      pulseEl.style.display = isSelected ? 'block' : 'none';

      // Pin Circular Badge (Bolinha com o número da sequência)
      const badgeEl = document.createElement('div');
      badgeEl.style.width = '36px';
      badgeEl.style.height = '36px';
      badgeEl.style.borderRadius = '9999px';
      badgeEl.style.display = 'flex';
      badgeEl.style.alignItems = 'center';
      badgeEl.style.justifyContent = 'center';
      badgeEl.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', sans-serif";
      badgeEl.style.fontWeight = '800';
      badgeEl.style.fontSize = '14px';
      badgeEl.style.letterSpacing = '-0.02em';

      if (isPremium) {
        badgeEl.style.background = isSelected
          ? 'linear-gradient(135deg, #B88214 0%, #E6AC33 22%, #FFF4A3 48%, #F5BE38 68%, #C98B18 88%, #9E6505 100%)'
          : (isDark ? '#222225' : '#FFFDF7');
        badgeEl.style.color = isSelected ? '#1A1202' : (isDark ? '#FDE073' : '#B88214');
        badgeEl.style.border = isSelected
          ? '3px solid #FFFFFF'
          : (isDark ? '2px solid rgba(245, 190, 56, 0.65)' : '2px solid rgba(230, 172, 51, 0.75)');
        badgeEl.style.boxShadow = isSelected
          ? '0 6px 26px rgba(230, 172, 51, 0.85), 0 2px 8px rgba(0, 0, 0, 0.4)'
          : '0 2px 10px rgba(230, 172, 51, 0.25), 0 1px 4px rgba(0, 0, 0, 0.15)';
      } else {
        // Pin da cor branca, número preto e contorno da cor branca (iOS style)
        badgeEl.style.background = '#FFFFFF';
        badgeEl.style.color = '#000000';
        badgeEl.style.border = isSelected
          ? '3px solid #FFFFFF'
          : '2px solid #FFFFFF';
        badgeEl.style.boxShadow = isSelected
          ? '0 6px 20px rgba(0, 0, 0, 0.35), 0 0 0 2px #FFFFFF'
          : '0 3px 10px rgba(0, 0, 0, 0.25)';
      }
      badgeEl.textContent = stepNumberFormatted;
      badgeEl.innerText = stepNumberFormatted;

      // Downward location pin pointer tip
      const tipEl = document.createElement('div');
      tipEl.style.width = '0';
      tipEl.style.height = '0';
      tipEl.style.borderLeft = '6px solid transparent';
      tipEl.style.borderRight = '6px solid transparent';
      tipEl.style.borderTop = isPremium
        ? (isSelected ? '7px solid #FFF4A3' : '7px solid #E6AC33')
        : '7px solid #FFFFFF';
      tipEl.style.marginTop = '-1px';
      tipEl.style.filter = 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35))';

      containerEl.appendChild(pulseEl);
      containerEl.appendChild(badgeEl);
      containerEl.appendChild(tipEl);
      el.appendChild(containerEl);

      const currentStepId = step.id;
      el.onclick = (e) => {
        e.stopPropagation();
        handleSelectStopOnMapById(currentStepId);
      };

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([step.spot!.lng, step.spot!.lat])
        .addTo(map);

      markerRecordsRef.current.push({
        stepId: step.id,
        marker,
        el,
        containerEl,
        badgeEl,
        tipEl,
        arrowEl: tipEl,
        pulseEl,
      });
    });
    syncMarkerHighlight(targetSelectedId);

    // 2. Safely update GeoJSON Route Line if style is loaded
    try {
      if (map.isStyleLoaded()) {
        const routeSourceId = 'itinerary-route-source';
        const glowLayerId = 'itinerary-route-glow';
        const casingLayerId = 'itinerary-route-casing';
        const lineLayerId = 'itinerary-route-line';

        const geojsonData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features:
            coordinates.length >= 2
              ? [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'LineString',
                      coordinates,
                    },
                  },
                ]
              : [],
        };

        const existingSource = map.getSource(routeSourceId) as maplibregl.GeoJSONSource | undefined;
        if (existingSource) {
          existingSource.setData(geojsonData);
          if (map.getLayer(glowLayerId)) {
            map.setPaintProperty(glowLayerId, 'line-color', routeColor);
          }
          if (map.getLayer(lineLayerId)) {
            map.setPaintProperty(lineLayerId, 'line-color', routeColor);
          }
        } else {
          map.addSource(routeSourceId, {
            type: 'geojson',
            data: geojsonData,
          });

          map.addLayer({
            id: glowLayerId,
            type: 'line',
            source: routeSourceId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': routeColor,
              'line-width': 12,
              'line-opacity': isPremium ? 0.45 : 0.35,
              'line-blur': 6,
            },
          });

          map.addLayer({
            id: casingLayerId,
            type: 'line',
            source: routeSourceId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 7,
              'line-opacity': 0.9,
            },
          });

          map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: routeSourceId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': routeColor,
              'line-width': 4.5,
            },
          });
        }
      }
    } catch (e) {
      console.warn('Error updating route line on map:', e);
    }

    // 3. Fit camera bounds only when explicitly requested (e.g. initial load or stop deletion)
    if (shouldFitBounds && coordinates.length > 0) {
      const animDuration = instantFit ? 0 : 600;
      if (coordinates.length === 1) {
        const verticalOffset = isExpandedRef.current
          ? -Math.round(window.innerHeight * 0.20)
          : -Math.round(window.innerHeight * 0.08);
        map.easeTo({
          center: coordinates[0],
          zoom: 15.3,
          pitch: 52,
          bearing: -13,
          offset: [0, verticalOffset],
          duration: animDuration,
        });
      } else {
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach((coord) => bounds.extend(coord));

        map.fitBounds(bounds, {
          padding: {
            top: 90,
            bottom: Math.round(window.innerHeight * 0.5) + 20,
            left: 45,
            right: 45,
          },
          pitch: 52,
          bearing: -13,
          maxZoom: 15.2,
          duration: animDuration,
        });
      }
    }
  }, [activeSteps, isDark, isPremiumItinerary, syncMarkerHighlight]);

  // Keep renderRouteAndMarkers ref continuously in sync for instant callers
  useEffect(() => {
    renderRouteAndMarkersRef.current = renderRouteAndMarkers;
  }, [renderRouteAndMarkers]);

  // Initialize MapLibre GL map ONCE when tab is open and in map mode
  useEffect(() => {
    if (!isOpen || itineraryViewMode !== 'map' || !mapContainerRef.current) return;

    isMapLoadedRef.current = false;

    // Clean up any stale markers before initializing map
    markerRecordsRef.current.forEach((rec) => {
      try {
        rec.marker.remove();
      } catch (e) {}
    });
    markerRecordsRef.current = [];

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {}
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapStyle(itineraryMapStyle, theme === 'dark' ? 'dark' : 'light'),
      center: [-45.5870, -22.7355],
      zoom: 15.2,
      pitch: 52,
      bearing: -13,
      projection: { type: 'globe' },
      attributionControl: false,
    } as any);

    mapRef.current = map;
    let hasInitializedRoute = false;

    const onMapReady = () => {
      if (mapRef.current !== map || hasInitializedRoute) return;
      hasInitializedRoute = true;
      isMapLoadedRef.current = true;
      try {
        map.resize();
      } catch (e) {}
      renderRouteAndMarkersRef.current?.(true, undefined, undefined, true);
    };

    if (map.loaded() && map.isStyleLoaded()) {
      onMapReady();
    } else {
      map.once('load', onMapReady);
    }

    const safetyTimer = setTimeout(() => {
      if (mapRef.current === map && !hasInitializedRoute) {
        onMapReady();
      }
    }, 600);

    // When clicking anywhere on the map, collapse the sheet so only 20% is visible
    map.on('click', () => {
      setIsExpanded(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      isMapLoadedRef.current = false;
      markerRecordsRef.current.forEach((rec) => {
        try {
          rec.marker.remove();
        } catch (e) {}
      });
      markerRecordsRef.current = [];

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }
    };
  }, [isOpen, itineraryViewMode, itineraryMapStyle, theme]);

  const prevItinIdRef = useRef<string | null>(userItinerary?.id || null);
  const prevDayIndexRef = useRef<number>(selectedDayIndex);

  // When active steps or selected day change after map is loaded
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) {
      prevItinIdRef.current = userItinerary?.id || null;
      prevDayIndexRef.current = selectedDayIndex;
      return;
    }
    const isNewItinOrDay =
      userItinerary?.id !== prevItinIdRef.current ||
      selectedDayIndex !== prevDayIndexRef.current;
    prevItinIdRef.current = userItinerary?.id || null;
    prevDayIndexRef.current = selectedDayIndex;
    renderRouteAndMarkers(isNewItinOrDay);
  }, [activeSteps, userItinerary?.id, selectedDayIndex, renderRouteAndMarkers]);

  // Marker highlight sync on stop selection
  useEffect(() => {
    syncMarkerHighlight(selectedStopId);
  }, [selectedStopId, syncMarkerHighlight]);

  // Select stop by ID, highlight numbered marker, zoom in and center in the visible half of the map
  const handleSelectStopOnMapById = (stepId: string) => {
    setSelectedStopId(stepId);
    const targetStep = activeSteps.find((s) => s.id === stepId);
    if (mapRef.current && targetStep?.spot && typeof targetStep.spot.lat === 'number' && typeof targetStep.spot.lng === 'number') {
      // Center the marker precisely in the middle of the visible map area above the bottom sheet
      const verticalOffset = isExpanded
        ? -Math.round(window.innerHeight * 0.20)
        : -Math.round(window.innerHeight * 0.08);

      mapRef.current.easeTo({
        center: [targetStep.spot.lng, targetStep.spot.lat],
        zoom: 15.3,
        pitch: 52,
        bearing: -13,
        offset: [0, verticalOffset],
        duration: 600,
      });
    }
  };

  const handleSelectStopOnMap = (step: ItineraryStep) => {
    handleSelectStopOnMapById(step.id);
  };

  // Register iOS Edge-Swipe Back Navigation for Roteiros Map -> Listagem de Roteiros & Modals
  useIOSBackEntry({
    id: 'itineraries:map-to-explore',
    enabled: Boolean(isOpen && itineraryViewMode === 'map' && !isOnboardingSelection),
    priority: 120,
    label: 'Mapa do Roteiro',
    foregroundSelector: '#itinerary-map-view-container',
    backgroundSelector: '#itinerary-explore-layer',
    onPop: () => {
      userHasExplicitlyOpenedStoreRef.current = true;
      try {
        localStorage.setItem('monvian_itinerary_view_mode', 'explore');
      } catch (e) {}
      setItineraryViewMode('explore');
    },
  });

  useIOSBackEntry({
    id: 'itineraries:edit-modal',
    enabled: Boolean(isOpen && isEditModalOpen),
    priority: 250,
    label: 'Editar Roteiro',
    foregroundSelector: '#itinerary-map-view-container',
    backgroundSelector: '#itinerary-explore-layer',
    onPop: () => setIsEditModalOpen(false),
  });

  useIOSBackEntry({
    id: 'itineraries:notes-modal',
    enabled: Boolean(isOpen && isNotesModalOpen),
    priority: 250,
    label: 'Anotações da Viagem',
    foregroundSelector: '#itinerary-map-view-container',
    backgroundSelector: '#itinerary-explore-layer',
    onPop: () => setIsNotesModalOpen(false),
  });

  useIOSBackEntry({
    id: 'itineraries:store-modal',
    enabled: Boolean(isOpen && isStoreOpen),
    priority: 250,
    label: 'Loja de Roteiros',
    foregroundSelector: '#itinerary-map-view-container',
    backgroundSelector: '#itinerary-explore-layer',
    onPop: () => setIsStoreOpen(false),
  });

  useIOSBackEntry({
    id: 'itineraries:plus-menu',
    enabled: Boolean(isOpen && isPlusMenuOpen),
    priority: 250,
    label: 'Opções de Adição',
    foregroundSelector: '#itinerary-map-view-container',
    backgroundSelector: '#itinerary-explore-layer',
    onPop: () => setIsPlusMenuOpen(false),
  });

  useIOSBackEntry({
    id: 'itineraries:import-modal',
    enabled: Boolean(isOpen && isImportModalOpen),
    priority: 255,
    label: 'Adicionar Ponto ao Roteiro',
    foregroundSelector: '#itinerary-map-view-container',
    backgroundSelector: '#itinerary-explore-layer',
    onPop: () => setIsImportModalOpen(false),
  });

  if (!isOpen) return null;

  return (
    <div
      id="itineraries-root-container"
      className="fixed inset-0 z-40 w-full h-full overflow-hidden select-none ios-pushed-page"
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
      {/* -------------------------------------------------------------
          EXPLORE LAYER: Full-page Airbnb Itinerary Discovery Screen
          Unmounted cleanly when viewing Map Mode so filters & infinite
          scroll listeners/requests do not run in the background!
          ------------------------------------------------------------- */}
      {itineraryViewMode === 'explore' && (
      <div
        id="itinerary-explore-layer"
        className={`fixed inset-0 ${
          isOnboardingSelection
            ? 'md:left-0 bg-[#FFFFFF]'
            : `md:left-[var(--desktop-sidebar-width,72px)] ${isDark ? 'bg-[#000000]' : 'bg-white'}`
        } z-40 w-full md:w-auto h-full overflow-hidden transition-[left,opacity] duration-200 ease-in-out select-none ios-pushed-page`}
        style={{
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          height: 'var(--app-height, 100dvh)',
          minHeight: 'var(--app-height, 100dvh)',
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
        <AirbnbItineraryExplorer
          onSelectItinerary={handleApplyStoreItinerary}
          onCreateManualItinerary={isOnboardingSelection ? undefined : handleCreateManualItinerary}
          onOpenMap={() => {
            if (!userItinerary || !userItinerary.days || userItinerary.days.length === 0) {
              handleCreateManualItinerary();
            } else {
              setIsExpanded(true);
              try {
                localStorage.setItem('monvian_itinerary_view_mode', 'map');
              } catch (e) {}
              setItineraryViewMode('map');
              scheduleTimeout(() => {
                if (mapRef.current) {
                  try {
                    mapRef.current.resize();
                  } catch (e) {}
                  renderRouteAndMarkersRef.current?.(true);
                }
              }, 60);
            }
          }}
          theme={isOnboardingSelection ? 'light' : theme}
          activeItineraryId={userItinerary?.id}
          isOnboardingSelection={isOnboardingSelection}
          isOnboardingRevealReady={isOnboardingRevealReady}
        />

        {/* Global Toast */}
        <AnimatePresence>
          {storeToast && !isOnboardingSelection && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              className="fixed top-20 inset-x-0 mx-auto z-70 w-fit px-5 py-2.5 rounded-full bg-zinc-900/90 text-white border border-white/15 backdrop-blur-xl shadow-2xl flex items-center gap-2 text-xs font-black"
            >
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
              <span>{storeToast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* -------------------------------------------------------------
          MAP LAYER: Interactive Map with Route, Sequential Points & Store
          Unmounted cleanly when in Explore Mode so MapLibre WebGL frees memory!
          ------------------------------------------------------------- */}
      {itineraryViewMode === 'map' && (
      <div
        id="itinerary-map-view-container"
        className={`fixed inset-0 md:left-[var(--desktop-sidebar-width,72px)] ${
          isEditModalOpen || isStoreOpen ? 'z-[90]' : 'z-[42]'
        } w-full md:w-auto h-full overflow-hidden transition-[left,opacity] duration-200 ease-in-out ${
          isDark ? 'bg-black' : 'bg-white'
        } select-none`}
        style={{
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          height: 'var(--app-height, 100dvh)',
          minHeight: 'var(--app-height, 100dvh)',
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
      {/* 1. MapLibre GL Interactive Canvas */}
      <div
        ref={mapContainerRef}
        onClick={() => setIsExpanded(false)}
        className={`absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden ${
          itineraryMapStyle === 'satelite' ? 'itinerary-satellite-canvas' : ''
        }`}
        style={{
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          height: 'var(--app-height, 100dvh)',
          minHeight: 'var(--app-height, 100dvh)',
          overflow: 'hidden',
        }}
      />

      {/* 2. Top Header Overlay with Back Button and Itinerary Name Dynamic Island (MOBILE ONLY) */}
      <div
        className="md:hidden absolute top-0 left-0 right-0 z-30 pointer-events-none flex items-center justify-between gap-2 px-4 sm:px-6"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 28px)',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        }}
      >
        {/* Left: Back Button to Airbnb Explorer / Loja de Roteiros */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          <AppleBackButton
            theme="glass"
            size="explore"
            onClick={() => {
              userHasExplicitlyOpenedStoreRef.current = true;
              try {
                localStorage.setItem('monvian_itinerary_view_mode', 'explore');
              } catch (e) {}
              setItineraryViewMode('explore');
            }}
            className={isSatelliteMap ? '!text-white' : '!text-black'}
            style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
            title="Loja de Roteiros"
            aria-label="Loja de Roteiros"
          />
        </div>

        {/* Dynamic Island Style Pill */}
        <div
          className={`h-12 px-4 sm:px-5 rounded-full pointer-events-auto ios26-liquid-glass flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold max-w-[calc(100vw-148px)] sm:max-w-none transition-all duration-200 ${
            isSatelliteMap ? 'text-white' : 'text-black'
          }`}
          style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
        >
          <RoundedNavigationIcon
            isGold={isPremiumItinerary}
            className="relative z-10 w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] shrink-0"
            style={{ color: isPremiumItinerary ? undefined : (isSatelliteMap ? '#FFFFFF' : '#000000') }}
            size={28}
          />

          {isEditingTitle ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRenameTitle(editedTitle);
              }}
              className="relative z-10 flex items-center gap-2 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                autoFocus
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={() => handleRenameTitle(editedTitle)}
                className={`w-28 sm:w-40 px-2 py-0.5 rounded-xl font-black text-xs sm:text-sm outline-none border ${
                  isDark
                    ? isPremiumItinerary ? 'bg-zinc-800 border-[#E5AC33]/60 text-white' : 'bg-zinc-800 border-white/40 text-white'
                    : isPremiumItinerary ? 'bg-zinc-100 border-[#E5AC33]/70 text-zinc-900' : 'bg-zinc-100 border-zinc-300 text-zinc-900'
                }`}
                placeholder="Nome do roteiro..."
              />
              <button
                type="submit"
                className={`w-6 h-6 rounded-full text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  isPremiumItinerary ? 'bg-metallic-gold text-[#1A1202]' : 'bg-white text-black hover:bg-zinc-200'
                }`}
                title="Salvar nome"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </form>
          ) : (
            <div className="relative z-10 flex items-center gap-1.5 min-w-0">
              <span
                onClick={() => {
                  setEditedTitle(userItinerary?.title || 'MEU ROTEIRO');
                  setIsEditingTitle(true);
                }}
                className={`font-black text-sm sm:text-base tracking-tight truncate max-w-[140px] sm:max-w-[240px] cursor-pointer ${
                  isSatelliteMap ? 'text-white' : 'text-black'
                }`}
                style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
                title="Toque para editar"
              >
                {getShortDisplayTitle(userItinerary?.title || 'MEU ROTEIRO')}
              </span>

              {isPremiumItinerary && (
                <span className="px-2.5 py-0.5 rounded-full bg-metallic-gold-badge border text-[#C28514] dark:text-[#FDE073] text-[9px] font-black uppercase tracking-wider shrink-0 shadow-xs">
                  ELITE GOLD
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action button to open edit modal */}
        <button
          onClick={() => {
            if (userItinerary) {
              setIsEditModalOpen(true);
            } else {
              setIsStoreOpen(true);
            }
          }}
          type="button"
          className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center pointer-events-auto transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
            isSatelliteMap ? 'text-white' : 'text-black'
          }`}
          style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
          title="Opções do roteiro"
        >
          <SlidersHorizontal
            className="relative z-10 w-6 h-6 sm:w-[29px] sm:h-[29px] stroke-[2]"
            style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
          />
        </button>
      </div>

      {/* Floating Map Actions (Layers & Casinha/Store - Mobile only, removed on desktop per user request) */}
      <div 
        className="md:hidden absolute right-3.5 sm:right-6 z-50 pointer-events-auto transition-all duration-300 flex flex-col items-center gap-3"
        style={{
          bottom: (activeSteps.length === 0 || isExpanded)
            ? 'calc(54vh + 16px)' 
            : 'calc(max(265px, calc(env(safe-area-inset-bottom, 0px) + 165px)))',
        }}
      >
        {/* Toggle between Satélite and Escuro / Claro */}
        <motion.button
          whileTap={{ scale: 0.90 }}
          whileHover={{ scale: 1.05 }}
          type="button"
          onClick={handleToggleMapStyle}
          className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0 ${
            isSatelliteMap ? 'text-white' : 'text-black'
          }`}
          style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
          title={itineraryMapStyle === 'satelite' ? 'Modo Satélite Ativo (Toque para alternar)' : 'Alternar satélite / mapa'}
          aria-label="Alternar satélite / mapa"
        >
          <Layers
            className="relative z-10 w-[26px] h-[26px] sm:w-[29px] sm:h-[29px] stroke-[2]"
            style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
          />
        </motion.button>

        {/* Floating Create Itinerary Button on Map (Casinha / Loja de Roteiros - switches to explore) */}
        <motion.button
          whileTap={{ scale: 0.90 }}
          whileHover={{ scale: 1.05 }}
          type="button"
          onClick={() => {
            userHasExplicitlyOpenedStoreRef.current = true;
            try {
              localStorage.setItem('monvian_itinerary_view_mode', 'explore');
            } catch (e) {}
            setItineraryViewMode('explore');
          }}
          className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0 ${
            isSatelliteMap ? 'text-white' : 'text-black'
          }`}
          style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
          title="Loja de Roteiros"
          aria-label="Loja de Roteiros"
        >
          <Store
            className="relative z-10 w-[26px] h-[26px] sm:w-[29px] sm:h-[29px] stroke-[2]"
            style={{ color: isSatelliteMap ? '#FFFFFF' : '#000000' }}
          />
        </motion.button>
      </div>

      {/* 4-A. DESKTOP ITINERARY SIDE PANEL (Hidden on mobile, desktop-native vertical layout) */}
      <aside
        aria-label="Roteiro de Viagem"
        className="hidden md:flex flex-col absolute top-5 bottom-5 left-5 w-96 lg:w-[420px] z-30 rounded-[28px] overflow-hidden border bg-white dark:bg-[#000000] border-zinc-200/80 dark:border-[#262626] shadow-[0_12px_40px_rgba(0,0,0,0.12)] pointer-events-auto select-none transition-colors duration-200 text-zinc-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Unified Scroll Container so stops glide softly blurred behind sticky header */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar flex flex-col"
          onWheel={(e) => e.stopPropagation()}
        >
        {/* Desktop Panel Header */}
        <div
          className="sticky top-0 z-20 p-4 lg:p-5 pb-3 border-b border-black/10 dark:border-[#262626]/70 shrink-0"
          style={{
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.40)' : 'rgba(255, 255, 255, 0.40)',
            backdropFilter: 'blur(8px) saturate(150%)',
            WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <RoundedNavigationIcon
                isGold={isPremiumItinerary}
                className={`w-6 h-6 shrink-0 ${isPremiumItinerary ? '' : (isDark ? 'text-white' : 'text-black')}`}
                size={24}
              />
              <h2 className="text-base font-black uppercase tracking-tight truncate text-zinc-900 dark:text-white">
                {getShortDisplayTitle(userItinerary?.title || 'Roteiro de Viagem')}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  userHasExplicitlyOpenedStoreRef.current = true;
                  try {
                    localStorage.setItem('monvian_itinerary_view_mode', 'explore');
                  } catch (e) {}
                  setItineraryViewMode('explore');
                }}
                className={`px-2.5 py-1.5 rounded-xl ${
                  isDark
                    ? 'bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white'
                    : 'bg-black/5 hover:bg-black/10 text-black hover:text-black font-bold'
                } transition-colors cursor-pointer text-xs font-bold flex items-center gap-1`}
                title="Loja de Roteiros"
              >
                <ChevronLeft
                  className={`w-3.5 h-3.5 ${isDark ? 'text-white' : 'text-black'}`}
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                />
                <span>Loja de Roteiros</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Editar roteiro"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsNotesModalOpen(true)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Anotações"
              >
                <Notebook className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader: Stops count + Days switcher */}
          <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold pt-1">
            <span>{activeSteps.length} {activeSteps.length === 1 ? 'local' : 'locais'} planejados</span>
            {userItinerary?.days && userItinerary.days.length > 1 && (
              <div className="flex items-center gap-1">
                {userItinerary.days.map((day, dIdx) => (
                  <motion.button
                    type="button"
                    key={day.dayNumber}
                    initial={shouldAnimateEntrance ? { opacity: 0, scale: 0.88, y: 12 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={
                      shouldAnimateEntrance
                        ? { type: 'spring', stiffness: 380, damping: 22, delay: dIdx * 0.035 }
                        : { duration: 0 }
                    }
                    whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                    whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                    onClick={() => {
                      setSelectedDayIndex(dIdx);
                      const firstStepOfDay = day.steps?.[0];
                      if (firstStepOfDay) setSelectedStopId(firstStepOfDay.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isDark
                        ? selectedDayIndex === dIdx
                          ? 'bg-white text-black shadow-md border border-white'
                          : 'bg-[#000000] text-[#A1A1AA] hover:text-white border border-[#262626]'
                        : selectedDayIndex === dIdx
                        ? 'bg-[#ffffff] text-[#000000] shadow-md border border-black/15'
                        : 'bg-[#ffffff] text-[#000000] hover:bg-zinc-100 border border-black/10'
                    }`}
                    style={{
                      color: isDark ? (selectedDayIndex === dIdx ? '#000000' : '#FFFFFF') : '#000000',
                      backgroundColor: isDark ? (selectedDayIndex === dIdx ? '#FFFFFF' : '#000000') : '#ffffff',
                    }}
                  >
                    Dia {day.dayNumber}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Stops List */}
        <div
          className={`p-3.5 space-y-2.5 ${isDark ? 'text-white' : 'text-[#141414]'}`}
          style={{ color: isDark ? '#FFFFFF' : '#141414' }}
        >
          {activeSteps.length > 0 ? (
            activeSteps.map((step, idx) => (
              <motion.div
                key={step.id}
                initial={shouldAnimateEntrance ? { opacity: 0, scale: 0.88, y: 12 } : false}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={
                  shouldAnimateEntrance
                    ? {
                        type: 'spring',
                        stiffness: 380,
                        damping: 22,
                        delay: Math.min(idx * 0.035, 0.35),
                      }
                    : { duration: 0 }
                }
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                onClick={() => handleSelectStopOnMap(step)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border text-left cursor-pointer transition-colors duration-200 group relative ${
                  isDark
                    ? step.id === currentSelectedStep?.id
                      ? 'border-white/40 ring-1 ring-white/20 shadow-sm'
                      : 'border-[#262626] hover:border-white/30'
                    : step.id === currentSelectedStep?.id
                    ? 'border-zinc-300 ring-2 ring-black/10 shadow-sm'
                    : 'border-zinc-200/80 hover:border-zinc-300 shadow-2xs'
                }`}
                style={{
                  backgroundColor: isDark ? '#000000' : '#fbfbfb',
                  color: isDark ? '#FFFFFF' : '#000000',
                }}
              >
                {/* Stop Number Badge */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`w-7 h-7 rounded-full text-[11px] font-black flex items-center justify-center leading-none shrink-0 ${
                    isPremiumItinerary
                      ? 'bg-metallic-gold text-[#1A1202] shadow-sm'
                      : 'bg-white text-black shadow-sm'
                  }`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Thumbnail Image */}
                  {step.spot && (
                    <div
                      style={{
                        overflow: 'clip',
                        clipPath: 'inset(0 round 12px)',
                        WebkitClipPath: 'inset(0 round 12px)',
                        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                        isolation: 'isolate',
                        transform: 'translateZ(0)',
                        WebkitTransform: 'translateZ(0)',
                      }}
                      className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800"
                    >
                      <LazyImage
                        src={getSpotImage(step.spot)}
                        alt={step.spot.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getSpotFallbackImage(step.spot?.name || '', step.spot?.category || 'attractions');
                        }}
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 leading-none mb-1">
                      <span className={`text-[10px] font-bold ${
                        isPremiumItinerary ? 'text-[#FDE073]' : 'text-zinc-400'
                      }`}>
                        {step.suggestedTime || '09:30'}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 truncate">
                        {step.spot?.categoryLabel || 'Ponto Turístico'}
                      </span>
                    </div>

                    <h4
                      className={`text-[13.5px] font-bold truncate leading-tight ${
                        isDark ? 'text-white' : 'text-[#000000]'
                      }`}
                      style={{ color: isDark ? '#FFFFFF' : '#000000' }}
                    >
                      {step.spot?.shortName || step.spot?.name || `Local ${idx + 1}`}
                    </h4>

                    {step.durationToNextMin ? (
                      <p className="text-[10.5px] text-zinc-400 truncate mt-0.5">
                        {step.durationToNextMin} min até o próximo local
                      </p>
                    ) : (
                      <p className="text-[10.5px] text-zinc-500 truncate mt-0.5">
                        Local planejado do roteiro
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Action: Round Play Button to open map directions & Delete */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDirectionsMap(step.spot);
                    }}
                    className="w-8 h-8 rounded-full bg-white text-zinc-900 shadow-sm flex items-center justify-center hover:bg-zinc-100 transition-all cursor-pointer"
                    title="Abrir rota no Maps"
                    aria-label="Abrir rota no Maps"
                  >
                    <Play className="w-3.5 h-3.5 fill-zinc-900 text-zinc-900 ml-0.5" />
                  </motion.button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStep(step.id);
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-colors cursor-pointer ml-0.5"
                    title="Remover local"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-12 text-center text-zinc-500 text-xs">
              Nenhum local adicionado ainda.
            </div>
          )}

          {/* Add Stop Button at bottom of list */}
          <div className="pt-2 pb-4">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-dashed text-xs font-bold transition-all cursor-pointer ${
                isDark
                  ? 'border-[#262626] bg-[#000000] hover:border-white/30 text-white'
                  : 'border-white/20 bg-[#e2e2e2] hover:bg-zinc-300 text-[#9e9e9e]'
              }`}
              style={{
                color: isDark ? '#FFFFFF' : '#9e9e9e',
                backgroundColor: isDark ? '#000000' : '#e2e2e2',
              }}
            >
              <Plus
                className={`w-4 h-4 ${isDark ? 'text-white' : 'text-[#000000]'}`}
                style={{ color: isDark ? '#FFFFFF' : '#000000' }}
              />
              <span style={{ color: isDark ? '#A1A1AA' : '#464646' }}>Adicionar Ponto ao Roteiro</span>
            </button>
          </div>
        </div>
        </div>
      </aside>

      {/* 4-B. Bottom Sheet with Route Stops and Actions (MOBILE ONLY - Hidden on Desktop) */}
      {/* 4-B. Bottom Sheet with Route Stops and Actions (MOBILE ONLY - Hidden on Desktop) */}
      <AnimatePresence mode="wait" initial={shouldAnimateEntrance}>
        {!isExpanded ? (
          /* Collapsed State: FLOATING CARD WITH NO WHITE CONTAINER BEHIND (Pointers pass through to map) */
          <motion.div
            key="itinerary-collapsed-floating-card-container"
            initial={shouldAnimateEntrance ? { opacity: 0, y: 12, scale: 0.96 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={shouldAnimateEntrance ? qrSpringTransition : { duration: 0 }}
            className="md:hidden fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none select-none"
            style={{
              bottom: '84px',
            }}
          >
            {activeSteps.length === 0 ? (
              /* State A: When NO route spots exist -> Render a sleek floating add card */
              <div
                onClick={() => setIsImportModalOpen(true)}
                style={{
                  backgroundColor: isDark ? 'rgba(28, 28, 30, 0.88)' : 'rgba(255, 255, 255, 0.88)',
                  backdropFilter: 'blur(24px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                }}
                className={`w-full max-w-[326px] sm:max-w-[342px] py-2.5 px-4 rounded-[28px] flex items-center justify-center gap-3 border pointer-events-auto cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.10)] transition-transform active:scale-95 ${
                  isDark ? 'border-white/15 text-white' : 'border-zinc-200/80 text-black'
                }`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black dark:bg-white text-white dark:text-black">
                  <Plus className="w-4 h-4 stroke-[2.4]" />
                </div>
                <span className="text-[12px] font-black uppercase tracking-wider select-none">
                  Adicionar Local ao Roteiro
                </span>
              </div>
            ) : currentSelectedStep ? (
              /* State B: When route spots exist -> Floating stop card with Apple iOS liquid glass aesthetics */
              <motion.div
                key={`collapsed-floating-card-${currentSelectedStep.id}`}
                whileHover={{ scale: 1.015, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.2, bottom: 0.05 }}
                onDragEnd={(_e, info) => {
                  if (info.offset.y < -30 || info.velocity.y < -120) {
                    setIsExpanded(true);
                  }
                }}
                onClick={() => setIsExpanded(true)}
                style={{
                  backgroundColor: isDark ? 'rgba(28, 28, 30, 0.88)' : 'rgba(255, 255, 255, 0.88)',
                  backdropFilter: 'blur(24px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                }}
                className={`w-full max-w-[326px] sm:max-w-[342px] py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-[28px] flex items-center justify-between gap-3 transition-all border pointer-events-auto cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.10)] ${
                  isDark ? 'border-white/15 text-white' : 'border-zinc-200/80 text-black'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 self-center">
                  <span
                    className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full text-[11px] font-black flex items-center justify-center leading-none text-center shrink-0 self-center ${
                      isPremiumItinerary
                        ? 'bg-metallic-gold text-[#1A1202] shadow-md shadow-[#E5AC33]/40'
                        : isDark
                        ? 'bg-white text-black shadow-md'
                        : 'bg-black text-white shadow-md'
                    }`}
                  >
                    {String(
                      Math.max(
                        1,
                        activeSteps.findIndex((s) => s.id === currentSelectedStep.id) + 1
                      )
                    ).padStart(2, '0')}
                  </span>
                  {currentSelectedStep.spot && (
                    <div
                      style={{
                        overflow: 'clip',
                        clipPath: 'inset(0 round 16px)',
                        WebkitClipPath: 'inset(0 round 16px)',
                        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                        isolation: 'isolate',
                        transform: 'translateZ(0)',
                        WebkitTransform: 'translateZ(0)',
                      }}
                      className="w-12 h-12 rounded-[16px] overflow-hidden shrink-0 bg-zinc-800 relative self-center"
                    >
                      <LazyImage
                        src={getSpotImage(currentSelectedStep.spot)}
                        alt={currentSelectedStep.spot.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getSpotFallbackImage(
                            currentSelectedStep.spot?.name || '',
                            currentSelectedStep.spot?.category || 'attractions'
                          );
                        }}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 flex flex-col justify-center self-center py-0.5">
                    <div className="flex items-center gap-1.5 flex-nowrap leading-none">
                      <span
                        className={`inline-flex items-center gap-1 text-[10.5px] font-bold leading-none ${
                          isPremiumItinerary ? 'text-[#C28514] dark:text-[#FDE073]' : 'text-zinc-400'
                        }`}
                      >
                        <Clock className="w-3 h-3 shrink-0 text-zinc-400" />
                        <span>{currentSelectedStep.suggestedTime || '09:30'}</span>
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-600 font-bold leading-none">·</span>
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate max-w-[130px] leading-none">
                        {currentSelectedStep.spot?.categoryLabel || 'ATRAÇÃO / TURÍSTICO'}
                      </span>
                    </div>
                    <h4 className="text-[14px] sm:text-[15px] font-black uppercase truncate leading-tight my-1 text-zinc-900 dark:text-white">
                      {currentSelectedStep.spot?.name}
                    </h4>
                    <p className="text-[10.5px] font-bold text-zinc-400 truncate leading-none flex items-center gap-1">
                      <RoundedNavigationIcon
                        isGold={isPremiumItinerary}
                        className={`w-3 h-3 shrink-0 ${
                          isPremiumItinerary ? '' : isDark ? 'text-white' : 'text-black'
                        }`}
                        size={12}
                      />
                      <span>
                        {currentSelectedStep.durationToNextMin
                          ? `${currentSelectedStep.durationToNextMin} min até o próximo ponto`
                          : 'Local planejado do roteiro'}
                      </span>
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        ) : (
          /* Expanded State: FULL BOTTOM DRAWER WITH SCROLLABLE STOPS */
          <motion.div
            key="itinerary-expanded-drawer"
            layout
            initial={shouldAnimateEntrance ? { opacity: 0, y: 120 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 120 }}
            transition={shouldAnimateEntrance ? qrSpringTransition : { duration: 0 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.3 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 50 || info.velocity.y > 140) {
                setIsExpanded(false);
              }
            }}
            className={`md:hidden !absolute inset-x-0 bottom-0 z-40 max-w-3xl mx-auto rounded-t-[32px] overflow-hidden flex flex-col pointer-events-auto transition-colors duration-200 border-x-0 sm:border-x border-t shadow-[0_-10px_34px_rgba(0,0,0,0.16)] ${
              isDark
                ? 'bg-[#121214] border-white/12 text-white'
                : 'bg-[#FFFFFF] border-black/[0.06] text-black'
            }`}
            style={{
              backgroundColor: isDark ? '#121214' : '#FFFFFF',
              color: isDark ? '#FFFFFF' : '#000000',
              position: 'absolute',
              bottom: 0,
              maxHeight: '52vh',
              height: '52vh',
              paddingBottom: '74px',
              borderTopLeftRadius: '32px',
              borderTopRightRadius: '32px',
              borderBottomLeftRadius: '0px',
              borderBottomRightRadius: '0px',
              WebkitMaskImage: '-webkit-radial-gradient(white, black)',
            }}
          >
            {/* Drag handle */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="w-full pt-3 pb-1.5 flex items-center justify-center touch-none shrink-0 cursor-grab active:cursor-grabbing"
            >
              <div className="w-10 h-1.5 rounded-full bg-zinc-300/90 dark:bg-zinc-600/80" />
            </div>

            {/* Scrollable Sequential Stops List (when expanded) - Matching the exact visual identity of Foto 1 */}
            {isExpanded && (
              <div
                className="flex-1 overflow-y-auto px-4 sm:px-5 py-1.5 space-y-2"
                style={{
                  paddingBottom: '16px',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {userItinerary?.days && userItinerary.days.length > 1 && (
                  <div className="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar">
                    {userItinerary.days.map((day, dIdx) => (
                      <motion.button
                        type="button"
                        key={day.dayNumber}
                        initial={shouldAnimateEntrance ? { opacity: 0, scale: 0.88, y: 12 } : false}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={
                          shouldAnimateEntrance
                            ? { type: 'spring', stiffness: 380, damping: 22, delay: dIdx * 0.035 }
                            : { duration: 0 }
                        }
                        whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                        whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                        onClick={() => {
                          setSelectedDayIndex(dIdx);
                          const firstStepOfDay = day.steps?.[0];
                          if (firstStepOfDay) setSelectedStopId(firstStepOfDay.id);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          selectedDayIndex === dIdx
                            ? 'bg-white text-black shadow-md'
                            : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
                        }`}
                      >
                        Dia {day.dayNumber}
                      </motion.button>
                    ))}
                  </div>
                )}
                <AnimatePresence mode="popLayout" initial={shouldAnimateEntrance}>
                  {activeSteps.map((step, idx) => (
                    <SwipeableStopCard
                      key={step.id}
                      step={step}
                      idx={idx}
                      shouldAnimate={shouldAnimateEntrance}
                      totalSteps={activeSteps.length}
                      isSelected={step.id === currentSelectedStep?.id}
                      isDark={isDark}
                      isPremium={isPremiumItinerary}
                      onSelect={handleSelectStopOnMap}
                      onDelete={handleDeleteStep}
                      onMoveUp={handleMoveStepUp}
                      onMoveDown={handleMoveStepDown}
                    />
                  ))}
                </AnimatePresence>

                {/* Add Spot "+" Button directly below the last tourist spot (revealed when pulled up) */}
                <div className="pt-2 pb-6 flex flex-col items-center justify-center">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.04 }}
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 ios-glass border border-white text-zinc-900 dark:text-white shadow-lg"
                    title="Adicionar ponto turístico ao roteiro"
                    aria-label="Adicionar ponto turístico ao roteiro"
                  >
                    <Plus className="w-5 h-5 stroke-[2.4] text-current" />
                  </motion.button>
                  <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 mt-2 select-none">
                    Adicionar Local
                  </span>
                </div>

                {/* Bottom padding spacer to ensure smooth scroll clearance above bottom nav */}
                <div className="h-4" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Edit Itinerary Modal */}
      {isEditModalOpen && (
        <ItineraryEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          itinerary={userItinerary}
          onSave={handleSaveEditedItinerary}
          onDeleteItinerary={handleDeleteItinerary}
          onCreateNewItinerary={handleCreateNewItinerary}
          theme={theme}
          isPremium={isPremiumItinerary}
        />
      )}

      {/* 6. Notes Modal (Anotações da viagem com folha de diário temática) */}
      <AnimatePresence>
        {isNotesModalOpen && (
          <TripNotesModal
            isOpen={isNotesModalOpen}
            onClose={() => setIsNotesModalOpen(false)}
            tripNoteText={tripNoteText}
            onSave={handleSaveTripNote}
            theme={theme}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification for Itinerary Added */}
      <AnimatePresence>
        {storeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="fixed top-20 inset-x-0 mx-auto z-70 w-fit px-5 py-2.5 rounded-full bg-zinc-900/90 text-white border border-white/15 backdrop-blur-xl shadow-2xl flex items-center gap-2 text-xs font-black"
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
            <span>{storeToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loja de Roteiros Premium Modal */}
      <ItineraryStoreModal
        isOpen={isStoreOpen}
        onClose={() => setIsStoreOpen(false)}
        onApplyItinerary={handleApplyStoreItinerary}
        theme={theme}
      />

      {/* Plus Action Sheet Popover Menu */}
      <PlusActionMenuModal
        isOpen={isPlusMenuOpen}
        onClose={() => setIsPlusMenuOpen(false)}
        onCreateNewItinerary={() => setItineraryViewMode('explore')}
        onAddSpot={() => setIsImportModalOpen(true)}
        theme={theme}
        isGoldUser={isUserGold}
      />

      {/* Floating Import Spots Modal */}
      <ImportSpotFloatingModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        spots={spots || CAMPOS_SPOTS}
        importedSpotIds={activeStepSpotIds}
        onImportSpot={handleImportSpotToItinerary}
        theme={theme}
        isGoldUser={isUserGold}
      />
      </div>
      )}
    </div>
  );
});
