import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Compass,
  Calendar,
  MapPin,
  Home,
  UtensilsCrossed,
  Coffee,
  Building2,
  Mountain,
  Trees,
  ShoppingBag,
  Heart,
  Camera,
  User,
  Users,
  Baby,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Loader2,
  Sparkles,
  Clock,
  CalendarDays,
  HelpCircle,
} from 'lucide-react';
import { gpsNavigationManager } from '../services/gpsNavigation';
import { deviceHeadingManager } from '../utils/deviceHeading';
import {
  saveUserPermissionsToDatabase,
  persistUserOnboardingToFirestore,
} from '../services/firestoreSync';

export interface TravelerOnboardingPreferences {
  campos_relationship: string;
  next_trip_timing: string;
  next_trip_date: string;
  interest_categories: string[];
  travel_company: string;
  location_preference: string;
  location_permission_granted?: number;
  onboarding_step?: number;
  onboarding_completed?: number;
}

export const CAMPOS_RELATIONSHIP_OPTIONS = [
  {
    id: 'visiting',
    value: 'Estou visitando a cidade.',
    label: 'Estou visitando a cidade.',
    subtitle: 'Já estou em Campos do Jordão aproveitando a serra',
    icon: MapPin,
  },
  {
    id: 'planning',
    value: 'Pretendo visitar em breve.',
    label: 'Pretendo visitar em breve.',
    subtitle: 'Estou planejando minha próxima viagem',
    icon: Calendar,
  },
  {
    id: 'resident',
    value: 'Moro em Campos do Jordão.',
    label: 'Moro em Campos do Jordão.',
    subtitle: 'Vivo na cidade e busco novas experiências locais',
    icon: Home,
  },
  {
    id: 'exploring',
    value: 'Estou apenas explorando.',
    label: 'Estou apenas explorando.',
    subtitle: 'Quero conhecer os roteiros e lugares do Monvian',
    icon: Compass,
  },
] as const;

export const NEXT_TRIP_TIMING_OPTIONS = [
  {
    id: 'today',
    value: 'Hoje.',
    label: 'Hoje.',
    subtitle: 'Quero aproveitar experiências ainda hoje',
    icon: Sparkles,
  },
  {
    id: 'next_days',
    value: 'Nos próximos dias.',
    label: 'Nos próximos dias.',
    subtitle: 'Minha viagem acontece ainda esta semana',
    icon: Clock,
  },
  {
    id: 'next_weeks',
    value: 'Nas próximas semanas.',
    label: 'Nas próximas semanas.',
    subtitle: 'Estou organizando meu roteiro com antecedência',
    icon: CalendarDays,
  },
  {
    id: 'no_date',
    value: 'Ainda não tenho uma data.',
    label: 'Ainda não tenho uma data.',
    subtitle: 'Estou pesquisando ideias para quando decidir ir',
    icon: HelpCircle,
  },
] as const;

export const INTEREST_CATEGORY_OPTIONS = [
  {
    id: 'restaurants',
    value: 'Restaurantes e gastronomia.',
    label: 'Restaurantes e gastronomia.',
    icon: UtensilsCrossed,
  },
  {
    id: 'cafes',
    value: 'Cafés e cafeterias.',
    label: 'Cafés e cafeterias.',
    icon: Coffee,
  },
  {
    id: 'hotels',
    value: 'Hotéis e hospedagens.',
    label: 'Hotéis e hospedagens.',
    icon: Building2,
  },
  {
    id: 'tours',
    value: 'Passeios e aventuras.',
    label: 'Passeios e aventuras.',
    icon: Mountain,
  },
  {
    id: 'nature',
    value: 'Natureza e paisagens.',
    label: 'Natureza e paisagens.',
    icon: Trees,
  },
  {
    id: 'shopping',
    value: 'Compras e lojas.',
    label: 'Compras e lojas.',
    icon: ShoppingBag,
  },
  {
    id: 'romantic',
    value: 'Experiências românticas.',
    label: 'Experiências românticas.',
    icon: Heart,
  },
  {
    id: 'attractions',
    value: 'Atrações turísticas.',
    label: 'Atrações turísticas.',
    icon: Camera,
  },
] as const;

export const TRAVEL_COMPANY_OPTIONS = [
  {
    id: 'solo',
    value: 'Viajo sozinho.',
    label: 'Viajo sozinho.',
    subtitle: 'Experiências no meu próprio ritmo',
    icon: User,
  },
  {
    id: 'couple',
    value: 'A dois.',
    label: 'A dois.',
    subtitle: 'Momentos especiais em casal',
    icon: Heart,
  },
  {
    id: 'friends',
    value: 'Com amigos.',
    label: 'Com amigos.',
    subtitle: 'Gastronomia, passeios e diversão em grupo',
    icon: Users,
  },
  {
    id: 'family',
    value: 'Com minha família.',
    label: 'Com minha família.',
    subtitle: 'Roteiros acolhedores para todos',
    icon: Home,
  },
  {
    id: 'kids',
    value: 'Com crianças.',
    label: 'Com crianças.',
    subtitle: 'Parques, natureza e atrações para os pequenos',
    icon: Baby,
  },
] as const;

interface OnboardingFlowProps {
  user: any;
  theme?: 'dark' | 'light';
  initialStep?: number;
  onComplete: (updatedUser?: any, preferences?: TravelerOnboardingPreferences) => void;
}

const TOTAL_STEPS = 4;

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function triggerSubtleHaptic() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {}
}

function toIsoDateString(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function parseIsoDateParts(iso: string): { year: number; monthIndex: number; day: number } | null {
  if (!iso || typeof iso !== 'string') return null;
  const parts = iso.trim().split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }
  return { year, monthIndex, day };
}

