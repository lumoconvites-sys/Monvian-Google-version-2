import { supabase, supabaseAnonClient } from './supabaseClient.ts';
import { isPrimaryAdmin } from './firestoreSync.ts';

/**
 * Helper to execute a Supabase promise with a safe timeout so server routes never hang
 */
async function withTimeout<T = any>(promise: PromiseLike<any>, ms = 4500, fallback: any = null): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export interface SupabaseUserRecord {
  id?: number;
  auth_id?: string | null;
  name: string;
  username?: string;
  username_normalized?: string;
  bio?: string;
  email: string;
  whatsapp: string;
  password_hash: string;
  role: string;
  avatar_url?: string;
  visits_count?: number;
  is_banned?: number;
  is_premium?: number;
  is_gold?: number;
  plan?: string;
  gold_activated_at?: string | null;
  snow_enabled?: number;
  theme?: string;
  high_contrast?: number;
  onboarding_completed?: number;
  onboarding_step?: number;
  welcome_card_seen?: number;
  last_access?: string;
  created_at?: string;
}

// =============================================================================
// 1. SUPABASE AUTH & USER SYNC
// =============================================================================

export async function verifySupabaseJwtUser(token: string): Promise<{
  authId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
} | null> {
  if (!supabaseAnonClient || !token || token.length < 40) return null;
  try {
    const res: any = await withTimeout(supabaseAnonClient.auth.getUser(token), 3000, { data: { user: null }, error: null } as any);
    const u = res?.data?.user;
    if (!u || !u.email) return null;
    return {
      authId: u.id,
      email: u.email.trim().toLowerCase(),
      name: u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0],
      avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture,
    };
  } catch {
    return null;
  }
}

