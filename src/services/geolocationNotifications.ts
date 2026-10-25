import { Spot } from '../types';
import { calculateHaversineDistance } from './gpsNavigation';
import {
  getSpotImage,
  getSpotNotificationImage,
  preloadSpotNotificationImage,
} from '../utils/spotImages';

export interface GeolocationArrivalNotificationItem {
  id: string;
  spotId: string;
  spotName: string;
  title: string;
  imageUrl: string;
  createdAt: string;
  isRead: boolean;
  spot?: Spot;
}

interface VisitRecord {
  inside: boolean;
  lastNotifiedAt: number;
}

const VISIT_STORAGE_KEY = 'monvian_geo_visit_records_v2';
const HISTORY_STORAGE_KEY = 'monvian_geo_notifications_v2';

// Arrival & exit hysteresis thresholds in meters
const ARRIVAL_RADIUS_METERS = 135;
const EXIT_RADIUS_METERS = 280;
const PRELOAD_RADIUS_METERS = 650;
// Cooldown within same visit (3 hours)
const SAME_VISIT_COOLDOWN_MS = 3 * 60 * 60 * 1000;

/**
 * Formats a clean, natural display name for a tourist spot.
 */
export function getCleanSpotDisplayName(spot: {
  id?: string;
  name?: string;
  shortName?: string;
}): string {
  const id = (spot.id || '').toLowerCase();
  const rawShort = (spot.shortName || '').trim();
  const rawName = (spot.name || '').trim();

  if (id === 'parque-capivari' || rawName.toLowerCase() === 'parque capivari') {
    return 'Parque Capivari';
  }
  if (id === 'morro-elefante' || id === 'morro-do-elefante') {
    return 'Morro do Elefante';
  }

  // Prefer shortName if it doesn't end with ellipsis "..."
  let chosen = rawShort && !rawShort.endsWith('...') ? rawShort : rawName;
  if (!chosen) return 'Ponto Turístico';

  // Convert ALL CAPS names (e.g., "PARQUE CAPIVARI") into Title Case
  if (chosen === chosen.toUpperCase() && chosen.length > 3) {
    const lowerWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na']);
    chosen = chosen
      .toLowerCase()
      .split(/\s+/)
      .map((w, idx) =>
        idx > 0 && lowerWords.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
      )
      .join(' ');
  }

  return chosen;
}

/**
 * Formats a short, iOS-style arrival title such as "Você chegou ao Parque Capivari"
 */
export function formatArrivalTitle(spot: {
  id?: string;
  name?: string;
  shortName?: string;
}): string {
  const cleanName = getCleanSpotDisplayName(spot);
  const firstWord = cleanName
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const feminineStarters = new Set([
    'ducha',
    'cervejaria',
    'villa',
    'vila',
    'fabrica',
    'pousada',
    'festa',
    'droga',
    'drogaria',
    'praca',
    'cachoeira',
    'pedra',
    'estacao',
    'igreja',
    'capela',
    'casa',
    'chocolataria',
    'confeitaria',
    'galeria',
    'trilha',
  ]);

  const pluralMasculineStarters = new Set(['chocolates', 'jardins', 'campos']);
  const pluralFeminineStarters = new Set(['feiras', 'cascata']);

  if (feminineStarters.has(firstWord)) {
    return `Você chegou à ${cleanName}`;
  }
  if (pluralMasculineStarters.has(firstWord)) {
    return `Você chegou aos ${cleanName}`;
  }
  if (pluralFeminineStarters.has(firstWord)) {
    return `Você chegou às ${cleanName}`;
  }

  return `Você chegou ao ${cleanName}`;
}

/**
 * Ensures standalone Parque Capivari and Morro do Elefante targets exist with their
 * specific coordinates and photos alongside all database spots.
 */
export function buildArrivalSpotTargets(spots: Spot[]): Spot[] {
  const activeSpots = (spots || []).filter((s) => s && s.isActive !== false);
  const hasParqueCapivari = activeSpots.some(
    (s) =>
      s.id.toLowerCase() === 'parque-capivari' ||
      s.name.toLowerCase().trim() === 'parque capivari'
  );

  const result = activeSpots.map((s) => {
    if (s.id === 'morro-elefante' && s.name.includes('Parque Capivari')) {
      return {
        ...s,
        shortName: 'Morro do Elefante',
        image: getSpotImage({
          id: 'morro-elefante',
          name: 'Morro do Elefante',
          category: s.category,
          image: s.image,
          gallery: s.gallery,
        }),
      };
    }
    return s;
  });

  if (!hasParqueCapivari) {
    result.push({
      id: 'parque-capivari',
      name: 'Parque Capivari',
      shortName: 'Parque Capivari',
      tagLabel: 'Parque Capivari',
      category: 'parks',
      categoryLabel: 'Lago, Teleférico & Roda-Gigante',
      lat: -22.7303,
      lng: -45.5898,
      image: getSpotImage({
        id: 'parque-capivari',
        name: 'Parque Capivari',
        category: 'parks',
      }),
      gallery: [
        getSpotImage({
          id: 'parque-capivari',
          name: 'Parque Capivari',
          category: 'parks',
        }),
      ],
      description:
        'Coração turístico de Campos do Jordão com teleférico, pedalinhos, roda-gigante e áreas de passeio ao redor do lago.',
      touristTip:
        'Aproveite o fim de tarde na roda-gigante para ver as luzes de Capivari acenderem.',
      rating: 4.8,
      reviewCount: 18400,
      hours: 'Diariamente das 09h às 21h',
      address: 'Rua Eng. Diogo José de Carvalho, 1291 - Capivari',
      priceRange: 'Grátis',
      visitorsToday: 540,
      badge: 'Imperdível',
      highlighted: true,
    });
  }

  return result;
}

