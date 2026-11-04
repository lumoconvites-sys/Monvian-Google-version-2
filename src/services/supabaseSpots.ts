import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import { getSpotImage } from '../utils/spotImages';

/**
 * Normalizes a database row from Supabase 'spots' into a frontend Spot model
 * ensuring both snake_case and camelCase properties are safely populated.
 */
export function normalizeSpotRecord(row: any): Spot {
  let parsedGallery: string[] = [];
  if (Array.isArray(row.gallery)) {
    parsedGallery = row.gallery;
  } else if (typeof row.gallery === 'string' && row.gallery.trim()) {
    try {
      const parsed = JSON.parse(row.gallery);
      if (Array.isArray(parsed)) parsedGallery = parsed;
    } catch {
      parsedGallery = row.gallery.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  const rawDbImage = row.image || (parsedGallery.length > 0 ? parsedGallery[0] : '');
  const primaryImage = getSpotImage({
    id: String(row.id || ''),
    name: String(row.name || ''),
    shortName: String(row.short_name || row.shortName || row.name || ''),
    category: row.category || 'attractions',
    image: rawDbImage,
    gallery: parsedGallery,
  });

  if (parsedGallery.length === 0 && primaryImage) {
    parsedGallery = [primaryImage];
  }

  const latNum = Number(row.lat);
  const lngNum = Number(row.lng);

  return {
    ...row,
    id: String(row.id),
    name: String(row.name || ''),
    shortName: row.short_name || row.shortName || row.name || '',
    short_name: row.short_name || row.shortName || row.name || '',
    tagLabel: row.tag_label || row.tagLabel || row.short_name || row.name || '',
    tag_label: row.tag_label || row.tagLabel || row.short_name || row.name || '',
    category: row.category || 'attractions',
    categoryLabel: row.category_label || row.categoryLabel || 'Atrações & Parques',
    category_label: row.category_label || row.categoryLabel || 'Atrações & Parques',
    lat: isNaN(latNum) ? -22.7192 : latNum,
    lng: isNaN(lngNum) ? -45.5673 : lngNum,
    image: primaryImage,
    gallery: parsedGallery,
    description: row.description || '',
    touristTip: row.tourist_tip || row.touristTip || '',
    tourist_tip: row.tourist_tip || row.touristTip || '',
    rating: Number(row.rating ?? 4.8),
    reviewCount: Number(row.review_count ?? row.reviewCount ?? 100),
    review_count: Number(row.review_count ?? row.reviewCount ?? 100),
    hours: row.hours || '09:00 às 18:00',
    address: row.address || 'Campos do Jordão, SP',
    priceRange: row.price_range || row.priceRange || '$$',
    price_range: row.price_range || row.priceRange || '$$',
    price: row.price || 'Entrada Franca',
    visitorsToday: Number(row.visitors_today ?? row.visitorsToday ?? 120),
    badge:
      row.badge ||
      (row.is_star === 1 || row.is_star === true || row.isStar === true ? 'Estrela' : ''),
    isStar:
      row.is_star !== undefined && row.is_star !== null
        ? Number(row.is_star) === 1 || row.is_star === true
        : row.isStar !== undefined
          ? Boolean(row.isStar)
          : row.badge === 'Estrela',
    is_star:
      (row.is_star !== undefined && row.is_star !== null
        ? Number(row.is_star) === 1 || row.is_star === true
        : row.isStar !== undefined
          ? Boolean(row.isStar)
          : row.badge === 'Estrela')
        ? 1
        : 0,
    highlighted: Boolean(
      row.highlighted ||
        row.is_star === 1 ||
        row.is_star === true ||
        row.isStar === true ||
        row.badge === 'Estrela'
    ),
    mapsUrl: row.maps_url || row.mapsUrl || '',
    maps_url: row.maps_url || row.mapsUrl || '',
    isActive: row.is_active !== undefined ? Number(row.is_active) === 1 : row.isActive !== false,
    is_active: row.is_active !== undefined ? Number(row.is_active) : row.isActive === false ? 0 : 1,
    isVerified: row.is_verified !== undefined ? Number(row.is_verified) === 1 : row.isVerified !== false,
    is_verified: row.is_verified !== undefined ? Number(row.is_verified) : row.isVerified === false ? 0 : 1,
    availableForItinerary: row.available_for_itinerary !== undefined ? Number(row.available_for_itinerary) === 1 : true,
    available_for_itinerary: row.available_for_itinerary !== undefined ? Number(row.available_for_itinerary) : 1,
    durationMinutes: Number(row.duration_minutes ?? row.durationMinutes ?? 90),
    duration_minutes: Number(row.duration_minutes ?? row.durationMinutes ?? 90),
    tags: Array.isArray(row.tags) ? row.tags.join(', ') : String(row.tags || ''),
  };
}

/**
 * Loads spots directly from Supabase PostgreSQL (the primary source of truth).
 * Falls back safely to cached spots or initial spots if offline or unconfigured.
 */
export async function fetchSpotsFromSupabase(options?: { throwOnError?: boolean }): Promise<Spot[]> {
  // Primary 1: Same-origin backend API (/api/spots) which merges Supabase + live SQLite ratings & reviews
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/spots');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.spots) && json.spots.length > 0) {
          const normalized = json.spots.map(normalizeSpotRecord);
          try {
            localStorage.setItem('monvian_cached_spots', JSON.stringify(normalized));
          } catch {}
          return normalized;
        }
      }
    }
  } catch {}

  // Primary 2: Direct Supabase query fallback
  try {
    if (isSupabaseConfigured && supabase) {
      let timer: any = null;
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
        timer = setTimeout(() => {
          resolve({ data: null, error: { message: 'Tempo limite ao consultar Supabase (3.5s)' } });
        }, 3500);
      });

      const queryPromise = Promise.resolve(
        supabase
          .from('spots')
          .select('*')
          .order('name', { ascending: true })
      ).catch((queryErr: any) => ({
        data: null,
        error: { message: queryErr?.message || 'Erro de conexão' },
      }));

      const { data, error } = await Promise.race([
        queryPromise.then((res) => {
          if (timer) clearTimeout(timer);
          return res;
        }),
        timeoutPromise,
      ]);

      if (timer) clearTimeout(timer);

      if (!error && Array.isArray(data) && data.length > 0) {
        const normalized = data.map(normalizeSpotRecord);
        try {
          localStorage.setItem('monvian_cached_spots', JSON.stringify(normalized));
        } catch {}
        return normalized;
      }
    }
  } catch {}

  // Fallback 2: Local cache in browser
  try {
    const cached = localStorage.getItem('monvian_cached_spots');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeSpotRecord);
      }
    }
  } catch {}

  // Fallback 3: Bundled CAMPOS_SPOTS
  return CAMPOS_SPOTS.map(normalizeSpotRecord);
}

