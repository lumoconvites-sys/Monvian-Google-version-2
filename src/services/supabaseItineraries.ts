import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Itinerary, ItineraryCategory, ItineraryDay, ItineraryStep, Spot } from '../types';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries';

export const CACHE_KEY_ITINERARIES = 'monvian_cached_itineraries';
export const CACHE_KEY_ITINERARY_CATEGORIES = 'monvian_cached_itinerary_categories';

export const INITIAL_STORE_CATEGORIES: ItineraryCategory[] = [
  { id: 'popular', name: 'Mais procurados', icon: 'Sparkles', sortOrder: 1, description: 'Os roteiros mais bem avaliados pelos viajantes', isActive: true },
  { id: 'nature', name: 'Natureza', icon: 'Trees', sortOrder: 2, description: 'Jardins, bosques, cachoeiras e mirantes', isActive: true },
  { id: 'romantic', name: 'Casais', icon: 'Heart', sortOrder: 3, description: 'Experiências a dois com vista e aconchego', isActive: true },
  { id: 'gastronomy', name: 'Gastronomia', icon: 'UtensilsCrossed', sortOrder: 4, description: 'Alta gastronomia alpina, fondues e chocolates', isActive: true },
  { id: 'adventure', name: 'Aventura', icon: 'Compass', sortOrder: 5, description: 'Trilhas, arvorismo e passeios radicais', isActive: true },
  { id: '1day', name: '1 dia', icon: 'Calendar', sortOrder: 6, description: 'Roteiros de bate-e-volta e experiências de 1 dia', isActive: true },
  { id: '2days', name: '2 dias', icon: 'CalendarDays', sortOrder: 7, description: 'Roteiros perfeitos para passar o fim de semana', isActive: true },
  { id: 'family', name: 'Família', icon: 'Users', sortOrder: 8, description: 'Parques com atrações ao ar livre e segurança', isActive: true },
  { id: 'cafes', name: 'Cafés & Bistrôs', icon: 'Coffee', sortOrder: 9, description: 'Cafés coloniais e bistrôs acolhedores na montanha', isActive: true },
];

/**
 * Normalizes an itinerary database record and its days/steps into the frontend model.
 */
