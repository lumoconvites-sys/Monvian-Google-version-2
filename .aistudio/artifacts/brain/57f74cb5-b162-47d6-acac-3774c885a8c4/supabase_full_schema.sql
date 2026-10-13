-- 1. Core Users and Sessions
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  whatsapp TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  is_banned INTEGER DEFAULT 0,
  snow_enabled INTEGER DEFAULT 0,
  theme TEXT DEFAULT 'dark',
  avatar_url TEXT,
  visits_count INTEGER DEFAULT 1,
  last_access TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  plan TEXT DEFAULT 'beta',
  is_gold INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 0,
  gold_activated_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  email TEXT UNIQUE,
  username TEXT,
  username_normalized TEXT,
  bio TEXT,
  onboarding_completed INTEGER DEFAULT 1,
  onboarding_step INTEGER DEFAULT 1,
  high_contrast INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- 2. Spots, Events, and Reviews
CREATE TABLE IF NOT EXISTS spots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  tag_label TEXT,
  category TEXT NOT NULL,
  category_label TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  image TEXT NOT NULL,
  gallery TEXT,
  description TEXT,
  tourist_tip TEXT,
  rating REAL DEFAULT 4.5,
  review_count INTEGER DEFAULT 0,
  hours TEXT,
  address TEXT,
  price_range TEXT,
  popular_times TEXT,
  visitors_today INTEGER DEFAULT 0,
  badge TEXT,
  highlighted INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  is_verified INTEGER DEFAULT 1,
  website TEXT,
  phone TEXT,
  maps_url TEXT,
  google_rating REAL,
  google_review_snippet TEXT,
  last_synced_maps TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  available_for_itinerary INTEGER DEFAULT 1,
  duration_minutes INTEGER DEFAULT 90,
  tags TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  category TEXT,
  date TEXT,
  time TEXT,
  address TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT DEFAULT 'active',
  highlighted INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  spot_id TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  user_avatar TEXT,
  rating REAL NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Itinerary Management
CREATE TABLE IF NOT EXISTS itinerary_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Compass',
  description TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itineraries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
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
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itinerary_days (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  title TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (itinerary_id) REFERENCES itineraries (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS itinerary_steps (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL,
  day_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  suggested_time TEXT DEFAULT '09:00',
  duration_minutes INTEGER DEFAULT 90,
  notes TEXT,
  custom_name TEXT DEFAULT '',
  custom_description TEXT DEFAULT '',
  custom_tip TEXT DEFAULT '',
  custom_image TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (itinerary_id) REFERENCES itineraries (id) ON DELETE CASCADE,
  FOREIGN KEY (day_id) REFERENCES itinerary_days (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_itineraries (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  session_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  days_count INTEGER DEFAULT 1,
  trip_date TEXT,
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

CREATE TABLE IF NOT EXISTS itinerary_drafts (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER,
  trip_date TEXT,
  people_count INTEGER DEFAULT 2,
  adults_count INTEGER DEFAULT 2,
  children_count INTEGER DEFAULT 0,
  budget TEXT,
  liked_spots_json TEXT DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planner_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Commerce & Settings
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'brl',
  payment_status TEXT NOT NULL,
  plan_granted TEXT NOT NULL DEFAULT 'gold',
  metadata TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  session_id TEXT,
  event_type TEXT NOT NULL,
  item_id TEXT,
  item_name TEXT,
  metadata TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL,
  referral_source TEXT,
  travel_frequency TEXT,
  travel_style TEXT,
  main_interests TEXT,
  preferred_season TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  time TEXT,
  data_json TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS map_visual_icons (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  color TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