function formatTripPeriodSummary(startIso: string, endIso: string): string {
  const s = parseIsoDateParts(startIso);
  if (!s) return '';
  const e = parseIsoDateParts(endIso);
  if (!e || startIso === endIso) {
    return `${s.day} de ${MONTH_NAMES_PT[s.monthIndex]}`;
  }
  if (s.monthIndex === e.monthIndex && s.year === e.year) {
    return `${s.day} a ${e.day} de ${MONTH_NAMES_PT[s.monthIndex]}`;
  }
  return `${s.day} de ${MONTH_NAMES_PT[s.monthIndex].slice(0, 3)} a ${e.day} de ${MONTH_NAMES_PT[e.monthIndex]}`;
}

/**
 * Custom Monochrome 3D-Depth Category & Relationship Icons
 * Matches the tactile sculpted monochrome icons in the reference screenshots
 */
const Monochrome3DCategoryIcon: React.FC<{
  categoryId: string;
  isDark: boolean;
}> = ({ categoryId, isDark }) => {
  const color = isDark ? '#FFFFFF' : '#121214';
  const shadowFilter = isDark
    ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))'
    : 'drop-shadow(0 2.5px 3.5px rgba(0,0,0,0.22))';

  switch (categoryId) {
    case 'restaurants':
      return (
        <svg
          viewBox="0 0 28 28"
          className="w-[26px] h-[26px]"
          style={{ filter: shadowFilter }}
          fill="none"
        >
          <UtensilsCrossed
            className="w-full h-full"
            color={color}
            strokeWidth={2.2}
          />
        </svg>
      );
    case 'cafes':
      return (
        <svg
          viewBox="0 0 28 28"
          className="w-[26px] h-[26px]"
          style={{ filter: shadowFilter }}
          fill="none"
        >
          <path
            d="M9.5 5.2C9.5 6.4 10.3 7.0 10.3 8.2M13.5 4.5C13.5 5.9 14.4 6.6 14.4 8.0M17.5 5.2C17.5 6.4 18.3 7.0 18.3 8.2"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6.5 10.5H19.5V16.2C19.5 19.8 16.6 22.5 13 22.5C9.4 22.5 6.5 19.8 6.5 16.2V10.5Z"
            fill={color}
          />
          <path
            d="M19.5 12H21.2C22.7 12 23.8 13.1 23.8 14.6C23.8 16.1 22.7 17.2 21.2 17.2H19.2"
            stroke={color}
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'hotels':
      return (
        <svg
          viewBox="0 0 28 28"
          className="w-[26px] h-[26px]"
          style={{ filter: shadowFilter }}
          fill="none"
        >
          <Building2 className="w-full h-full" color={color} strokeWidth={2.1} />
        </svg>
      );
    case 'tours':
      return (
        <svg
          viewBox="0 0 30 26"
          className="w-[28px] h-[25px]"
          style={{ filter: shadowFilter }}
          fill="none"
        >
          <path d="M3 22L11.5 7.5L18.5 22H3Z" fill={color} />
          <path d="M12.5 22L19.5 9.5L27 22H12.5Z" fill={color} fillOpacity="0.88" />
          <path
            d="M11.5 7.5L9.1 11.6L11.2 12.8L13.6 11.2L11.5 7.5Z"
            fill={isDark ? '#1C1C1E' : '#FFFFFF'}
          />
          <path
            d="M19.5 9.5L17.4 13.1L19.4 14.2L21.5 12.9L19.5 9.5Z"
            fill={isDark ? '#1C1C1E' : '#FFFFFF'}
          />
        </svg>
      );
    case 'nature':
      return (
        <svg
          viewBox="0 0 28 28"
          className="w-[26px] h-[26px]"
          style={{ filter: shadowFilter }}
          fill="none"
        >
          <Trees className="w-full h-full" color={color} strokeWidth={2.1} />
        </svg>
      );
    case 'shopping':
      return (
        <svg
          viewBox="0 0 28 28"
          className="w-[25px] h-[25px]"
          style={{ filter: shadowFilter }}
          fill="none"
        >
          <path
            d="M10.2 9.5V7.8C10.2 5.7 11.9 4 14 4C16.1 4 17.8 5.7 17.8 7.8V9.5"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <rect
            x="6.5"
            y="9"
            width="15"
            height="14.5"
            rx="3.2"
            fill={color}
          />
        </svg>
      );
    case 'romantic':
      return (
        <svg
          viewBox="0 0 28 28"
          className="w-[25px] h-[25px]"
          style={{ filter: shadowFilter }}
          fill="none"
        >
          <Heart className="w-full h-full" color={color} strokeWidth={2.4} />
        </svg>
      );
    case 'attractions':
    default:
      return (
        <svg
          viewBox="0 0 28 28"
          className="w-[25px] h-[25px]"
          style={{ filter: shadowFilter }}
          fill="none"
        >
          <path
            d="M4.5 10.5C4.5 8.84315 5.84315 7.5 7.5 7.5H9.2L10.6 5.4C10.95 4.85 11.55 4.5 12.2 4.5H15.8C16.45 4.5 17.05 4.85 17.4 5.4L18.8 7.5H20.5C22.1569 7.5 23.5 8.84315 23.5 10.5V19.5C23.5 21.1569 22.1569 22.5 20.5 22.5H7.5C5.84315 22.5 4.5 21.1569 4.5 19.5V10.5Z"
            fill={color}
          />
          <circle
            cx="14"
            cy="14.8"
            r="4.2"
            fill={isDark ? '#1C1C1E' : '#FFFFFF'}
          />
          <circle cx="14" cy="14.8" r="2.3" fill={color} />
        </svg>
      );
  }
};

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  user,
  theme = 'light',
  initialStep = 1,
  onComplete,
}) => {
  const isDark = theme === 'dark';
  const prefersReducedMotion = Boolean(useReducedMotion());

  const [step, setStep] = useState<number>(() => {
    const start = Number(initialStep || user?.onboarding_step || 1);
    return Math.max(1, Math.min(TOTAL_STEPS, start));
  });
  const [direction, setDirection] = useState<1 | -1>(1);

  // Step 1: Relação com Campos do Jordão
  const [camposRelationship, setCamposRelationship] = useState<string>(
    () => user?.campos_relationship || 'Estou visitando a cidade.'
  );

  // Step 2: Data da viagem (Calendário funcional com data de chegada e partida)
  const initialDateRange = useMemo(() => {
    const raw = String(user?.next_trip_date || '').trim();
    if (raw.includes('..')) {
      const [s, e] = raw.split('..');
      return { start: s || '', end: e || s || '' };
    }
    if (raw) {
      return { start: raw, end: raw };
    }
    return { start: '', end: '' };
  }, [user?.next_trip_date]);

  const [arrivalDate, setArrivalDate] = useState<string>(initialDateRange.start);
  const [departureDate, setDepartureDate] = useState<string>(initialDateRange.end);
  const [hasNoDefinedDate, setHasNoDefinedDate] = useState<boolean>(
    () => user?.next_trip_timing === 'Ainda não tenho uma data.'
  );

  const [calendarMonth, setCalendarMonth] = useState<{ year: number; monthIndex: number }>(() => {
    const parsed = parseIsoDateParts(initialDateRange.start);
    if (parsed) {
      return { year: parsed.year, monthIndex: parsed.monthIndex };
    }
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  });

  // Step 3: Preferências (8 categorias)
  const [interestCategories, setInterestCategories] = useState<string[]>(() =>
    Array.isArray(user?.interest_categories) ? user.interest_categories : []
  );

  // Preserve travel_company if already set or edited in profile
  const [travelCompany, setTravelCompany] = useState<string>(
    () => user?.travel_company || ''
  );

  // Step 4: Localização
  const [locationPreference, setLocationPreference] = useState<string>(
    () => user?.location_preference || ''
  );
  const [isRequestingLocation, setIsRequestingLocation] = useState<boolean>(false);

  const cleanEmail = String(user?.email || user?.whatsapp || '')
    .trim()
    .toLowerCase();

  // Load any saved partial onboarding answers on mount
  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('monvian_token');
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cleanEmail) headers['x-user-email'] = cleanEmail;

    fetch(`/api/user/onboarding?email=${encodeURIComponent(cleanEmail)}`, {
      headers,
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.preferences) return;
        const p = data.preferences;
        if (p.campos_relationship) setCamposRelationship(p.campos_relationship);
        if (p.next_trip_date) {
          const rawDate = String(p.next_trip_date);
          if (rawDate.includes('..')) {
            const [s, e] = rawDate.split('..');
            setArrivalDate(s || '');
            setDepartureDate(e || s || '');
            const parsed = parseIsoDateParts(s);
            if (parsed) {
              setCalendarMonth({ year: parsed.year, monthIndex: parsed.monthIndex });
            }
          } else {
            setArrivalDate(rawDate);
            setDepartureDate(rawDate);
            const parsed = parseIsoDateParts(rawDate);
            if (parsed) {
              setCalendarMonth({ year: parsed.year, monthIndex: parsed.monthIndex });
            }
          }
        }
        if (p.next_trip_timing === 'Ainda não tenho uma data.') {
          setHasNoDefinedDate(true);
        }
        if (Array.isArray(p.interest_categories) && p.interest_categories.length > 0) {
          setInterestCategories(p.interest_categories);
        }
        if (p.travel_company) setTravelCompany(p.travel_company);
        if (p.location_preference) setLocationPreference(p.location_preference);
        if (
          typeof p.onboarding_step === 'number' &&
          p.onboarding_step >= 1 &&
          p.onboarding_step <= TOTAL_STEPS &&
          p.onboarding_completed === 0
        ) {
          setStep(p.onboarding_step);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [cleanEmail]);

  const buildTripDateValues = useCallback(() => {
    if (hasNoDefinedDate || !arrivalDate) {
      return {
        next_trip_timing: 'Ainda não tenho uma data.',
        next_trip_date: '',
      };
    }
    const end = departureDate || arrivalDate;
    const summary = formatTripPeriodSummary(arrivalDate, end);
    return {
      next_trip_timing: summary,
      next_trip_date: arrivalDate === end ? arrivalDate : `${arrivalDate}..${end}`,
    };
  }, [hasNoDefinedDate, arrivalDate, departureDate]);

  const persistStepToBackend = useCallback(
    async (
      nextStepNumber: number,
      overrides?: Partial<TravelerOnboardingPreferences>,
      markComplete: boolean = false
    ) => {
      const tripValues = buildTripDateValues();
      const payload: TravelerOnboardingPreferences & { email?: string } = {
        email: cleanEmail,
        campos_relationship:
          overrides?.campos_relationship !== undefined
            ? overrides.campos_relationship
            : camposRelationship,
        next_trip_timing:
          overrides?.next_trip_timing !== undefined
            ? overrides.next_trip_timing
            : tripValues.next_trip_timing,
        next_trip_date:
          overrides?.next_trip_date !== undefined
            ? overrides.next_trip_date
            : tripValues.next_trip_date,
        interest_categories:
          overrides?.interest_categories !== undefined
            ? overrides.interest_categories
            : interestCategories,
        travel_company:
          overrides?.travel_company !== undefined
            ? overrides.travel_company
            : travelCompany,
        location_preference:
          overrides?.location_preference !== undefined
            ? overrides.location_preference
            : locationPreference,
        location_permission_granted:
          overrides?.location_permission_granted !== undefined
            ? overrides.location_permission_granted
            : (overrides?.location_preference || locationPreference) === 'granted'
              ? 1
              : Number(user?.location_permission_granted || 0),
        onboarding_step: Math.min(TOTAL_STEPS, Math.max(1, nextStepNumber)),
        onboarding_completed: markComplete ? 1 : 0,
      };

      try {
        if (cleanEmail) {
          localStorage.setItem(
            `monvian_onboarding_prefs_${cleanEmail}`,
            JSON.stringify(payload)
          );
        }
        const savedUserRaw = localStorage.getItem('monvian_user');
        if (savedUserRaw) {
          const parsed = JSON.parse(savedUserRaw);
          const merged = { ...parsed, ...payload };
          localStorage.setItem('monvian_user', JSON.stringify(merged));
        }
      } catch {}

      if (cleanEmail) {
        persistUserOnboardingToFirestore({
          user_id: user?.id ? String(user.id) : '',
          user_email: cleanEmail,
          ...payload,
        }).catch(() => {});
      }

      const token = localStorage.getItem('monvian_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (cleanEmail) headers['x-user-email'] = cleanEmail;

      const endpoint = markComplete
        ? '/api/user/onboarding/complete'
        : '/api/user/onboarding/step';

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
      return null;
    },
    [
      cleanEmail,
      camposRelationship,
      buildTripDateValues,
      interestCategories,
      travelCompany,
      locationPreference,
      user?.id,
      user?.location_permission_granted,
    ]
  );

  const goToStep = useCallback(
    (targetStep: number, overrides?: Partial<TravelerOnboardingPreferences>) => {
      triggerSubtleHaptic();
      setDirection(targetStep >= step ? 1 : -1);
      setStep(targetStep);
      void persistStepToBackend(targetStep, overrides, false);
    },
    [step, persistStepToBackend]
  );

  const handleBack = useCallback(() => {
    if (step <= 1) return;
    triggerSubtleHaptic();
    const prev = step - 1;
    setDirection(-1);
    setStep(prev);
  }, [step]);

  // Complete all 4 steps of onboarding and transition immediately to original Monvian Welcome Screen
  const finalizeFourStepOnboarding = useCallback(
    async (locPref: 'granted' | 'skipped' | 'prompted', locGranted: boolean, coords?: [number, number]) => {
      if (locGranted) {
        saveUserPermissionsToDatabase({
          locationGranted: true,
          motionGranted: true,
          coords,
          email: cleanEmail,
        }).catch(() => {});
      }

      const tripValues = buildTripDateValues();
      const finalPreferences: TravelerOnboardingPreferences = {
        campos_relationship: camposRelationship,
        next_trip_timing: tripValues.next_trip_timing,
        next_trip_date: tripValues.next_trip_date,
        interest_categories: interestCategories,
        travel_company: travelCompany,
        location_preference: locPref,
        location_permission_granted: locGranted ? 1 : 0,
        onboarding_step: 4,
        onboarding_completed: 1,
      };

      const result = await persistStepToBackend(4, finalPreferences, true);
      const updatedUser = result?.user || {
        ...(user || {}),
        ...finalPreferences,
        onboarding_completed: 1,
      };

      onComplete(updatedUser, finalPreferences);
    },
    [
      cleanEmail,
      buildTripDateValues,
      camposRelationship,
      interestCategories,
      travelCompany,
      persistStepToBackend,
      user,
      onComplete,
    ]
  );

  // Automatically prompt for native iPhone Location & Motion permission upon entering Step 4 ("Descubra o que está ao seu redor.")
  useEffect(() => {
    if (step !== 4) return;
    let active = true;

    try {
      gpsNavigationManager.requestPermissionAndStartFromGesture();
      if (
        deviceHeadingManager.isPermissionRequired() &&
        !deviceHeadingManager.isPermissionHandled()
      ) {
        deviceHeadingManager.requestPermission().catch(() => {});
      }
      deviceHeadingManager.start();
    } catch {}

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!active) return;
          const coords: [number, number] = [
            Number(pos.coords.longitude),
            Number(pos.coords.latitude),
          ];
          setLocationPreference('granted');
          saveUserPermissionsToDatabase({
            locationGranted: true,
            motionGranted: true,
            coords,
            email: cleanEmail,
          }).catch(() => {});
        },
        () => {},
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 15000,
        }
      );
    }

    return () => {
      active = false;
    };
  }, [step, cleanEmail]);

  const handleActivateLocation = async () => {
    if (isRequestingLocation) return;
    triggerSubtleHaptic();
    setIsRequestingLocation(true);

    // Synchronously invoke iPhone Safari geolocation & motion permission from user tap gesture
    try {
      gpsNavigationManager.requestPermissionAndStartFromGesture();
      if (deviceHeadingManager.isPermissionRequired()) {
        deviceHeadingManager.requestPermission().catch(() => {});
      }
      deviceHeadingManager.start();
    } catch {}

    let granted = false;
    let coords: [number, number] | undefined;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 15000,
          });
        });
        granted = true;
        coords = [Number(pos.coords.longitude), Number(pos.coords.latitude)];
      } catch {
        granted = gpsNavigationManager.getState().status === 'granted';
      }
    }

    const prefValue = granted ? 'granted' : 'prompted';
    setLocationPreference(prefValue);
    await finalizeFourStepOnboarding(prefValue, granted, coords);
    setIsRequestingLocation(false);
  };

  const handleSkipLocation = async () => {
    if (isRequestingLocation) return;
    triggerSubtleHaptic();
    setIsRequestingLocation(true);
    setLocationPreference('skipped');
    await finalizeFourStepOnboarding('skipped', false);
    setIsRequestingLocation(false);
  };

  // Calendar grid helper for Step 2
  const calendarCells = useMemo(() => {
    const { year, monthIndex } = calendarMonth;
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const cells: Array<{ day: number | null; iso: string }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, iso: `empty-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        iso: toIsoDateString(year, monthIndex, d),
      });
    }
    return cells;
  }, [calendarMonth]);

  const handleSelectCalendarDay = (iso: string) => {
    triggerSubtleHaptic();
    setHasNoDefinedDate(false);

    if (!arrivalDate || (arrivalDate && departureDate && arrivalDate !== departureDate)) {
      setArrivalDate(iso);
      setDepartureDate(iso);
      return;
    }

    if (iso < arrivalDate) {
      setArrivalDate(iso);
      setDepartureDate(arrivalDate);
    } else {
      setDepartureDate(iso);
    }
  };

  const handlePrevMonth = () => {
    triggerSubtleHaptic();
    setCalendarMonth((prev) => {
      if (prev.monthIndex === 0) {
        return { year: prev.year - 1, monthIndex: 11 };
      }
      return { year: prev.year, monthIndex: prev.monthIndex - 1 };
    });
  };

  const handleNextMonth = () => {
    triggerSubtleHaptic();
    setCalendarMonth((prev) => {
      if (prev.monthIndex === 11) {
        return { year: prev.year + 1, monthIndex: 0 };
      }
      return { year: prev.year, monthIndex: prev.monthIndex + 1 };
    });
  };

  const handleToggleInterest = (val: string) => {
    triggerSubtleHaptic();
    setInterestCategories((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
  };

  const slideVariants = {
    enter: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir > 0 ? 26 : -26 },
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir > 0 ? -26 : 26 },
  };

  const tripSummaryLabel = useMemo(() => {
    if (hasNoDefinedDate || !arrivalDate) return '';
    return formatTripPeriodSummary(arrivalDate, departureDate || arrivalDate);
  }, [hasNoDefinedDate, arrivalDate, departureDate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-0 z-[260] w-full flex flex-col select-none overflow-hidden ${
        isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#080808]'
      }`}
      style={{
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top Bar: Circular Back Button + 4 Horizontal Progress Dots */}
      <header
        className="w-full max-w-md mx-auto px-6 shrink-0 flex items-center justify-between"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 14px), 24px)',
          paddingBottom: '8px',
        }}
      >
        <div className="w-11 h-11 flex items-center justify-start">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Voltar para a etapa anterior"
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
                isDark
                  ? 'bg-[#1C1C1E] border-white/10 text-white hover:bg-[#2C2C2E]'
                  : 'bg-[#F7F7F9] border-black/[0.06] text-[#080808] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-[#EFEFF2]'
              }`}
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
          ) : (
            <div className="w-11 h-11" />
          )}
        </div>

        {/* 4 Bolinhas Alinhadas Horizontalmente (Etapa atual em preto, futuras em cinza-claro) */}
        <div
          className="flex items-center justify-center gap-3"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label={`Etapa ${step} de ${TOTAL_STEPS}`}
        >
          {[1, 2, 3, 4].map((dotIdx) => {
            const isCurrent = dotIdx === step;
            return (
              <motion.span
                key={dotIdx}
                layout
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={`block w-3 h-3 rounded-full transition-colors duration-300 ${
                  isCurrent
                    ? isDark
                      ? 'bg-[#FFFFFF]'
                      : 'bg-[#080808]'
                    : isDark
                      ? 'bg-[#2C2C2E]'
                      : 'bg-[#E2E2E7]'
                }`}
              />
            );
          })}
        </div>

        <div className="w-11 h-11" />
      </header>

      {/* Main Step Viewport */}
      <div className="flex-1 w-full max-w-md mx-auto px-6 overflow-y-auto scrollbar-none flex flex-col justify-between py-4">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ============================================================== */}
          {/* TELA 1 — RELAÇÃO COM CAMPOS DO JORDÃO                          */}
          {/* ============================================================== */}
          {step === 1 && (
            <motion.div
              key="onboarding-step-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="space-y-6">
                <div className="space-y-2.5 pt-2">
                  <h1 className="text-[29px] sm:text-[32px] font-bold tracking-[-0.03em] leading-[1.12]">
                    Qual é a sua relação com Campos do Jordão?
                  </h1>
                  <p
                    className={`text-[15.5px] leading-[1.42] font-normal ${
                      isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                    }`}
                  >
                    Queremos conhecer você para tornar sua experiência ainda melhor.
                  </p>
                </div>

                <div className="space-y-3.5 pt-1">
                  {CAMPOS_RELATIONSHIP_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = camposRelationship === option.value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setCamposRelationship(option.value);
                          goToStep(2, { campos_relationship: option.value });
                        }}
                        className={`w-full p-4 sm:p-4.5 rounded-[28px] border text-left transition-all duration-200 active:scale-[0.985] cursor-pointer flex items-center justify-between gap-3.5 ${
                          isDark
                            ? isSelected
                              ? 'bg-[#1C1C1E] border-white/25 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.65)]'
                              : 'bg-[#141416] border-white/[0.08] hover:bg-[#1C1C1E]'
                            : isSelected
                              ? 'bg-[#F9F9FB] border-black/[0.09] shadow-[0_10px_26px_-10px_rgba(0,0,0,0.08)]'
                              : 'bg-[#FBFBFD] border-black/[0.06] shadow-[0_6px_20px_-10px_rgba(0,0,0,0.05)] hover:bg-[#F5F5F8]'
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Tactile 3D-Depth Squircle Icon Badge */}
                          <div
                            className={`w-[58px] h-[58px] rounded-[20px] flex items-center justify-center shrink-0 border ${
                              isDark
                                ? 'bg-gradient-to-b from-[#2C2C2E] to-[#1C1C1E] border-white/10 shadow-[0_6px_14px_rgba(0,0,0,0.45)]'
                                : 'bg-gradient-to-b from-[#FFFFFF] to-[#EFEFF4] border-white shadow-[0_6px_14px_rgba(0,0,0,0.07),inset_0_1px_1px_rgba(255,255,255,0.95)]'
                            }`}
                          >
                            <Icon
                              className="w-[26px] h-[26px] stroke-[2.2]"
                              style={{
                                filter: isDark
                                  ? 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))'
                                  : 'drop-shadow(0 2px 3px rgba(0,0,0,0.16))',
                              }}
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[16.5px] font-bold tracking-[-0.02em] leading-snug">
                              {option.label}
                            </p>
                            <p
                              className={`text-[13.5px] mt-0.5 leading-snug ${
                                isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                              }`}
                            >
                              {option.subtitle}
                            </p>
                          </div>
                        </div>

                        {/* Animated iOS Radio Circle */}
                        <div
                          className={`w-[25px] h-[25px] rounded-full flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? isDark
                                ? 'border-[2px] border-[#FFFFFF]'
                                : 'border-[2px] border-[#080808]'
                              : isDark
                                ? 'border-[1.6px] border-white/20'
                                : 'border-[1.6px] border-[#D1D1D6]'
                          }`}
                        >
                          {isSelected && (
                            <motion.span
                              initial={{ scale: 0.4, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={`w-[13px] h-[13px] rounded-full ${
                                isDark ? 'bg-[#FFFFFF]' : 'bg-[#080808]'
                              }`}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TELA 2 — DATA DA VIAGEM (CALENDÁRIO INTERATIVO DE PERÍODO)     */}
          {/* ============================================================== */}
          {step === 2 && (
            <motion.div
              key="onboarding-step-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                <div className="space-y-1.5 pt-1">
                  <h1 className="text-[28px] sm:text-[31px] font-bold tracking-[-0.03em] leading-[1.12]">
                    Quando será sua próxima experiência em Campos?
                  </h1>
                  <p
                    className={`text-[15.5px] leading-snug font-normal ${
                      isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                    }`}
                  >
                    Escolha o período da sua viagem.
                  </p>
                </div>

                {/* Interactive Calendar Card */}
                <div
                  className={`rounded-[30px] p-5 border ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.65)]'
                      : 'bg-[#FBFBFD] border-black/[0.05] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.07)]'
                  }`}
                >
                  {/* Month Navigation Header */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      aria-label="Mês anterior"
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 active:scale-95 cursor-pointer ${
                        isDark ? 'text-white' : 'text-[#080808]'
                      }`}
                    >
                      <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
                    </button>

                    <span className="text-[16.5px] font-bold tracking-[-0.02em]">
                      {MONTH_NAMES_PT[calendarMonth.monthIndex]} de {calendarMonth.year}
                    </span>

                    <button
                      type="button"
                      onClick={handleNextMonth}
                      aria-label="Próximo mês"
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 active:scale-95 cursor-pointer ${
                        isDark ? 'text-white' : 'text-[#080808]'
                      }`}
                    >
                      <ChevronRight className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  </div>

                  {/* Weekday Labels */}
                  <div className="grid grid-cols-7 text-center mb-2">
                    {WEEKDAYS_PT.map((wd) => (
                      <span
                        key={wd}
                        className={`text-[12.5px] font-medium py-1 ${
                          isDark ? 'text-[#8E8E93]' : 'text-[#8E8E93]'
                        }`}
                      >
                        {wd}
                      </span>
                    ))}
                  </div>

                  {/* Days Grid with Continuous Period Highlight */}
                  <div className="grid grid-cols-7 gap-y-1.5 text-center">
                    {calendarCells.map((cell, idx) => {
                      if (!cell.day) {
                        return <div key={cell.iso} className="h-[40px]" />;
                      }

                      const effectiveEnd = departureDate || arrivalDate;
                      const isRangeActive =
                        !hasNoDefinedDate && Boolean(arrivalDate);
                      const isStart = isRangeActive && cell.iso === arrivalDate;
                      const isEnd = isRangeActive && cell.iso === effectiveEnd;
                      const isInRange =
                        isRangeActive &&
                        cell.iso >= arrivalDate &&
                        cell.iso <= effectiveEnd;
                      const isSingleDay = isStart && isEnd;

                      const colIndex = idx % 7;
                      const isRowStart = colIndex === 0;
                      const isRowEnd = colIndex === 6;

                      const roundLeft = isStart || (isInRange && isRowStart);
                      const roundRight = isEnd || (isInRange && isRowEnd);

                      return (
                        <div
                          key={cell.iso}
                          className="relative h-[40px] flex items-center justify-center"
                        >
                          {/* Continuous Pill Track across Selected Period */}
                          {isInRange && (
                            <div
                              className={`absolute inset-y-[2px] inset-x-0 ${
                                isDark ? 'bg-[#FFFFFF]' : 'bg-[#111113]'
                              } ${
                                isSingleDay
                                  ? 'rounded-full mx-auto w-[38px]'
                                  : `${roundLeft ? 'rounded-l-full left-[2px]' : ''} ${
                                      roundRight ? 'rounded-r-full right-[2px]' : ''
                                    }`
                              }`}
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleSelectCalendarDay(cell.iso)}
                            className={`relative z-10 w-[36px] h-[36px] rounded-full text-[15px] font-semibold tracking-[-0.01em] flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
                              isInRange
                                ? isDark
                                  ? 'text-[#080808] font-bold'
                                  : 'text-[#FFFFFF] font-bold'
                                : isDark
                                  ? 'text-[#FFFFFF] hover:bg-white/10'
                                  : 'text-[#080808] hover:bg-black/[0.05]'
                            }`}
                          >
                            {cell.day}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Trip Summary Card (Matches Image 3) */}
                {tripSummaryLabel && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-[24px] p-3.5 px-4 border flex items-center justify-between gap-3 ${
                      isDark
                        ? 'bg-[#1C1C1E] border-white/10'
                        : 'bg-[#FBFBFD] border-black/[0.06] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.05)]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-[50px] h-[50px] rounded-[16px] flex items-center justify-center shrink-0 border ${
                          isDark
                            ? 'bg-gradient-to-b from-[#2C2C2E] to-[#1C1C1E] border-white/10'
                            : 'bg-gradient-to-b from-[#FFFFFF] to-[#EFEFF4] border-white shadow-[0_4px_10px_rgba(0,0,0,0.07)]'
                        }`}
                      >
                        <Calendar className="w-[23px] h-[23px] stroke-[2.1]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14.5px] font-bold tracking-[-0.01em]">
                          Sua viagem:
                        </p>
                        <p className="text-[15.5px] font-bold tracking-[-0.02em] truncate">
                          {tripSummaryLabel}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerSubtleHaptic();
                        setArrivalDate('');
                        setDepartureDate('');
                      }}
                      aria-label="Editar datas da viagem"
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-white/10 text-white hover:bg-white/15'
                          : 'bg-[#F2F2F6] text-[#080808] hover:bg-[#E6E6EC]'
                      }`}
                    >
                      <Pencil className="w-4 h-4 stroke-[2.1]" />
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Bottom Action Buttons: "Ainda não tenho uma data" + "Próximo >" */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerSubtleHaptic();
                    setHasNoDefinedDate(true);
                    setArrivalDate('');
                    setDepartureDate('');
                    goToStep(3, {
                      next_trip_timing: 'Ainda não tenho uma data.',
                      next_trip_date: '',
                    });
                  }}
                  className={`w-full h-[52px] rounded-full font-semibold text-[15.5px] tracking-[-0.01em] transition-all active:scale-[0.985] cursor-pointer border ${
                    hasNoDefinedDate
                      ? isDark
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-[#EFEFF4] border-black/15 text-[#080808]'
                      : isDark
                        ? 'bg-[#1C1C1E] border-white/10 text-white hover:bg-[#252528]'
                        : 'bg-[#F9F9FB] border-black/[0.07] text-[#080808] hover:bg-[#F2F2F6]'
                  }`}
                >
                  Ainda não tenho uma data
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const tripVals = buildTripDateValues();
                    goToStep(3, tripVals);
                  }}
                  className={`w-full h-[56px] rounded-full font-semibold text-[16.5px] tracking-[-0.015em] flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                      : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                  }`}
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-5 h-5 stroke-[2.4]" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TELA 3 — PREFERÊNCIAS (GRADE 2 COLUNAS COM ÍCONES 3D DISCRETOS) */}
          {/* ============================================================== */}
          {step === 3 && (
            <motion.div
              key="onboarding-step-3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-5"
            >
              <div className="space-y-4">
                <div className="space-y-2 pt-1">
                  <h1 className="text-[29px] sm:text-[32px] font-bold tracking-[-0.03em] leading-[1.12]">
                    O que você gosta de descobrir?
                  </h1>
                  <p
                    className={`text-[15.5px] leading-snug font-normal ${
                      isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                    }`}
                  >
                    Selecione suas experiências favoritas.
                  </p>
                </div>

                {/* 2-Column Visual Grid Matching Reference Image 4 */}
                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  {INTEREST_CATEGORY_OPTIONS.map((item) => {
                    const isSelected = interestCategories.includes(item.value);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleInterest(item.value)}
                        className={`p-4 rounded-[26px] border text-left transition-all duration-200 active:scale-[0.975] cursor-pointer flex flex-col justify-between min-h-[126px] ${
                          isDark
                            ? isSelected
                              ? 'bg-[#1C1C1E] border-white/30 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.65)]'
                              : 'bg-[#141416] border-white/[0.08] hover:bg-[#1C1C1E]'
                            : isSelected
                              ? 'bg-[#F8F8FA] border-black/20 shadow-[0_10px_26px_-10px_rgba(0,0,0,0.09)]'
                              : 'bg-[#FBFBFD] border-black/[0.06] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.05)] hover:bg-[#F5F5F8]'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between">
                          {/* Circular 3D-Depth Badge */}
                          <div
                            className={`w-[52px] h-[52px] rounded-full flex items-center justify-center border ${
                              isDark
                                ? 'bg-gradient-to-b from-[#2C2C2E] to-[#1C1C1E] border-white/10 shadow-[0_6px_12px_rgba(0,0,0,0.45)]'
                                : 'bg-gradient-to-b from-[#FFFFFF] to-[#EFEFF4] border-white shadow-[0_6px_14px_rgba(0,0,0,0.07),inset_0_1px_1px_rgba(255,255,255,0.95)]'
                            }`}
                          >
                            <Monochrome3DCategoryIcon
                              categoryId={item.id}
                              isDark={isDark}
                            />
                          </div>

                          {/* Selection Circle */}
                          <div
                            className={`w-[23px] h-[23px] rounded-full flex items-center justify-center transition-all ${
                              isSelected
                                ? isDark
                                  ? 'border-[2px] border-[#FFFFFF]'
                                  : 'border-[2px] border-[#080808]'
                                : isDark
                                  ? 'border-[1.5px] border-white/20'
                                  : 'border-[1.5px] border-[#D1D1D6]'
                            }`}
                          >
                            {isSelected && (
                              <motion.span
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`w-[12px] h-[12px] rounded-full ${
                                  isDark ? 'bg-[#FFFFFF]' : 'bg-[#080808]'
                                }`}
                              />
                            )}
                          </div>
                        </div>

                        <p className="text-[15px] font-bold tracking-[-0.02em] leading-[1.22] mt-3">
                          {item.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() =>
                    goToStep(4, { interest_categories: interestCategories })
                  }
                  className={`w-full h-[56px] rounded-full font-semibold text-[16.5px] tracking-[-0.015em] flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                      : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                  }`}
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-5 h-5 stroke-[2.4]" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TELA 4 — LOCALIZAÇÃO (PEDESTAL 3D + PERMISSÃO NATIVA IPHONE)   */}
          {/* ============================================================== */}
          {step === 4 && (
            <motion.div
              key="onboarding-step-4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                {/* 3D Sculpted Navigation Pedestal with Concentric Ripples (Matches Reference Image 1) */}
                <div className="relative w-[220px] h-[220px] flex items-center justify-center mb-6">
                  {/* Outer Ripple Ring */}
                  <div
                    className={`absolute inset-0 rounded-full border ${
                      isDark
                        ? 'border-white/[0.06] bg-white/[0.01]'
                        : 'border-black/[0.045] bg-black/[0.008]'
                    }`}
                  />
                  {/* Middle Ripple Ring */}
                  <div
                    className={`absolute w-[174px] h-[174px] rounded-full border ${
                      isDark
                        ? 'border-white/[0.09] bg-white/[0.02]'
                        : 'border-black/[0.06] bg-white/60 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06)]'
                    }`}
                  />
                  {/* Elevated 3D Circular Pedestal */}
                  <div
                    className={`relative w-[136px] h-[136px] rounded-full flex items-center justify-center border ${
                      isDark
                        ? 'bg-gradient-to-b from-[#2C2C2E] to-[#18181A] border-white/15 shadow-[0_18px_36px_rgba(0,0,0,0.7),inset_0_2px_3px_rgba(255,255,255,0.15)]'
                        : 'bg-gradient-to-b from-[#FFFFFF] via-[#F9F9FB] to-[#EAEAEF] border-white shadow-[0_18px_36px_-10px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,1)]'
                    }`}
                  >
                    {/* 3D Sculpted Black Navigation Arrow */}
                    <svg
                      viewBox="0 0 64 64"
                      className="w-[68px] h-[68px]"
                      style={{
                        filter: isDark
                          ? 'drop-shadow(0 8px 12px rgba(0,0,0,0.65))'
                          : 'drop-shadow(0 8px 12px rgba(0,0,0,0.22))',
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="monvian3dNavGrad"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop
                            offset="0%"
                            stopColor={isDark ? '#FFFFFF' : '#2C2C30'}
                          />
                          <stop
                            offset="55%"
                            stopColor={isDark ? '#E5E5EA' : '#121214'}
                          />
                          <stop
                            offset="100%"
                            stopColor={isDark ? '#C7C7CC' : '#050506'}
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d="M52.8 11.2C54.1 12.5 54.4 14.5 53.6 16.2L37.4 51.4C36.5 53.3 34.4 54.3 32.4 53.7C30.5 53.1 29.2 51.4 29.0 49.4L27.3 36.7L14.6 35.0C12.6 34.8 10.9 33.5 10.3 31.6C9.7 29.6 10.7 27.5 12.6 26.6L47.8 10.4C49.5 9.6 51.5 9.9 52.8 11.2Z"
                        fill="url(#monvian3dNavGrad)"
                      />
                    </svg>
                  </div>
                </div>

                <h1 className="text-[29px] sm:text-[32px] font-bold tracking-[-0.03em] leading-[1.12] max-w-[320px]">
                  Descubra o que está ao seu redor.
                </h1>
                <p
                  className={`text-[15.5px] leading-[1.45] font-normal mt-3 max-w-[330px] ${
                    isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                  }`}
                >
                  Permita o acesso à sua localização para encontrar experiências, lugares e atrações próximas de você.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={isRequestingLocation}
                  onClick={handleActivateLocation}
                  className={`w-full h-[56px] rounded-full font-semibold text-[16.5px] tracking-[-0.015em] flex items-center justify-center gap-2.5 transition-all active:scale-[0.985] cursor-pointer shadow-sm ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                      : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                  }`}
                >
                  {isRequestingLocation ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Navigation className="w-5 h-5 stroke-[2.2]" />
                  )}
                  <span>Ativar localização</span>
                </button>

                <button
                  type="button"
                  disabled={isRequestingLocation}
                  onClick={handleSkipLocation}
                  className={`w-full h-[54px] rounded-full font-semibold text-[16px] tracking-[-0.01em] transition-all active:scale-[0.985] cursor-pointer border ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 text-white hover:bg-[#252528]'
                      : 'bg-[#FBFBFD] border-black/[0.08] text-[#080808] hover:bg-[#F2F2F6]'
                  }`}
                >
                  Continuar sem localização
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Safe Area Bottom Padding */}
      <div
        className="shrink-0"
        style={{
          height: 'max(env(safe-area-inset-bottom, 0px), 14px)',
        }}
      />
    </motion.div>
  );
};

export default OnboardingFlow;
