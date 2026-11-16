import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Compass,
  Calendar,
  MapPin,
  Home,
  Sparkles,
  Clock,
  CalendarDays,
  HelpCircle,
  UtensilsCrossed,
  Coffee,
  Building2,
  Mountain,
  Trees,
  ShoppingBag,
  Heart,
  FerrisWheel,
  User,
  Users,
  Baby,
  Navigation,
  Check,
  ChevronLeft,
  ArrowRight,
  Globe,
  Loader2,
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
    icon: FerrisWheel,
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

const TOTAL_QUESTION_STEPS = 5;

function triggerSubtleHaptic() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {}
}

/**
 * Interactive 3D Wireframe/Latitude-Longitude Sphere Canvas for the Final Welcome Screen
 * Pure monochrome black & white aesthetic matching Monvian iOS identity
 */
const MonvianInteractiveGlobeVisual: React.FC<{ isDark: boolean }> = React.memo(
  function MonvianInteractiveGlobeVisual({ isDark }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rotationRef = useRef<{ yaw: number; pitch: number; velocity: number }>({
      yaw: -0.78,
      pitch: -0.38,
      velocity: 0.0055,
    });
    const pointerRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
      active: false,
      lastX: 0,
      lastY: 0,
    });

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let rafId = 0;
      const size = 240;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);

      const cx = size / 2;
      const cy = size / 2;
      const radius = 88;

      const render = () => {
        ctx.clearRect(0, 0, size, size);

        if (!pointerRef.current.active) {
          rotationRef.current.yaw += rotationRef.current.velocity;
          rotationRef.current.velocity += (0.0055 - rotationRef.current.velocity) * 0.04;
        }

        const yaw = rotationRef.current.yaw;
        const pitch = rotationRef.current.pitch;
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);

        // Subtle outer ambient halo
        const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius * 1.24);
        if (isDark) {
          haloGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
          haloGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
          haloGrad.addColorStop(0, 'rgba(8, 8, 8, 0.06)');
          haloGrad.addColorStop(1, 'rgba(8, 8, 8, 0)');
        }
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.24, 0, Math.PI * 2);
        ctx.fill();

        // Main glass sphere body
        const sphereGrad = ctx.createRadialGradient(
          cx - radius * 0.32,
          cy - radius * 0.34,
          radius * 0.08,
          cx,
          cy,
          radius
        );
        if (isDark) {
          sphereGrad.addColorStop(0, 'rgba(48, 48, 52, 0.95)');
          sphereGrad.addColorStop(0.65, 'rgba(22, 22, 24, 0.96)');
          sphereGrad.addColorStop(1, 'rgba(8, 8, 10, 0.98)');
        } else {
          sphereGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
          sphereGrad.addColorStop(0.7, 'rgba(244, 244, 246, 0.96)');
          sphereGrad.addColorStop(1, 'rgba(228, 228, 233, 0.94)');
        }
        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Clip inside sphere for meridians & parallels
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        const project3D = (latRad: number, lonRad: number) => {
          const x = Math.cos(latRad) * Math.sin(lonRad + yaw);
          const yRaw = Math.sin(latRad);
          const zRaw = Math.cos(latRad) * Math.cos(lonRad + yaw);

          const y = yRaw * cosPitch - zRaw * sinPitch;
          const z = yRaw * sinPitch + zRaw * cosPitch;
          return {
            px: cx + x * radius,
            py: cy - y * radius,
            z,
          };
        };

        // Draw parallels (latitude rings)
        const latitudes = [-60, -30, 0, 30, 60];
        latitudes.forEach((latDeg) => {
          const latRad = (latDeg * Math.PI) / 180;
          ctx.beginPath();
          let started = false;
          for (let lonDeg = 0; lonDeg <= 360; lonDeg += 6) {
            const lonRad = (lonDeg * Math.PI) / 180;
            const pt = project3D(latRad, lonRad);
            if (!started) {
              ctx.moveTo(pt.px, pt.py);
              started = true;
            } else {
              ctx.lineTo(pt.px, pt.py);
            }
          }
          ctx.strokeStyle = isDark
            ? latDeg === 0
              ? 'rgba(255,255,255,0.22)'
              : 'rgba(255,255,255,0.11)'
            : latDeg === 0
              ? 'rgba(8,8,8,0.18)'
              : 'rgba(8,8,8,0.09)';
          ctx.lineWidth = latDeg === 0 ? 1.2 : 0.9;
          ctx.stroke();
        });

        // Draw meridians (longitude rings)
        for (let lonDeg = 0; lonDeg < 180; lonDeg += 30) {
          const lonRad = (lonDeg * Math.PI) / 180;
          ctx.beginPath();
          let started = false;
          for (let latDeg = 0; latDeg <= 360; latDeg += 6) {
            const latRad = (latDeg * Math.PI) / 180;
            const pt = project3D(latRad, lonRad);
            if (!started) {
              ctx.moveTo(pt.px, pt.py);
              started = true;
            } else {
              ctx.lineTo(pt.px, pt.py);
            }
          }
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(8,8,8,0.09)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }

        // Highlight Campos do Jordão marker (-22.739, -45.591) when facing front
        const cjLat = (-22.739 * Math.PI) / 180;
        const cjLon = (-45.591 * Math.PI) / 180;
        const cjPt = project3D(cjLat, cjLon);
        if (cjPt.z > -0.15) {
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.0045);
          ctx.beginPath();
          ctx.arc(cjPt.px, cjPt.py, 9 + pulse * 6, 0, Math.PI * 2);
          ctx.fillStyle = isDark
            ? `rgba(255, 255, 255, ${0.18 * (1 - pulse * 0.5)})`
            : `rgba(8, 8, 8, ${0.14 * (1 - pulse * 0.5)})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cjPt.px, cjPt.py, 4.2, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? '#FFFFFF' : '#080808';
          ctx.fill();
        }

        ctx.restore();

        // Crisp Liquid Glass Rim
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(8, 8, 8, 0.14)';
        ctx.lineWidth = 1.25;
        ctx.stroke();

        rafId = requestAnimationFrame(render);
      };

      rafId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(rafId);
    }, [isDark]);

    return (
      <div
        className="relative flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          pointerRef.current = {
            active: true,
            lastX: e.clientX,
            lastY: e.clientY,
          };
        }}
        onPointerMove={(e) => {
          if (!pointerRef.current.active) return;
          const dx = e.clientX - pointerRef.current.lastX;
          const dy = e.clientY - pointerRef.current.lastY;
          rotationRef.current.yaw += dx * 0.012;
          rotationRef.current.pitch = Math.max(
            -0.85,
            Math.min(0.85, rotationRef.current.pitch + dy * 0.008)
          );
          rotationRef.current.velocity = dx * 0.003;
          pointerRef.current.lastX = e.clientX;
          pointerRef.current.lastY = e.clientY;
        }}
        onPointerUp={() => {
          pointerRef.current.active = false;
        }}
        onPointerCancel={() => {
          pointerRef.current.active = false;
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-[220px] h-[220px] sm:w-[240px] sm:h-[240px]"
          aria-label="Globo 3D interativo Monvian"
        />
      </div>
    );
  }
);

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
    return Math.max(1, Math.min(6, start));
  });
  const [direction, setDirection] = useState<1 | -1>(1);

  const [camposRelationship, setCamposRelationship] = useState<string>(
    () => user?.campos_relationship || ''
  );
  const [nextTripTiming, setNextTripTiming] = useState<string>(
    () => user?.next_trip_timing || ''
  );
  const [nextTripDate, setNextTripDate] = useState<string>(
    () => user?.next_trip_date || ''
  );
  const [showDatePicker, setShowDatePicker] = useState<boolean>(
    () => Boolean(user?.next_trip_date)
  );
  const [interestCategories, setInterestCategories] = useState<string[]>(() =>
    Array.isArray(user?.interest_categories) ? user.interest_categories : []
  );
  const [travelCompany, setTravelCompany] = useState<string>(
    () => user?.travel_company || ''
  );
  const [locationPreference, setLocationPreference] = useState<string>(
    () => user?.location_preference || ''
  );
  const [isRequestingLocation, setIsRequestingLocation] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);

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
        if (p.next_trip_timing) setNextTripTiming(p.next_trip_timing);
        if (p.next_trip_date) {
          setNextTripDate(p.next_trip_date);
          setShowDatePicker(true);
        }
        if (Array.isArray(p.interest_categories) && p.interest_categories.length > 0) {
          setInterestCategories(p.interest_categories);
        }
        if (p.travel_company) setTravelCompany(p.travel_company);
        if (p.location_preference) setLocationPreference(p.location_preference);
        if (
          typeof p.onboarding_step === 'number' &&
          p.onboarding_step >= 1 &&
          p.onboarding_step <= 6 &&
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

  const persistStepToBackend = useCallback(
    async (
      nextStepNumber: number,
      overrides?: Partial<TravelerOnboardingPreferences>,
      markComplete: boolean = false
    ) => {
      const payload: TravelerOnboardingPreferences & { email?: string } = {
        email: cleanEmail,
        campos_relationship:
          overrides?.campos_relationship !== undefined
            ? overrides.campos_relationship
            : camposRelationship,
        next_trip_timing:
          overrides?.next_trip_timing !== undefined
            ? overrides.next_trip_timing
            : nextTripTiming,
        next_trip_date:
          overrides?.next_trip_date !== undefined
            ? overrides.next_trip_date
            : nextTripDate,
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
        onboarding_step: nextStepNumber,
        onboarding_completed: markComplete ? 1 : 0,
      };

      // Save locally right away for instant resilience
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

      // Persist to Firestore directly from client as well
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
          const data = await res.json();
          return data;
        }
      } catch {}
      return null;
    },
    [
      cleanEmail,
      camposRelationship,
      nextTripTiming,
      nextTripDate,
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

  const isOptionalVisitTiming =
    camposRelationship === 'Moro em Campos do Jordão.' ||
    camposRelationship === 'Estou apenas explorando.';

  const handleToggleInterest = (val: string) => {
    triggerSubtleHaptic();
    setInterestCategories((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
  };

  const handleActivateLocation = async () => {
    if (isRequestingLocation) return;
    triggerSubtleHaptic();
    setIsRequestingLocation(true);

    try {
      // Trigger iOS Safari gesture-bound geolocation & compass permission
      gpsNavigationManager.requestPermissionAndStartFromGesture();
      if (
        deviceHeadingManager.isPermissionRequired() &&
        !deviceHeadingManager.isPermissionHandled()
      ) {
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
            maximumAge: 30000,
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

    if (granted) {
      saveUserPermissionsToDatabase({
        locationGranted: true,
        coords,
        email: cleanEmail,
      }).catch(() => {});
    }

    setIsRequestingLocation(false);
    goToStep(6, {
      location_preference: prefValue,
      location_permission_granted: granted ? 1 : 0,
    });
  };

  const handleSkipLocation = () => {
    triggerSubtleHaptic();
    setLocationPreference('skipped');
    goToStep(6, {
      location_preference: 'skipped',
    });
  };

  const handleFinishOnboarding = async () => {
    if (isCompleting) return;
    triggerSubtleHaptic();
    setIsCompleting(true);

    const finalPreferences: TravelerOnboardingPreferences = {
      campos_relationship: camposRelationship,
      next_trip_timing: nextTripTiming,
      next_trip_date: nextTripDate,
      interest_categories: interestCategories,
      travel_company: travelCompany,
      location_preference: locationPreference || 'skipped',
      location_permission_granted:
        locationPreference === 'granted' || user?.location_permission_granted === 1
          ? 1
          : 0,
      onboarding_step: 6,
      onboarding_completed: 1,
    };

    const result = await persistStepToBackend(6, finalPreferences, true);
    const updatedUser = result?.user || {
      ...(user || {}),
      ...finalPreferences,
      onboarding_completed: 1,
      welcome_card_seen: 1,
    };

    setIsCompleting(false);
    onComplete(updatedUser, finalPreferences);
  };

  const progressFraction = Math.min(1, Math.max(0.2, step / TOTAL_QUESTION_STEPS));

  const slideVariants = {
    enter: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir > 0 ? 28 : -28, filter: 'blur(4px)' },
    center: {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
    },
    exit: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir > 0 ? -28 : 28, filter: 'blur(4px)' },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
      {/* Top Navigation & Discrete Progress Header */}
      <header
        className="w-full max-w-md mx-auto px-6 shrink-0 flex flex-col gap-3.5"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)',
        }}
      >
        <div className="flex items-center justify-between min-h-[36px]">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Voltar para a etapa anterior"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
                isDark
                  ? 'bg-[#1C1C1E] border-white/10 text-white hover:bg-[#2C2C2E]'
                  : 'bg-[#F5F5F7] border-black/[0.06] text-[#080808] hover:bg-[#EBEBED]'
              }`}
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
          ) : (
            <div className="w-9 h-9" />
          )}

          {step <= TOTAL_QUESTION_STEPS ? (
            <span
              className={`text-[12px] font-semibold tracking-[0.02em] ${
                isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
              }`}
            >
              Etapa {step} de {TOTAL_QUESTION_STEPS}
            </span>
          ) : (
            <span
              className={`text-[12px] font-semibold tracking-[0.04em] uppercase ${
                isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
              }`}
            >
              Monvian
            </span>
          )}

          <div className="w-9 h-9 flex items-center justify-end">
            {step === 2 && isOptionalVisitTiming && (
              <button
                type="button"
                onClick={() =>
                  goToStep(3, {
                    next_trip_timing: nextTripTiming || 'Ainda não tenho uma data.',
                  })
                }
                className={`text-[13px] font-semibold transition-opacity hover:opacity-75 cursor-pointer ${
                  isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                }`}
              >
                Pular
              </button>
            )}
          </div>
        </div>

        {/* Discrete iOS Segmented Progress Bar (Steps 1..5) */}
        {step <= TOTAL_QUESTION_STEPS && (
          <div className="w-full flex items-center gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((idx) => {
              const isCompletedOrCurrent = idx <= step;
              return (
                <div
                  key={idx}
                  className={`h-[3px] flex-1 rounded-full overflow-hidden transition-colors duration-300 ${
                    isDark ? 'bg-white/12' : 'bg-black/[0.08]'
                  }`}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      width: isCompletedOrCurrent ? '100%' : '0%',
                    }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-full rounded-full ${
                      isDark ? 'bg-[#FFFFFF]' : 'bg-[#080808]'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Step Content Area */}
      <div className="flex-1 w-full max-w-md mx-auto px-6 overflow-y-auto scrollbar-none flex flex-col justify-between py-6">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ============================================================== */}
          {/* TELA 1 — SUA RELAÇÃO COM CAMPOS                                */}
          {/* ============================================================== */}
          {step === 1 && (
            <motion.div
              key="onboarding-step-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="space-y-6">
                <div className="space-y-2.5 pt-2">
                  <h1 className="text-[28px] sm:text-[31px] font-bold tracking-[-0.03em] leading-[1.14]">
                    Qual é a sua relação com Campos do Jordão?
                  </h1>
                  <p
                    className={`text-[15px] leading-relaxed font-normal ${
                      isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                    }`}
                  >
                    Queremos conhecer você para tornar sua experiência no Monvian ainda melhor.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
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
                        className={`w-full p-4 rounded-[22px] border text-left transition-all duration-200 active:scale-[0.985] cursor-pointer flex items-center justify-between gap-3.5 ${
                          isSelected
                            ? isDark
                              ? 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF] shadow-sm'
                              : 'bg-[#080808] text-[#FFFFFF] border-[#080808] shadow-sm'
                            : isDark
                              ? 'bg-[#1C1C1E] text-[#FFFFFF] border-white/10 hover:bg-[#242426]'
                              : 'bg-[#F8F8FA] text-[#080808] border-black/[0.06] hover:bg-[#F0F0F3]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? isDark
                                  ? 'bg-black/10 text-[#080808]'
                                  : 'bg-white/15 text-[#FFFFFF]'
                                : isDark
                                  ? 'bg-white/[0.07] text-[#FFFFFF]'
                                  : 'bg-black/[0.05] text-[#080808]'
                            }`}
                          >
                            <Icon className="w-5 h-5 stroke-[1.9]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[16px] font-semibold tracking-[-0.015em] leading-snug">
                              {option.label}
                            </p>
                            <p
                              className={`text-[12.5px] mt-0.5 leading-snug ${
                                isSelected
                                  ? isDark
                                    ? 'text-black/65'
                                    : 'text-white/75'
                                  : isDark
                                    ? 'text-[#8E8E93]'
                                    : 'text-[#6E6E73]'
                              }`}
                            >
                              {option.subtitle}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                            isSelected
                              ? isDark
                                ? 'bg-[#080808] text-[#FFFFFF] border-[#080808]'
                                : 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF]'
                              : isDark
                                ? 'border-white/20'
                                : 'border-black/15'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {camposRelationship && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className={`w-full h-[54px] rounded-full font-semibold text-[16px] tracking-[-0.01em] flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer ${
                      isDark
                        ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                        : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                    }`}
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.3]" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TELA 2 — QUANDO VOCÊ PRETENDE VISITAR?                         */}
          {/* ============================================================== */}
          {step === 2 && (
            <motion.div
              key="onboarding-step-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="space-y-5">
                <div className="space-y-2 pt-2">
                  <h1 className="text-[28px] sm:text-[31px] font-bold tracking-[-0.03em] leading-[1.14]">
                    Quando será sua próxima experiência em Campos?
                  </h1>
                  {isOptionalVisitTiming && (
                    <p
                      className={`text-[14px] leading-relaxed ${
                        isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                      }`}
                    >
                      Esta etapa é opcional para você. Escolha uma opção ou pule para continuar.
                    </p>
                  )}
                </div>

                <div className="space-y-2.5 pt-1">
                  {NEXT_TRIP_TIMING_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = nextTripTiming === option.value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setNextTripTiming(option.value);
                          goToStep(3, { next_trip_timing: option.value });
                        }}
                        className={`w-full p-4 rounded-[22px] border text-left transition-all duration-200 active:scale-[0.985] cursor-pointer flex items-center justify-between gap-3.5 ${
                          isSelected
                            ? isDark
                              ? 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF] shadow-sm'
                              : 'bg-[#080808] text-[#FFFFFF] border-[#080808] shadow-sm'
                            : isDark
                              ? 'bg-[#1C1C1E] text-[#FFFFFF] border-white/10 hover:bg-[#242426]'
                              : 'bg-[#F8F8FA] text-[#080808] border-black/[0.06] hover:bg-[#F0F0F3]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-10.5 h-10.5 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? isDark
                                  ? 'bg-black/10 text-[#080808]'
                                  : 'bg-white/15 text-[#FFFFFF]'
                                : isDark
                                  ? 'bg-white/[0.07] text-[#FFFFFF]'
                                  : 'bg-black/[0.05] text-[#080808]'
                            }`}
                          >
                            <Icon className="w-5 h-5 stroke-[1.9]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[16px] font-semibold tracking-[-0.015em] leading-snug">
                              {option.label}
                            </p>
                            <p
                              className={`text-[12.5px] mt-0.5 leading-snug ${
                                isSelected
                                  ? isDark
                                    ? 'text-black/65'
                                    : 'text-white/75'
                                  : isDark
                                    ? 'text-[#8E8E93]'
                                    : 'text-[#6E6E73]'
                              }`}
                            >
                              {option.subtitle}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                            isSelected
                              ? isDark
                                ? 'bg-[#080808] text-[#FFFFFF] border-[#080808]'
                                : 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF]'
                              : isDark
                                ? 'border-white/20'
                                : 'border-black/15'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
                        </div>
                      </button>
                    );
                  })}

                  {/* Optional Calendar Specific Date Selector */}
                  <div
                    className={`rounded-[22px] border p-4 transition-all ${
                      showDatePicker || nextTripDate
                        ? isDark
                          ? 'bg-[#1C1C1E] border-white/25'
                          : 'bg-[#F8F8FA] border-black/20'
                        : isDark
                          ? 'bg-[#1C1C1E]/70 border-white/10'
                          : 'bg-[#F8F8FA]/80 border-black/[0.06]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerSubtleHaptic();
                        setShowDatePicker((prev) => !prev);
                      }}
                      className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10.5 h-10.5 rounded-2xl flex items-center justify-center shrink-0 ${
                            isDark
                              ? 'bg-white/[0.07] text-[#FFFFFF]'
                              : 'bg-black/[0.05] text-[#080808]'
                          }`}
                        >
                          <Calendar className="w-5 h-5 stroke-[1.9]" />
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold tracking-[-0.01em]">
                            Selecionar data específica
                          </p>
                          <p
                            className={`text-[12px] ${
                              isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                            }`}
                          >
                            {nextTripDate
                              ? `Data escolhida: ${nextTripDate.split('-').reverse().join('/')}`
                              : 'Opcional — escolha no calendário'}
                          </p>
                        </div>
                      </div>
                    </button>

                    {(showDatePicker || nextTripDate) && (
                      <div className="mt-3.5 pt-3 border-t border-black/5 dark:border-white/10 flex items-center gap-2.5">
                        <input
                          type="date"
                          value={nextTripDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNextTripDate(val);
                            if (val && !nextTripTiming) {
                              setNextTripTiming('Data específica planejada.');
                            }
                          }}
                          className={`flex-1 px-3.5 py-2.5 rounded-xl border text-[14px] font-medium focus:outline-none ${
                            isDark
                              ? 'bg-[#000000] border-white/15 text-white'
                              : 'bg-white border-black/10 text-[#080808]'
                          }`}
                        />
                        {nextTripDate && (
                          <button
                            type="button"
                            onClick={() =>
                              goToStep(3, {
                                next_trip_date: nextTripDate,
                                next_trip_timing:
                                  nextTripTiming || 'Data específica planejada.',
                              })
                            }
                            className={`px-4 py-2.5 rounded-xl text-[13.5px] font-semibold cursor-pointer transition-all active:scale-95 ${
                              isDark
                                ? 'bg-[#FFFFFF] text-[#080808]'
                                : 'bg-[#080808] text-[#FFFFFF]'
                            }`}
                          >
                            Confirmar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                {(nextTripTiming || nextTripDate) && (
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className={`w-full h-[54px] rounded-full font-semibold text-[16px] tracking-[-0.01em] flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer ${
                      isDark
                        ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                        : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                    }`}
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.3]" />
                  </button>
                )}

                {isOptionalVisitTiming && !nextTripTiming && !nextTripDate && (
                  <button
                    type="button"
                    onClick={() =>
                      goToStep(3, {
                        next_trip_timing: 'Ainda não tenho uma data.',
                      })
                    }
                    className={`w-full h-[50px] rounded-full font-semibold text-[15px] transition-all active:scale-[0.985] cursor-pointer border ${
                      isDark
                        ? 'bg-[#1C1C1E] text-white border-white/10 hover:bg-[#2C2C2E]'
                        : 'bg-[#F5F5F7] text-[#080808] border-black/[0.06] hover:bg-[#EBEBED]'
                    }`}
                  >
                    Pular esta etapa
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TELA 3 — SEUS INTERESSES (MÚLTIPLA ESCOLHA EM GRADE)           */}
          {/* ============================================================== */}
          {step === 3 && (
            <motion.div
              key="onboarding-step-3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="space-y-5">
                <div className="space-y-2 pt-2">
                  <h1 className="text-[28px] sm:text-[31px] font-bold tracking-[-0.03em] leading-[1.14]">
                    O que você gosta de descobrir?
                  </h1>
                  <p
                    className={`text-[15px] leading-relaxed font-normal ${
                      isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                    }`}
                  >
                    Selecione suas experiências favoritas.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {INTEREST_CATEGORY_OPTIONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = interestCategories.includes(item.value);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleInterest(item.value)}
                        className={`p-4 rounded-[22px] border text-left transition-all duration-200 active:scale-[0.97] cursor-pointer flex flex-col justify-between min-h-[112px] relative ${
                          isSelected
                            ? isDark
                              ? 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF] shadow-sm'
                              : 'bg-[#080808] text-[#FFFFFF] border-[#080808] shadow-sm'
                            : isDark
                              ? 'bg-[#1C1C1E] text-[#FFFFFF] border-white/10 hover:bg-[#242426]'
                              : 'bg-[#F8F8FA] text-[#080808] border-black/[0.06] hover:bg-[#F0F0F3]'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                              isSelected
                                ? isDark
                                  ? 'bg-black/10 text-[#080808]'
                                  : 'bg-white/15 text-[#FFFFFF]'
                                : isDark
                                  ? 'bg-white/[0.07] text-[#FFFFFF]'
                                  : 'bg-black/[0.05] text-[#080808]'
                            }`}
                          >
                            <Icon className="w-5 h-5 stroke-[1.9]" />
                          </div>

                          <div
                            className={`w-5.5 h-5.5 rounded-full flex items-center justify-center border transition-all ${
                              isSelected
                                ? isDark
                                  ? 'bg-[#080808] text-[#FFFFFF] border-[#080808]'
                                  : 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF]'
                                : isDark
                                  ? 'border-white/20'
                                  : 'border-black/15'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        <p className="text-[14.5px] font-semibold tracking-[-0.015em] leading-snug mt-3">
                          {item.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={interestCategories.length === 0}
                  onClick={() =>
                    goToStep(4, { interest_categories: interestCategories })
                  }
                  className={`w-full h-[54px] rounded-full font-semibold text-[16px] tracking-[-0.01em] flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer disabled:opacity-35 disabled:pointer-events-none ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                      : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                  }`}
                >
                  <span>
                    {interestCategories.length > 0
                      ? `Continuar (${interestCategories.length})`
                      : 'Selecione ao menos uma opção'}
                  </span>
                  {interestCategories.length > 0 && (
                    <ArrowRight className="w-4 h-4 stroke-[2.3]" />
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TELA 4 — COM QUEM VOCÊ COSTUMA VIAJAR?                         */}
          {/* ============================================================== */}
          {step === 4 && (
            <motion.div
              key="onboarding-step-4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="space-y-5">
                <div className="space-y-2 pt-2">
                  <h1 className="text-[28px] sm:text-[31px] font-bold tracking-[-0.03em] leading-[1.14]">
                    Quem costuma acompanhar suas viagens?
                  </h1>
                </div>

                <div className="space-y-2.5 pt-1">
                  {TRAVEL_COMPANY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = travelCompany === option.value;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setTravelCompany(option.value);
                          goToStep(5, { travel_company: option.value });
                        }}
                        className={`w-full p-4 rounded-[22px] border text-left transition-all duration-200 active:scale-[0.985] cursor-pointer flex items-center justify-between gap-3.5 ${
                          isSelected
                            ? isDark
                              ? 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF] shadow-sm'
                              : 'bg-[#080808] text-[#FFFFFF] border-[#080808] shadow-sm'
                            : isDark
                              ? 'bg-[#1C1C1E] text-[#FFFFFF] border-white/10 hover:bg-[#242426]'
                              : 'bg-[#F8F8FA] text-[#080808] border-black/[0.06] hover:bg-[#F0F0F3]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-10.5 h-10.5 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? isDark
                                  ? 'bg-black/10 text-[#080808]'
                                  : 'bg-white/15 text-[#FFFFFF]'
                                : isDark
                                  ? 'bg-white/[0.07] text-[#FFFFFF]'
                                  : 'bg-black/[0.05] text-[#080808]'
                            }`}
                          >
                            <Icon className="w-5 h-5 stroke-[1.9]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[16px] font-semibold tracking-[-0.015em] leading-snug">
                              {option.label}
                            </p>
                            <p
                              className={`text-[12.5px] mt-0.5 leading-snug ${
                                isSelected
                                  ? isDark
                                    ? 'text-black/65'
                                    : 'text-white/75'
                                  : isDark
                                    ? 'text-[#8E8E93]'
                                    : 'text-[#6E6E73]'
                              }`}
                            >
                              {option.subtitle}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                            isSelected
                              ? isDark
                                ? 'bg-[#080808] text-[#FFFFFF] border-[#080808]'
                                : 'bg-[#FFFFFF] text-[#080808] border-[#FFFFFF]'
                              : isDark
                                ? 'border-white/20'
                                : 'border-black/15'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {travelCompany && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => goToStep(5)}
                    className={`w-full h-[54px] rounded-full font-semibold text-[16px] tracking-[-0.01em] flex items-center justify-center gap-2 transition-all active:scale-[0.985] cursor-pointer ${
                      isDark
                        ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                        : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                    }`}
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.3]" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TELA 5 — LOCALIZAÇÃO                                           */}
          {/* ============================================================== */}
          {step === 5 && (
            <motion.div
              key="onboarding-step-5"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                {/* Minimalist Liquid Glass Location Radar Emblem */}
                <div className="relative flex items-center justify-center mb-8">
                  <div
                    className={`w-36 h-36 rounded-full flex items-center justify-center border ${
                      isDark
                        ? 'bg-white/[0.03] border-white/10'
                        : 'bg-black/[0.02] border-black/[0.06]'
                    }`}
                  >
                    <div
                      className={`w-24 h-24 rounded-full flex items-center justify-center border ${
                        isDark
                          ? 'bg-white/[0.05] border-white/15'
                          : 'bg-black/[0.04] border-black/[0.08]'
                      }`}
                    >
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm ${
                          isDark
                            ? 'bg-[#FFFFFF] text-[#080808]'
                            : 'bg-[#080808] text-[#FFFFFF]'
                        }`}
                      >
                        <Navigation className="w-6 h-6 stroke-[2.1]" />
                      </div>
                    </div>
                  </div>
                </div>

                <h1 className="text-[28px] sm:text-[31px] font-bold tracking-[-0.03em] leading-[1.14] max-w-[320px]">
                  Descubra o que está ao seu redor.
                </h1>
                <p
                  className={`text-[15.5px] leading-relaxed font-normal mt-3 max-w-[330px] ${
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
                  className={`w-full h-[54px] rounded-full font-semibold text-[16px] tracking-[-0.01em] flex items-center justify-center gap-2.5 transition-all active:scale-[0.985] cursor-pointer ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                      : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                  }`}
                >
                  {isRequestingLocation ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Navigation className="w-4.5 h-4.5 stroke-[2.2]" />
                  )}
                  <span>Ativar localização</span>
                </button>

                <button
                  type="button"
                  disabled={isRequestingLocation}
                  onClick={handleSkipLocation}
                  className={`w-full h-[46px] rounded-full font-medium text-[14.5px] transition-opacity hover:opacity-80 cursor-pointer ${
                    isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                  }`}
                >
                  Continuar sem localização
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* TELA FINAL — BOAS-VINDAS COM GLOBO 3D INTERATIVO               */}
          {/* ============================================================== */}
          {step === 6 && (
            <motion.div
              key="onboarding-step-6"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-between gap-6"
            >
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                <div className="mb-6">
                  <MonvianInteractiveGlobeVisual isDark={isDark} />
                </div>

                <h1 className="text-[29px] sm:text-[33px] font-bold tracking-[-0.03em] leading-[1.12] max-w-[330px]">
                  Sua próxima experiência começa aqui.
                </h1>
                <p
                  className={`text-[15.5px] leading-relaxed font-normal mt-3 max-w-[330px] ${
                    isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
                  }`}
                >
                  Descubra lugares, encontre experiências e conecte-se com tudo o que acontece em Campos do Jordão.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isCompleting}
                  onClick={handleFinishOnboarding}
                  className={`w-full h-[56px] rounded-full font-semibold text-[16.5px] tracking-[-0.015em] flex items-center justify-center gap-2.5 transition-all active:scale-[0.985] cursor-pointer shadow-sm ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#080808] hover:bg-zinc-200'
                      : 'bg-[#080808] text-[#FFFFFF] hover:bg-zinc-900'
                  }`}
                >
                  {isCompleting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Globe className="w-5 h-5 stroke-[2]" />
                  )}
                  <span>Explorar Campos</span>
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
          height: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        }}
      />
    </motion.div>
  );
};

export default OnboardingFlow;