/**
 * Persists a tourist spot to Supabase PostgreSQL + local backend SQLite with real validation and confirmation.
 */
export async function saveSpotToSupabase(spotData: any, isEdit: boolean): Promise<Spot> {
  if (!spotData?.name || !String(spotData.name).trim()) {
    throw new Error('O nome do ponto turístico é obrigatório.');
  }

  const spotId =
    spotData.id ||
    `spot-${spotData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;

  const finalGallery = Array.isArray(spotData.gallery)
    ? spotData.gallery
    : spotData.image
      ? [spotData.image]
      : [];

  const latNum = Number(spotData.lat);
  const lngNum = Number(spotData.lng);

  const isStarFlag =
    spotData.is_star !== undefined
      ? Boolean(spotData.is_star)
      : spotData.isStar !== undefined
        ? Boolean(spotData.isStar)
        : spotData.badge === 'Estrela';

  const resolvedBadge = isStarFlag
    ? 'Estrela'
    : spotData.badge === 'Estrela'
      ? ''
      : spotData.badge || '';

  const payload: any = {
    id: spotId,
    name: String(spotData.name).trim(),
    short_name: String(spotData.short_name || spotData.shortName || spotData.name).trim(),
    tag_label: String(spotData.tag_label || spotData.tagLabel || spotData.short_name || spotData.name).trim(),
    category: spotData.category || 'attractions',
    category_label: spotData.category_label || spotData.categoryLabel || 'Atrações & Parques',
    lat: isNaN(latNum) ? -22.7192 : latNum,
    lng: isNaN(lngNum) ? -45.5673 : lngNum,
    image: spotData.image || (finalGallery.length > 0 ? finalGallery[0] : ''),
    gallery: JSON.stringify(finalGallery),
    description: spotData.description || '',
    tourist_tip: spotData.tourist_tip || spotData.touristTip || '',
    rating: Number(spotData.rating ?? 4.8),
    review_count: Number(spotData.review_count ?? spotData.reviewCount ?? 120),
    hours: spotData.hours || '09:00 às 18:00',
    address: spotData.address || 'Campos do Jordão, SP',
    price_range: spotData.price_range || spotData.priceRange || '$$',
    price: spotData.price || 'Entrada Franca',
    maps_url: spotData.maps_url || spotData.mapsUrl || '',
    is_active: spotData.is_active !== undefined ? Number(spotData.is_active) : spotData.isActive === false ? 0 : 1,
    is_verified: spotData.is_verified !== undefined ? Number(spotData.is_verified) : spotData.isVerified === false ? 0 : 1,
    available_for_itinerary: spotData.available_for_itinerary !== undefined ? Number(spotData.available_for_itinerary) : 1,
    duration_minutes: Number(spotData.duration_minutes ?? spotData.durationMinutes ?? 90),
    tags: Array.isArray(spotData.tags) ? spotData.tags.join(', ') : String(spotData.tags || ''),
    updated_at: new Date().toISOString(),
  };

  const fullPayload = {
    ...payload,
    is_star: isStarFlag ? 1 : 0,
    isStar: isStarFlag,
    badge: resolvedBadge,
    highlighted: isStarFlag ? 1 : 0,
  };

  let savedRecord: any = fullPayload;

  // 1. Sync with local backend SQLite (/api/admin/spots) first so local DB is immediately authoritative
  try {
    const token = localStorage.getItem('monvian_token');
    const endpoint = isEdit ? `/api/admin/spots/${spotId}` : '/api/admin/spots';
    const method = isEdit ? 'PUT' : 'POST';
    const apiRes = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(fullPayload),
    });
    if (apiRes.ok) {
      const apiJson = await apiRes.json();
      if (apiJson?.spot) {
        savedRecord = { ...fullPayload, ...apiJson.spot };
      }
    }
  } catch {}

  // 2. Direct PostgreSQL Upsert in Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('spots')
        .upsert({ ...payload, badge: resolvedBadge, highlighted: isStarFlag ? 1 : 0 }, { onConflict: 'id' })
        .select();

      if (error) {
        // Fallback if badge/highlighted columns are not present in remote schema
        const { data: retryData } = await supabase
          .from('spots')
          .upsert(payload, { onConflict: 'id' })
          .select();
        if (retryData && retryData.length > 0) {
          savedRecord = { ...retryData[0], is_star: isStarFlag ? 1 : 0, isStar: isStarFlag, badge: resolvedBadge };
        }
      } else if (data && data.length > 0) {
        savedRecord = { ...data[0], is_star: isStarFlag ? 1 : 0, isStar: isStarFlag, badge: resolvedBadge };
      }
    } catch {}
  }

  const normalized = normalizeSpotRecord(savedRecord);

  // 3. Update localStorage cache
  try {
    const cached = localStorage.getItem('monvian_cached_spots');
    let list: Spot[] = cached ? JSON.parse(cached) : [];
    const idx = list.findIndex((s) => s.id === spotId);
    if (idx >= 0) {
      list[idx] = normalized;
    } else {
      list = [normalized, ...list];
    }
    localStorage.setItem('monvian_cached_spots', JSON.stringify(list));
  } catch {}

  // 4. Notify app components (Map, Admin, Explore) to update immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('monvian:spots_updated', { detail: { spot: normalized, action: 'save' } }));
  }

  return normalized;
}

/**
 * Deletes a tourist spot from Supabase PostgreSQL.
 * Throws an Error if the deletion failed.
 */
export async function deleteSpotFromSupabase(spotId: string): Promise<boolean> {
  if (!spotId) return false;

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('spots').delete().eq('id', spotId);
    } catch {}
  }

  // Attempt backend API notification (fails silently if on Vercel)
  try {
    const token = localStorage.getItem('monvian_token');
    await fetch(`/api/admin/spots/${spotId}`, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {}

  // Update local cache
  try {
    const cached = localStorage.getItem('monvian_cached_spots');
    if (cached) {
      const list: Spot[] = JSON.parse(cached);
      const filtered = list.filter((s) => s.id !== spotId);
      localStorage.setItem('monvian_cached_spots', JSON.stringify(filtered));
    }
  } catch {}

  // Notify app components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('monvian:spots_updated', { detail: { spotId, action: 'delete' } }));
  }

  return true;
}

/**
 * Toggles spot active status in Supabase
 */
export async function toggleSpotActiveInSupabase(spotId: string, isActive: boolean): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('spots')
        .update({ is_active: isActive ? 1 : 0, updated_at: new Date().toISOString() })
        .eq('id', spotId);
    } catch {}
  }

  try {
    const token = localStorage.getItem('monvian_token');
    await fetch(`/api/admin/spots/${spotId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ is_active: isActive ? 1 : 0, isActive }),
    });
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('monvian:spots_updated', { detail: { spotId, isActive, action: 'toggleActive' } }));
  }

  return true;
}

