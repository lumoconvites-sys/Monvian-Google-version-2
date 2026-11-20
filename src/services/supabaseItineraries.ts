import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import type { Itinerary, ItineraryCategory, ItineraryDay, ItineraryStep, Spot } from '../types.ts';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries.ts';

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

  const isManual =
    String(row.id || '').startsWith('manual-itin-') ||
    String(row.id || '').startsWith('user-itin-');
  const isFreeDefault =
    row.id === 'roteiro-classico-2-dias' ||
    row.id === 'roteiro-bate-volta-essencial';
  const isPaidDefault =
    row.id === 'roteiro-romantico-montanhas' ||
    row.id === 'roteiro-natureza-aventura' ||
    row.id === 'roteiro-gastronomia-chocolates';

  const hasExplicitFlag = row.is_premium !== undefined && row.is_premium !== null;
  const isPremium = isManual
    ? false
    : isFreeDefault
      ? (hasExplicitFlag ? Number(row.is_premium) === 1 : false)
      : hasExplicitFlag
        ? (Number(row.is_premium) === 1 || (isPaidDefault && (row.price === 'R$ 0' || row.price === 'Grátis')))
        : row.isPremium !== undefined
          ? Boolean(row.isPremium)
          : isPaidDefault;

  const rawPlatPrice = Number(row.platanos_price ?? row.platanosPrice ?? 0);
  const platanosPrice = isPremium ? (rawPlatPrice > 0 ? rawPlatPrice : 15) : 0;

  return {
    id: String(row.id),
    title: String(row.title || 'Roteiro Sem Título'),
    description: String(row.description || ''),
    coverImage: row.cover_image || row.coverImage || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
    videoUrl: row.video_url || row.videoUrl || undefined,
    daysCount: Number(row.days_count ?? row.daysCount ?? (days.length > 0 ? days.length : 1)),
    categories: parsedCategories,
    isActive: row.is_active !== undefined ? Number(row.is_active) === 1 : row.isActive !== false,
    isRecommended: row.is_recommended !== undefined ? Number(row.is_recommended) === 1 : Boolean(row.isRecommended),
    isFeatured: row.is_featured !== undefined ? Number(row.is_featured) === 1 : (row.is_recommended !== undefined ? Number(row.is_recommended) === 1 : Boolean(row.isFeatured)),
    isPremium,
    price: isPremium ? `${platanosPrice} Plátanos` : 'Grátis',
    platanosPrice,
    status: row.status || (Number(row.is_active) === 1 ? 'published' : 'draft'),
    badgeText: isPremium ? (row.badge_text || row.badgeText || `${platanosPrice} Plátanos`) : (row.badge_text || row.badgeText || 'Grátis'),
    showBadge: isPremium ? (row.show_badge !== undefined ? Number(row.show_badge) === 1 : true) : false,
    showPrice: true,
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

  const isPrem = Boolean(payload.isPremium);
  const platPrice = isPrem ? (Number(payload.platanosPrice) > 0 ? Number(payload.platanosPrice) : 15) : 0;

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
    is_premium: isPrem ? 1 : 0,
    price: isPrem ? `${platPrice} Plátanos` : 'Grátis',
    status,
    badge_text: isPrem ? (payload.badgeText || `${platPrice} Plátanos`) : 'Grátis',
    show_badge: isPrem ? 1 : 0,
    show_price: 1,
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
 * Toggles paid (Plátanos) status in Supabase and local cache
 */
export async function toggleItineraryPremiumInSupabase(
  id: string,
  isPremium: boolean
): Promise<boolean> {
  if (!id) return false;

  const val = isPremium ? 1 : 0;
  const platanosPrice = isPremium ? 15 : 0;
  const price = isPremium ? '15 Plátanos' : 'Grátis';
  const badgeText = isPremium ? '15 Plátanos' : 'Grátis';

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
        it.id === id ? { ...it, isPremium, platanosPrice, price, badgeText, showBadge: isPremium } : it
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
        price: itin.price || (itin.isPremium ? '15 Plátanos' : 'Grátis'),
        status: itin.status || 'published',
        badge_text: itin.badgeText || (itin.isPremium ? '15 Plátanos' : 'Grátis'),
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
  const handleLocalEvent = () => {
    clearItinerariesPageCache();
    onUpdate();
  };
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
          () => {
            clearItinerariesPageCache();
            onUpdate();
          }
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

// ============================================================================
// PROGRESSIVE PAGINATION ENGINE (Cursor / Range + Scoped Hydration + Caching)
// ============================================================================

export interface PaginatedItinerariesParams {
  limit: number;
  cursor?: string | null;
  offset?: number;
  category?: string;
  durationFilter?: 'all' | '1day' | 'multiday' | 'free';
  searchQuery?: string;
  excludeIds?: string[];
  includeFeaturedBanner?: boolean;
  forceRefresh?: boolean;
}

export interface PaginatedItinerariesResult {
  itineraries: Itinerary[];
  featuredItinerary: Itinerary | null;
  hasMore: boolean;
  nextCursor: string | null;
  nextOffset: number;
  totalMatching?: number;
}

const PAGE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes valid page cache
const paginatedPageCache = new Map<string, { timestamp: number; data: PaginatedItinerariesResult }>();
const inFlightPaginatedRequests = new Map<string, Promise<PaginatedItinerariesResult>>();

export function clearItinerariesPageCache(): void {
  paginatedPageCache.clear();
}

function normalizeToken(val: string): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesItineraryFilter(
  itin: Itinerary,
  category = 'all',
  durationFilter: 'all' | '1day' | 'multiday' | 'free' = 'all',
  searchQuery = ''
): boolean {
  const normTitle = normalizeToken(itin.title || '');
  const normDesc = normalizeToken(itin.description || '');
  const cat = normalizeToken(category || 'all');

  // Regra estrita: O roteiro "Romântico" (itin-093850-ialh / roteiro-romantico-montanhas) não deve aparecer na área "todos",
  // aparecendo APENAS na área "destaques" (com estrela)
  const isExclusiveDestaqueItinerary =
    itin.id === 'itin-093850-ialh' ||
    itin.id === 'roteiro-romantico-montanhas' ||
    normTitle === 'romantico' ||
    (normTitle.includes('romantico') && (normDesc.includes('desfrute') || itin.isFeatured));

  if (isExclusiveDestaqueItinerary) {
    if (cat !== 'destaque' && cat !== 'destaques') {
      return false;
    }
  }

  // 1. Category Filter
  if (category && category !== 'all') {
    const cat = normalizeToken(category);
    if (cat === 'destaque' || cat === 'destaques' || cat === 'popular') {
      if (!itin.isFeatured && !itin.isRecommended && !isExclusiveDestaqueItinerary) return false;
    } else {
      const itinCats = (itin.categories || []).map(normalizeToken);
      const normTitle = normalizeToken(itin.title || '');

      if (cat === 'natureza' || cat === 'nature') {
        const ok =
          itinCats.some((c) => ['nature', 'natureza', 'ecotourism', 'ecoturismo'].includes(c)) ||
          normTitle.includes('natureza');
        if (!ok) return false;
      } else if (cat === 'romantico' || cat === 'romantic') {
        const ok =
          itinCats.some((c) => ['romantic', 'romantico', 'casais', 'casal', 'romance'].includes(c)) ||
          normTitle.includes('romantic') ||
          normTitle.includes('casal') ||
          normTitle.includes('casais');
        if (!ok) return false;
      } else if (cat === 'gastronomia' || cat === 'gastronomy') {
        const ok =
          itinCats.some((c) =>
            ['gastronomy', 'gastronomia', 'sweets', 'cafes', 'culinaria', 'fondue'].includes(c)
          ) ||
          normTitle.includes('gastronom') ||
          normTitle.includes('fondue');
        if (!ok) return false;
      } else if (cat === 'aventura' || cat === 'adventure') {
        const ok =
          itinCats.some((c) => ['adventure', 'aventura', 'trilhas', 'radical', 'esportes'].includes(c)) ||
          normTitle.includes('aventur') ||
          normTitle.includes('trilha');
        if (!ok) return false;
      } else if (cat === 'familia' || cat === 'family') {
        const ok =
          itinCats.some((c) => ['family', 'familia', 'kids', 'criancas'].includes(c)) ||
          normTitle.includes('familia');
        if (!ok) return false;
      } else if (cat === 'terror') {
        const ok =
          itinCats.some((c) => ['terror', 'assombrado', 'misterio', 'sobrenatural'].includes(c)) ||
          normTitle.includes('terror');
        if (!ok) return false;
      } else if (!itinCats.includes(cat) && !normTitle.includes(cat)) {
        return false;
      }
    }
  }

  // 2. Duration / Type Filter
  if (durationFilter === '1day' && itin.daysCount !== 1) return false;
  if (durationFilter === 'multiday' && (itin.daysCount || 1) < 2) return false;
  if (durationFilter === 'free') {
    const isFree =
      !itin.isPremium ||
      itin.badgeText?.toLowerCase() === 'grátis' ||
      itin.price === 'R$ 0' ||
      itin.price === 'Grátis';
    if (!isFree) return false;
  }

  // 3. Search Query Filter
  const q = normalizeToken(searchQuery);
  if (q) {
    const matchesTitle = normalizeToken(itin.title).includes(q);
    const matchesDesc = normalizeToken(itin.description || '').includes(q);
    const matchesCat = (itin.categories || []).some((c) => normalizeToken(c).includes(q));
    const matchesSpots = (itin.days || []).some((d) =>
      (d.steps || []).some(
        (s) =>
          normalizeToken(s.spot?.name || '').includes(q) ||
          normalizeToken(s.spotName || '').includes(q) ||
          normalizeToken(s.customName || '').includes(q)
      )
    );
    if (!matchesTitle && !matchesDesc && !matchesCat && !matchesSpots) return false;
  }

  return true;
}

/**
 * Hydrates ONLY the given batch of raw itinerary rows by querying `itinerary_days`,
 * `itinerary_steps`, and `spots` scoped strictly to the batch's IDs.
 */
async function hydrateItineraryBatchFromSupabase(batchRows: any[]): Promise<Itinerary[]> {
  if (!supabase || batchRows.length === 0) return [];

  const batchIds = batchRows.map((r) => String(r.id));

  const [daysRes, stepsRes] = await Promise.all([
    safeSupabaseQuery(
      supabase
        .from('itinerary_days')
        .select('*')
        .in('itinerary_id', batchIds)
        .order('day_number', { ascending: true })
    ),
    safeSupabaseQuery(
      supabase
        .from('itinerary_steps')
        .select('*')
        .in('itinerary_id', batchIds)
        .order('step_order', { ascending: true })
    ),
  ]);

  const batchDays = Array.isArray(daysRes.data) ? daysRes.data : [];
  const batchSteps = Array.isArray(stepsRes.data) ? stepsRes.data : [];

  const spotIds = Array.from(
    new Set(batchSteps.map((st: any) => st.spot_id).filter(Boolean))
  );

  const spotsMap = new Map<string, any>();
  if (spotIds.length > 0) {
    const spotsRes = await safeSupabaseQuery(
      supabase
        .from('spots')
        .select('id, name, short_name, category, category_label, lat, lng, image, description')
        .in('id', spotIds)
    );
    const batchSpots = Array.isArray(spotsRes.data) ? spotsRes.data : [];
    for (const s of batchSpots) {
      spotsMap.set(s.id, s);
    }
  }

  const stepsByDay = new Map<string, ItineraryStep[]>();
  for (const st of batchSteps) {
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

  const daysByItin = new Map<string, ItineraryDay[]>();
  for (const d of batchDays) {
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

  return batchRows.map((row: any) => {
    const itinDays = daysByItin.get(row.id) || [];
    return normalizeItineraryRecord(row, itinDays);
  });
}

function paginateItinerariesArray(
  sourceList: Itinerary[],
  params: PaginatedItinerariesParams
): PaginatedItinerariesResult {
  const limit = Math.max(1, Math.min(24, params.limit || 4));
  const category = params.category || 'all';
  const durationFilter = params.durationFilter || 'all';
  const searchQuery = params.searchQuery || '';
  const cursor = params.cursor || null;
  const offset = Math.max(0, params.offset || 0);
  const excludeIds = new Set(params.excludeIds || []);

  // Deterministic ordering by sortOrder ASC, id ASC
  const sorted = [...sourceList]
    .filter((i) => i.isActive !== false)
    .sort((a, b) => {
      const sA = Number(a.sortOrder || 0);
      const sB = Number(b.sortOrder || 0);
      if (sA !== sB) return sA - sB;
      return String(a.id).localeCompare(String(b.id));
    });

  const matching = sorted.filter((itin) =>
    matchesItineraryFilter(itin, category, durationFilter, searchQuery)
  );

  let featuredItinerary: Itinerary | null = null;
  if (params.includeFeaturedBanner && !searchQuery.trim()) {
    featuredItinerary = matching.find((i) => i.isFeatured || i.isRecommended) || matching[0] || null;
    if (featuredItinerary) {
      excludeIds.add(featuredItinerary.id);
    }
  }

  const discoveryPool = matching.filter((i) => {
    if (excludeIds.has(i.id)) return false;
    if (
      featuredItinerary &&
      i.title.trim().toLowerCase() === featuredItinerary.title.trim().toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  let startIndex = offset;
  if (cursor) {
    const [cursorSortStr, cursorId] = cursor.split('|');
    const cursorSort = Number(cursorSortStr);
    const exactIdx = discoveryPool.findIndex((i) => i.id === cursorId);
    if (exactIdx >= 0) {
      startIndex = exactIdx + 1;
    } else if (!Number.isNaN(cursorSort)) {
      const nextIdx = discoveryPool.findIndex((i) => {
        const s = Number(i.sortOrder || 0);
        return s > cursorSort || (s === cursorSort && String(i.id) > (cursorId || ''));
      });
      startIndex = nextIdx >= 0 ? nextIdx : discoveryPool.length;
    }
  }

  const pageItems = discoveryPool.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + pageItems.length < discoveryPool.length;
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor =
    hasMore && lastItem ? `${Number(lastItem.sortOrder || 0)}|${lastItem.id}` : null;
  const nextOffset = startIndex + pageItems.length;

  return {
    itineraries: pageItems,
    featuredItinerary,
    hasMore,
    nextCursor,
    nextOffset,
    totalMatching: discoveryPool.length,
  };
}

/**
 * Fetches a paginated batch of itineraries with cursor/offset support,
 * DB-level filtering, scoped batch hydration, in-flight deduplication, and page caching.
 */
export async function fetchPaginatedItinerariesFromSupabase(
  params: PaginatedItinerariesParams
): Promise<PaginatedItinerariesResult> {
  const limit = Math.max(1, Math.min(24, params.limit || 4));
  const category = (params.category || 'all').trim();
  const durationFilter = params.durationFilter || 'all';
  const searchQuery = (params.searchQuery || '').trim();
  const cursor = params.cursor || null;
  const offset = Math.max(0, params.offset || 0);
  const excludeKey = (params.excludeIds || []).slice().sort().join(',');
  const includeFeatured = Boolean(params.includeFeaturedBanner);

  const cacheKey = `${category}|${durationFilter}|${searchQuery.toLowerCase()}|${cursor || ''}|${offset}|${limit}|${excludeKey}|${includeFeatured ? '1' : '0'}`;

  if (!params.forceRefresh) {
    const cachedPage = paginatedPageCache.get(cacheKey);
    if (cachedPage && Date.now() - cachedPage.timestamp < PAGE_CACHE_TTL_MS) {
      return cachedPage.data;
    }
  }

  const existingInFlight = inFlightPaginatedRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const executeQuery = async (): Promise<PaginatedItinerariesResult> => {
    // 1. Primary Path: Direct Supabase PostgreSQL Paginated Query + Scoped Hydration
    if (isSupabaseConfigured && supabase) {
      try {
        let baseQuery = supabase
          .from('itineraries')
          .select('*')
          .eq('is_active', 1)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true });

        // Push down filters to Supabase PostgreSQL where applicable
        const catNorm = normalizeToken(category);
        if (catNorm === 'destaque' || catNorm === 'popular') {
          baseQuery = baseQuery.or('is_featured.eq.1,is_recommended.eq.1');
        }
        if (durationFilter === '1day') {
          baseQuery = baseQuery.eq('days_count', 1);
        } else if (durationFilter === 'multiday') {
          baseQuery = baseQuery.gte('days_count', 2);
        } else if (durationFilter === 'free') {
          baseQuery = baseQuery.eq('is_premium', 0);
        }

        // If no complex client-side category synonym or spot-nested search is required,
        // use direct cursor/range pagination in PostgreSQL
        const canUseDirectSqlRange =
          (catNorm === 'all' || catNorm === 'destaque' || catNorm === 'popular') &&
          !searchQuery;

        if (canUseDirectSqlRange) {
          let featuredItinerary: Itinerary | null = null;
          const excludeIds = new Set(params.excludeIds || []);

          if (includeFeatured && (catNorm === 'all' || catNorm === 'destaque')) {
            const { data: featRows } = await safeSupabaseQuery(
              supabase
                .from('itineraries')
                .select('*')
                .eq('is_active', 1)
                .or('is_featured.eq.1,is_recommended.eq.1')
                .order('sort_order', { ascending: true })
                .order('id', { ascending: true })
                .limit(1),
              3500
            );
            if (Array.isArray(featRows) && featRows.length > 0) {
              const hydratedFeat = await hydrateItineraryBatchFromSupabase([featRows[0]]);
              featuredItinerary = hydratedFeat[0] || null;
              if (featuredItinerary) {
                excludeIds.add(featuredItinerary.id);
              }
            }
          }

          let pageQuery = supabase
            .from('itineraries')
            .select('*')
            .eq('is_active', 1);

          if (catNorm === 'destaque' || catNorm === 'popular') {
            pageQuery = pageQuery.or('is_featured.eq.1,is_recommended.eq.1');
          }
          if (durationFilter === '1day') {
            pageQuery = pageQuery.eq('days_count', 1);
          } else if (durationFilter === 'multiday') {
            pageQuery = pageQuery.gte('days_count', 2);
          } else if (durationFilter === 'free') {
            pageQuery = pageQuery.eq('is_premium', 0);
          }

          if (excludeIds.size > 0) {
            const excludeList = Array.from(excludeIds)
              .map((id) => `"${String(id).replace(/"/g, '')}"`)
              .join(',');
            pageQuery = pageQuery.not('id', 'in', `(${excludeList})`);
          }

          if (cursor) {
            const [cursorSortStr, cursorId] = cursor.split('|');
            const cursorSort = Number(cursorSortStr);
            if (!Number.isNaN(cursorSort) && cursorId) {
              pageQuery = pageQuery.or(
                `sort_order.gt.${cursorSort},and(sort_order.eq.${cursorSort},id.gt.${cursorId})`
              );
            }
            pageQuery = pageQuery
              .order('sort_order', { ascending: true })
              .order('id', { ascending: true })
              .limit(limit + 1);
          } else {
            pageQuery = pageQuery
              .order('sort_order', { ascending: true })
              .order('id', { ascending: true })
              .range(offset, offset + limit);
          }

          const { data: rawPageRows, error: pageErr } = await safeSupabaseQuery(pageQuery, 4000);

          if (!pageErr && Array.isArray(rawPageRows)) {
            if (rawPageRows.length === 0 && offset === 0 && !cursor && !featuredItinerary && catNorm === 'all' && durationFilter === 'all') {
              // Table is completely empty -> seed defaults once
              await seedItinerariesIntoSupabase();
              const seededResult = paginateItinerariesArray(DEFAULT_CURATED_ITINERARIES, params);
              paginatedPageCache.set(cacheKey, { timestamp: Date.now(), data: seededResult });
              return seededResult;
            }

            const hasMore = rawPageRows.length > limit;
            const slicedRows = rawPageRows.slice(0, limit);
            const hydratedBatch = await hydrateItineraryBatchFromSupabase(slicedRows);
            const lastItem = hydratedBatch[hydratedBatch.length - 1];
            const nextCursor =
              hasMore && lastItem ? `${Number(lastItem.sortOrder || 0)}|${lastItem.id}` : null;
            const nextOffset = offset + hydratedBatch.length;

            const result: PaginatedItinerariesResult = {
              itineraries: hydratedBatch,
              featuredItinerary,
              hasMore,
              nextCursor,
              nextOffset,
            };
            paginatedPageCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return result;
          }
        } else {
          // Filtered category or search query: fetch lightweight itinerary metadata rows,
          // filter before hydration, then hydrate ONLY the current page's slice!
          const { data: rawMetaRows, error: metaErr } = await safeSupabaseQuery(baseQuery, 4000);
          if (!metaErr && Array.isArray(rawMetaRows) && rawMetaRows.length > 0) {
            const lightweightItins = rawMetaRows.map((r: any) => normalizeItineraryRecord(r, []));
            const matchingLight = lightweightItins.filter((it) =>
              matchesItineraryFilter(it, category, durationFilter, searchQuery)
            );

            const excludeIds = new Set(params.excludeIds || []);
            let featuredItinerary: Itinerary | null = null;
            if (
              includeFeatured &&
              !searchQuery &&
              (catNorm === 'all' || catNorm === 'destaque')
            ) {
              const featLight = matchingLight.find((i) => i.isFeatured || i.isRecommended);
              if (featLight) {
                const featRaw = rawMetaRows.find((r: any) => String(r.id) === featLight.id);
                if (featRaw) {
                  const hydratedFeat = await hydrateItineraryBatchFromSupabase([featRaw]);
                  featuredItinerary = hydratedFeat[0] || null;
                }
                excludeIds.add(featLight.id);
              }
            }

            const discoveryLight = matchingLight.filter((i) => !excludeIds.has(i.id));
            let startIndex = offset;
            if (cursor) {
              const [cursorSortStr, cursorId] = cursor.split('|');
              const cursorSort = Number(cursorSortStr);
              const exactIdx = discoveryLight.findIndex((i) => i.id === cursorId);
              if (exactIdx >= 0) {
                startIndex = exactIdx + 1;
              } else if (!Number.isNaN(cursorSort)) {
                const nextIdx = discoveryLight.findIndex((i) => {
                  const s = Number(i.sortOrder || 0);
                  return s > cursorSort || (s === cursorSort && String(i.id) > (cursorId || ''));
                });
                startIndex = nextIdx >= 0 ? nextIdx : discoveryLight.length;
              }
            }

            const sliceLight = discoveryLight.slice(startIndex, startIndex + limit);
            const sliceIds = new Set(sliceLight.map((i) => i.id));
            const rawSliceRows = rawMetaRows.filter((r: any) => sliceIds.has(String(r.id)));
            const hydratedBatch = await hydrateItineraryBatchFromSupabase(rawSliceRows);

            const hasMore = startIndex + hydratedBatch.length < discoveryLight.length;
            const lastItem = hydratedBatch[hydratedBatch.length - 1];
            const nextCursor =
              hasMore && lastItem ? `${Number(lastItem.sortOrder || 0)}|${lastItem.id}` : null;
            const nextOffset = startIndex + hydratedBatch.length;

            const result: PaginatedItinerariesResult = {
              itineraries: hydratedBatch,
              featuredItinerary,
              hasMore,
              nextCursor,
              nextOffset,
              totalMatching: discoveryLight.length,
            };
            paginatedPageCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return result;
          }
        }
      } catch (err) {
        console.warn('[SupabaseItineraries] Paginated Supabase query notice, trying API fallback:', err);
      }
    }

    // 2. Fallback 1: Same-Origin Backend API (/api/itineraries?paginated=true&...)
    if (typeof window !== 'undefined') {
      try {
        const qs = new URLSearchParams({
          paginated: 'true',
          limit: String(limit),
          offset: String(offset),
          category,
          duration: durationFilter,
        });
        if (cursor) qs.set('cursor', cursor);
        if (searchQuery) qs.set('search', searchQuery);
        if (includeFeatured) qs.set('includeFeaturedBanner', 'true');
        if (params.excludeIds && params.excludeIds.length > 0) {
          qs.set('excludeIds', params.excludeIds.join(','));
        }

        const res = await fetch(`/api/itineraries?${qs.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.itineraries)) {
            const normalizedBatch = json.itineraries.map((it: any) =>
              normalizeItineraryRecord(it, Array.isArray(it.days) ? it.days : [])
            );
            const normalizedFeatured = json.featuredItinerary
              ? normalizeItineraryRecord(
                  json.featuredItinerary,
                  Array.isArray(json.featuredItinerary.days) ? json.featuredItinerary.days : []
                )
              : null;

            const result: PaginatedItinerariesResult = {
              itineraries: normalizedBatch,
              featuredItinerary: normalizedFeatured,
              hasMore: Boolean(json.hasMore),
              nextCursor: json.nextCursor || null,
              nextOffset: Number(json.nextOffset ?? offset + normalizedBatch.length),
              totalMatching: json.totalMatching,
            };
            paginatedPageCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return result;
          }
        }
      } catch (apiErr) {
        console.warn('[SupabaseItineraries] Paginated API fallback notice:', apiErr);
      }
    }

    // 3. Fallback 2: LocalStorage Cache or Curated Default Itineraries
    let fallbackList: Itinerary[] = DEFAULT_CURATED_ITINERARIES;
    try {
      const cached = localStorage.getItem(CACHE_KEY_ITINERARIES);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fallbackList = parsed;
        }
      }
    } catch {}

    const fallbackResult = paginateItinerariesArray(fallbackList, params);
    paginatedPageCache.set(cacheKey, { timestamp: Date.now(), data: fallbackResult });
    return fallbackResult;
  };

  const requestPromise = executeQuery().finally(() => {
    inFlightPaginatedRequests.delete(cacheKey);
  });

  inFlightPaginatedRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

