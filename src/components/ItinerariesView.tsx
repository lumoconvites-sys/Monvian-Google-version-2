import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
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
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { Itinerary, ItineraryDay, ItineraryStep, Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import { TripDateStep } from './itineraries/TripDateStep';
import { PeopleStep } from './itineraries/PeopleStep';
import { BudgetStep } from './itineraries/BudgetStep';
import { TinderDiscoveryStep } from './itineraries/TinderDiscoveryStep';
import { ItineraryEditModal } from './itineraries/ItineraryEditModal';
import { generateCustomItinerary } from './itineraries/routeGenerator';

interface ItinerariesViewProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  spots?: Spot[];
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
const getMapStyle = (theme: 'dark' | 'light' = 'light'): maplibregl.StyleSpecification => {
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
        'osm-transport': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-transport-layer',
          type: 'raster',
          source: 'osm-transport',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-contrast': 0.15,
            'raster-brightness-min': 0.0,
            'raster-brightness-max': 1.0,
            'raster-saturation': 0.85,
            'raster-hue-rotate': 14,
          },
        },
      ],
    };
  }

  // Dark mode
  return {
    version: 8,
    projection: { type: 'globe' } as any,
    sources: {
      'carto-base': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; CARTO &copy; OpenStreetMap',
      },
    },
    layers: [
      {
        id: 'carto-base-layer',
        type: 'raster',
        source: 'carto-base',
        minzoom: 0,
        maxzoom: 20,
        paint: {
          'raster-contrast': 0.2,
          'raster-brightness-min': 0.0,
          'raster-brightness-max': 0.85,
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
  onSelect: (step: ItineraryStep) => void;
  onDelete: (stepId: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
}

const OPEN_OFFSET_LEFT = -84;
const SPRING_IOS = { type: 'spring' as const, stiffness: 440, damping: 36, mass: 0.8 };
const SPRING_LAYOUT = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.6 };

const SwipeableStopCard: React.FC<SwipeableStopCardProps> = ({
  step,
  idx,
  totalSteps,
  isSelected,
  isDark,
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
      layout="position"
      layoutId={step.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: isDeleting ? 0 : 1,
        height: isDeleting ? 0 : 'auto',
        y: 0,
      }}
      exit={{ opacity: 0, height: 0 }}
      transition={{
        layout: SPRING_LAYOUT,
        opacity: { duration: 0.18 },
        height: { duration: 0.22 },
      }}
      className="relative w-full rounded-[28px] overflow-hidden select-none touch-pan-y transform-gpu will-change-transform"
    >
      {/* Background Red Swipe Area (iOS Delete Action - Right side) */}
      <motion.div
        style={{ opacity: bgOpacity }}
        onClick={handleDeleteItem}
        className="absolute inset-0 bg-[#FF3B30] rounded-[28px] flex items-center justify-end px-6 z-0 cursor-pointer"
        aria-label="Excluir ponto turístico"
      >
        <motion.div
          style={{ opacity: trashOpacity, scale: trashScale }}
          className="flex items-center gap-1.5 text-white font-bold select-none"
        >
          <Trash2 className="w-5 h-5 stroke-[2.2]" />
        </motion.div>
      </motion.div>

      {/* Foreground Draggable Card - 100% OPAQUE to prevent any bleeding/tinting */}
      <motion.div
        ref={containerRef}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -400, right: 0 }}
        dragElastic={{ left: 0.12, right: 0 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
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
        aria-label={`Parada ${idx + 1}: ${spot?.name || 'Local'}. Deslize para a esquerda para excluir.`}
        className={`relative z-10 py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-[28px] flex items-center justify-between gap-3 cursor-pointer ${
          isSelected
            ? isDark
              ? 'bg-[#242426] border border-white/30 ring-1 ring-white/20 shadow-md text-white'
              : 'bg-white ring-2 ring-blue-500/50 shadow-md text-zinc-900 border border-zinc-200'
            : isDark
            ? 'bg-[#1c1c1e] border border-white/10 hover:border-white/20 hover:bg-[#242426] text-white'
            : 'bg-white hover:bg-zinc-50 border border-zinc-200/80 shadow-xs text-zinc-900'
        }`}
      >
        {/* Left: Stop Number + Compact Thumbnail */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 self-center">
          <div className="relative shrink-0 flex items-center justify-center self-center">
            <span
              className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full text-[11px] font-black flex items-center justify-center leading-none text-center tracking-tight transition-colors self-center ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40'
                  : isDark
                  ? 'bg-zinc-800 text-zinc-300 border border-white/10'
                  : 'bg-zinc-100 text-zinc-700 border border-black/5'
              }`}
            >
              {String(idx + 1).padStart(2, '0')}
            </span>
          </div>

          {spot?.image && (
            <div
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-[16px] overflow-hidden shrink-0 bg-zinc-800 relative select-none self-center hover:opacity-90 active:scale-98 transition-all"
            >
              <img
                src={spot.image}
                alt={spot.name}
                className="w-full h-full object-cover pointer-events-none"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=200&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
            </div>
          )}

          {/* Middle Column */}
          <div className="min-w-0 flex-1 flex flex-col justify-center self-center py-0.5 pointer-events-none">
            <div className="flex items-center gap-1.5 flex-nowrap leading-none">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-blue-600 dark:text-blue-400 leading-none">
                <Clock className="w-3 h-3 shrink-0" />
                <span>{step.suggestedTime || '09:30'}</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-600 font-bold leading-none">·</span>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate max-w-[130px] leading-none">
                {spot?.categoryLabel || 'ATRAÇÃO / TURÍSTICO'}
              </span>
              {spot?.highlighted && (
                <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-blue-500/12 text-blue-500 border border-blue-500/20 leading-none">
                  ★ Verificado
                </span>
              )}
            </div>

            <h4
              className="text-[14px] sm:text-[15px] font-black uppercase truncate leading-tight my-1 text-zinc-900 dark:text-white"
            >
              {spot?.name || `Ponto ${idx + 1}`}
            </h4>

            {step.durationToNextMin ? (
              <p className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-400 truncate leading-none flex items-center gap-1 pointer-events-none">
                <Navigation className="w-3 h-3 text-blue-500 shrink-0" />
                <span>{step.durationToNextMin} min até o próximo ponto</span>
              </p>
            ) : (
              <p className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-400 truncate leading-none pointer-events-none">
                {(spot as { shortDescription?: string })?.shortDescription || spot?.description || 'Parada planejada do roteiro'}
              </p>
            )}
          </div>
        </div>

        {/* Right Action: Reorder Arrows (↑ and ↓) as shown in IMG_7287 */}
        <div
          className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-center z-10 pl-1"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            type="button"
            disabled={idx === 0}
            whileTap={idx === 0 ? {} : { scale: 0.82 }}
            onClick={(e) => {
              e.stopPropagation();
              if (idx > 0 && onMoveUp) {
                onMoveUp(idx);
              }
            }}
            className={`w-7 h-8 sm:w-8 sm:h-8.5 rounded-lg flex items-center justify-center transition-colors ${
              idx === 0
                ? isDark
                  ? 'text-zinc-600/50 cursor-not-allowed'
                  : 'text-zinc-300 cursor-not-allowed'
                : isDark
                ? 'text-zinc-200 hover:text-white hover:bg-white/10 active:bg-white/15 cursor-pointer'
                : 'text-zinc-800 hover:text-black hover:bg-zinc-100 active:bg-zinc-200 cursor-pointer'
            }`}
            title={idx === 0 ? 'Primeira parada' : 'Mover para cima'}
            aria-label="Mover parada para cima"
          >
            <ArrowUp className="w-4.5 h-4.5 stroke-[2.2]" />
          </motion.button>

          <motion.button
            type="button"
            disabled={idx === totalSteps - 1}
            whileTap={idx === totalSteps - 1 ? {} : { scale: 0.82 }}
            onClick={(e) => {
              e.stopPropagation();
              if (idx < totalSteps - 1 && onMoveDown) {
                onMoveDown(idx);
              }
            }}
            className={`w-7 h-8 sm:w-8 sm:h-8.5 rounded-lg flex items-center justify-center transition-colors ${
              idx === totalSteps - 1
                ? isDark
                  ? 'text-zinc-600/50 cursor-not-allowed'
                  : 'text-zinc-300 cursor-not-allowed'
                : isDark
                ? 'text-zinc-200 hover:text-white hover:bg-white/10 active:bg-white/15 cursor-pointer'
                : 'text-zinc-800 hover:text-black hover:bg-zinc-100 active:bg-zinc-200 cursor-pointer'
            }`}
            title={idx === totalSteps - 1 ? 'Última parada' : 'Mover para baixo'}
            aria-label="Mover parada para baixo"
          >
            <ArrowDown className="w-4.5 h-4.5 stroke-[2.2]" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const ItinerariesView: React.FC<ItinerariesViewProps> = ({
  isOpen,
  onClose,
  theme = 'light',
  spots = CAMPOS_SPOTS
}) => {
  const isDark = theme === 'dark';

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

  // Current active user itinerary
  const [userItinerary, setUserItinerary] = useState<Itinerary | null>(() => {
    try {
      const cached = localStorage.getItem('monvian_active_itinerary');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.days && parsed.days.length > 0) return parsed;
      }
    } catch (e) {}
    return null;
  });

  // Modal for editing stops
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Notes Modal state & persistent trip notes
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isListeningNote, setIsListeningNote] = useState(false);
  const [tripNoteText, setTripNoteText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('monvian_trip_note_campos');
      if (saved) return saved;
    } catch (e) {}
    return '';
  });
  const [isNoteSavedToast, setIsNoteSavedToast] = useState(false);

  const toggleDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Ditado por voz não é suportado neste navegador.');
      return;
    }
    if (isListeningNote) {
      setIsListeningNote(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setIsListeningNote(true);
      recognition.onend = () => setIsListeningNote(false);
      recognition.onerror = () => setIsListeningNote(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setTripNoteText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.start();
    } catch (e) {
      setIsListeningNote(false);
    }
  };

  const handleSaveTripNote = (text: string) => {
    setTripNoteText(text);
    try {
      localStorage.setItem('monvian_trip_note_campos', text);
    } catch (e) {}
    setIsNoteSavedToast(true);
    setTimeout(() => setIsNoteSavedToast(false), 2200);
  };

  // Rename title inline
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Bottom Sheet expansion state: false = compact (inteiro e compacto acima da barra), true = 50% split
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Map references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRecordsRef = useRef<Array<{
    stepId: string;
    marker: maplibregl.Marker;
    containerEl: HTMLElement;
    badgeEl: HTMLElement;
    arrowEl: HTMLElement;
    pulseEl: HTMLElement | null;
  }>>([]);

  // Fetch saved user itinerary or draft on startup
  useEffect(() => {
    let isMounted = true;
    const fetchSavedState = async () => {
      try {
        const res = await fetch('/api/user-itineraries', {
          headers: { 'x-session-id': sessionId }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.itineraries) && data.itineraries.length > 0) {
            const first = data.itineraries[0];
            // Enrich with spots references
            const enriched: Itinerary = {
              ...first,
              days: (first.days || []).map((day: ItineraryDay) => ({
                ...day,
                steps: (day.steps || []).map((step: ItineraryStep) => ({
                  ...step,
                  spot: spots.find(s => s.id === step.spotId) || step.spot
                }))
              }))
            };
            setUserItinerary(enriched);
            localStorage.setItem('monvian_active_itinerary', JSON.stringify(enriched));
            return;
          }
        }

        // Check if there was an in-progress draft
        const draftRes = await fetch('/api/user-itineraries/draft', {
          headers: { 'x-session-id': sessionId }
        });
        if (draftRes.ok) {
          const draftData = await draftRes.json();
          if (isMounted && draftData.success && draftData.draft) {
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
    };
  }, [sessionId, spots]);

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
      setTimeout(() => {
        setUserItinerary(generated);
        localStorage.setItem('monvian_active_itinerary', JSON.stringify(generated));
        setWizardStep('date'); // Reset for next time
      }, 1000);
    } catch (err) {
      console.error('Error generating itinerary:', err);
      setWizardStep('tinder');
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
    setWizardStep('date');
    setSelectedStopId(null);
  };

  // Create new itinerary handler
  const handleCreateNewItinerary = () => {
    setUserItinerary(null);
    localStorage.removeItem('monvian_active_itinerary');
    setWizardStep('date');
    setSelectedStopId(null);
  };

  // Save edited itinerary (reordered stops or removed stops)
  const handleSaveEditedItinerary = async (updated: Itinerary) => {
    setUserItinerary(updated);
    localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));

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

    const updatedDays = (userItinerary.days || []).map((day) => ({
      ...day,
      steps: (day.steps || []).filter((s) => s.id !== stepId)
    }));

    const updated: Itinerary = {
      ...userItinerary,
      days: updatedDays
    };

    setUserItinerary(updated);
    localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));

    if (selectedStopId === stepId) {
      const remainingSteps = updatedDays.flatMap(d => d.steps);
      setSelectedStopId(remainingSteps.length > 0 ? remainingSteps[0].id : null);
    }

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

  // Active steps from current user itinerary
  const activeSteps = useMemo(() => {
    if (!userItinerary?.days || userItinerary.days.length === 0) return [];
    return [...(userItinerary.days[0].steps || [])].sort((a, b) => a.stepOrder - b.stepOrder);
  }, [userItinerary]);

  // Reorder steps up / down directly from the order arrows on cards (matching IMG_7287)
  const handleMoveStepUp = async (index: number) => {
    if (!userItinerary || index <= 0 || !activeSteps[index]) return;
    const currentSteps = [...activeSteps];
    const temp = currentSteps[index - 1];
    currentSteps[index - 1] = currentSteps[index];
    currentSteps[index] = temp;

    const reorderedSteps = currentSteps.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));

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

    const reorderedSteps = currentSteps.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));

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

  // In-place marker visual sync matching Foto 2
  const syncMarkerHighlight = useCallback((activeStepId: string | null) => {
    markerRecordsRef.current.forEach((rec) => {
      const isSelected = rec.stepId === activeStepId;
      rec.containerEl.style.transform = isSelected ? 'scale(1.22)' : 'scale(0.96)';
      rec.containerEl.style.zIndex = isSelected ? '50' : '20';

      rec.badgeEl.style.background = isSelected ? '#007AFF' : (isDark ? '#27272a' : '#FFFFFF');
      rec.badgeEl.style.color = isSelected ? '#FFFFFF' : (isDark ? '#e4e4e7' : '#18181b');
      rec.badgeEl.style.border = isSelected
        ? '3px solid #FFFFFF'
        : (isDark ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(0,0,0,0.18)');
      rec.badgeEl.style.boxShadow = isSelected
        ? '0 6px 22px rgba(0, 122, 255, 0.65), 0 2px 8px rgba(0, 0, 0, 0.3)'
        : '0 2px 8px rgba(0, 0, 0, 0.2)';

      rec.arrowEl.style.background = isSelected ? '#007AFF' : (isDark ? '#27272a' : '#FFFFFF');
      rec.arrowEl.style.borderRight = isSelected
        ? '3px solid #FFFFFF'
        : (isDark ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(0,0,0,0.18)');
      rec.arrowEl.style.borderBottom = isSelected
        ? '3px solid #FFFFFF'
        : (isDark ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(0,0,0,0.18)');

      if (rec.pulseEl) {
        rec.pulseEl.style.display = isSelected ? 'block' : 'none';
      }
    });
  }, [isDark]);

  // Update Route Polyline and Markers efficiently without destroying DOM elements
  const renderRouteAndMarkers = useCallback((shouldFitBounds = false) => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.isStyleLoaded()) {
      map.once('load', () => {
        if (mapRef.current === map) renderRouteAndMarkers(shouldFitBounds);
      });
      map.once('styledata', () => {
        if (mapRef.current === map) renderRouteAndMarkers(shouldFitBounds);
      });
      return;
    }

    // Extract coordinates
    const validSteps = activeSteps.filter(
      (s) => s.spot && typeof s.spot.lat === 'number' && typeof s.spot.lng === 'number'
    );
    const coordinates: [number, number][] = validSteps.map((s) => [s.spot!.lng, s.spot!.lat]);

    // GeoJSON route
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

    const existingSource = map.getSource(routeSourceId) as maplibregl.GeoJSONSource;
    if (existingSource) {
      existingSource.setData(geojsonData);
    } else {
      map.addSource(routeSourceId, {
        type: 'geojson',
        data: geojsonData,
      });

      // Outer glow
      map.addLayer({
        id: glowLayerId,
        type: 'line',
        source: routeSourceId,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#007AFF',
          'line-width': 12,
          'line-opacity': 0.35,
          'line-blur': 6,
        },
      });

      // Casing
      map.addLayer({
        id: casingLayerId,
        type: 'line',
        source: routeSourceId,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 7,
          'line-opacity': 0.9,
        },
      });

      // Line
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: routeSourceId,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#007AFF',
          'line-width': 4.5,
        },
      });
    }

    // Check if we can safely update existing marker numbers in-place on this active map instance
    const existingStepIds = markerRecordsRef.current.map((r) => r.stepId);
    const newStepIds = validSteps.map((s) => s.id);
    const isSameMarkerSet =
      existingStepIds.length === newStepIds.length &&
      existingStepIds.every((id) => newStepIds.includes(id));

    const areMarkersAttachedToCurrentMap =
      markerRecordsRef.current.length > 0 &&
      markerRecordsRef.current.every((rec) => {
        try {
          const el = rec.marker.getElement();
          return Boolean(el && el.isConnected && map.getContainer().contains(el));
        } catch {
          return false;
        }
      });

    if (isSameMarkerSet && areMarkersAttachedToCurrentMap) {
      // In-place update of step numbers: 0 DOM destruction, 60fps/120fps guarantee!
      validSteps.forEach((step, idx) => {
        const rec = markerRecordsRef.current.find((r) => r.stepId === step.id);
        if (rec) {
          rec.badgeEl.innerText = String(idx + 1).padStart(2, '0');
        }
      });
      return;
    }

    // Clear previous markers
    markerRecordsRef.current.forEach((rec) => {
      try {
        rec.marker.remove();
      } catch (e) {}
    });
    markerRecordsRef.current = [];

    // Attach markers with direct element references matching Foto 2
    validSteps.forEach((step, idx) => {
      const stepNumberFormatted = String(idx + 1).padStart(2, '0');
      const isSelected = (selectedStopId && selectedStopId === step.id) || (!selectedStopId && idx === 0);

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

      // Glowing circular translucent blue aura/halo (Foto 2)
      const pulseEl = document.createElement('div');
      pulseEl.style.position = 'absolute';
      pulseEl.style.width = '64px';
      pulseEl.style.height = '64px';
      pulseEl.style.borderRadius = '9999px';
      pulseEl.style.top = '-14px';
      pulseEl.style.left = '-14px';
      pulseEl.style.background = 'radial-gradient(circle, rgba(0, 122, 255, 0.5) 0%, rgba(0, 122, 255, 0.2) 55%, transparent 75%)';
      pulseEl.style.pointerEvents = 'none';
      pulseEl.style.zIndex = '-1';
      pulseEl.style.display = isSelected ? 'block' : 'none';

      // Pin Circular Badge (Foto 2: Blue with 3px solid white border, white bold text)
      const badgeEl = document.createElement('div');
      badgeEl.style.width = '36px';
      badgeEl.style.height = '36px';
      badgeEl.style.borderRadius = '9999px';
      badgeEl.style.display = 'flex';
      badgeEl.style.alignItems = 'center';
      badgeEl.style.justifyContent = 'center';
      badgeEl.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
      badgeEl.style.fontWeight = '800';
      badgeEl.style.fontSize = '14px';
      badgeEl.style.letterSpacing = '-0.02em';
      badgeEl.style.background = isSelected ? '#007AFF' : (isDark ? '#27272a' : '#FFFFFF');
      badgeEl.style.color = isSelected ? '#FFFFFF' : (isDark ? '#e4e4e7' : '#18181b');
      badgeEl.style.border = isSelected
        ? '3px solid #FFFFFF'
        : (isDark ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(0,0,0,0.18)');
      badgeEl.style.boxShadow = isSelected
        ? '0 6px 22px rgba(0, 122, 255, 0.65), 0 2px 8px rgba(0, 0, 0, 0.3)'
        : '0 2px 8px rgba(0, 0, 0, 0.2)';
      badgeEl.innerText = stepNumberFormatted;

      // Pin downward arrow pointer
      const arrowEl = document.createElement('div');
      arrowEl.style.width = '7px';
      arrowEl.style.height = '7px';
      arrowEl.style.transform = 'rotate(45deg)';
      arrowEl.style.marginTop = '-3.5px';
      arrowEl.style.background = isSelected ? '#007AFF' : (isDark ? '#27272a' : '#FFFFFF');
      arrowEl.style.borderRight = isSelected
        ? '3px solid #FFFFFF'
        : (isDark ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(0,0,0,0.18)');
      arrowEl.style.borderBottom = isSelected
        ? '3px solid #FFFFFF'
        : (isDark ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(0,0,0,0.18)');

      containerEl.appendChild(pulseEl);
      containerEl.appendChild(badgeEl);
      containerEl.appendChild(arrowEl);
      el.appendChild(containerEl);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSelectStopOnMap(step);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([step.spot!.lng, step.spot!.lat])
        .addTo(map);

      markerRecordsRef.current.push({
        stepId: step.id,
        marker,
        containerEl,
        badgeEl,
        arrowEl,
        pulseEl,
      });
    });

    // Fit camera bounds only when explicitly requested (e.g. initial load or stop deletion)
    if (shouldFitBounds && coordinates.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach((coord) => bounds.extend(coord));

      map.fitBounds(bounds, {
        padding: {
          top: 90,
          bottom: Math.round(window.innerHeight * 0.5) + 20,
          left: 45,
          right: 45,
        },
        maxZoom: 14.8,
        duration: 600,
      });
    }
  }, [activeSteps, selectedStopId, isDark]);

  // Initialize MapLibre GL map when userItinerary exists and tab is open
  useEffect(() => {
    if (!isOpen || !userItinerary || !mapContainerRef.current) return;

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
      style: getMapStyle(theme === 'dark' ? 'dark' : 'light'),
      center: [-45.5910, -22.7340],
      zoom: 12.8,
      attributionControl: false,
    });

    mapRef.current = map;

    const onMapReady = () => {
      if (mapRef.current !== map) return;
      try {
        map.resize();
      } catch (e) {}
      renderRouteAndMarkers(true);
    };

    if (map.loaded() && map.isStyleLoaded()) {
      onMapReady();
    } else {
      map.once('load', onMapReady);
    }

    // When clicking anywhere on the map, collapse the sheet so only 20% is visible
    map.on('click', () => {
      setIsExpanded(false);
    });

    return () => {
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
  }, [isOpen, userItinerary?.id, theme]);

  // When active steps change or map finishes loading
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      renderRouteAndMarkers(false);
    }
  }, [activeSteps, renderRouteAndMarkers]);

  // Marker highlight sync on stop selection
  useEffect(() => {
    syncMarkerHighlight(selectedStopId);
  }, [selectedStopId, syncMarkerHighlight]);

  // Select stop, highlight numbered marker, zoom in and center in the visible half of the map
  const handleSelectStopOnMap = (step: ItineraryStep) => {
    setSelectedStopId(step.id);
    if (mapRef.current && step.spot) {
      // Center the marker precisely in the middle of the visible map area above the bottom sheet
      const verticalOffset = isExpanded
        ? -Math.round(window.innerHeight * 0.20)
        : -Math.round(window.innerHeight * 0.08);

      mapRef.current.easeTo({
        center: [step.spot.lng, step.spot.lat],
        zoom: 15.3,
        offset: [0, verticalOffset],
        duration: 600,
      });
    }
  };

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // VIEW MODE A: Step-by-Step Creation Wizard (Single question at a time)
  // -------------------------------------------------------------
  if (!userItinerary) {
    return (
      <div
        className={`fixed inset-0 z-[120] flex flex-col justify-between overflow-y-auto transition-colors duration-200 select-none ${
          isDark ? 'bg-[#111315] text-white' : 'bg-[#F4F4F6] text-zinc-900'
        }`}
        style={{
          paddingTop: 'max(14px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        }}
      >
        {/* Top Minimalist Header with iOS Frosted Glass */}
        <div className="w-full max-w-md sm:max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              if (wizardStep === 'people') setWizardStep('date');
              else if (wizardStep === 'budget') setWizardStep('people');
              else if (wizardStep === 'tinder') setWizardStep('budget');
              else onClose();
            }}
            className="w-11 h-11 rounded-full ios-glass-btn flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-lg text-zinc-800 dark:text-white"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Step Pill */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full ios-glass shadow-md">
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                wizardStep === 'date' ? 'bg-blue-600 scale-125' : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                wizardStep === 'people' ? 'bg-blue-600 scale-125' : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                wizardStep === 'budget' ? 'bg-blue-600 scale-125' : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                wizardStep === 'tinder' ? 'bg-blue-600 scale-125' : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
          </div>

          <div className="w-11 flex items-center justify-end">
            {wizardStep === 'tinder' ? (
              <span className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 tabular-nums px-2 py-1 rounded-full ios-glass">
                4/4
              </span>
            ) : null}
          </div>
        </div>

        {/* Wizard Step Content */}
        <div className="flex-1 w-full overflow-y-auto flex flex-col items-center justify-center px-4 py-2 sm:py-4 my-auto">
          <AnimatePresence mode="wait">
            {wizardStep === 'date' && (
              <TripDateStep
                key="step-date"
                initialDate={tripDate}
                onContinue={handleDateContinue}
                theme={theme}
              />
            )}

            {wizardStep === 'people' && (
              <PeopleStep
                key="step-people"
                initialAdults={adultsCount}
                initialChildren={childrenCount}
                initialCount={peopleCount}
                onContinue={handlePeopleContinue}
                onBack={() => setWizardStep('date')}
                theme={theme}
              />
            )}

            {wizardStep === 'budget' && (
              <BudgetStep
                key="step-budget"
                initialBudget={budget}
                onContinue={handleBudgetContinue}
                onBack={() => setWizardStep('people')}
                theme={theme}
              />
            )}

            {wizardStep === 'tinder' && (
              <TinderDiscoveryStep
                key="step-tinder"
                spots={spots}
                onFinish={handleTinderFinish}
                onBack={() => setWizardStep('budget')}
                theme={theme}
              />
            )}

            {wizardStep === 'generating' && (
              <motion.div
                key="step-generating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm sm:max-w-md mx-auto my-auto flex flex-col items-center justify-center text-center px-6 py-12"
              >
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 mb-6 flex items-center justify-center">
                  <div className="w-full h-full rounded-full border-[3.5px] border-blue-500/20 border-t-blue-500 animate-spin" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                  Criando seu Roteiro...
                </h2>
                <p className="text-sm sm:text-base font-medium text-zinc-500 dark:text-zinc-400 mt-2.5 max-w-[280px] sm:max-w-[320px] leading-relaxed mx-auto">
                  Organizando os pontos turísticos em sequência inteligente para minimizar deslocamentos.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE B: Map with the Route and Sequential Points
  // -------------------------------------------------------------
  return (
    <div className={`fixed inset-0 ${isEditModalOpen ? 'z-[120]' : 'z-40'} w-full h-full overflow-hidden ${isDark ? 'bg-[#111315]' : 'bg-[#F4F4F6]'} select-none`}>
      {/* 1. MapLibre GL Interactive Canvas */}
      <div
        ref={mapContainerRef}
        onClick={() => setIsExpanded(false)}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* 2. Top Header Overlay with Back Button and Itinerary Name Dynamic Island */}
      <div
        className="absolute top-0 inset-x-0 z-30 pointer-events-none p-3.5 sm:p-4 flex items-center justify-between gap-2"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={() => setIsNotesModalOpen(true)}
          type="button"
          className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center pointer-events-auto transition-transform active:scale-95 cursor-pointer shrink-0 ${
            isDark
              ? 'ios-glass-btn text-white'
              : 'ios-glass-btn-white text-zinc-900 shadow-md'
          }`}
          title="Anotações da viagem"
        >
          <Notebook className="w-5 h-5 stroke-[1.8] text-zinc-900 dark:text-white" />

          {/* Glowing white pulsing dot indicator when notes are saved */}
          {tripNoteText.trim().length > 0 && (
            <span className="absolute top-1 right-1 flex h-2.5 w-2.5 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90 shadow-[0_0_10px_rgba(255,255,255,1)]" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white border border-zinc-300 dark:border-zinc-700 shadow-[0_0_8px_rgba(255,255,255,1)]" />
            </span>
          )}
        </button>

        {/* Dynamic Island Style Pill (iPhone style, structured, rounded, bold title, pencil icon & stop count) */}
        <div
          className={`px-4 py-2.5 sm:px-5 sm:py-3 rounded-full pointer-events-auto flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold max-w-[calc(100vw-116px)] sm:max-w-none transition-all duration-200 ${
            isDark
              ? 'ios-glass text-white shadow-2xl'
              : 'ios-glass-white text-zinc-900 shadow-lg'
          }`}
        >
          <Navigation className={`w-5 h-5 sm:w-5.5 sm:h-5.5 fill-current shrink-0 ${isDark ? 'text-blue-500' : 'text-blue-600'}`} />

          {isEditingTitle ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRenameTitle(editedTitle);
              }}
              className="flex items-center gap-2 pointer-events-auto"
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
                    ? 'bg-zinc-800 border-blue-500 text-white'
                    : 'bg-zinc-100 border-blue-600 text-zinc-900'
                }`}
                placeholder="Nome do roteiro..."
              />
              <button
                type="submit"
                className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 hover:bg-blue-500 transition-colors cursor-pointer"
                title="Salvar nome"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                onClick={() => {
                  setEditedTitle(userItinerary.title);
                  setIsEditingTitle(true);
                }}
                className={`font-black text-sm sm:text-base tracking-tight truncate max-w-[140px] sm:max-w-[240px] cursor-pointer ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
                title="Toque para editar"
              >
                {userItinerary.title}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditedTitle(userItinerary.title);
                  setIsEditingTitle(true);
                }}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  isDark
                    ? 'text-zinc-400 hover:text-blue-400 hover:bg-white/10'
                    : 'text-zinc-400 hover:text-blue-600 hover:bg-zinc-100'
                }`}
                title="Editar nome do roteiro"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <span className={`font-bold ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`}>·</span>

          <span className={`font-black text-xs sm:text-sm shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {activeSteps.length} {activeSteps.length === 1 ? 'parada' : 'paradas'}
          </span>
        </div>

        {/* Action button to open edit modal (Clean Apple Sliders) */}
        <button
          onClick={() => setIsEditModalOpen(true)}
          type="button"
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center pointer-events-auto transition-transform active:scale-95 cursor-pointer shrink-0 ${
            isDark
              ? 'ios-glass-btn text-white'
              : 'ios-glass-btn-white text-zinc-900 shadow-md'
          }`}
          title="Opções do roteiro"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* 4. Bottom Sheet with Route Stops and Actions (50% Split or Compact) */}
      <motion.div
        layout
        transition={qrSpringTransition}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.08, bottom: 0.3 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 40 || info.velocity.y > 100) {
            setIsExpanded(false);
          } else if (info.offset.y < -40 || info.velocity.y < -100) {
            setIsExpanded(true);
          }
        }}
        onClick={(e) => {
          if (!isExpanded) {
            e.stopPropagation();
            setIsExpanded(true);
          }
        }}
        className={`!absolute inset-x-0 bottom-0 z-40 max-w-3xl mx-auto rounded-t-[32px] sm:rounded-t-[36px] overflow-hidden flex flex-col pointer-events-auto transition-colors duration-200 border-x-0 sm:border-x ${
          isDark
            ? 'ios-glass-nav text-white shadow-[0_-20px_50px_rgba(0,0,0,0.85)]'
            : 'ios-glass-nav-white text-zinc-900 shadow-[0_-15px_40px_rgba(0,0,0,0.12)]'
        }`}
        style={{
          position: 'absolute',
          bottom: '-0.8vh',
          maxHeight: isExpanded ? '46vh' : '200px',
          height: isExpanded ? '46vh' : 'auto',
          paddingBottom: isExpanded ? '0px' : 'calc(88px + env(safe-area-inset-bottom, 16px))',
        }}
      >
        {/* Drag handle */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-full pt-2.5 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <div className="w-9 h-1 rounded-full bg-zinc-400/60 dark:bg-zinc-600/60" />
        </div>

        {/* Collapsed state with ONE route stop: 100% visible, extra rounded and compact above nav bar */}
        {!isExpanded && currentSelectedStep && (
          <div
            onClick={() => setIsExpanded(true)}
            className="px-4 pb-1 cursor-pointer"
          >
            <div
              className={`py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-[28px] flex items-center justify-between gap-3 transition-all ${
                isDark
                  ? 'bg-white/[0.07] backdrop-blur-xl border border-white/25 ring-1 ring-white/10 shadow-md'
                  : 'ios-glass-white text-zinc-900 shadow-md'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 self-center">
                <span className="w-7 h-7 rounded-full text-[11px] font-black flex items-center justify-center leading-none text-center bg-blue-600 text-white shadow-md shadow-blue-600/40 shrink-0 self-center">
                  {String(
                    Math.max(
                      1,
                      activeSteps.findIndex((s) => s.id === currentSelectedStep.id) + 1
                    )
                  ).padStart(2, '0')}
                </span>
                {currentSelectedStep.spot?.image && (
                  <div className="w-12 h-12 rounded-[16px] overflow-hidden shrink-0 bg-zinc-800 relative self-center">
                    <img
                      src={currentSelectedStep.spot.image}
                      alt={currentSelectedStep.spot.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=200&q=80';
                      }}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 flex flex-col justify-center self-center py-0.5">
                  <div className="flex items-center gap-1.5 flex-nowrap leading-none">
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-blue-600 dark:text-blue-400 leading-none">
                      <Clock className="w-3 h-3 shrink-0" />
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
                    <Navigation className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>{currentSelectedStep.durationToNextMin ? `${currentSelectedStep.durationToNextMin} min até o próximo ponto` : 'Parada planejada do roteiro'}</span>
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-800/60 text-zinc-400 dark:text-zinc-300 shrink-0 self-center">
                <ChevronRight className="w-4 h-4 stroke-[2.2]" />
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Sequential Stops List (when expanded) - Matching the exact visual identity of Foto 1 */}
        {isExpanded && (
          <div
            className="flex-1 overflow-y-auto px-4 sm:px-5 py-1.5 space-y-2"
            style={{
              paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 16px))',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <AnimatePresence mode="popLayout">
              {activeSteps.map((step, idx) => (
                <SwipeableStopCard
                  key={step.id}
                  step={step}
                  idx={idx}
                  totalSteps={activeSteps.length}
                  isSelected={step.id === currentSelectedStep?.id}
                  isDark={isDark}
                  onSelect={handleSelectStopOnMap}
                  onDelete={handleDeleteStep}
                  onMoveUp={handleMoveStepUp}
                  onMoveDown={handleMoveStepDown}
                />
              ))}
            </AnimatePresence>

            {/* Bottom padding spacer to ensure smooth scroll clearance above bottom nav */}
            <div className="h-2" />
          </div>
        )}
      </motion.div>

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
        />
      )}

      {/* 6. Notes Modal (Anotações da viagem) */}
      <AnimatePresence>
        {isNotesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsNotesModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className={`relative w-full max-w-lg rounded-[28px] p-6 sm:p-7 z-10 flex flex-col gap-4 overflow-hidden ${
                isDark
                  ? 'ios-glass text-white shadow-2xl border border-white/12'
                  : 'ios-glass-white text-zinc-900 shadow-2xl border border-white/80'
              }`}
            >
              {/* Close Button X */}
              <button
                type="button"
                onClick={() => setIsNotesModalOpen(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>

              {/* Header */}
              <div className="flex flex-col gap-0.5 pr-8">
                <div className="flex items-center gap-2">
                  <Notebook className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 stroke-[2]" />
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                    Anotações da viagem
                  </h3>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-zinc-400 dark:text-zinc-500">
                  Campos do Jordão
                </p>
              </div>

              {/* Text Area */}
              <div className="relative mt-1">
                <textarea
                  rows={7}
                  value={tripNoteText}
                  onChange={(e) => setTripNoteText(e.target.value)}
                  placeholder="Escreva uma anotação sobre sua viagem..."
                  className="w-full p-4 pr-12 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-white/70 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-normal text-sm sm:text-base leading-relaxed outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={toggleDictation}
                  className={`absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                    isListeningNote
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-blue-600 hover:text-white'
                  }`}
                  title={isListeningNote ? 'Ouvindo... toque para parar' : 'Ditar por voz'}
                >
                  <Mic className="w-4 h-4 stroke-[2]" />
                </button>
              </div>

              {/* Footer / Save Button */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  {isNoteSavedToast ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 transition-all">
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Salvo com sucesso
                    </span>
                  ) : (
                    <span>Sua anotação é salva localmente</span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => handleSaveTripNote(tripNoteText)}
                  className="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs sm:text-sm font-bold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Salvar</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
