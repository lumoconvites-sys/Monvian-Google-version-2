-- =============================================================================
-- MONVIAN — MIGRAÇÃO E ESQUEMA COMPLETO SUPABASE POSTGRESQL + RLS + STORAGE
-- Projeto: Monvian - Campos do Jordão
-- =============================================================================

-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PERFIS E USUÁRIOS (Integrado com auth.users do Supabase Auth e Contas App)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  whatsapp TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_banned INTEGER NOT NULL DEFAULT 0,
  snow_enabled INTEGER NOT NULL DEFAULT 0,
  rain_enabled INTEGER NOT NULL DEFAULT 1,
  theme TEXT NOT NULL DEFAULT 'dark',
  avatar_url TEXT DEFAULT '/fotoperfil.png',
  visits_count INTEGER NOT NULL DEFAULT 1,
  last_access TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  plan TEXT NOT NULL DEFAULT 'beta' CHECK (plan IN ('beta', 'gold')),
  is_gold INTEGER NOT NULL DEFAULT 0,
  is_premium INTEGER NOT NULL DEFAULT 0,
  gold_activated_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  email TEXT UNIQUE,
  username TEXT,
  username_normalized TEXT UNIQUE,
  bio TEXT DEFAULT '',
  onboarding_completed INTEGER NOT NULL DEFAULT 1,
  onboarding_step INTEGER NOT NULL DEFAULT 1,
  high_contrast INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_username_norm ON public.users (username_normalized);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users (auth_id);

CREATE TABLE IF NOT EXISTS public.sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions (user_id);

-- =============================================================================
-- 2. PONTOS TURÍSTICOS, SERVIÇOS, EVENTOS E AVALIAÇÕES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.spots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  tag_label TEXT,
  category TEXT NOT NULL,
  category_label TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  image TEXT NOT NULL,
  gallery TEXT DEFAULT '[]',
  description TEXT DEFAULT '',
  tourist_tip TEXT DEFAULT '',
  rating DOUBLE PRECISION DEFAULT 4.8,
  review_count INTEGER DEFAULT 0,
  hours TEXT DEFAULT '',
  address TEXT DEFAULT '',
  price_range TEXT DEFAULT '$$',
  price TEXT DEFAULT '',
  popular_times TEXT DEFAULT '',
  visitors_today INTEGER DEFAULT 0,
  badge TEXT DEFAULT '',
  highlighted INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  is_verified INTEGER DEFAULT 1,
  website TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  maps_url TEXT DEFAULT '',
  google_rating DOUBLE PRECISION,
  google_review_snippet TEXT,
  last_synced_maps TIMESTAMP WITH TIME ZONE,
  available_for_itinerary INTEGER DEFAULT 1,
  duration_minutes INTEGER DEFAULT 90,
  tags TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spots_category ON public.spots (category);
CREATE INDEX IF NOT EXISTS idx_spots_active ON public.spots (is_active);

CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  category TEXT DEFAULT 'Música & Cultura',
  date TEXT DEFAULT '',
  time TEXT DEFAULT '',
  address TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'active',
  highlighted INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id SERIAL PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES public.spots(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_avatar TEXT,
  rating DOUBLE PRECISION NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_spot_id ON public.reviews (spot_id);

-- =============================================================================
-- 3. ROTEIROS TURÍSTICOS, CATEGORIAS E PLANEJADOR DO USUÁRIO
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.itinerary_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Compass',
  description TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.itineraries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  days_count INTEGER DEFAULT 1,
  categories TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  is_recommended INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 1,
  price TEXT DEFAULT 'R$ 14,90',
  status TEXT DEFAULT 'published',
  badge_text TEXT DEFAULT 'Premium',
  show_badge INTEGER DEFAULT 1,
  show_price INTEGER DEFAULT 1,
  show_stops_count INTEGER DEFAULT 1,
  tips TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.itinerary_days (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_itinerary_days_itin ON public.itinerary_days (itinerary_id, day_number);

CREATE TABLE IF NOT EXISTS public.itinerary_steps (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  day_id TEXT NOT NULL REFERENCES public.itinerary_days(id) ON DELETE CASCADE,
  spot_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  suggested_time TEXT DEFAULT '09:00',
  duration_minutes INTEGER DEFAULT 90,
  notes TEXT DEFAULT '',
  custom_name TEXT DEFAULT '',
  custom_description TEXT DEFAULT '',
  custom_tip TEXT DEFAULT '',
  custom_image TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_itinerary_steps_day ON public.itinerary_steps (day_id, step_order);

CREATE TABLE IF NOT EXISTS public.user_itineraries (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  days_count INTEGER DEFAULT 1,
  trip_date TEXT DEFAULT '',
  pace TEXT DEFAULT 'Equilibrado',
  has_car INTEGER DEFAULT 1,
  less_walking INTEGER DEFAULT 0,
  prioritize_food INTEGER DEFAULT 0,
  prioritize_attractions INTEGER DEFAULT 1,
  preferences_json TEXT DEFAULT '{}',
  itinerary_data_json TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_itineraries_user ON public.user_itineraries (user_id);
CREATE INDEX IF NOT EXISTS idx_user_itineraries_session ON public.user_itineraries (session_id);

CREATE TABLE IF NOT EXISTS public.itinerary_drafts (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  trip_date TEXT,
  people_count INTEGER DEFAULT 2,
  adults_count INTEGER DEFAULT 2,
  children_count INTEGER DEFAULT 0,
  budget TEXT,
  liked_spots_json TEXT DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.planner_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. REDE SOCIAL, PUBLICAÇÕES, STORIES 24H E NOTIFICAÇÕES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_username TEXT,
  user_photo TEXT,
  image_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  location TEXT DEFAULT 'Campos do Jordão, SP',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts (user_id);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id TEXT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_photo TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.social_notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_photo TEXT,
  type TEXT NOT NULL,
  post_id TEXT,
  post_image TEXT,
  comment_text TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_notif_recipient ON public.social_notifications (recipient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.user_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.user_follows (following_id);

CREATE TABLE IF NOT EXISTS public.stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_photo TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT DEFAULT '',
  location TEXT DEFAULT '',
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_stories_active ON public.stories (user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS public.story_views (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(story_id, viewer_id)
);

-- =============================================================================
-- 5. ÁREA DO ANFITRIÃO (HOST PROFILES)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.host_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_email TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'incomplete',
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  current_step INTEGER NOT NULL DEFAULT 1,
  full_name TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  cpf_masked TEXT DEFAULT '',
  cpf_hash TEXT DEFAULT '',
  birth_date TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  cep TEXT DEFAULT '',
  street TEXT DEFAULT '',
  number TEXT DEFAULT '',
  complement TEXT DEFAULT '',
  neighborhood TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  referral_code TEXT DEFAULT '',
  stripe_onboarding_status TEXT DEFAULT 'pending_verification',
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_host_profiles_user_id ON public.host_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_host_profiles_email ON public.host_profiles (LOWER(user_email));

-- =============================================================================
-- 6. PAGAMENTOS STRIPE, FAVORITOS, MAPA E CONFIGURAÇÕES DO SISTEMA
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'brl',
  payment_status TEXT NOT NULL,
  plan_granted TEXT NOT NULL DEFAULT 'gold',
  metadata TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_session ON public.purchases (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON public.purchases (user_id);

CREATE TABLE IF NOT EXISTS public.favorites (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  item_type TEXT DEFAULT 'spot',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, spot_id)
);

CREATE TABLE IF NOT EXISTS public.user_favorites (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS public.map_visual_icons (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  icon TEXT DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  color TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referral_source TEXT,
  travel_frequency TEXT,
  travel_style TEXT,
  main_interests TEXT,
  preferred_season TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  session_id TEXT,
  event_type TEXT NOT NULL,
  item_id TEXT,
  item_name TEXT,
  metadata TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 7. FUNÇÃO E POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE (auth_id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
      AND (role = 'admin' OR LOWER(email) IN ('empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS nas tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_visual_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública para catálogo turístico e social
DROP POLICY IF EXISTS "Public read spots" ON public.spots;
CREATE POLICY "Public read spots" ON public.spots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write spots" ON public.spots;
CREATE POLICY "Admin write spots" ON public.spots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read events" ON public.events;
CREATE POLICY "Public read events" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write events" ON public.events;
CREATE POLICY "Admin write events" ON public.events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read itineraries" ON public.itineraries;
CREATE POLICY "Public read itineraries" ON public.itineraries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write itineraries" ON public.itineraries;
CREATE POLICY "Admin write itineraries" ON public.itineraries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read itinerary_days" ON public.itinerary_days;
CREATE POLICY "Public read itinerary_days" ON public.itinerary_days FOR SELECT USING (true);
CREATE POLICY "Write itinerary_days" ON public.itinerary_days FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read itinerary_steps" ON public.itinerary_steps;
CREATE POLICY "Public read itinerary_steps" ON public.itinerary_steps FOR SELECT USING (true);
CREATE POLICY "Write itinerary_steps" ON public.itinerary_steps FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read itinerary_categories" ON public.itinerary_categories;
CREATE POLICY "Public read itinerary_categories" ON public.itinerary_categories FOR SELECT USING (true);
CREATE POLICY "Write itinerary_categories" ON public.itinerary_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read map_visual_icons" ON public.map_visual_icons;
CREATE POLICY "Public read map_visual_icons" ON public.map_visual_icons FOR SELECT USING (true);
CREATE POLICY "Write map_visual_icons" ON public.map_visual_icons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read system_settings" ON public.system_settings;
CREATE POLICY "Public read system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Write system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access posts" ON public.posts;
CREATE POLICY "Public access posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access post_likes" ON public.post_likes;
CREATE POLICY "Public access post_likes" ON public.post_likes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access post_comments" ON public.post_comments;
CREATE POLICY "Public access post_comments" ON public.post_comments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access stories" ON public.stories;
CREATE POLICY "Public access stories" ON public.stories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access story_views" ON public.story_views;
CREATE POLICY "Public access story_views" ON public.story_views FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access user_follows" ON public.user_follows;
CREATE POLICY "Public access user_follows" ON public.user_follows FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access social_notifications" ON public.social_notifications;
CREATE POLICY "Public access social_notifications" ON public.social_notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users access" ON public.users;
CREATE POLICY "Users access" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sessions access" ON public.sessions;
CREATE POLICY "Sessions access" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Host profiles access" ON public.host_profiles;
CREATE POLICY "Host profiles access" ON public.host_profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "User itineraries access" ON public.user_itineraries;
CREATE POLICY "User itineraries access" ON public.user_itineraries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Itinerary drafts access" ON public.itinerary_drafts;
CREATE POLICY "Itinerary drafts access" ON public.itinerary_drafts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Favorites access" ON public.favorites;
CREATE POLICY "Favorites access" ON public.favorites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "User favorites access" ON public.user_favorites;
CREATE POLICY "User favorites access" ON public.user_favorites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Purchases access" ON public.purchases;
CREATE POLICY "Purchases access" ON public.purchases FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 8. SUPABASE STORAGE BUCKET PARA IMAGENS E STORIES
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('monvian-media', 'monvian-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read monvian-media" ON storage.objects;
CREATE POLICY "Public read monvian-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'monvian-media');

DROP POLICY IF EXISTS "Authenticated upload monvian-media" ON storage.objects;
CREATE POLICY "Authenticated upload monvian-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'monvian-media');

DROP POLICY IF EXISTS "Authenticated update monvian-media" ON storage.objects;
CREATE POLICY "Authenticated update monvian-media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'monvian-media');