export async function persistUserToSupabase(user: SupabaseUserRecord): Promise<void> {
  if (!supabase || !user.email) return;
  const cleanEmail = user.email.trim().toLowerCase();
  const isAdmin = isPrimaryAdmin(cleanEmail) || user.role === 'admin';
  const isGold = isAdmin || user.is_gold === 1 || user.plan === 'gold';

  try {
    const payload: any = {
      name: user.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      whatsapp: user.whatsapp || cleanEmail,
      password_hash: user.password_hash || '',
      username: user.username || cleanEmail.split('@')[0],
      username_normalized: (user.username_normalized || user.username || cleanEmail.split('@')[0]).toLowerCase(),
      bio: user.bio || '',
      role: isAdmin ? 'admin' : 'user',
      avatar_url: user.avatar_url || '/fotoperfil.png',
      visits_count: user.visits_count || 1,
      is_banned: user.is_banned || 0,
      is_premium: isGold ? 1 : 0,
      is_gold: isGold ? 1 : 0,
      plan: isGold ? 'gold' : 'beta',
      gold_activated_at: user.gold_activated_at || null,
      snow_enabled: user.snow_enabled || 0,
      theme: user.theme || 'dark',
      high_contrast: user.high_contrast || 0,
      onboarding_completed: user.onboarding_completed !== undefined ? user.onboarding_completed : 1,
      onboarding_step: user.onboarding_step || 1,
      last_access: user.last_access || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (user.auth_id) payload.auth_id = user.auth_id;
    if (user.welcome_card_seen !== undefined) {
      payload.welcome_card_seen = user.welcome_card_seen ? 1 : 0;
    }

    await withTimeout(
      supabase.from('users').upsert(payload, { onConflict: 'email' }),
      3500,
      null
    );
  } catch {}
}

export async function getUserFromSupabase(emailOrUsername: string): Promise<SupabaseUserRecord | null> {
  if (!supabase || !emailOrUsername) return null;
  const clean = emailOrUsername.trim().toLowerCase();
  try {
    const { data }: any = await withTimeout(
      supabase
        .from('users')
        .select('*')
        .or(`email.ilike.${clean},username_normalized.eq.${clean},whatsapp.ilike.${clean}`)
        .limit(1)
        .maybeSingle(),
      3000,
      { data: null }
    );
    return data || null;
  } catch {
    return null;
  }
}

export async function persistSessionToSupabase(token: string, userId: number): Promise<void> {
  if (!supabase || !token || !userId) return;
  try {
    await withTimeout(
      supabase.from('sessions').upsert(
        {
          token,
          user_id: userId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      ),
      3000,
      null
    );
  } catch {}
}

export async function deleteSessionFromSupabase(token: string): Promise<void> {
  if (!supabase || !token) return;
  try {
    await withTimeout(supabase.from('sessions').delete().eq('token', token), 3000, null);
  } catch {}
}

export async function getSessionFromSupabase(token: string): Promise<{ token: string; user_id: number } | null> {
  if (!supabase || !token) return null;
  try {
    const { data } = await withTimeout(
      supabase.from('sessions').select('token, user_id').eq('token', token).maybeSingle(),
      3000,
      { data: null }
    );
    return data || null;
  } catch {
    return null;
  }
}

// =============================================================================
// 2. SPOTS & TOURIST ATTRACTIONS PERSISTENCE
// =============================================================================

export async function persistSpotToSupabase(spot: any): Promise<void> {
  if (!supabase || !spot?.id) return;
  try {
    const isStarBool = Boolean(spot.is_star === 1 || spot.is_star === true || spot.isStar === true || spot.badge === 'Estrela');
    const payload = {
      id: String(spot.id),
      name: String(spot.name || ''),
      short_name: spot.short_name || spot.shortName || spot.name || '',
      tag_label: spot.tag_label || spot.tagLabel || spot.name || '',
      category: spot.category || 'attractions',
      category_label: spot.category_label || spot.categoryLabel || spot.category || 'Atrações',
      lat: Number(spot.lat ?? -22.7394),
      lng: Number(spot.lng ?? -45.5913),
      image: spot.image || '',
      gallery: typeof spot.gallery === 'string' ? spot.gallery : JSON.stringify(spot.gallery || []),
      description: spot.description || '',
      tourist_tip: spot.tourist_tip || spot.touristTip || '',
      rating: Number(spot.rating ?? 4.8),
      review_count: Number(spot.review_count ?? spot.reviewCount ?? 0),
      hours: spot.hours || '',
      address: spot.address || 'Campos do Jordão, SP',
      price_range: spot.price_range || spot.priceRange || '$$',
      price: spot.price || '',
      popular_times: spot.popular_times || '',
      visitors_today: Number(spot.visitors_today || 0),
      badge: isStarBool ? 'Estrela' : (spot.badge === 'Estrela' ? '' : (spot.badge || '')),
      highlighted: spot.highlighted || isStarBool ? 1 : 0,
      is_active: spot.is_active !== undefined ? Number(spot.is_active) : spot.isActive !== false ? 1 : 0,
      is_verified: spot.is_verified !== undefined ? Number(spot.is_verified) : spot.isVerified !== false ? 1 : 0,
      website: spot.website || '',
      phone: spot.phone || '',
      maps_url: spot.maps_url || spot.mapsUrl || '',
      available_for_itinerary: spot.available_for_itinerary !== undefined ? Number(spot.available_for_itinerary) : 1,
      duration_minutes: Number(spot.duration_minutes || spot.durationMinutes || 90),
      tags: Array.isArray(spot.tags) ? spot.tags.join(', ') : String(spot.tags || ''),
      updated_at: new Date().toISOString(),
    };

    await withTimeout(supabase.from('spots').upsert(payload, { onConflict: 'id' }), 4000, null);
  } catch {}
}

export async function deleteSpotFromSupabase(spotId: string): Promise<void> {
  if (!supabase || !spotId) return;
  try {
    await withTimeout(supabase.from('spots').delete().eq('id', spotId), 3500, null);
  } catch {}
}

// =============================================================================
// 3. MAP VISUAL ICONS, EVENTS & SYSTEM SETTINGS PERSISTENCE
// =============================================================================

export async function persistMapVisualIconToSupabase(icon: any): Promise<void> {
  if (!supabase || !icon?.id) return;
  try {
    await withTimeout(
      supabase.from('map_visual_icons').upsert(
        {
          id: String(icon.id),
          category: String(icon.category),
          icon: String(icon.icon || icon.category),
          latitude: Number(icon.latitude),
          longitude: Number(icon.longitude),
          color: icon.color || null,
          is_active: icon.is_active !== undefined ? Number(icon.is_active) : 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      ),
      3500,
      null
    );
  } catch {}
}

export async function deleteMapVisualIconFromSupabase(iconId: string): Promise<void> {
  if (!supabase || !iconId) return;
  try {
    await withTimeout(supabase.from('map_visual_icons').delete().eq('id', iconId), 3500, null);
  } catch {}
}

export async function persistEventToSupabase(evt: any): Promise<void> {
  if (!supabase || !evt?.id) return;
  try {
    await withTimeout(
      supabase.from('events').upsert(
        {
          id: String(evt.id),
          name: String(evt.name),
          description: evt.description || '',
          image: evt.image || '',
          category: evt.category || 'Música & Cultura',
          date: evt.date || '',
          time: evt.time || '',
          address: evt.address || 'Campos do Jordão, SP',
          lat: Number(evt.lat ?? -22.7345),
          lng: Number(evt.lng ?? -45.5912),
          status: evt.status || 'active',
          highlighted: evt.highlighted ? 1 : 0,
        },
        { onConflict: 'id' }
      ),
      3500,
      null
    );
  } catch {}
}

export async function deleteEventFromSupabase(eventId: string): Promise<void> {
  if (!supabase || !eventId) return;
  try {
    await withTimeout(supabase.from('events').delete().eq('id', eventId), 3500, null);
  } catch {}
}

export async function persistSystemSettingToSupabase(key: string, value: string): Promise<void> {
  if (!supabase || !key) return;
  try {
    await withTimeout(
      supabase.from('system_settings').upsert(
        {
          key,
          value: String(value),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      ),
      3000,
      null
    );
  } catch {}
}

// =============================================================================
// 4. FAVORITES, SOCIAL, STORIES, HOST PROFILES & PURCHASES
// =============================================================================

export async function persistFavoriteToSupabase(
  userId: string,
  itemType: string,
  itemId: string,
  isSaved: boolean
): Promise<void> {
  if (!supabase || !userId || !itemId) return;
  try {
    if (isSaved) {
      await withTimeout(
        supabase.from('user_favorites').upsert(
          {
            user_id: String(userId),
            item_type: itemType,
            item_id: itemId,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,item_type,item_id' }
        ),
        3000,
        null
      );
      if (itemType === 'spot' || itemType === 'place') {
        await withTimeout(
          supabase.from('favorites').upsert(
            {
              user_id: String(userId),
              spot_id: itemId,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,spot_id' }
          ),
          3000,
          null
        );
      }
    } else {
      await withTimeout(
        supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', String(userId))
          .eq('item_type', itemType)
          .eq('item_id', itemId),
        3000,
        null
      );
      await withTimeout(
        supabase
          .from('favorites')
          .delete()
          .eq('user_id', String(userId))
          .eq('spot_id', itemId),
        3000,
        null
      );
    }
  } catch {}
}

export async function persistPostToSupabase(post: any): Promise<void> {
  if (!supabase || !post?.id) return;
  try {
    await withTimeout(
      supabase.from('posts').upsert(
        {
          id: post.id,
          user_id: String(post.user_id),
          user_name: post.user_name,
          user_username: post.user_username || post.user_name?.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          user_photo: post.user_photo || '',
          image_url: post.image_url,
          caption: post.caption || '',
          location: post.location || 'Campos do Jordão, SP',
          likes_count: Number(post.likes_count || 0),
          comments_count: Number(post.comments_count || 0),
          created_at: post.created_at || new Date().toISOString(),
        },
        { onConflict: 'id' }
      ),
      3500,
      null
    );
  } catch {}
}

export async function persistStoryToSupabase(story: any): Promise<void> {
  if (!supabase || !story?.id) return;
  try {
    await withTimeout(
      supabase.from('stories').upsert(
        {
          id: story.id,
          user_id: String(story.user_id),
          user_name: story.user_name,
          user_photo: story.user_photo,
          media_url: story.media_url,
          media_type: story.media_type || 'image',
          caption: story.caption || '',
          location: story.location || '',
          views_count: Number(story.views_count || 0),
          created_at: story.created_at || new Date().toISOString(),
          expires_at: story.expires_at,
          status: story.status || 'active',
        },
        { onConflict: 'id' }
      ),
      3500,
      null
    );
  } catch {}
}

export async function persistHostProfileToSupabase(record: any): Promise<void> {
  if (!supabase || !record?.user_email) return;
  try {
    await withTimeout(
      supabase.from('host_profiles').upsert(
        {
          user_id: record.user_id,
          user_email: record.user_email.trim().toLowerCase(),
          status: record.status || 'incomplete',
          onboarding_completed: record.onboarding_completed ? 1 : 0,
          current_step: record.current_step || 1,
          full_name: record.full_name || '',
          contact_email: record.contact_email || '',
          cpf_masked: record.cpf_masked || '',
          cpf_hash: record.cpf_hash || '',
          birth_date: record.birth_date || '',
          phone: record.phone || '',
          cep: record.cep || '',
          street: record.street || '',
          number: record.number || '',
          complement: record.complement || '',
          neighborhood: record.neighborhood || '',
          city: record.city || '',
          state: record.state || '',
          referral_code: record.referral_code || '',
          stripe_onboarding_status: record.stripe_onboarding_status || 'pending_verification',
          completed_at: record.completed_at || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      ),
      3500,
      null
    );
  } catch {}
}

export async function fetchHostProfileFromSupabase(email: string): Promise<any | null> {
  if (!supabase || !email) return null;
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data }: any = await withTimeout(
      supabase
        .from('host_profiles')
        .select('*')
        .ilike('user_email', cleanEmail)
        .limit(1)
        .maybeSingle(),
      3000,
      { data: null }
    );
    return data || null;
  } catch {
    return null;
  }
}

export async function persistPurchaseToSupabase(purchase: {
  user_id: number;
  user_email: string;
  stripe_session_id: string;
  stripe_payment_intent_id?: string | null;
  amount_total: number;
  currency: string;
  payment_status: string;
  plan_granted: string;
  metadata?: string;
}): Promise<void> {
  if (!supabase || !purchase.stripe_session_id) return;
  try {
    await withTimeout(
      supabase.from('purchases').upsert(
        {
          ...purchase,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_session_id' }
      ),
      3500,
      null
    );
  } catch {}
}

// =============================================================================
// 5. FULL BIDIRECTIONAL REPLICATION ON SERVER BOOT (SQLite <-> Supabase)
// =============================================================================

export async function syncDatabaseWithSupabase(sqliteDb: any): Promise<void> {
  if (!supabase) return;
  console.log('[SupabaseSync] Starting synchronization with Supabase PostgreSQL...');

  try {
    // 1. Spots Synchronization
    try {
      const { data: remoteSpots, error: spotsErr }: any = await withTimeout(
        supabase.from('spots').select('*'),
        5000,
        { data: null, error: null }
      );

      if (!spotsErr && Array.isArray(remoteSpots)) {
        if (remoteSpots.length > 0) {
          const upsertSpot = sqliteDb.prepare(`
            INSERT INTO spots (
              id, name, short_name, tag_label, category, category_label,
              lat, lng, image, gallery, description, tourist_tip,
              rating, review_count, hours, address, price_range, price,
              available_for_itinerary, duration_minutes, tags, maps_url, is_active, is_star, badge
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              short_name = excluded.short_name,
              tag_label = excluded.tag_label,
              category = excluded.category,
              category_label = excluded.category_label,
              lat = excluded.lat,
              lng = excluded.lng,
              image = excluded.image,
              gallery = excluded.gallery,
              description = excluded.description,
              tourist_tip = excluded.tourist_tip,
              rating = excluded.rating,
              review_count = excluded.review_count,
              hours = excluded.hours,
              address = excluded.address,
              price_range = excluded.price_range,
              price = excluded.price,
              available_for_itinerary = excluded.available_for_itinerary,
              duration_minutes = excluded.duration_minutes,
              tags = excluded.tags,
              maps_url = excluded.maps_url,
              is_active = excluded.is_active,
              is_star = CASE WHEN excluded.is_star = 1 THEN 1 ELSE spots.is_star END,
              badge = COALESCE(NULLIF(excluded.badge, ''), spots.badge)
          `);

          for (const s of remoteSpots) {
            if (s && s.id && s.name) {
              const remoteIsStar = s.is_star === 1 || s.is_star === true || s.badge === 'Estrela' ? 1 : 0;
              upsertSpot.run(
                s.id,
                s.name,
                s.short_name || s.name,
                s.tag_label || s.name,
                s.category || 'attractions',
                s.category_label || s.category,
                Number(s.lat || -22.7394),
                Number(s.lng || -45.5913),
                s.image || '',
                typeof s.gallery === 'string' ? s.gallery : JSON.stringify(s.gallery || []),
                s.description || '',
                s.tourist_tip || '',
                Number(s.rating || 4.8),
                Number(s.review_count || 0),
                s.hours || '',
                s.address || '',
                s.price_range || '$$',
                s.price || '',
                s.available_for_itinerary !== undefined ? Number(s.available_for_itinerary) : 1,
                Number(s.duration_minutes || 90),
                s.tags || '',
                s.maps_url || '',
                s.is_active !== undefined ? Number(s.is_active) : 1,
                remoteIsStar,
                s.badge || (remoteIsStar ? 'Estrela' : '')
              );
            }
          }
          console.log(`[SupabaseSync] Hydrated ${remoteSpots.length} spots from Supabase PostgreSQL.`);
        } else {
          // Remote table exists but is empty -> push initial SQLite spots to Supabase
          const localSpots = sqliteDb.prepare('SELECT * FROM spots').all();
          if (localSpots.length > 0) {
            await withTimeout(
              supabase.from('spots').upsert(
                localSpots.map((s: any) => ({
                  id: s.id,
                  name: s.name,
                  short_name: s.short_name || s.name,
                  tag_label: s.tag_label || s.name,
                  category: s.category || 'attractions',
                  category_label: s.category_label || s.category,
                  lat: Number(s.lat),
                  lng: Number(s.lng),
                  image: s.image || '',
                  gallery: s.gallery || '[]',
                  description: s.description || '',
                  tourist_tip: s.tourist_tip || '',
                  rating: Number(s.rating || 4.8),
                  review_count: Number(s.review_count || 0),
                  hours: s.hours || '',
                  address: s.address || '',
                  price_range: s.price_range || '$$',
                  price: s.price || '',
                  available_for_itinerary: s.available_for_itinerary ?? 1,
                  duration_minutes: s.duration_minutes ?? 90,
                  tags: s.tags || '',
                  maps_url: s.maps_url || '',
                  is_active: s.is_active ?? 1,
                })),
                { onConflict: 'id' }
              ),
              6000,
              null
            );
            console.log(`[SupabaseSync] Seeded ${localSpots.length} spots into Supabase PostgreSQL.`);
          }
        }
      }
    } catch {}

    // 2. Map Visual Icons Synchronization
    try {
      const { data: remoteIcons, error: iconsErr }: any = await withTimeout(
        supabase.from('map_visual_icons').select('*'),
        4500,
        { data: null, error: null }
      );

      if (!iconsErr && Array.isArray(remoteIcons)) {
        if (remoteIcons.length > 0) {
          const upsertIcon = sqliteDb.prepare(`
            INSERT INTO map_visual_icons (id, category, latitude, longitude, color, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              category = excluded.category,
              latitude = excluded.latitude,
              longitude = excluded.longitude,
              color = excluded.color,
              is_active = excluded.is_active,
              updated_at = CURRENT_TIMESTAMP
          `);
          for (const ic of remoteIcons) {
            if (ic && ic.id && ic.category) {
              upsertIcon.run(
                ic.id,
                ic.category,
                Number(ic.latitude),
                Number(ic.longitude),
                ic.color || null,
                ic.is_active !== undefined ? Number(ic.is_active) : 1
              );
            }
          }
        } else {
          const localIcons = sqliteDb.prepare('SELECT * FROM map_visual_icons').all();
          if (localIcons.length > 0) {
            await withTimeout(
              supabase.from('map_visual_icons').upsert(
                localIcons.map((ic: any) => ({
                  id: ic.id,
                  category: ic.category,
                  icon: ic.category,
                  latitude: Number(ic.latitude),
                  longitude: Number(ic.longitude),
                  color: ic.color || null,
                  is_active: ic.is_active ?? 1,
                })),
                { onConflict: 'id' }
              ),
              5000,
              null
            );
          }
        }
      }
    } catch {}

    // 3. Users Synchronization
    try {
      const { data: remoteUsers, error: usersErr }: any = await withTimeout(
        supabase.from('users').select('*'),
        4500,
        { data: null, error: null }
      );

      if (!usersErr && Array.isArray(remoteUsers) && remoteUsers.length > 0) {
        for (const u of remoteUsers) {
          if (!u.email) continue;
          const cleanEmail = u.email.trim().toLowerCase();
          const role = isPrimaryAdmin(cleanEmail) || u.role === 'admin' ? 'admin' : 'user';
          const isGold = role === 'admin' || u.is_gold === 1 || u.plan === 'gold' ? 1 : 0;

          const existing = sqliteDb
            .prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?')
            .get(cleanEmail, cleanEmail);

          if (!existing) {
            sqliteDb
              .prepare(`
                INSERT INTO users (name, username, email, whatsapp, password_hash, role, avatar_url, is_gold)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .run(
                u.name || cleanEmail.split('@')[0],
                u.username || cleanEmail.split('@')[0],
                cleanEmail,
                u.whatsapp || cleanEmail,
                u.password_hash || 'supabase_auth',
                role,
                u.avatar_url || '/fotoperfil.png',
                isGold
              );
          } else {
            sqliteDb
              .prepare(`
                UPDATE users
                SET name = COALESCE(?, name),
                    role = ?,
                    avatar_url = COALESCE(?, avatar_url),
                    is_gold = CASE WHEN ? = 1 THEN 1 ELSE is_gold END
                WHERE id = ?
              `)
              .run(u.name, role, u.avatar_url, isGold, existing.id);
          }
        }
      }
    } catch {}

    // 4. Itineraries & Categories Synchronization
    try {
      const { data: remoteItins }: any = await withTimeout(
        supabase.from('itineraries').select('*'),
        5000,
        { data: null }
      );

      if (Array.isArray(remoteItins) && remoteItins.length > 0) {
        const upsertItin = sqliteDb.prepare(`
          INSERT INTO itineraries (
            id, title, description, cover_image, days_count, categories,
            is_active, is_recommended, is_featured, is_premium, price,
            status, badge_text, show_badge, show_price, show_stops_count,
            tips, sort_order, notes, usage_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            cover_image = excluded.cover_image,
            days_count = excluded.days_count,
            categories = excluded.categories,
            is_active = excluded.is_active,
            is_recommended = excluded.is_recommended,
            is_featured = excluded.is_featured,
            is_premium = excluded.is_premium,
            price = excluded.price,
            status = excluded.status,
            badge_text = excluded.badge_text,
            show_badge = excluded.show_badge,
            show_price = excluded.show_price,
            show_stops_count = excluded.show_stops_count,
            tips = excluded.tips,
            sort_order = excluded.sort_order,
            notes = excluded.notes,
            usage_count = excluded.usage_count,
            updated_at = CURRENT_TIMESTAMP
        `);

        for (const it of remoteItins) {
          upsertItin.run(
            it.id,
            it.title,
            it.description || '',
            it.cover_image || '',
            it.days_count || 1,
            it.categories || '[]',
            it.is_active !== undefined ? Number(it.is_active) : 1,
            it.is_recommended !== undefined ? Number(it.is_recommended) : 1,
            it.is_featured !== undefined ? Number(it.is_featured) : 0,
            it.is_premium !== undefined ? Number(it.is_premium) : 1,
            it.price || 'R$ 14,90',
            it.status || 'published',
            it.badge_text || 'Premium',
            it.show_badge !== undefined ? Number(it.show_badge) : 1,
            it.show_price !== undefined ? Number(it.show_price) : 1,
            it.show_stops_count !== undefined ? Number(it.show_stops_count) : 1,
            it.tips || '',
            Number(it.sort_order || 0),
            it.notes || '',
            Number(it.usage_count || 0)
          );
        }

        // Hydrate days & steps from Supabase into SQLite
        const [remoteDaysRes, remoteStepsRes] = await Promise.all([
          supabase.from('itinerary_days').select('*'),
          supabase.from('itinerary_steps').select('*'),
        ]);

        if (Array.isArray(remoteDaysRes.data) && remoteDaysRes.data.length > 0) {
          const insertDay = sqliteDb.prepare(`
            INSERT OR REPLACE INTO itinerary_days (id, itinerary_id, day_number, title, summary)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const d of remoteDaysRes.data) {
            insertDay.run(d.id, d.itinerary_id, d.day_number, d.title || '', d.summary || '');
          }
        }

        if (Array.isArray(remoteStepsRes.data) && remoteStepsRes.data.length > 0) {
          const insertStep = sqliteDb.prepare(`
            INSERT OR REPLACE INTO itinerary_steps (
              id, itinerary_id, day_id, spot_id, step_order, suggested_time,
              duration_minutes, notes, custom_name, custom_description, custom_tip, custom_image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const s of remoteStepsRes.data) {
            insertStep.run(
              s.id,
              s.itinerary_id,
              s.day_id,
              s.spot_id,
              s.step_order || 1,
              s.suggested_time || '09:00',
              s.duration_minutes || 90,
              s.notes || '',
              s.custom_name || '',
              s.custom_description || '',
              s.custom_tip || '',
              s.custom_image || ''
            );
          }
        }
        console.log(`[SupabaseSync] Hydrated ${remoteItins.length} itineraries from Supabase PostgreSQL.`);
      }
    } catch (e) {
      console.warn('[SupabaseSync] Notice during itineraries sync:', e);
    }

    // 5. Stripe Secret Key Synchronization
    try {
      const envStripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
      if (envStripeKey) {
        try {
          sqliteDb
            .prepare(
              "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('stripe_secret_key', ?, CURRENT_TIMESTAMP)"
            )
            .run(envStripeKey);
        } catch {}
        await withTimeout(
          supabase.from('system_settings').upsert(
            {
              key: 'stripe_secret_key',
              value: envStripeKey,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          ),
          3500,
          null
        );
      } else {
        const { data: remoteKeyRow }: any = await withTimeout(
          supabase.from('system_settings').select('value').eq('key', 'stripe_secret_key').maybeSingle(),
          3500,
          { data: null }
        );
        if (remoteKeyRow?.value && remoteKeyRow.value.trim()) {
          try {
            sqliteDb
              .prepare(
                "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('stripe_secret_key', ?, CURRENT_TIMESTAMP)"
              )
              .run(remoteKeyRow.value.trim());
          } catch {}
        }
      }
    } catch {}

    console.log('[SupabaseSync] Synchronization completed.');
  } catch (err) {
    console.warn('[SupabaseSync] Non-fatal sync notice:', err);
  }
}