export function normalizeItineraryRecord(
  row: any,
  days: ItineraryDay[] = []
): Itinerary {
  let parsedCategories: string[] = [];
  if (Array.isArray(row.categories)) {
    parsedCategories = row.categories;
  } else if (typeof row.categories === 'string' && row.categories.trim()) {
    try {
      const parsed = JSON.parse(row.categories);
      if (Array.isArray(parsed)) parsedCategories = parsed;
    } catch {
      parsedCategories = row.categories.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  const hasExplicitPremium =
    row.is_premium !== undefined && row.is_premium !== null
      ? Number(row.is_premium) === 1 || row.is_premium === true
      : row.isPremium !== undefined
        ? Boolean(row.isPremium)
        : false;

  const isPrem = hasExplicitPremium;
  const badge = isPrem
    ? row.badge_text && row.badge_text.toLowerCase() !== 'livre'
      ? row.badge_text
      : row.badgeText && row.badgeText.toLowerCase() !== 'livre'
        ? row.badgeText
        : 'ELITE GOLD'
    : 'Livre';

  return {
    id: String(row.id),
    title: String(row.title || 'Roteiro Sem Título'),
    description: String(row.description || ''),
    coverImage: row.cover_image || row.coverImage || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
    daysCount: Number(row.days_count ?? row.daysCount ?? (days.length > 0 ? days.length : 1)),
    categories: parsedCategories,
    isActive: row.is_active !== undefined ? Number(row.is_active) === 1 : row.isActive !== false,
    isRecommended: row.is_recommended !== undefined ? Number(row.is_recommended) === 1 : Boolean(row.isRecommended),
    isFeatured: row.is_featured !== undefined ? Number(row.is_featured) === 1 : (row.is_recommended !== undefined ? Number(row.is_recommended) === 1 : Boolean(row.isFeatured)),
    isPremium: isPrem,
    price: isPrem ? (row.price && row.price !== 'Grátis' && row.price !== 'R$ 0' ? row.price : '15 Plátanos') : 'Grátis',
    platanosPrice: isPrem
      ? Number(row.platanos_price ?? row.platanosPrice ?? 15) > 0
        ? Number(row.platanos_price ?? row.platanosPrice ?? 15)
        : 15
      : 0,
    status: row.status || (Number(row.is_active) === 1 ? 'published' : 'draft'),
    badgeText: badge,
    showBadge: row.show_badge !== undefined ? Number(row.show_badge) === 1 : true,
    showPrice: row.show_price !== undefined ? Number(row.show_price) === 1 : true,
    showStopsCount: row.show_stops_count !== undefined ? Number(row.show_stops_count) === 1 : true,
    tips: row.tips || row.notes || '',
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    usageCount: Number(row.usage_count ?? row.usageCount ?? 0),
    notes: row.notes || '',
    days: days || [],
  };
}

/**
 * Helper to race a Supabase query against a timeout and catch network aborts safely
 */
async function safeSupabaseQuery<T = any>(
  promiseLike: PromiseLike<{ data: T | null; error: any }>,
  timeoutMs = 4000
): Promise<{ data: T | null; error: any }> {
  let timer: any = null;
  const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
    timer = setTimeout(() => {
      resolve({ data: null, error: { message: 'Timeout querying Supabase' } });
    }, timeoutMs);
  });

  const queryPromise = Promise.resolve(promiseLike).catch((err: any) => ({
    data: null,
    error: { message: err?.message || 'Network request failed' },
  }));

  try {
    return await Promise.race([queryPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fetches all categories for itineraries from Supabase.
 * If Supabase is empty, seeds the initial categories.
 */
export async function fetchItineraryCategoriesFromSupabase(): Promise<ItineraryCategory[]> {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await safeSupabaseQuery(
        supabase
          .from('itinerary_categories')
          .select('*')
          .order('sort_order', { ascending: true })
      );

      if (!error && Array.isArray(data) && data.length > 0) {
        const normalized = data.map((c: any) => ({
          id: String(c.id),
          name: String(c.name),
          icon: c.icon || 'Compass',
          description: c.description || '',
          sortOrder: Number(c.sort_order || 0),
          isActive: c.is_active !== undefined ? Number(c.is_active) === 1 : true,
        }));
        try {
          localStorage.setItem(CACHE_KEY_ITINERARY_CATEGORIES, JSON.stringify(normalized));
        } catch {}
        return normalized;
      }

      // If empty in Supabase, seed them idempotently
      if (!error && Array.isArray(data) && data.length === 0) {
        await seedCategoriesIntoSupabase();
        return INITIAL_STORE_CATEGORIES;
      }
    }
  } catch {}

  // Fallback 1: Same-origin API
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/itinerary-categories');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.categories) && json.categories.length > 0) {
          try {
            localStorage.setItem(CACHE_KEY_ITINERARY_CATEGORIES, JSON.stringify(json.categories));
          } catch {}
          return json.categories;
        }
      }
    }
  } catch {}

  // Fallback 2: Cache
  try {
    const cached = localStorage.getItem(CACHE_KEY_ITINERARY_CATEGORIES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return INITIAL_STORE_CATEGORIES;
}

/**
 * Seeds default categories into Supabase
 */
export async function seedCategoriesIntoSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const payload = INITIAL_STORE_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description || '',
      sort_order: c.sortOrder || 0,
      is_active: c.isActive !== false ? 1 : 0,
    }));
    await safeSupabaseQuery(supabase.from('itinerary_categories').upsert(payload, { onConflict: 'id' }));
  } catch {}
}

/**
 * Fetches all curated and admin itineraries from Supabase PostgreSQL.
 * Queries itineraries, days, steps and spots to build complete models.
 */