function loadVisitRecords(): Record<string, VisitRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw =
      sessionStorage.getItem(VISIT_STORAGE_KEY) ||
      localStorage.getItem(VISIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {}
  return {};
}

function saveVisitRecords(records: Record<string, VisitRecord>) {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(records);
    sessionStorage.setItem(VISIT_STORAGE_KEY, serialized);
    localStorage.setItem(VISIT_STORAGE_KEY, serialized);
  } catch {}
}

export function loadGeolocationNotificationsHistory(spots: Spot[] = []): GeolocationArrivalNotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: GeolocationArrivalNotificationItem) => {
          const matchedSpot = spots.find((s) => s.id === item.spotId);
          const freshImage = matchedSpot
            ? getSpotNotificationImage(matchedSpot)
            : getSpotNotificationImage({
                id: item.spotId,
                name: item.spotName,
                image: item.imageUrl,
              });
          return {
            ...item,
            imageUrl: freshImage || item.imageUrl,
            spot: matchedSpot || item.spot,
          };
        });
      }
    }
  } catch {}
  return [];
}

export function saveGeolocationNotificationsHistory(items: GeolocationArrivalNotificationItem[]) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = items.slice(0, 30).map(({ spot, ...rest }) => rest);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

/**
 * Requests native iOS / Web Notification permission when supported by the platform.
 */
export async function requestPlatformNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

/**
 * Dispatches a real native iOS / Web platform notification when supported and permitted.
 */
export async function dispatchNativePlatformNotification(
  item: GeolocationArrivalNotificationItem,
  onSelectSpotId?: (spotId: string) => void
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const options: NotificationOptions & { image?: string; renotify?: boolean } = {
    body: item.title,
    icon: item.imageUrl,
    image: item.imageUrl,
    badge: '/loogo.png',
    tag: `monvians-arrival-${item.spotId}`,
    renotify: false,
    silent: false,
    data: {
      spotId: item.spotId,
      spotName: item.spotName,
      url: `/?spot=${encodeURIComponent(item.spotId)}`,
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification('Monvians', options);
        return true;
      }
    }
  } catch {}

  try {
    const nativeNotif = new Notification('Monvians', options);
    nativeNotif.onclick = () => {
      try {
        window.focus();
      } catch {}
      onSelectSpotId?.(item.spotId);
      nativeNotif.close();
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluates current real GPS coordinates against registered tourist spots.
 * Returns the newly arrived Spot if an arrival just occurred (avoiding repeated alerts on the same visit).
 */
export function evaluateGeolocationArrival(
  userLng: number,
  userLat: number,
  spots: Spot[],
  options?: { forceSpotId?: string }
): Spot | null {
  if (typeof window === 'undefined') return null;

  // Respect user's proximity alert preference
  if (
    !options?.forceSpotId &&
    (localStorage.getItem('monvian_proximity_alerts') === 'false' ||
      localStorage.getItem('monvian_location_perm') === 'false')
  ) {
    return null;
  }

  const targets = buildArrivalSpotTargets(spots);
  if (targets.length === 0) return null;

  if (options?.forceSpotId) {
    const forced = targets.find(
      (s) =>
        s.id.toLowerCase() === options.forceSpotId!.toLowerCase() ||
        s.name.toLowerCase().includes(options.forceSpotId!.toLowerCase())
    );
    return forced || null;
  }

  if (
    typeof userLng !== 'number' ||
    typeof userLat !== 'number' ||
    isNaN(userLng) ||
    isNaN(userLat)
  ) {
    return null;
  }

  const now = Date.now();
  const visitRecords = loadVisitRecords();
  let recordsMutated = false;

  let closestArrivedSpot: Spot | null = null;
  let closestDistance = Infinity;

  for (const spot of targets) {
    if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') continue;

    const dist = calculateHaversineDistance(userLng, userLat, spot.lng, spot.lat);
    const existing = visitRecords[spot.id];

    // Preload notification image when approaching within 650m
    if (dist <= PRELOAD_RADIUS_METERS) {
      preloadSpotNotificationImage(spot).catch(() => {});
    }

    // Reset "inside" state once the user leaves beyond EXIT_RADIUS_METERS
    if (existing?.inside && dist > EXIT_RADIUS_METERS) {
      visitRecords[spot.id] = {
        ...existing,
        inside: false,
      };
      recordsMutated = true;
    }

    if (dist <= ARRIVAL_RADIUS_METERS) {
      const alreadyInside = Boolean(existing?.inside);
      const recentlyNotified =
        Boolean(existing?.lastNotifiedAt) &&
        now - existing.lastNotifiedAt < SAME_VISIT_COOLDOWN_MS;

      if (!alreadyInside && !recentlyNotified && dist < closestDistance) {
        closestDistance = dist;
        closestArrivedSpot = spot;
      }
    }
  }

  if (closestArrivedSpot) {
    visitRecords[closestArrivedSpot.id] = {
      inside: true,
      lastNotifiedAt: now,
    };
    recordsMutated = true;
  }

  if (recordsMutated) {
    saveVisitRecords(visitRecords);
  }

  return closestArrivedSpot;
}