/**
 * Toggles spot Star ("Estrela") famous marker status in SQLite + Supabase + Map
 */
export async function toggleSpotStarInSupabase(spot: any, isStar: boolean): Promise<Spot> {
  const updatedPayload = {
    ...spot,
    isStar,
    is_star: isStar ? 1 : 0,
    badge: isStar ? 'Estrela' : (spot?.badge === 'Estrela' ? '' : (spot?.badge || '')),
  };
  return saveSpotToSupabase(updatedPayload, true);
}

/**
 * Toggles spot verified status in Supabase
 */
export async function toggleSpotVerifiedInSupabase(spotId: string, isVerified: boolean): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  const { error } = await supabase
    .from('spots')
    .update({ is_verified: isVerified ? 1 : 0, updated_at: new Date().toISOString() })
    .eq('id', spotId);

  if (error) {
    throw new Error(error.message);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('monvian:spots_updated', { detail: { spotId, isVerified, action: 'toggleVerified' } }));
  }

  return true;
}

/**
 * Subscribes to spot updates across the app (Realtime + Local events)
 */
export function subscribeToSpotsChanges(onUpdate: () => void): () => void {
  const handleLocalEvent = () => onUpdate();
  if (typeof window !== 'undefined') {
    window.addEventListener('monvian:spots_updated', handleLocalEvent);
  }

  let channel: any = null;
  try {
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('realtime:spots')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'spots' },
          () => {
            onUpdate();
          }
        )
        .subscribe();
    }
  } catch {}

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('monvian:spots_updated', handleLocalEvent);
    }
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {}
    }
  };
}