export async function fetchItinerariesFromSupabase(options?: {
  all?: boolean;
  throwOnError?: boolean;
}): Promise<Itinerary[]> {
  try {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('itineraries').select('*').order('sort_order', { ascending: true });
      if (!options?.all) {
        query = query.eq('is_active', 1);
      }

      const { data: rawItins, error: itinsErr } = await safeSupabaseQuery(query, 4500);

      if (!itinsErr && Array.isArray(rawItins)) {
        if (rawItins.length === 0) {
          // If Supabase table is empty, seed initial curated itineraries
          await seedItinerariesIntoSupabase();
          return DEFAULT_CURATED_ITINERARIES;
        }

        // Fetch days, steps, and spots in parallel for complete hydration
        const [daysRes, stepsRes, spotsRes] = await Promise.all([
          safeSupabaseQuery(supabase.from('itinerary_days').select('*').order('day_number', { ascending: true })),
          safeSupabaseQuery(supabase.from('itinerary_steps').select('*').order('step_order', { ascending: true })),
          safeSupabaseQuery(supabase.from('spots').select('id, name, short_name, category, category_label, lat, lng, image, description')),
        ]);

        const allDays = Array.isArray(daysRes.data) ? daysRes.data : [];
        const allSteps = Array.isArray(stepsRes.data) ? stepsRes.data : [];
        const allSpots = Array.isArray(spotsRes.data) ? spotsRes.data : [];

        const spotsMap = new Map<string, any>();
        for (const s of allSpots) {
          spotsMap.set(s.id, s);
        }

        // Group steps by day_id
        const stepsByDay = new Map<string, ItineraryStep[]>();
        for (const st of allSteps) {
          const dayId = st.day_id;
          if (!stepsByDay.has(dayId)) stepsByDay.set(dayId, []);
          const spotData = spotsMap.get(st.spot_id);

          stepsByDay.get(dayId)!.push({
            id: String(st.id),
            itineraryId: String(st.itinerary_id),
            dayId: String(st.day_id),
            spotId: String(st.spot_id),
            stepOrder: Number(st.step_order || 1),
            suggestedTime: st.suggested_time || '09:00',
            durationMinutes: Number(st.duration_minutes || 90),
            notes: st.notes || '',
            customName: st.custom_name || '',
            customDescription: st.custom_description || '',
            customTip: st.custom_tip || '',
            customImage: st.custom_image || '',
            spot: spotData
              ? {
                  id: spotData.id,
                  name: spotData.name,
                  category: spotData.category,
                  categoryLabel: spotData.category_label,
                  lat: Number(spotData.lat),
                  lng: Number(spotData.lng),
                  image: spotData.image,
                  description: spotData.description,
                }
              : undefined,
          });
        }

        // Group days by itinerary_id
        const daysByItin = new Map<string, ItineraryDay[]>();
        for (const d of allDays) {
          const itinId = d.itinerary_id;
          if (!daysByItin.has(itinId)) daysByItin.set(itinId, []);
          const daySteps = stepsByDay.get(d.id) || [];

          daysByItin.get(itinId)!.push({
            id: String(d.id),
            itineraryId: String(d.itinerary_id),
            dayNumber: Number(d.day_number || 1),
            title: d.title || `Dia ${d.day_number}`,
            summary: d.summary || '',
            steps: daySteps,
          });
        }

        const normalizedItins = rawItins.map((row: any) => {
          const itinDays = daysByItin.get(row.id) || [];
          return normalizeItineraryRecord(row, itinDays);
        });

        // One-time cleanup for legacy seeded default itineraries that all had is_featured=1 / is_recommended=1
        try {
          const cleanupKey = 'monvian_cleanup_default_featured_v2';
          if (typeof window !== 'undefined' && !localStorage.getItem(cleanupKey)) {
            const defaultIds = new Set(DEFAULT_CURATED_ITINERARIES.map((d) => d.id));
            const secondaryDefaultIds = new Set(
              DEFAULT_CURATED_ITINERARIES.filter((d) => !d.isFeatured).map((d) => d.id)
            );
            const hasCustomFeatured = normalizedItins.some(
              (it) => !defaultIds.has(it.id) && (it.isFeatured || it.isRecommended)
            );
            const idsToUnfeature = normalizedItins
              .filter((it) =>
                (it.isFeatured || it.isRecommended) &&
                (hasCustomFeatured ? defaultIds.has(it.id) : secondaryDefaultIds.has(it.id))
              )
              .map((it) => it.id);

            if (idsToUnfeature.length > 0) {
              idsToUnfeature.forEach((id) => {
                const target = normalizedItins.find((it) => it.id === id);
                if (target) {
                  target.isFeatured = false;
                  target.isRecommended = false;
                }
              });
              safeSupabaseQuery(
                supabase
                  .from('itineraries')
                  .update({ is_featured: 0, is_recommended: 0 })
                  .in('id', idsToUnfeature)
              ).catch(() => {});
            }
            localStorage.setItem(cleanupKey, '1');
          }
        } catch {}

        try {
          localStorage.setItem(CACHE_KEY_ITINERARIES, JSON.stringify(normalizedItins));
        } catch {}

        return normalizedItins;
      }
    }
  } catch (err: any) {
    if (options?.throwOnError) throw err;
  }

  // Fallback 1: Same-origin backend API (/api/itineraries) — resilient to Safari cross-origin Load failed
  try {
    if (typeof window !== 'undefined') {
      const apiUrl = options?.all ? '/api/itineraries?all=true' : '/api/itineraries';
      const res = await fetch(apiUrl);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.itineraries) && json.itineraries.length > 0) {
          const normalizedFromApi = json.itineraries.map((it: any) =>
            normalizeItineraryRecord(it, Array.isArray(it.days) ? it.days : [])
          );
          try {
            localStorage.setItem(CACHE_KEY_ITINERARIES, JSON.stringify(normalizedFromApi));
          } catch {}
          return normalizedFromApi;
        }
      }
    }
  } catch {}

  // Fallback 2: LocalStorage Cache
  try {
    const cached = localStorage.getItem(CACHE_KEY_ITINERARIES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Fallback 3: Bundled DEFAULT_CURATED_ITINERARIES
  return DEFAULT_CURATED_ITINERARIES;
}

/**
 * Persists an itinerary and all its days and steps permanently to Supabase PostgreSQL.
 * Throws an Error if the database rejects the record.
 */
export async function saveItineraryToSupabase(payload: any, isEdit: boolean): Promise<Itinerary> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não está configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  if (!payload?.title || !String(payload.title).trim()) {
    throw new Error('O título do roteiro é obrigatório.');
  }

  const itinId =
    payload.id ||
    `itin-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;

  const daysArray = Array.isArray(payload.days) ? payload.days : [];
  const safeDaysCount = Math.max(1, Number(payload.daysCount) || daysArray.length || 1);
  const safeCategories = Array.isArray(payload.categories)
    ? JSON.stringify(payload.categories)
    : typeof payload.categories === 'string'
      ? payload.categories
      : '[]';

  const status = payload.status || (payload.isActive ? 'published' : 'draft');
  const isActive = status === 'published' ? 1 : 0;
  const isFeatured = payload.isFeatured ? 1 : (payload.isRecommended ? 1 : 0);

  const itineraryRow: any = {
    id: itinId,
    title: String(payload.title).trim(),
    description: String(payload.description || '').trim(),
    cover_image: payload.coverImage || payload.cover_image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
    days_count: safeDaysCount,
    categories: safeCategories,
    is_active: isActive,
    is_recommended: isFeatured,
    is_featured: isFeatured,
    is_premium: payload.isPremium !== undefined ? (payload.isPremium ? 1 : 0) : 1,
    price: payload.price || 'R$ 14,90',
    status,
    badge_text: payload.badgeText || (payload.isPremium ? 'Premium' : 'Livre'),
    show_badge: payload.showBadge !== undefined ? (payload.showBadge ? 1 : 0) : 1,
    show_price: payload.showPrice !== undefined ? (payload.showPrice ? 1 : 0) : 1,
    show_stops_count: payload.showStopsCount !== undefined ? (payload.showStopsCount ? 1 : 0) : 1,
    tips: payload.tips || payload.notes || '',
    sort_order: Number(payload.sortOrder ?? payload.sort_order ?? 0),
    notes: payload.notes || payload.tips || '',
    updated_at: new Date().toISOString(),
  };

  // 1. Upsert parent itinerary
  const { data: itinData, error: itinErr } = await supabase
    .from('itineraries')
    .upsert(itineraryRow, { onConflict: 'id' })
    .select();

  if (itinErr) {
    console.error('[SupabaseItineraries] Erro ao salvar roteiro:', itinErr);
    throw new Error(`Falha no banco Supabase: ${itinErr.message}`);
  }

  // 2. If editing or creating with days, replace days and steps
  if (daysArray.length > 0) {
    // Delete existing steps and days for this itinerary first
    await supabase.from('itinerary_steps').delete().eq('itinerary_id', itinId);
    await supabase.from('itinerary_days').delete().eq('itinerary_id', itinId);

    const daysRows: any[] = [];
    const stepsRows: any[] = [];

    daysArray.forEach((d: any, dIdx: number) => {
      const dayId = d.id || `${itinId}-day-${dIdx + 1}`;
      daysRows.push({
        id: dayId,
        itinerary_id: itinId,
        day_number: d.dayNumber || dIdx + 1,
        title: d.title || `Dia ${dIdx + 1}`,
        summary: d.summary || '',
      });

      const daySteps = Array.isArray(d.steps) ? d.steps : [];
      daySteps.forEach((s: any, sIdx: number) => {
        const stepId = s.id || `${dayId}-step-${sIdx + 1}`;
        stepsRows.push({
          id: stepId,
          itinerary_id: itinId,
          day_id: dayId,
          spot_id: s.spotId || s.spot_id,
          step_order: s.stepOrder || s.step_order || sIdx + 1,
          suggested_time: s.suggestedTime || s.suggested_time || '09:00',
          duration_minutes: Number(s.durationMinutes || s.duration_minutes || 90),
          notes: s.notes || '',
          custom_name: s.customName || s.custom_name || '',
          custom_description: s.customDescription || s.custom_description || '',
          custom_tip: s.customTip || s.custom_tip || '',
          custom_image: s.customImage || s.custom_image || '',
        });
      });
    });

    if (daysRows.length > 0) {
      const { error: daysErr } = await supabase.from('itinerary_days').insert(daysRows);
      if (daysErr) console.warn('[SupabaseItineraries] Notice inserting days:', daysErr);
    }

    if (stepsRows.length > 0) {
      const { error: stepsErr } = await supabase.from('itinerary_steps').insert(stepsRows);
      if (stepsErr) console.warn('[SupabaseItineraries] Notice inserting steps:', stepsErr);
    }
  }

  // 3. Best-effort notification to backend Express route if available
  try {
    const token = localStorage.getItem('monvian_token') || localStorage.getItem('monvian_auth_token');
    const endpoint = isEdit ? `/api/admin/itineraries/${itinId}` : '/api/admin/itineraries';
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

  const savedRecord = itinData && itinData.length > 0 ? itinData[0] : itineraryRow;
  const normalized = normalizeItineraryRecord(savedRecord, daysArray);

  // 4. Update local cache
  try {
    const cached = localStorage.getItem(CACHE_KEY_ITINERARIES);
    let list: Itinerary[] = cached ? JSON.parse(cached) : [];
    const idx = list.findIndex((it) => it.id === itinId);
    if (idx >= 0) {
      list[idx] = normalized;
    } else {
      list = [normalized, ...list];
    }
    localStorage.setItem(CACHE_KEY_ITINERARIES, JSON.stringify(list));
  } catch {}

  // 5. Broadcast change to all app components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monvian:itineraries_updated', {
        detail: { itinerary: normalized, id: itinId, action: 'save' },
      })
    );
  }

  return normalized;
}

/**
 * Deletes an itinerary permanently from Supabase PostgreSQL.
 */
export async function deleteItineraryFromSupabase(id: string): Promise<boolean> {
  if (!id || !isSupabaseConfigured || !supabase) return false;

  const { error } = await supabase.from('itineraries').delete().eq('id', id);
  if (error) {
    console.error('[SupabaseItineraries] Erro ao excluir roteiro no Supabase:', error);
    throw new Error(`Falha ao excluir no Supabase: ${error.message}`);
  }

  // Best effort backend notification
  try {
    const token = localStorage.getItem('monvian_token') || localStorage.getItem('monvian_auth_token');
    fetch(`/api/admin/itineraries/${id}`, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).catch(() => {});
  } catch {}

  // Update local cache
  try {
    const cached = localStorage.getItem(CACHE_KEY_ITINERARIES);
    if (cached) {
      const list: Itinerary[] = JSON.parse(cached);
      const filtered = list.filter((it) => it.id !== id);
      localStorage.setItem(CACHE_KEY_ITINERARIES, JSON.stringify(filtered));
    }
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monvian:itineraries_updated', {
        detail: { id, action: 'delete' },
      })
    );
  }

  return true;
}

/**
 * Toggles status (published / draft / hidden) in Supabase
 */
export async function toggleItineraryStatusInSupabase(
  id: string,
  newStatus: 'published' | 'draft' | 'hidden'
): Promise<boolean> {
  if (!id || !isSupabaseConfigured || !supabase) return false;

  const isActive = newStatus === 'published' ? 1 : 0;
  const { error } = await supabase
    .from('itineraries')
    .update({ status: newStatus, is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monvian:itineraries_updated', {
        detail: { id, status: newStatus, action: 'status' },
      })
    );
  }

  return true;
}

/**
 * Toggles featured status in Supabase
 */
export async function toggleItineraryFeaturedInSupabase(
  id: string,
  isFeatured: boolean
): Promise<boolean> {
  if (!id || !isSupabaseConfigured || !supabase) return false;

  const val = isFeatured ? 1 : 0;
  const { error } = await supabase
    .from('itineraries')
    .update({ is_featured: val, is_recommended: val, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monvian:itineraries_updated', {
        detail: { id, isFeatured, action: 'featured' },
      })
    );
  }

  return true;
}

/**
 * Toggles Premium (Elite Gold) status in Supabase and local cache
 */
export async function toggleItineraryPremiumInSupabase(
  id: string,
  isPremium: boolean
): Promise<boolean> {
  if (!id) return false;

  const val = isPremium ? 1 : 0;
  const price = isPremium ? 'R$ 19,90' : 'Grátis';
  const badgeText = isPremium ? 'ELITE GOLD' : 'Livre';

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('itineraries')
      .update({
        is_premium: val,
        price,
        badge_text: badgeText,
        show_badge: val,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY_ITINERARIES);
    if (cached) {
      const list: Itinerary[] = JSON.parse(cached);
      const updated = list.map((it) =>
        it.id === id ? { ...it, isPremium, price, badgeText, showBadge: isPremium } : it
      );
      localStorage.setItem(CACHE_KEY_ITINERARIES, JSON.stringify(updated));
    }
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monvian:itineraries_updated', {
        detail: { id, isPremium, action: 'premium' },
      })
    );
  }

  return true;
}

/**
 * Seeds DEFAULT_CURATED_ITINERARIES into Supabase if not yet present.
 */
export async function seedItinerariesIntoSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    for (const itin of DEFAULT_CURATED_ITINERARIES) {
      const itinPayload: any = {
        id: itin.id,
        title: itin.title,
        description: itin.description || '',
        cover_image: itin.coverImage || '',
        days_count: itin.daysCount || (itin.days?.length || 1),
        categories: JSON.stringify(itin.categories || []),
        is_active: itin.isActive !== false ? 1 : 0,
        is_recommended: itin.isRecommended ? 1 : 0,
        is_featured: itin.isFeatured ? 1 : 0,
        is_premium: itin.isPremium ? 1 : 0,
        price: itin.price || 'R$ 14,90',
        status: itin.status || 'published',
        badge_text: itin.badgeText || (itin.isPremium ? 'Premium' : 'Livre'),
        show_badge: itin.showBadge ? 1 : 0,
        show_price: itin.showPrice ? 1 : 0,
        show_stops_count: itin.showStopsCount ? 1 : 0,
        tips: itin.tips || '',
        sort_order: itin.sortOrder || 0,
        usage_count: itin.usageCount || 0,
        notes: itin.notes || '',
      };

      await supabase.from('itineraries').upsert(itinPayload, { onConflict: 'id' });

      if (Array.isArray(itin.days) && itin.days.length > 0) {
        for (const d of itin.days) {
          await supabase.from('itinerary_days').upsert(
            {
              id: d.id,
              itinerary_id: itin.id,
              day_number: d.dayNumber,
              title: d.title || `Dia ${d.dayNumber}`,
              summary: d.summary || '',
            },
            { onConflict: 'id' }
          );

          if (Array.isArray(d.steps) && d.steps.length > 0) {
            for (const s of d.steps) {
              await supabase.from('itinerary_steps').upsert(
                {
                  id: s.id,
                  itinerary_id: itin.id,
                  day_id: d.id,
                  spot_id: s.spotId,
                  step_order: s.stepOrder,
                  suggested_time: s.suggestedTime || '09:00',
                  duration_minutes: s.durationMinutes || 90,
                  notes: s.notes || '',
                  custom_name: s.customName || '',
                  custom_description: s.customDescription || '',
                  custom_tip: s.customTip || '',
                  custom_image: s.customImage || '',
                },
                { onConflict: 'id' }
              );
            }
          }
        }
      }
    }

    console.log(`[SupabaseItineraries] Successfully seeded ${DEFAULT_CURATED_ITINERARIES.length} curated itineraries into Supabase.`);
  } catch (err) {
    console.warn('[SupabaseItineraries] Notice during seeding itineraries:', err);
  }
}

/**
 * Realtime and local events subscriber for itineraries
 */
export function subscribeToItinerariesChanges(onUpdate: () => void): () => void {
  const handleLocalEvent = () => onUpdate();
  if (typeof window !== 'undefined') {
    window.addEventListener('monvian:itineraries_updated', handleLocalEvent);
  }

  let channel: any = null;
  try {
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('realtime:itineraries_all')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'itineraries' },
          () => onUpdate()
        )
        .subscribe();
    }
  } catch {}

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('monvian:itineraries_updated', handleLocalEvent);
    }
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {}
    }
  };
}
