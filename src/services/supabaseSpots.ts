import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';

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

  const primaryImage =
    row.image ||
    (parsedGallery.length > 0 ? parsedGallery[0] : '') ||
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80';

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
    badge: row.badge || '',
    highlighted: Boolean(row.highlighted),
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
export async function fetchSpotsFromSupabase(): Promise<Spot[]> {
  try {
    if (isSupabaseConfigured && supabase) {
      // Execute with a 6-second timeout so UI never hangs indefinitely
      const queryPromise = supabase
        .from('spots')
        .select('*')
        .order('name', { ascending: true });

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Timeout ao conectar com Supabase' } }), 6000)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (!error && Array.isArray(data) && data.length > 0) {
        const normalized = data.map(normalizeSpotRecord);
        try {
          localStorage.setItem('monvian_cached_spots', JSON.stringify(normalized));
        } catch {}
        return normalized;
      }

      if (error && error.message !== 'Timeout ao conectar com Supabase') {
        console.warn('[SupabaseSpots] Erro ao consultar spots:', error.message);
      }
    }
  } catch (err) {
    console.warn('[SupabaseSpots] Falha de rede ao consultar Supabase:', err);
  }

  // Fallback 1: Local cache in browser
  try {
    const cached = localStorage.getItem('monvian_cached_spots');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeSpotRecord);
      }
    }
  } catch {}

  // Fallback 2: Bundled CAMPOS_SPOTS
  return CAMPOS_SPOTS.map(normalizeSpotRecord);
}

/**
 * Persists a tourist spot to Supabase PostgreSQL with real validation and confirmation.
 * Throws an Error if the database rejected the record.
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
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;

  const finalGallery = Array.isArray(spotData.gallery)
    ? spotData.gallery
    : spotData.image
      ? [spotData.image]
      : [];

  const latNum = Number(spotData.lat);
  const lngNum = Number(spotData.lng);

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

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não está configurado no ambiente atual. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  // 1. Direct PostgreSQL Upsert in Supabase
  const { data, error } = await supabase
    .from('spots')
    .upsert(payload, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('[SupabaseSpots] Erro ao gravar ponto turístico no Supabase:', error);
    throw new Error(`Falha no banco Supabase: ${error.message || 'Erro desconhecido'}`);
  }

  const savedRecord = data && data.length > 0 ? data[0] : payload;
  const normalized = normalizeSpotRecord(savedRecord);

  // 2. Also optionally notify local backend API if available (fails silently if on static Vercel)
  try {
    const token = localStorage.getItem('monvian_token');
    const endpoint = isEdit ? `/api/admin/spots/${spotId}` : '/api/admin/spots';
    const method = isEdit ? 'PUT' : 'POST';
    fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}

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

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não está configurado.');
  }

  const { error } = await supabase.from('spots').delete().eq('id', spotId);

  if (error) {
    console.error('[SupabaseSpots] Erro ao excluir ponto no Supabase:', error);
    throw new Error(`Erro ao excluir no Supabase: ${error.message}`);
  }

  // Attempt backend API notification (fails silently if on Vercel)
  try {
    const token = localStorage.getItem('monvian_token');
    fetch(`/api/admin/spots/${spotId}`, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).catch(() => {});
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
  if (!isSupabaseConfigured || !supabase) return false;

  const { error } = await supabase
    .from('spots')
    .update({ is_active: isActive ? 1 : 0, updated_at: new Date().toISOString() })
    .eq('id', spotId);

  if (error) {
    throw new Error(error.message);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('monvian:spots_updated', { detail: { spotId, isActive, action: 'toggleActive' } }));
  }

  return true;
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
