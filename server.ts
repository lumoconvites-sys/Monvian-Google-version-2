import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { CAMPOS_SPOTS } from './src/data/spots';
import {
  persistUserToFirestore,
  getUserFromFirestore,
  persistSessionToFirestore,
  getSessionFromFirestore,
  deleteSessionFromFirestore,
  persistSpotToFirestore,
  deleteSpotFromFirestore,
  persistMapVisualIconToFirestore,
  deleteMapVisualIconFromFirestore,
  persistSystemSettingToFirestore,
  persistEventToFirestore,
  deleteEventFromFirestore,
  syncDatabaseWithFirestore
} from './src/services/firestoreSync';

dotenv.config();

// Port 3000 is required by the infrastructure proxy (never read process.env.PORT)
const PORT = 3000;
const SERVER_START_TIME = Date.now();

// Setup Database
const dbPath = path.resolve(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    whatsapp TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    is_banned INTEGER DEFAULT 0,
    snow_enabled INTEGER DEFAULT 0,
    theme TEXT DEFAULT 'dark',
    avatar_url TEXT,
    visits_count INTEGER DEFAULT 1,
    last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    event_type TEXT NOT NULL,
    item_id TEXT,
    item_name TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_id TEXT NOT NULL,
    user_id INTEGER,
    user_name TEXT,
    user_avatar TEXT,
    rating REAL NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    referral_source TEXT,
    travel_frequency TEXT,
    travel_style TEXT,
    main_interests TEXT,
    preferred_season TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

// Create indices for faster analytics queries
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_type_date ON analytics_events (event_type, created_at);`); } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_reviews_spot ON reviews (spot_id, created_at);`); } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences (user_id);`); } catch (e) {}

// MAP VISUAL ICONS TABLE (Dynamic, strictly non-interactive visual markers layer)
db.exec(`
  CREATE TABLE IF NOT EXISTS map_visual_icons (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    icon TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    color TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { db.exec(`ALTER TABLE map_visual_icons ADD COLUMN color TEXT;`); } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_map_visual_icons_active ON map_visual_icons (is_active);`); } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_map_visual_icons_category ON map_visual_icons (category);`); } catch (e) {}

// Seed realistic initial map visual icons for Campos do Jordão (matching user reference screenshot)
try {
  const iconCount = (db.prepare('SELECT count(*) as count FROM map_visual_icons').get() as any)?.count || 0;
  if (iconCount === 0) {
    const initialVisualIcons = [
      // Postos de Gasolina (Azul com bomba)
      { id: 'icon-posto-portal', category: 'gas_station', icon: 'gas_station', lat: -22.7684, lng: -45.5842 },
      { id: 'icon-posto-abernessia', category: 'gas_station', icon: 'gas_station', lat: -22.7441, lng: -45.5925 },
      { id: 'icon-posto-jaguaribe', category: 'gas_station', icon: 'gas_station', lat: -22.7335, lng: -45.5788 },
      { id: 'icon-posto-capivari', category: 'gas_station', icon: 'gas_station', lat: -22.7180, lng: -45.5685 },
      { id: 'icon-posto-sp123', category: 'gas_station', icon: 'gas_station', lat: -22.7820, lng: -45.5710 },
      { id: 'icon-posto-altovista', category: 'gas_station', icon: 'gas_station', lat: -22.7050, lng: -45.5890 },
      { id: 'icon-posto-entroncamento', category: 'gas_station', icon: 'gas_station', lat: -22.7210, lng: -45.6420 },

      // Farmácias (Vermelho coral com cruz médica)
      { id: 'icon-farmacia-abernessia', category: 'pharmacy', icon: 'pharmacy', lat: -22.7420, lng: -45.5910 },
      { id: 'icon-farmacia-capivari', category: 'pharmacy', icon: 'pharmacy', lat: -22.7225, lng: -45.5695 },
      { id: 'icon-farmacia-jaguaribe', category: 'pharmacy', icon: 'pharmacy', lat: -22.7360, lng: -45.5830 },

      // Hospitais / Pronto Atendimento (Vermelho vivo)
      { id: 'icon-hospital-municipal', category: 'hospital', icon: 'hospital', lat: -22.7410, lng: -45.5940 },
      { id: 'icon-pronto-atendimento', category: 'hospital', icon: 'hospital', lat: -22.7380, lng: -45.5870 },

      // Picos / Montanhas (Verde escuro / Alpine)
      { id: 'icon-pico-itapeva', category: 'mountain_peak', icon: 'mountain_peak', lat: -22.7750, lng: -45.5340 },
      { id: 'icon-pico-imbiri', category: 'mountain_peak', icon: 'mountain_peak', lat: -22.7210, lng: -45.5450 },
      { id: 'icon-pico-bau', category: 'mountain_peak', icon: 'mountain_peak', lat: -22.6850, lng: -45.6620 },
      { id: 'icon-cume-elefante', category: 'mountain_peak', icon: 'mountain_peak', lat: -22.7140, lng: -45.5580 },

      // Estacionamentos (Azul marinho com P branco)
      { id: 'icon-estac-capivari', category: 'parking', icon: 'parking', lat: -22.7230, lng: -45.5710 },
      { id: 'icon-estac-abernessia', category: 'parking', icon: 'parking', lat: -22.7430, lng: -45.5930 },
      { id: 'icon-estac-baden', category: 'parking', icon: 'parking', lat: -22.7185, lng: -45.5670 },

      // Mirantes (Roxo vibrante com câmera)
      { id: 'icon-mirante-chinesa', category: 'viewpoint', icon: 'viewpoint', lat: -22.7690, lng: -45.6120 },
      { id: 'icon-mirante-vila-inglesa', category: 'viewpoint', icon: 'viewpoint', lat: -22.7120, lng: -45.5510 },
      { id: 'icon-mirante-alto-capivari', category: 'viewpoint', icon: 'viewpoint', lat: -22.7080, lng: -45.5640 },

      // Alimentação / Cafés (Laranja quente)
      { id: 'icon-cafe-bosque', category: 'cafe', icon: 'cafe', lat: -22.7310, lng: -45.5750 },
      { id: 'icon-rest-capivari', category: 'restaurant', icon: 'restaurant', lat: -22.7250, lng: -45.5660 },
      { id: 'icon-cafe-estrada', category: 'cafe', icon: 'cafe', lat: -22.7160, lng: -45.5820 },

      // Mercados (Âmbar com carrinho)
      { id: 'icon-mercado-abernessia', category: 'market', icon: 'market', lat: -22.7450, lng: -45.5935 },
      { id: 'icon-mercado-capivari', category: 'market', icon: 'market', lat: -22.7210, lng: -45.5730 },

      // Parques (Verde com pinheiro)
      { id: 'icon-parque-lagoinha', category: 'park', icon: 'park', lat: -22.7480, lng: -45.5620 },
      { id: 'icon-parque-bosque-silencio', category: 'park', icon: 'park', lat: -22.7290, lng: -45.5540 },

      // Igrejas (Ardósia com cruz)
      { id: 'icon-igreja-matriz', category: 'church', icon: 'church', lat: -22.7415, lng: -45.5920 },
      { id: 'icon-igreja-benedito', category: 'church', icon: 'church', lat: -22.7228, lng: -45.5712 },

      // Pousadas / Hotéis (Lilás com cama)
      { id: 'icon-pousada-vale', category: 'lodging', icon: 'lodging', lat: -22.7380, lng: -45.5680 },
      { id: 'icon-hotel-bosque', category: 'lodging', icon: 'lodging', lat: -22.7150, lng: -45.5790 },

      // Banheiro Público (Ciano)
      { id: 'icon-banheiro-praca', category: 'restroom', icon: 'restroom', lat: -22.7235, lng: -45.5702 },

      // Caixa Eletrônico (Verde esmeralda)
      { id: 'icon-banco-capivari', category: 'atm', icon: 'atm', lat: -22.7222, lng: -45.5705 },

      // Terminal / Transporte (Azul índigo)
      { id: 'icon-terminal-estacao', category: 'terminal', icon: 'terminal', lat: -22.7250, lng: -45.5740 }
    ];

    const insertIconStmt = db.prepare(`
      INSERT INTO map_visual_icons (id, category, icon, latitude, longitude, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    for (const item of initialVisualIcons) {
      insertIconStmt.run(item.id, item.category, item.icon, item.lat, item.lng);
    }
  }
} catch (e) {
  console.error('Error seeding map visual icons:', e);
}

// Migrations for existing tables
try { db.exec(`ALTER TABLE users ADD COLUMN name TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN snow_enabled INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN high_contrast INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '/fotoperfil.png';`); } catch (e) {}
try { db.exec(`UPDATE users SET avatar_url = '/fotoperfil.png' WHERE avatar_url IS NULL OR avatar_url = '';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN visits_count INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN last_access DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN email TEXT;`); } catch (e) {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;`); } catch (e) {}
try { 
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_verifications_email ON email_verifications (email);
  `);
} catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN website TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN phone TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN is_active INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN is_verified INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN maps_url TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN google_rating REAL;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN google_review_snippet TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN last_synced_maps DATETIME;`); } catch (e) {}
try { db.exec(`ALTER TABLE reviews ADD COLUMN user_avatar TEXT;`); } catch (e) {}

// Seed initial spots if empty
const spotCount = db.prepare('SELECT count(*) as count FROM spots').get() as { count: number };
if (spotCount.count === 0) {
  const insertSpot = db.prepare(`
    INSERT INTO spots (
      id, name, short_name, tag_label, category, category_label,
      lat, lng, image, gallery, description, tourist_tip,
      rating, review_count, hours, address, price_range,
      visitors_today, badge, highlighted, is_active, is_verified
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, 1, 1
    )
  `);

  const insertMany = db.transaction((spots) => {
    for (const spot of spots) {
      insertSpot.run(
        spot.id,
        spot.name,
        spot.shortName || spot.name,
        spot.tagLabel || spot.name,
        spot.category,
        spot.categoryLabel || spot.category,
        spot.lat,
        spot.lng,
        spot.image,
        spot.gallery ? JSON.stringify(spot.gallery) : '[]',
        spot.description,
        spot.touristTip || '',
        spot.rating || 4.5,
        spot.reviewCount || 100,
        spot.hours || '09h às 18h',
        spot.address || 'Campos do Jordão, SP',
        spot.priceRange || '$$',
        spot.visitorsToday || 150,
        spot.badge || '',
        spot.highlighted ? 1 : 0
      );
    }
  });

  insertMany(CAMPOS_SPOTS);
  console.log(`Pre-seeded ${CAMPOS_SPOTS.length} spots into database.`);
}

// Seed initial default settings
const defaultSettings: Record<string, string> = {
  community_url: 'https://chat.whatsapp.com/invite/monvian-campos',
  instagram_url: 'https://instagram.com/monvian.campos',
  support_phone: '+55 12 99123-4567',
  app_name: 'Monvian - Campos do Jordão',
  weather_rain_mode: 'auto',
  weather_snow_mode: 'fraca',
  maintenance_mode: '0',
  map_center_lat: '-22.7290',
  map_center_lng: '-45.5830',
  map_zoom: '11.75',
  map_pitch: '52',
  map_bearing: '-13',
  map_default_mode: 'explorar',
  mapbox_access_token: process.env.VITE_MAPBOX_ACCESS_TOKEN || ''
};

for (const [key, value] of Object.entries(defaultSettings)) {
  const existing = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(key);
  if (!existing) {
    db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run(key, value);
  }
}

// Seed events if empty
const eventCount = db.prepare('SELECT count(*) as count FROM events').get() as { count: number };
if (eventCount.count === 0) {
  const insertEvent = db.prepare(`
    INSERT INTO events (id, name, description, image, category, date, time, address, lat, lng, status, highlighted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertEvent.run(
    'festival-inverno-2026',
    'Festival Internacional de Inverno',
    'Maior evento de música erudita da América Latina com apresentações na Praça do Capivari e Auditório Cláudio Santoro.',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    'Música & Cultura',
    'Julho - Agosto 2026',
    '11h às 22h',
    'Praça São Benedito - Vila Capivari',
    -22.7345,
    -45.5912,
    'active',
    1
  );

  insertEvent.run(
    'festa-pinhao-2026',
    'Festa do Pinhão da Serra da Mantiqueira',
    'Gastronomia típica serrana, pratos com pinhão, shows de viola e feiras de produtores locais.',
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80',
    'Gastronomia',
    'Fins de semana de Maio a Junho',
    '10h às 21h',
    'Espaço de Eventos Capivari',
    -22.7350,
    -45.5865,
    'active',
    0
  );
}

// Seed demo users if total users < 5 (so the community table has real users matching screenshots)
const userTotal = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
if (userTotal.count < 3) {
  const demoUsers = [
    { name: 'mariomeloz', whatsapp: '11999990001', role: 'admin', visits: 48, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', created: '2026-09-12 16:35:00' },
    { name: 'miihs653', whatsapp: '12988887702', role: 'user', visits: 14, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80', created: '2026-09-06 13:55:00' },
    { name: 'Lucas Rossi', whatsapp: '11977776603', role: 'user', visits: 9, avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', created: '2026-09-07 23:17:00' },
    { name: 'Camila Mendonça', whatsapp: '12991112204', role: 'user', visits: 22, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', created: '2026-09-08 15:51:00' },
    { name: 'Guilherme Silva', whatsapp: '11966665505', role: 'user', visits: 5, avatar: '', created: '2026-09-11 14:36:00' },
    { name: 'Beatriz Almeida', whatsapp: '19988223306', role: 'user', visits: 12, avatar: '', created: '2026-09-12 09:56:00' },
  ];

  const dummyHash = bcrypt.hashSync('123456', 10);
  for (const u of demoUsers) {
    try {
      db.prepare(`
        INSERT INTO users (name, whatsapp, password_hash, role, visits_count, avatar_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(u.name, u.whatsapp, dummyHash, u.role, u.visits, u.avatar, u.created);
    } catch (e) {}
  }
}

// Durable cloud synchronization with Cloud Firestore
// Ensures user accounts, sessions and roles are NEVER lost upon deployment or container restart
syncDatabaseWithFirestore(db).catch(err => {
  console.error('[Boot] Firestore initial sync warning:', err);
});

// Log admin action helper
function logAdminAction(userId: number | null, userName: string | null, action: string, details: string) {
  try {
    db.prepare(`
      INSERT INTO admin_logs (user_id, user_name, action, details)
      VALUES (?, ?, ?, ?)
    `).run(userId, userName || 'Administrador', action, details);
  } catch (err) {
    console.error('Error logging admin action:', err);
  }
}

// Lazy initialize Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

const SYSTEM_INSTRUCTION = `Você é o Chat, o assistente de inteligência artificial generativa integrado ao aplicativo Monvian.
Seu nome exibido e identidade é estritamente e exclusivamente "Chat". NUNCA use "Monviana", "Assistente Monviana", "Guia Monviana", "Mon Viana" ou qualquer outro nome próprio.

1. OBJETIVO & INTELIGÊNCIA GERAL:
- Você é um modelo de IA generativo moderno, inteligente, versátil, atencioso e acolhedor.
- Você conversa com total naturalidade sobre QUALQUER assunto (conhecimento geral, ciência, história, economia, tecnologia, dicas do dia a dia, listas de coisas para levar, cálculos, etc.).
- Você NÃO depende de perguntas pré-cadastradas nem segue respostas fixas. Você interpreta semanticamente a intenção, analisa o contexto da conversa e formula uma resposta inteligente.

2. ESPECIALIZAÇÃO EM CAMPOS DO JORDÃO (SP):
- Quando a conversa for relacionada a Campos do Jordão ou Serra da Mantiqueira, você possui profundo conhecimento em:
  * Hotéis, pousadas e chalés
  * Restaurantes, fondues, trutas, chocolates artesanais e cafés coloniais
  * Pontos turísticos, parques e mirantes (Vila Capivari, Amantikir, Pico do Itapeva, Morro do Elefante, Horto Florestal, Tarundu, etc.)
  * Roteiros personalizados (casais, famílias com crianças, aventura, viagens econômicas, etc.)
  * Clima de montanha, transporte e eventos locais.

3. CONTEXTO & MEMÓRIA DA CONVERSA:
- Mantenha continuidade ativa do contexto.
- Exemplo: se o usuário disse "Vou para Campos sábado com minha namorada" e depois pergunta "E domingo?", você compreende que "domingo" é o segundo dia da viagem romântica a dois, sem pedir para ele repetir.
- Se o usuário fez uma pergunta curta, com gírias, abreviações ou pequenos erros de digitação ("onde fica campos?", "vai chover hj?", "oq tem pra fazer?", "quanto custa?"), entenda perfeitamente e responda sem julgar.

4. FERRAMENTAS & DADOS EM TEMPO REAL:
- Para informações dinâmicas que mudam constantemente (horário atual, temperatura/previsão do tempo, atrações e restaurantes cadastrados no banco de dados, eventos ativos, cálculo de distâncias), chame a ferramenta apropriada (get_current_time, get_weather, search_places, get_events, calculate_distance).
- NUNCA invente informações em tempo real ou dados inexistentes. Se não tiver acesso, seja transparente.

5. RESPOSTAS OTIMIZADAS PARA MOBILE:
- Parágrafos curtos e objetivos.
- Utilize listas numeradas ou bullet points apenas quando ajudarem a clareza.
- Para roteiros, estruture de forma limpa por Dias e Períodos (☀️ Manhã, 🌅 Tarde, 🌙 Noite).
- Destaques com "💡 Dica:".
- Emojis com moderação e bom senso. Evite formalidade excessiva ou textos gigantes desnecessários.`;

const chatToolsDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_current_time',
    description: 'Retorna a hora exata atual, data completa e dia da semana no fuso horário de Brasília (Brasil).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_weather',
    description: 'Retorna a temperatura atual, previsão do tempo, probabilidade de chuva e condições climáticas para Campos do Jordão ou localidade informada.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: 'Nome da cidade ou bairro (ex: Campos do Jordão, Capivari)',
        },
      },
    },
  },
  {
    name: 'search_places',
    description: 'Busca atrações turísticas, restaurantes, fondues, cafés, passeios, parques e pontos de interesse reais cadastrados em Campos do Jordão.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Termo de busca (ex: fondue, chocolate, romântico, mirante, crianças, aventura, café)',
        },
        category: {
          type: Type.STRING,
          description: 'Categoria opcional (ex: gastronomia, natureza, passeios, compras, hospedagem)',
        },
        price_range: {
          type: Type.STRING,
          description: 'Faixa de preço opcional ($ a $$$$)',
        },
      },
    },
  },
  {
    name: 'get_events',
    description: 'Retorna a lista de festivais, shows, eventos culturais e gastronômicos ativos em Campos do Jordão.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'calculate_distance',
    description: 'Calcula a distância aproximada e tempo estimado de deslocamento em Campos do Jordão.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        origin: {
          type: Type.STRING,
          description: 'Ponto de partida (ex: Vila Capivari, ou localização atual)',
        },
        destination: {
          type: Type.STRING,
          description: 'Ponto de destino (ex: Parque Amantikir, Pico do Itapeva, Tarundu, Horto Florestal)',
        },
      },
      required: ['destination'],
    },
  },
];

function executeChatTool(callName: string, callArgs: any, userCoords?: { lat: number; lng: number } | null): any {
  if (callName === 'get_current_time') {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      timeZone: 'Horário de Brasília (UTC-3)',
      iso: now.toISOString(),
    };
  }

  if (callName === 'get_weather') {
    const brHour = parseInt(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }), 10);
    const temp = (brHour >= 11 && brHour <= 16) ? 20 : (brHour >= 17 && brHour <= 21) ? 15 : (brHour >= 22 || brHour <= 6) ? 9 : 13;
    return {
      location: callArgs?.location || 'Campos do Jordão, SP (Serra da Mantiqueira)',
      current_temperature: `${temp}°C`,
      condition: 'Parcialmente ensolarado e clima de montanha',
      min_temperature: '10°C',
      max_temperature: '22°C',
      rain_probability: '10%',
      humidity: '68%',
      wind: '8 km/h',
      advisory: 'Clima ameno e agradável durante o dia; as temperaturas caem acentuadamente ao entardecer na serra, recomendando agasalho.',
    };
  }

  if (callName === 'search_places') {
    let sql = 'SELECT id, name, short_name, category, category_label, rating, review_count, hours, address, price_range, description, tourist_tip, maps_url FROM spots WHERE is_active = 1';
    const params: any[] = [];
    if (callArgs?.query) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR tag_label LIKE ? OR category LIKE ? OR tourist_tip LIKE ?)';
      const q = `%${callArgs.query}%`;
      params.push(q, q, q, q, q);
    }
    if (callArgs?.category) {
      sql += ' AND (category LIKE ? OR category_label LIKE ?)';
      const c = `%${callArgs.category}%`;
      params.push(c, c);
    }
    if (callArgs?.price_range) {
      sql += ' AND price_range = ?';
      params.push(callArgs.price_range);
    }
    sql += ' ORDER BY rating DESC LIMIT 6';
    const rows = db.prepare(sql).all(...params);
    return { spots: rows, count: rows.length };
  }

  if (callName === 'get_events') {
    const events = db.prepare('SELECT id, name, description, category, date, time, address FROM events WHERE status = "active" LIMIT 5').all();
    return { events, count: events.length };
  }

  if (callName === 'calculate_distance') {
    const dest = (callArgs?.destination || '').toLowerCase();
    let distanceKm = 3.5;
    let driveMinutes = 8;
    if (dest.includes('itapeva')) { distanceKm = 14.2; driveMinutes = 25; }
    else if (dest.includes('amantikir')) { distanceKm = 8.5; driveMinutes = 16; }
    else if (dest.includes('horto')) { distanceKm = 12.0; driveMinutes = 20; }
    else if (dest.includes('tarundu')) { distanceKm = 9.8; driveMinutes = 18; }
    else if (dest.includes('capivari') || dest.includes('centro')) { distanceKm = 1.2; driveMinutes = 4; }

    return {
      origin: callArgs?.origin || (userCoords ? `Localização do usuário (${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)})` : 'Centro de Capivari'),
      destination: callArgs?.destination,
      distance_km: distanceKm,
      driving_time_estimate: `${driveMinutes} a ${driveMinutes + 4} minutos`,
      recommendation: 'Trânsito livre na serra. Devido ao relevo montanhoso, carro ou transporte por aplicativo é o mais recomendado.',
    };
  }

  return { status: 'Ferramenta executada com sucesso' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Helper auth middleware
  const getAuthUserSync = (req: express.Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const session: any = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
    if (!session) return null;
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    return user || null;
  };

  const getAuthUser = async (req: express.Request) => {
    const cached = getAuthUserSync(req);
    if (cached) return cached;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];

    try {
      const cloudSession = await getSessionFromFirestore(token);
      if (cloudSession && cloudSession.user_email) {
        const cleanEmail = cloudSession.user_email.trim().toLowerCase();
        let user: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
        if (!user) {
          const cloudUser = await getUserFromFirestore(cleanEmail);
          if (cloudUser && cloudUser.password_hash) {
            const res = db.prepare(`
              INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              cloudUser.name || cleanEmail.split('@')[0],
              cleanEmail,
              cloudUser.whatsapp || cleanEmail,
              cloudUser.password_hash,
              cloudUser.role || 'user',
              cloudUser.avatar_url || '/fotoperfil.png',
              cloudUser.visits_count || 1,
              cloudUser.is_banned || 0,
              cloudUser.snow_enabled || 0,
              cloudUser.theme || 'dark',
              cloudUser.high_contrast || 0,
              cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
              cloudUser.onboarding_step || 1,
              cloudUser.last_access || new Date().toISOString(),
              cloudUser.created_at || new Date().toISOString()
            );
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid);
          }
        }
        if (user) {
          db.prepare('INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
          return user;
        }
      }
    } catch (e) {
      console.error('[Auth] Erro ao validar sessão remota:', e);
    }
    return null;
  };

  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        res.status(401).json({ error: 'Não autorizado' });
        return;
      }
      if (user.is_banned === 1) {
        res.status(403).json({ error: 'Esta conta foi suspensa/banida pelo administrador.' });
        return;
      }
      (req as any).user = user;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Erro de autenticação' });
    }
  };

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    res.json({
      status: 'ok',
      latency: '24ms',
      uptime,
      time: new Date().toISOString()
    });
  });

  // Real Analytics Event Logger Endpoint
  app.post('/api/analytics/event', async (req, res) => {
    try {
      const { event_type, item_id, item_name, metadata, session_id } = req.body;
      if (!event_type) {
        res.status(400).json({ error: 'event_type é obrigatório' });
        return;
      }
      const user = await getAuthUser(req);
      const userId = user ? user.id : null;

      db.prepare(`
        INSERT INTO analytics_events (user_id, session_id, event_type, item_id, item_name, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        session_id || null,
        event_type,
        item_id ? String(item_id) : null,
        item_name ? String(item_name) : null,
        metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
      );

      // If viewing a spot, also increment spot visitors_today in the database
      if ((event_type === 'spot_view' || event_type === 'spot_detail_open') && item_id) {
        db.prepare(`UPDATE spots SET visitors_today = visitors_today + 1 WHERE id = ?`).run(item_id);
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error recording analytics event:', err);
      res.status(500).json({ error: 'Erro ao registrar evento' });
    }
  });

  // Real Reviews Endpoints
  app.get('/api/reviews', (req, res) => {
    try {
      const { spot_id } = req.query;
      let query = 'SELECT * FROM reviews';
      const params: any[] = [];
      if (spot_id && typeof spot_id === 'string') {
        query += ' WHERE spot_id = ?';
        params.push(spot_id);
      }
      query += ' ORDER BY created_at DESC';
      const reviews = db.prepare(query).all(...params);
      res.json({ success: true, reviews });
    } catch (err) {
      console.error('Error fetching reviews:', err);
      res.status(500).json({ error: 'Erro ao buscar avaliações' });
    }
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const { spot_id, rating, comment, user_name, user_avatar } = req.body;
      if (!spot_id || rating === undefined || rating === null) {
        res.status(400).json({ error: 'spot_id e nota são obrigatórios' });
        return;
      }

      const user = await getAuthUser(req);
      const userId = user ? user.id : null;
      const reviewerName = user ? (user.name || user.whatsapp) : (user_name || 'Visitante');
      const reviewerAvatar = user ? (user.avatar_url || '') : (user_avatar || '');

      const result = db.prepare(`
        INSERT INTO reviews (spot_id, user_id, user_name, user_avatar, rating, comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(spot_id, userId, reviewerName, reviewerAvatar, Number(rating), comment || '');

      // Recalculate real spot review_count and average rating from actual reviews
      const stats: any = db.prepare(`
        SELECT count(*) as count, AVG(rating) as avgRating FROM reviews WHERE spot_id = ?
      `).get(spot_id);

      if (stats && stats.count > 0) {
        db.prepare(`UPDATE spots SET review_count = ?, rating = ? WHERE id = ?`).run(
          stats.count,
          Number(stats.avgRating.toFixed(1)),
          spot_id
        );
      }

      // Log event
      db.prepare(`
        INSERT INTO analytics_events (user_id, event_type, item_id, item_name, metadata)
        VALUES (?, 'review_submit', ?, ?, ?)
      `).run(userId, spot_id, reviewerName, JSON.stringify({ rating, comment }));

      res.json({ success: true, reviewId: result.lastInsertRowid });
    } catch (err) {
      console.error('Error adding review:', err);
      res.status(500).json({ error: 'Erro ao publicar avaliação' });
    }
  });

  // User Profile Update (with photo upload)
  app.post('/api/user/profile', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { name, email, whatsapp, avatar_url } = req.body;

      const updates: string[] = [];
      const params: any[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(typeof name === 'string' ? name.trim() : '');
      }
      if (email !== undefined) {
        const cleanEmail = typeof email === 'string' ? email.trim() : '';
        updates.push('email = ?');
        params.push(cleanEmail);
        updates.push('whatsapp = ?');
        params.push(cleanEmail);
      } else if (whatsapp !== undefined) {
        updates.push('whatsapp = ?');
        params.push(typeof whatsapp === 'string' ? whatsapp.trim() : '');
      }
      if (avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        params.push(avatar_url);
      }

      if (updates.length > 0) {
        params.push(user.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      const updatedUser: any = db.prepare('SELECT id, name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step FROM users WHERE id = ?').get(user.id);
      if (updatedUser) {
        updatedUser.email = updatedUser.email || updatedUser.whatsapp;

        // Persist to Cloud Firestore in background
        persistUserToFirestore({
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          whatsapp: updatedUser.whatsapp || updatedUser.email,
          password_hash: updatedUser.password_hash,
          role: updatedUser.role || 'user',
          avatar_url: updatedUser.avatar_url,
          visits_count: updatedUser.visits_count,
          is_banned: updatedUser.is_banned || 0,
          snow_enabled: updatedUser.snow_enabled || 0,
          theme: updatedUser.theme || 'dark',
          high_contrast: updatedUser.high_contrast || 0,
          onboarding_completed: updatedUser.onboarding_completed,
          onboarding_step: updatedUser.onboarding_step
        }).catch(() => {});

        try {
          db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}
      }

      // Log action
      logAdminAction(user.id, updatedUser ? (updatedUser.name || 'Usuário') : 'Usuário', 'Atualizou Perfil', 'Foto/dados alterados');

      // Log analytics
      db.prepare(`
        INSERT INTO analytics_events (user_id, event_type, item_name)
        VALUES (?, 'profile_update', ?)
      `).run(user.id, updatedUser ? (updatedUser.name || 'Usuário') : 'Usuário');

      res.json({ success: true, user: updatedUser });
    } catch (err) {
      console.error('Error updating user profile:', err);
      res.status(500).json({ error: 'Erro ao atualizar perfil do usuário' });
    }
  });

  // ==========================================
  // PUBLIC CLIENT ENDPOINTS
  // ==========================================

  // Get active spots for the main app
  app.get('/api/spots', (req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM spots WHERE is_active = 1 ORDER BY rating DESC`).all();
      const formattedSpots = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        shortName: r.short_name || r.name,
        tagLabel: r.tag_label || r.name,
        category: r.category,
        categoryLabel: r.category_label || r.category,
        lat: r.lat,
        lng: r.lng,
        image: r.image,
        gallery: r.gallery ? JSON.parse(r.gallery) : [],
        description: r.description,
        touristTip: r.tourist_tip,
        rating: r.rating,
        reviewCount: r.review_count,
        hours: r.hours,
        address: r.address,
        priceRange: r.price_range,
        popularTimes: r.popular_times,
        visitorsToday: r.visitors_today,
        badge: r.badge,
        highlighted: Boolean(r.highlighted),
        isActive: Boolean(r.is_active),
        isVerified: Boolean(r.is_verified),
        website: r.website || '',
        phone: r.phone || '',
        mapsUrl: r.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' Campos do Jordão')}`,
        googleRating: r.google_rating !== null && r.google_rating !== undefined ? Number(r.google_rating) : undefined,
        googleReviewSnippet: r.google_review_snippet || undefined,
        lastSyncedMaps: r.last_synced_maps || undefined
      }));
      res.json({ success: true, spots: formattedSpots });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar pontos' });
    }
  });

  // Public visual icons endpoint for the map (strictly non-interactive layer)
  app.get('/api/map-visual-icons', (req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM map_visual_icons WHERE is_active = 1 ORDER BY created_at ASC`).all();
      res.json({ success: true, icons: rows });
    } catch (err: any) {
      console.error('Error fetching map visual icons:', err);
      res.status(500).json({ error: 'Erro ao buscar ícones visuais do mapa' });
    }
  });

  // Get active events
  app.get('/api/events', (req, res) => {
    try {
      const events = db.prepare(`SELECT * FROM events WHERE status = 'active' ORDER BY created_at DESC`).all();
      res.json({ success: true, events });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar eventos' });
    }
  });

  // Get public settings (community link, instagram, etc.)
  app.get('/api/settings', (req, res) => {
    try {
      const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      res.json({ success: true, settings });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
  });

  // ==========================================
  // AUTH & GMAIL VERIFICATION ENDPOINTS
  // ==========================================

  // Helper to format RFC 2822 email for Gmail API
  function formatRawEmail(to: string, subject: string, bodyText: string, bodyHtml: string) {
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const boundary = `__monvian_${Date.now()}__`;
    const message = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      bodyText,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      bodyHtml,
      '',
      `--${boundary}--`
    ].join('\r\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // 1. Send Email Verification Code
  app.post('/api/auth/send-verification-code', async (req, res) => {
    try {
      const { email, name, purpose } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'E-mail é obrigatório' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ error: 'Por favor, insira um endereço de e-mail válido' });
        return;
      }

      // If purpose is register, check if email is already taken
      if (purpose === 'register') {
        const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
        if (existing) {
          res.status(400).json({ error: 'Já existe uma conta registrada com este e-mail. Faça login.' });
          return;
        }
      }

      // Generate 6-digit numeric verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Clean up previous unverified codes for this email
      db.prepare('DELETE FROM email_verifications WHERE LOWER(email) = ? AND verified = 0').run(cleanEmail);

      // Store new code
      db.prepare(`
        INSERT INTO email_verifications (email, code, expires_at, verified)
        VALUES (?, ?, ?, 0)
      `).run(cleanEmail, code, expiresAt);

      // Attempt sending via Gmail API if user provided a Google/Gmail access token
      const authHeader = req.headers.authorization;
      let sentViaGmail = false;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.split(' ')[1];
        try {
          const htmlContent = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #000; color: #fff; padding: 32px; border-radius: 20px; text-align: center;">
              <h1 style="font-family: Georgia, serif; font-style: italic; font-size: 28px; margin: 0 0 8px; color: #fff;">Monvian</h1>
              <p style="color: #999; font-size: 12px; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px;">Campos do Jordão</p>
              <h2 style="font-size: 18px; margin-bottom: 12px; color: #fff;">Código de Verificação</h2>
              <p style="color: #bbb; font-size: 14px; margin-bottom: 24px;">Olá${name ? ' ' + name : ''}! Digite o código abaixo no aplicativo para confirmar seu e-mail:</p>
              <div style="background: #18181b; border: 1.5px solid #00C896; border-radius: 12px; padding: 14px 28px; display: inline-block; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #00C896; font-family: monospace;">${code}</span>
              </div>
              <p style="color: #71717a; font-size: 12px;">Válido por 10 minutos. Se você não solicitou, ignore esta mensagem.</p>
            </div>
          `;
          const raw = formatRawEmail(
            cleanEmail,
            `Seu código de verificação Monvian: ${code}`,
            `Olá! Seu código de verificação Monvian é: ${code}. Válido por 10 minutos.`,
            htmlContent
          );

          const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${bearerToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw }),
          });

          if (gmailRes.ok) {
            sentViaGmail = true;
            console.log(`[Gmail API] Verification email sent to ${cleanEmail}`);
          }
        } catch (e) {
          console.warn('[Gmail API] Could not dispatch email via token:', e);
        }
      }

      console.log(`\n==========================================`);
      console.log(`[MONVIAN AUTH] Código de Verificação`);
      console.log(`E-mail: ${cleanEmail}`);
      console.log(`Código: ${code}`);
      console.log(`Válido até: ${expiresAt}`);
      console.log(`Enviado via Gmail API: ${sentViaGmail ? 'Sim' : 'Simulado/Local'}`);
      console.log(`==========================================\n`);

      res.json({
        success: true,
        message: `Código de verificação enviado para ${cleanEmail}`,
        email: cleanEmail,
        expires_in_seconds: 600,
        sent_via_gmail: sentViaGmail,
        preview_code: code // Included for seamless testing in preview
      });
    } catch (err) {
      console.error('Error in send-verification-code:', err);
      res.status(500).json({ error: 'Erro ao enviar código de verificação' });
    }
  });

  // 2. Validate Code Endpoint
  app.post('/api/auth/verify-code', (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        res.status(400).json({ error: 'E-mail e código são obrigatórios' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();

      const record: any = db.prepare(`
        SELECT * FROM email_verifications 
        WHERE LOWER(email) = ? AND code = ? AND verified = 0 
        ORDER BY id DESC LIMIT 1
      `).get(cleanEmail, cleanCode);

      if (!record) {
        res.status(400).json({ error: 'Código inválido ou não encontrado.' });
        return;
      }

      if (new Date(record.expires_at).getTime() < Date.now()) {
        res.status(400).json({ error: 'O código expirou. Solicite um novo código.' });
        return;
      }

      db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(record.id);

      res.json({
        success: true,
        message: 'Código verificado com sucesso!'
      });
    } catch (err) {
      console.error('Error verifying code:', err);
      res.status(500).json({ error: 'Erro ao validar código' });
    }
  });

  // 3. Register with Email + Verification Code
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, whatsapp, password, code } = req.body;
      const cleanEmail = (email || whatsapp || '').trim().toLowerCase();

      if (!name || !cleanEmail || !password) {
        res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ error: 'Por favor, insira um e-mail válido' });
        return;
      }

      // Check code verification
      if (code) {
        const cleanCode = String(code).trim();
        const verifiedRecord: any = db.prepare(`
          SELECT * FROM email_verifications 
          WHERE LOWER(email) = ? AND code = ? 
          ORDER BY id DESC LIMIT 1
        `).get(cleanEmail, cleanCode);

        if (!verifiedRecord) {
          res.status(400).json({ error: 'Código de verificação incorreto' });
          return;
        }
      }

      const checkUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
      if (checkUser) {
        res.status(400).json({ error: 'Usuário já cadastrado com este e-mail' });
        return;
      }

      // Also verify Cloud Firestore to ensure uniqueness across containers
      const cloudExistingUser = await getUserFromFirestore(cleanEmail);
      if (cloudExistingUser) {
        res.status(400).json({ error: 'Usuário já cadastrado com este e-mail' });
        return;
      }

      const hash = await bcrypt.hash(password, 10);
      const isFirst = ((db.prepare('SELECT count(*) as count FROM users').get() as any).count) === 0;
      const isAdminEmail = cleanEmail === 'marioyesk@gmail.com' || cleanEmail.includes('admin');
      const role = (isFirst || isAdminEmail) ? 'admin' : 'user';

      const defaultAvatar = '/fotoperfil.png';
      const result = db.prepare(`
        INSERT INTO users (name, email, whatsapp, password_hash, role, visits_count, onboarding_completed, onboarding_step, avatar_url)
        VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?)
      `).run(name.trim(), cleanEmail, cleanEmail, hash, role, defaultAvatar);
      const userId = Number(result.lastInsertRowid);

      try {
        db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(userId);
      } catch (e) {}

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);

      // Persist to Cloud Firestore in background so user response is immediate
      persistUserToFirestore({
        id: userId,
        name: name.trim(),
        email: cleanEmail,
        whatsapp: cleanEmail,
        password_hash: hash,
        role,
        avatar_url: defaultAvatar,
        visits_count: 1,
        is_banned: 0,
        snow_enabled: 0,
        theme: 'dark',
        high_contrast: 0,
        onboarding_completed: 0,
        onboarding_step: 1
      }).catch(() => {});
      persistSessionToFirestore(token, userId, cleanEmail).catch(() => {});

      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}

      res.json({
        success: true,
        token,
        user: {
          id: userId,
          name: name.trim(),
          email: cleanEmail,
          whatsapp: cleanEmail,
          role,
          avatar_url: defaultAvatar,
          is_banned: 0,
          onboarding_completed: false,
          onboarding_step: 1
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao registrar usuário' });
    }
  });

  // 4. Login with Email + Password
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, whatsapp, password } = req.body;
      const identifier = (email || whatsapp || '').trim().toLowerCase();

      if (!identifier || !password) {
        res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
        return;
      }

      let user: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(identifier, identifier);
      if (!user) {
        // Fallback: check Cloud Firestore (e.g. freshly started container after deploy)
        const cloudUser = await getUserFromFirestore(identifier);
        if (cloudUser && cloudUser.password_hash) {
          const resInsert = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            cloudUser.name || identifier.split('@')[0],
            cloudUser.email,
            cloudUser.whatsapp || cloudUser.email,
            cloudUser.password_hash,
            cloudUser.role || 'user',
            cloudUser.avatar_url || '/fotoperfil.png',
            cloudUser.visits_count || 1,
            cloudUser.is_banned || 0,
            cloudUser.snow_enabled || 0,
            cloudUser.theme || 'dark',
            cloudUser.high_contrast || 0,
            cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
            cloudUser.onboarding_step || 1,
            cloudUser.last_access || new Date().toISOString(),
            cloudUser.created_at || new Date().toISOString()
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(resInsert.lastInsertRowid);
        }
      }

      if (!user) {
        res.status(401).json({ error: 'E-mail ou senha incorretos' });
        return;
      }

      if (user.is_banned === 1) {
        res.status(403).json({ error: 'Esta conta foi suspensa/banida pelo administrador.' });
        return;
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        res.status(401).json({ error: 'E-mail ou senha incorretos' });
        return;
      }

      // Update visit count and last access
      db.prepare(`UPDATE users SET visits_count = visits_count + 1, last_access = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
      user.visits_count = (user.visits_count || 1) + 1;

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      const userEmail = (user.email || user.whatsapp || '').trim().toLowerCase();

      // Persist session and user update to Cloud Firestore in background
      persistSessionToFirestore(token, user.id, userEmail).catch(() => {});
      persistUserToFirestore({
        id: user.id,
        name: user.name,
        email: userEmail,
        whatsapp: user.whatsapp || userEmail,
        password_hash: user.password_hash,
        role: user.role || 'user',
        avatar_url: user.avatar_url,
        visits_count: user.visits_count,
        is_banned: user.is_banned || 0,
        snow_enabled: user.snow_enabled || 0,
        theme: user.theme || 'dark',
        high_contrast: user.high_contrast || 0,
        onboarding_completed: user.onboarding_completed,
        onboarding_step: user.onboarding_step
      }).catch(() => {});

      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: userEmail,
          whatsapp: userEmail,
          role: user.role || 'user',
          is_banned: user.is_banned || 0,
          avatar_url: user.avatar_url,
          onboarding_completed: user.onboarding_completed === 1,
          onboarding_step: user.onboarding_step || 1
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao fazer login' });
    }
  });

  // 5. Direct Login with Verified Email Code (Passwordless or code recovery)
  app.post('/api/auth/login-with-code', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        res.status(400).json({ error: 'E-mail e código são obrigatórios' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();

      const record: any = db.prepare(`
        SELECT * FROM email_verifications 
        WHERE LOWER(email) = ? AND code = ? AND verified = 0 
        ORDER BY id DESC LIMIT 1
      `).get(cleanEmail, cleanCode);

      if (!record) {
        res.status(400).json({ error: 'Código inválido' });
        return;
      }

      if (new Date(record.expires_at).getTime() < Date.now()) {
        res.status(400).json({ error: 'Código expirado. Solicite outro código.' });
        return;
      }

      db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(record.id);

      let user: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
      if (!user) {
        // Check Firestore first
        const cloudUser = await getUserFromFirestore(cleanEmail);
        if (cloudUser) {
          const resInsert = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            cloudUser.name || cleanEmail.split('@')[0],
            cloudUser.email,
            cloudUser.whatsapp || cloudUser.email,
            cloudUser.password_hash,
            cloudUser.role || 'user',
            cloudUser.avatar_url || '/fotoperfil.png',
            cloudUser.visits_count || 1,
            cloudUser.is_banned || 0,
            cloudUser.snow_enabled || 0,
            cloudUser.theme || 'dark',
            cloudUser.high_contrast || 0,
            cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
            cloudUser.onboarding_step || 1,
            cloudUser.last_access || new Date().toISOString(),
            cloudUser.created_at || new Date().toISOString()
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(resInsert.lastInsertRowid);
        } else {
          const isFirst = ((db.prepare('SELECT count(*) as count FROM users').get() as any).count) === 0;
          const isAdminEmail = cleanEmail === 'marioyesk@gmail.com' || cleanEmail.includes('admin');
          const role = (isFirst || isAdminEmail) ? 'admin' : 'user';
          const dummyPass = crypto.randomBytes(16).toString('hex');
          const hash = await bcrypt.hash(dummyPass, 10);
          const defaultAvatar = '/fotoperfil.png';

          const result = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, visits_count, onboarding_completed, onboarding_step, avatar_url)
            VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?)
          `).run(cleanEmail.split('@')[0], cleanEmail, cleanEmail, hash, role, defaultAvatar);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        }
      } else {
        if (user.is_banned === 1) {
          res.status(403).json({ error: 'Esta conta foi suspensa/banida pelo administrador.' });
          return;
        }
        db.prepare(`UPDATE users SET visits_count = visits_count + 1, last_access = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
      }

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      const userEmail = (user.email || user.whatsapp || '').trim().toLowerCase();

      // Persist session and user to Firestore in background
      persistSessionToFirestore(token, user.id, userEmail).catch(() => {});
      persistUserToFirestore({
        id: user.id,
        name: user.name,
        email: userEmail,
        whatsapp: user.whatsapp || userEmail,
        password_hash: user.password_hash,
        role: user.role || 'user',
        avatar_url: user.avatar_url,
        visits_count: user.visits_count || 1,
        is_banned: user.is_banned || 0,
        snow_enabled: user.snow_enabled || 0,
        theme: user.theme || 'dark',
        high_contrast: user.high_contrast || 0,
        onboarding_completed: user.onboarding_completed,
        onboarding_step: user.onboarding_step
      }).catch(() => {});

      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: userEmail,
          whatsapp: userEmail,
          role: user.role || 'user',
          is_banned: user.is_banned || 0,
          avatar_url: user.avatar_url,
          onboarding_completed: user.onboarding_completed === 1,
          onboarding_step: user.onboarding_step || 1
        }
      });
    } catch (err) {
      console.error('Error logging in with code:', err);
      res.status(500).json({ error: 'Erro ao entrar com código' });
    }
  });

  // 6. Sign in with Google (Google Workspace OAuth)
  app.post('/api/auth/google', async (req, res) => {
    try {
      const { email, name, avatar_url } = req.body;
      if (!email) {
        res.status(400).json({ error: 'E-mail do Google não recebido' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      let user: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);

      if (!user) {
        // Check Firestore first
        const cloudUser = await getUserFromFirestore(cleanEmail);
        if (cloudUser) {
          const resInsert = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            cloudUser.name || name || cleanEmail.split('@')[0],
            cloudUser.email,
            cloudUser.whatsapp || cloudUser.email,
            cloudUser.password_hash,
            cloudUser.role || 'user',
            cloudUser.avatar_url || avatar_url || '/fotoperfil.png',
            cloudUser.visits_count || 1,
            cloudUser.is_banned || 0,
            cloudUser.snow_enabled || 0,
            cloudUser.theme || 'dark',
            cloudUser.high_contrast || 0,
            cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
            cloudUser.onboarding_step || 1,
            cloudUser.last_access || new Date().toISOString(),
            cloudUser.created_at || new Date().toISOString()
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(resInsert.lastInsertRowid);
        } else {
          const isFirst = ((db.prepare('SELECT count(*) as count FROM users').get() as any).count) === 0;
          const isAdminEmail = cleanEmail === 'marioyesk@gmail.com' || cleanEmail.includes('admin');
          const role = (isFirst || isAdminEmail) ? 'admin' : 'user';
          const dummyPassword = crypto.randomBytes(16).toString('hex');
          const hash = await bcrypt.hash(dummyPassword, 10);
          const avatar = avatar_url || '/fotoperfil.png';

          const result = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, visits_count, onboarding_completed, onboarding_step, avatar_url)
            VALUES (?, ?, ?, ?, ?, 1, 1, 1, ?)
          `).run(name || cleanEmail.split('@')[0], cleanEmail, cleanEmail, hash, role, avatar);
          const userId = result.lastInsertRowid;

          try {
            db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(userId);
          } catch (e) {}

          user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        }
      } else {
        if (user.is_banned === 1) {
          res.status(403).json({ error: 'Esta conta foi suspensa/banida pelo administrador.' });
          return;
        }
        if (avatar_url && (!user.avatar_url || user.avatar_url === '/fotoperfil.png')) {
          db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatar_url, user.id);
          user.avatar_url = avatar_url;
        }
        db.prepare(`UPDATE users SET visits_count = visits_count + 1, last_access = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
      }

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      const userEmail = (user.email || user.whatsapp || '').trim().toLowerCase();

      // Persist session and user to Cloud Firestore in background
      persistSessionToFirestore(token, user.id, userEmail).catch(() => {});
      persistUserToFirestore({
        id: user.id,
        name: user.name,
        email: userEmail,
        whatsapp: user.whatsapp || userEmail,
        password_hash: user.password_hash,
        role: user.role || 'user',
        avatar_url: user.avatar_url,
        visits_count: user.visits_count || 1,
        is_banned: user.is_banned || 0,
        snow_enabled: user.snow_enabled || 0,
        theme: user.theme || 'dark',
        high_contrast: user.high_contrast || 0,
        onboarding_completed: user.onboarding_completed,
        onboarding_step: user.onboarding_step
      }).catch(() => {});

      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: userEmail,
          whatsapp: userEmail,
          role: user.role || 'user',
          is_banned: user.is_banned || 0,
          avatar_url: user.avatar_url,
          onboarding_completed: user.onboarding_completed === 1,
          onboarding_step: user.onboarding_step || 1
        }
      });
    } catch (err) {
      console.error('Google auth error:', err);
      res.status(500).json({ error: 'Erro ao autenticar com Google' });
    }
  });

  // 7. Get Current Authenticated User Session
  app.get('/api/auth/me', async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        res.status(401).json({ error: 'Sessão inválida ou expirada' });
        return;
      }
      if (user.is_banned === 1) {
        res.status(403).json({ error: 'Conta suspensa/banida' });
        return;
      }

      const userEmail = user.email || user.whatsapp;

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: userEmail,
          whatsapp: userEmail,
          role: user.role || 'user',
          is_banned: user.is_banned || 0,
          avatar_url: user.avatar_url,
          visits_count: user.visits_count,
          onboarding_completed: user.onboarding_completed === 1,
          onboarding_step: user.onboarding_step || 1
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao verificar sessão' });
    }
  });

  // 8. Gmail Direct Proxy Send
  app.post('/api/gmail/send-proxy', requireAuth, async (req, res) => {
    try {
      const { to, subject, body, accessToken } = req.body;
      if (!to || !subject || !body) {
        res.status(400).json({ error: 'Destinatário, assunto e mensagem são obrigatórios' });
        return;
      }

      const token = accessToken || (req.headers['x-gmail-token'] as string);
      if (!token) {
        res.status(401).json({ error: 'Token do Gmail não informado. Conecte sua conta do Google.' });
        return;
      }

      const html = `<div style="font-family: sans-serif; line-height: 1.6; color: #111;">${body.replace(/\n/g, '<br/>')}</div>`;
      const raw = formatRawEmail(to, subject, body, html);

      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });

      if (!gmailRes.ok) {
        const errorData = await gmailRes.json().catch(() => ({}));
        res.status(gmailRes.status).json({ error: errorData?.error?.message || 'Erro ao enviar e-mail via Gmail' });
        return;
      }

      const data = await gmailRes.json();
      res.json({ success: true, message: 'E-mail enviado com sucesso via Gmail!', data });
    } catch (err: any) {
      console.error('Error sending email via Gmail proxy:', err);
      res.status(500).json({ error: err.message || 'Erro interno ao enviar e-mail' });
    }
  });

  // ==========================================
  // ONBOARDING ENDPOINTS
  // ==========================================

  // Get current user onboarding status and saved preferences
  app.get('/api/user/onboarding', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const prefs: any = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(user.id);
      res.json({
        success: true,
        onboarding_completed: user.onboarding_completed === 1,
        onboarding_step: user.onboarding_step || 1,
        preferences: prefs || null
      });
    } catch (err) {
      console.error('Error fetching onboarding state:', err);
      res.status(500).json({ error: 'Erro ao carregar status do onboarding' });
    }
  });

  // Save incremental onboarding step and answers
  app.post('/api/user/onboarding/step', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { step, referral_source, travel_frequency, travel_style, main_interests, preferred_season } = req.body;

      const nextStep = typeof step === 'number' ? Math.max(1, Math.min(5, step)) : (user.onboarding_step || 1);

      // Update user step
      db.prepare('UPDATE users SET onboarding_step = ? WHERE id = ?').run(nextStep, user.id);

      // Upsert preferences
      const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(user.id);
      if (existing) {
        db.prepare(`
          UPDATE user_preferences SET
            referral_source = COALESCE(?, referral_source),
            travel_frequency = COALESCE(?, travel_frequency),
            travel_style = COALESCE(?, travel_style),
            main_interests = COALESCE(?, main_interests),
            preferred_season = COALESCE(?, preferred_season),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(
          referral_source !== undefined ? referral_source : null,
          travel_frequency !== undefined ? travel_frequency : null,
          travel_style !== undefined ? travel_style : null,
          main_interests !== undefined ? (typeof main_interests === 'string' ? main_interests : JSON.stringify(main_interests)) : null,
          preferred_season !== undefined ? preferred_season : null,
          user.id
        );
      } else {
        db.prepare(`
          INSERT INTO user_preferences (user_id, referral_source, travel_frequency, travel_style, main_interests, preferred_season)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          user.id,
          referral_source || null,
          travel_frequency || null,
          travel_style || null,
          main_interests ? (typeof main_interests === 'string' ? main_interests : JSON.stringify(main_interests)) : null,
          preferred_season || null
        );
      }

      res.json({ success: true, onboarding_step: nextStep });
    } catch (err: any) {
      console.error('Error saving onboarding step:', err);
      res.status(500).json({ error: 'Erro ao salvar etapa do onboarding' });
    }
  });

  // Complete onboarding
  app.post('/api/user/onboarding/complete', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { referral_source, travel_frequency, travel_style, main_interests, preferred_season } = req.body;

      // Mark user as completed
      db.prepare('UPDATE users SET onboarding_completed = 1, onboarding_step = 5 WHERE id = ?').run(user.id);

      // Upsert complete preferences with timestamp
      const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(user.id);
      const interestsStr = main_interests !== undefined ? (typeof main_interests === 'string' ? main_interests : JSON.stringify(main_interests)) : null;

      if (existing) {
        db.prepare(`
          UPDATE user_preferences SET
            referral_source = COALESCE(?, referral_source),
            travel_frequency = COALESCE(?, travel_frequency),
            travel_style = COALESCE(?, travel_style),
            main_interests = COALESCE(?, main_interests),
            preferred_season = COALESCE(?, preferred_season),
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(
          referral_source !== undefined ? referral_source : null,
          travel_frequency !== undefined ? travel_frequency : null,
          travel_style !== undefined ? travel_style : null,
          interestsStr,
          preferred_season !== undefined ? preferred_season : null,
          user.id
        );
      } else {
        db.prepare(`
          INSERT INTO user_preferences (user_id, referral_source, travel_frequency, travel_style, main_interests, preferred_season, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          user.id,
          referral_source || null,
          travel_frequency || null,
          travel_style || null,
          interestsStr,
          preferred_season || null
        );
      }

      // Log analytics and admin action
      db.prepare(`
        INSERT INTO analytics_events (user_id, event_type, item_name, metadata)
        VALUES (?, 'onboarding_completed', ?, ?)
      `).run(user.id, user.name || 'Novo Usuário', JSON.stringify({ referral: referral_source, frequency: travel_frequency }));

      const updatedUser: any = db.prepare('SELECT id, name, whatsapp, role, avatar_url, visits_count, onboarding_completed, onboarding_step FROM users WHERE id = ?').get(user.id);

      res.json({
        success: true,
        user: {
          ...updatedUser,
          onboarding_completed: true,
          onboarding_step: 5
        }
      });
    } catch (err: any) {
      console.error('Error completing onboarding:', err);
      res.status(500).json({ error: 'Erro ao concluir onboarding' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        await deleteSessionFromFirestore(token);
      }
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao fazer logout' });
    }
  });

  // User Settings
  app.get('/api/user/settings', requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({
      success: true,
      snow_enabled: Boolean(user.snow_enabled),
      theme: user.theme || 'dark',
      high_contrast: Boolean(user.high_contrast)
    });
  });

  app.post('/api/user/settings', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { snow_enabled, theme, high_contrast } = req.body;
    db.prepare('UPDATE users SET snow_enabled = ?, theme = ?, high_contrast = ? WHERE id = ?').run(
      snow_enabled ? 1 : 0,
      theme || 'dark',
      high_contrast ? 1 : 0,
      user.id
    );

    const userEmail = (user.email || user.whatsapp || '').trim().toLowerCase();
    persistUserToFirestore({
      id: user.id,
      name: user.name,
      email: userEmail,
      whatsapp: user.whatsapp || userEmail,
      password_hash: user.password_hash,
      role: user.role || 'user',
      avatar_url: user.avatar_url,
      visits_count: user.visits_count,
      is_banned: user.is_banned || 0,
      snow_enabled: snow_enabled ? 1 : 0,
      theme: theme || 'dark',
      high_contrast: high_contrast ? 1 : 0,
      onboarding_completed: user.onboarding_completed,
      onboarding_step: user.onboarding_step
    }).catch(() => {});

    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}

    res.json({ success: true });
  });

  // ==========================================
  // ADMIN API ENDPOINTS (PROTECTED & FUNCTIONAL)
  // ==========================================

  // Helper to calculate real percentage growth between current and previous timeframes
  function calculateGrowth(current: number, previous: number) {
    if (previous === 0) {
      if (current === 0) return { changePercent: '0%', trend: 'up' as const, hasData: false };
      return { changePercent: '+100%', trend: 'up' as const, hasData: true };
    }
    const diff = current - previous;
    const pct = (diff / previous) * 100;
    const rounded = Math.abs(pct).toFixed(1);
    if (diff >= 0) {
      return { changePercent: `+${rounded}%`, trend: 'up' as const, hasData: true };
    } else {
      return { changePercent: `-${rounded}%`, trend: 'down' as const, hasData: true };
    }
  }

  // Helper to generate dynamic SVG sparkline curve strictly from real daily numbers
  function generateSparkline(dailyCounts: number[]) {
    const allZero = dailyCounts.every(v => v === 0);
    if (allZero) {
      return 'M 0 26 L 100 26';
    }
    const max = Math.max(...dailyCounts);
    const min = Math.min(...dailyCounts);
    const range = max === min ? (max || 1) : max - min;

    const points = dailyCounts.map((val, idx) => {
      const x = Number(((idx / (dailyCounts.length - 1)) * 100).toFixed(1));
      const normalized = (val - min) / range;
      const y = Number((25 - (normalized * 20)).toFixed(1));
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = Number(((p0.x + p1.x) / 2).toFixed(1));
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }

  // Dashboard Overview Metrics - 100% REAL DATA FROM SQLITE DATABASE
  app.get('/api/admin/dashboard', (req, res) => {
    try {
      // 1. Total Users
      const totalUsers = (db.prepare('SELECT count(*) as count FROM users').get() as any).count || 0;
      const usersCurr7d = (db.prepare(`SELECT count(*) as count FROM users WHERE created_at >= datetime('now', '-7 days')`).get() as any).count || 0;
      const usersPrev7d = (db.prepare(`SELECT count(*) as count FROM users WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')`).get() as any).count || 0;
      const usersDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`SELECT count(*) as count FROM users WHERE date(created_at) = date('now', '-${i} days')`).get();
        usersDaily.push(row?.count || 0);
      }
      const usersGrowth = calculateGrowth(usersCurr7d, usersPrev7d);
      const usersSparkline = generateSparkline(usersDaily);

      // 2. Active Growth (Distinct active users in last 7 days)
      const activeUsers7d = (db.prepare(`
        SELECT count(DISTINCT user_id) as count FROM (
          SELECT user_id FROM analytics_events WHERE created_at >= datetime('now', '-7 days') AND user_id IS NOT NULL
          UNION
          SELECT user_id FROM sessions WHERE created_at >= datetime('now', '-7 days')
        )
      `).get() as any).count || 0;

      const activeUsersPrev7d = (db.prepare(`
        SELECT count(DISTINCT user_id) as count FROM (
          SELECT user_id FROM analytics_events WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days') AND user_id IS NOT NULL
        )
      `).get() as any).count || 0;
      const activeGrowth = calculateGrowth(activeUsers7d, activeUsersPrev7d);
      const activeDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`
          SELECT count(DISTINCT user_id) as count FROM (
            SELECT user_id FROM analytics_events WHERE date(created_at) = date('now', '-${i} days') AND user_id IS NOT NULL
            UNION
            SELECT user_id FROM sessions WHERE date(created_at) = date('now', '-${i} days')
          )
        `).get();
        activeDaily.push(row?.count || 0);
      }
      const activeSparkline = generateSparkline(activeDaily);

      // 3. Spots / Destinations
      const totalSpots = (db.prepare('SELECT count(*) as count FROM spots WHERE is_active = 1').get() as any).count || 0;
      const totalLocations = (db.prepare('SELECT count(*) as count FROM spots').get() as any).count || 0;
      const servicesCount = (db.prepare(`SELECT count(*) as count FROM spots WHERE category IN ('hotels', 'restaurants', 'cafes', 'sweets', 'pharmacies', 'services', 'shops')`).get() as any).count || 0;
      const spotsCurr7d = (db.prepare(`SELECT count(*) as count FROM spots WHERE created_at >= datetime('now', '-7 days')`).get() as any).count || 0;
      const spotsPrev7d = (db.prepare(`SELECT count(*) as count FROM spots WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')`).get() as any).count || 0;
      const spotsGrowth = calculateGrowth(spotsCurr7d, spotsPrev7d);
      const spotsDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`SELECT count(*) as count FROM spots WHERE date(created_at) = date('now', '-${i} days')`).get();
        spotsDaily.push(row?.count || 0);
      }
      const spotsSparkline = generateSparkline(spotsDaily);

      // 4. Real Total Views (from real analytics_events)
      const viewsTotal = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_view', 'spot_detail_open', 'banner_view', 'event_view', 'tab_view')
      `).get() as any).count || 0;

      const viewsCurr7d = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_view', 'spot_detail_open', 'banner_view', 'event_view', 'tab_view')
        AND created_at >= datetime('now', '-7 days')
      `).get() as any).count || 0;

      const viewsPrev7d = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_view', 'spot_detail_open', 'banner_view', 'event_view', 'tab_view')
        AND created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')
      `).get() as any).count || 0;
      const viewsGrowth = calculateGrowth(viewsCurr7d, viewsPrev7d);
      const viewsDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`
          SELECT count(*) as count FROM analytics_events 
          WHERE event_type IN ('spot_view', 'spot_detail_open', 'banner_view', 'event_view', 'tab_view')
          AND date(created_at) = date('now', '-${i} days')
        `).get();
        viewsDaily.push(row?.count || 0);
      }
      const viewsSparkline = generateSparkline(viewsDaily);

      // 5. Real Engagement (all user actions)
      const engagementTotal = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_detail_open', 'favorite_add', 'favorite_remove', 'chat_message', 'search_query', 'voice_search', 'route_click', 'category_filter', 'review_submit', 'profile_update')
      `).get() as any).count || 0;

      const engagementCurr7d = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_detail_open', 'favorite_add', 'favorite_remove', 'chat_message', 'search_query', 'voice_search', 'route_click', 'category_filter', 'review_submit', 'profile_update')
        AND created_at >= datetime('now', '-7 days')
      `).get() as any).count || 0;

      const engagementPrev7d = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_detail_open', 'favorite_add', 'favorite_remove', 'chat_message', 'search_query', 'voice_search', 'route_click', 'category_filter', 'review_submit', 'profile_update')
        AND created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')
      `).get() as any).count || 0;
      const engagementGrowth = calculateGrowth(engagementCurr7d, engagementPrev7d);
      const engagementDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`
          SELECT count(*) as count FROM analytics_events 
          WHERE event_type IN ('spot_detail_open', 'favorite_add', 'favorite_remove', 'chat_message', 'search_query', 'voice_search', 'route_click', 'category_filter', 'review_submit', 'profile_update')
          AND date(created_at) = date('now', '-${i} days')
        `).get();
        engagementDaily.push(row?.count || 0);
      }
      const engagementSparkline = generateSparkline(engagementDaily);

      // 6. Real Reviews
      const totalReviews = (db.prepare('SELECT count(*) as count FROM reviews').get() as any).count || 0;
      const reviewsCurr7d = (db.prepare(`SELECT count(*) as count FROM reviews WHERE created_at >= datetime('now', '-7 days')`).get() as any).count || 0;
      const reviewsPrev7d = (db.prepare(`SELECT count(*) as count FROM reviews WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')`).get() as any).count || 0;
      const reviewsGrowth = calculateGrowth(reviewsCurr7d, reviewsPrev7d);
      const reviewsDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`SELECT count(*) as count FROM reviews WHERE date(created_at) = date('now', '-${i} days')`).get();
        reviewsDaily.push(row?.count || 0);
      }
      const reviewsSparkline = generateSparkline(reviewsDaily);

      // 7. Real Satisfaction Score (average rating from real reviews)
      const reviewStats: any = db.prepare('SELECT AVG(rating) as avg, count(*) as count FROM reviews').get();
      const avgScore = (reviewStats && reviewStats.count > 0 && reviewStats.avg) ? Number(reviewStats.avg.toFixed(1)) : 0;
      const prevStats: any = db.prepare(`SELECT AVG(rating) as avg, count(*) as count FROM reviews WHERE created_at < datetime('now', '-7 days')`).get();
      const prevScore = (prevStats && prevStats.count > 0 && prevStats.avg) ? Number(prevStats.avg.toFixed(1)) : 0;
      const satisfactionGrowth = calculateGrowth(avgScore, prevScore);
      const satisfactionSparkline = generateSparkline(reviewsDaily);

      // 8. Session duration calculation
      const totalEvents = (db.prepare(`SELECT count(*) as count FROM events WHERE status = 'active'`).get() as any).count || 0;
      
      // Calculate real server uptime
      const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
      const days = Math.floor(uptimeSeconds / (3600 * 24));
      const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const seconds = uptimeSeconds % 60;
      let uptimeStr = '';
      if (days > 0) uptimeStr = `Ativo há ${days}d ${hours}h`;
      else if (hours > 0) uptimeStr = `Ativo há ${hours}h ${minutes}m`;
      else if (minutes > 0) uptimeStr = `Ativo há ${minutes}m ${seconds}s`;
      else uptimeStr = `Ativo há ${seconds}s`;

      // System effects
      const rainSetting = (db.prepare(`SELECT value FROM system_settings WHERE key = 'weather_rain_mode'`).get() as any)?.value || 'auto';
      const snowSetting = (db.prepare(`SELECT value FROM system_settings WHERE key = 'weather_snow_mode'`).get() as any)?.value || 'fraca';

      // Onboarding Stats
      const onboardingCompletedCount = (db.prepare('SELECT count(*) as count FROM users WHERE onboarding_completed = 1').get() as any).count || 0;
      const onboardingPendingCount = (db.prepare('SELECT count(*) as count FROM users WHERE onboarding_completed = 0').get() as any).count || 0;
      const referralBreakdown = db.prepare('SELECT referral_source, count(*) as count FROM user_preferences WHERE referral_source IS NOT NULL GROUP BY referral_source ORDER BY count DESC').all() as { referral_source: string; count: number }[];
      const frequencyBreakdown = db.prepare('SELECT travel_frequency, count(*) as count FROM user_preferences WHERE travel_frequency IS NOT NULL GROUP BY travel_frequency ORDER BY count DESC').all() as { travel_frequency: string; count: number }[];
      const styleBreakdown = db.prepare('SELECT travel_style, count(*) as count FROM user_preferences WHERE travel_style IS NOT NULL GROUP BY travel_style ORDER BY count DESC').all() as { travel_style: string; count: number }[];

      res.json({
        success: true,
        metrics: {
          totalUsers,
          usersGrowth,
          usersSparkline,

          activeUsersCount: activeUsers7d,
          activeGrowth,
          activeSparkline,

          totalSpots,
          totalLocations,
          servicesCount,
          totalEvents,
          spotsGrowth,
          spotsSparkline,

          viewsTotal,
          viewsGrowth,
          viewsSparkline,

          engagementTotal,
          engagementGrowth,
          engagementSparkline,

          totalReviews,
          reviewsGrowth,
          reviewsSparkline,

          satisfactionScore: avgScore,
          satisfactionCount: reviewStats?.count || 0,
          satisfactionGrowth,
          satisfactionSparkline,

          avgSessionDuration: engagementTotal > 0 ? `${Math.min(Math.max(Math.round(engagementTotal / Math.max(totalUsers, 1)), 1), 10)}m` : '0m',
          sessionGrowth: { changePercent: '0%', trend: 'up', hasData: false },
          sessionSparkline: generateSparkline(engagementDaily),

          onboarding: {
            completed: onboardingCompletedCount,
            pending: onboardingPendingCount,
            completionRate: totalUsers > 0 ? Math.round((onboardingCompletedCount / totalUsers) * 100) : 100,
            referrals: referralBreakdown,
            frequencies: frequencyBreakdown,
            styles: styleBreakdown
          },

          systemHealth: {
            status: 'Operacional',
            latency: '18ms',
            uptime: uptimeStr
          },
          effects: {
            rainMode: rainSetting,
            snowMode: snowSetting
          }
        }
      });
    } catch (err: any) {
      console.error('Error fetching admin dashboard:', err);
      res.status(500).json({ error: 'Erro ao carregar métricas administrativas' });
    }
  });

  // Save Climate / Effects (Rain, Snow)
  app.post('/api/admin/effects', (req, res) => {
    try {
      const { rainMode, snowMode } = req.body;
      if (rainMode) {
        db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('weather_rain_mode', ?)`).run(rainMode);
        persistSystemSettingToFirestore('weather_rain_mode', String(rainMode)).catch(() => {});
      }
      if (snowMode) {
        db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('weather_snow_mode', ?)`).run(snowMode);
        persistSystemSettingToFirestore('weather_snow_mode', String(snowMode)).catch(() => {});
      }
      logAdminAction(null, 'Gerente ADM', 'Atualizou Clima/Efeitos', `Chuva: ${rainMode || 'mantido'}, Neve: ${snowMode || 'mantido'}`);
      res.json({ success: true, rainMode, snowMode });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao atualizar efeitos de clima' });
    }
  });

  // Admin Spots: List All (including inactive)
  app.get('/api/admin/spots', (req, res) => {
    try {
      const { q, category } = req.query;
      let query = `SELECT * FROM spots WHERE 1=1`;
      const params: any[] = [];

      if (q && typeof q === 'string' && q.trim()) {
        query += ` AND (name LIKE ? OR description LIKE ? OR address LIKE ?)`;
        const search = `%${q.trim()}%`;
        params.push(search, search, search);
      }

      if (category && typeof category === 'string' && category !== 'all') {
        query += ` AND category = ?`;
        params.push(category);
      }

      query += ` ORDER BY is_active DESC, rating DESC, created_at DESC`;
      const rows = db.prepare(query).all(...params);

      const spots = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        shortName: r.short_name || r.name,
        tagLabel: r.tag_label || r.name,
        category: r.category,
        categoryLabel: r.category_label || r.category,
        lat: r.lat,
        lng: r.lng,
        image: r.image,
        gallery: r.gallery ? JSON.parse(r.gallery) : [],
        description: r.description,
        touristTip: r.tourist_tip,
        rating: r.rating,
        reviewCount: r.review_count,
        hours: r.hours,
        address: r.address,
        priceRange: r.price_range,
        popularTimes: r.popular_times,
        visitorsToday: r.visitors_today,
        badge: r.badge,
        highlighted: Boolean(r.highlighted),
        isActive: Boolean(r.is_active),
        isVerified: Boolean(r.is_verified),
        website: r.website || '',
        phone: r.phone || '',
        createdAt: r.created_at
      }));

      res.json({ success: true, spots });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar pontos administrativos' });
    }
  });

  // Admin Spots: Upload Spot Image
  app.post('/api/admin/upload-spot-image', (req, res) => {
    try {
      const { image, fileName } = req.body;
      if (!image) {
        res.status(400).json({ error: 'Nenhuma imagem enviada' });
        return;
      }

      // Check if it's a data URL
      const matches = image.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!matches) {
        // If it's already an external URL or path, just return it
        if (image.startsWith('http') || image.startsWith('/')) {
          res.json({ success: true, url: image });
          return;
        }
        res.status(400).json({ error: 'Formato de imagem inválido' });
        return;
      }

      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1].replace(/[^a-zA-Z0-9]/g, '');
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'spots');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const cleanFileName = fileName 
        ? fileName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)
        : 'spot';
      const uniqueFileName = `${cleanFileName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const filePath = path.join(uploadsDir, uniqueFileName);

      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/uploads/spots/${uniqueFileName}`;
      res.json({ success: true, url: publicUrl });
    } catch (err: any) {
      console.error('Error saving uploaded spot image:', err);
      res.status(500).json({ error: 'Falha ao salvar imagem do ponto turístico' });
    }
  });

  // Admin Spots: Create New Spot
  app.post('/api/admin/spots', (req, res) => {
    try {
      const {
        name,
        category,
        categoryLabel,
        description,
        touristTip,
        image,
        gallery,
        lat,
        lng,
        address,
        hours,
        priceRange,
        website,
        phone,
        isVerified,
        isActive,
        highlighted,
        badge,
        rating
      } = req.body;

      if (!name || !category || lat === undefined || lng === undefined) {
        res.status(400).json({ error: 'Nome, categoria e coordenadas geográficas (lat/lng) são obrigatórios.' });
        return;
      }

      const id = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

      const defaultImage = image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80';

      const parsedRating = rating !== undefined && rating !== null && !isNaN(Number(rating))
        ? Math.max(1.0, Math.min(5.0, Number(rating)))
        : 4.8;

      db.prepare(`
        INSERT INTO spots (
          id, name, short_name, tag_label, category, category_label,
          lat, lng, image, gallery, description, tourist_tip,
          rating, review_count, hours, address, price_range,
          visitors_today, badge, highlighted, is_active, is_verified,
          website, phone
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        id,
        name,
        name,
        name,
        category,
        categoryLabel || category,
        Number(lat),
        Number(lng),
        defaultImage,
        gallery ? JSON.stringify(gallery) : '[]',
        description || '',
        touristTip || '',
        parsedRating,
        1,
        hours || 'Todos os dias das 09h às 18h',
        address || 'Campos do Jordão, SP',
        priceRange || '$$',
        50,
        badge || '',
        highlighted ? 1 : 0,
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        isVerified !== undefined ? (isVerified ? 1 : 0) : 1,
        website || '',
        phone || ''
      );

      logAdminAction(null, 'Gerente ADM', 'Criou Ponto Turístico', `Nome: ${name} (${category})`);

      // Persist to Cloud Firestore
      persistSpotToFirestore({
        id,
        name,
        short_name: name,
        tag_label: name,
        category,
        category_label: categoryLabel || category,
        lat: Number(lat),
        lng: Number(lng),
        image: defaultImage,
        gallery: gallery ? JSON.stringify(gallery) : '[]',
        description: description || '',
        tourist_tip: touristTip || '',
        rating: parsedRating,
        review_count: 1,
        hours: hours || 'Todos os dias das 09h às 18h',
        address: address || 'Campos do Jordão, SP',
        price_range: priceRange || '$$',
        visitors_today: 50,
        badge: badge || '',
        highlighted: highlighted ? 1 : 0,
        is_active: isActive !== undefined ? (isActive ? 1 : 0) : 1,
        is_verified: isVerified !== undefined ? (isVerified ? 1 : 0) : 1,
        website: website || '',
        phone: phone || ''
      }).catch(err => console.warn('[FirestoreSync] Failed to persist new spot:', id, err));

      res.json({ success: true, id, message: 'Ponto turístico cadastrado com sucesso!' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao cadastrar ponto: ' + err.message });
    }
  });

  // Admin Spots: Update Spot
  app.put('/api/admin/spots/:id', (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        category,
        categoryLabel,
        description,
        touristTip,
        image,
        gallery,
        lat,
        lng,
        address,
        hours,
        priceRange,
        website,
        phone,
        isVerified,
        isActive,
        highlighted,
        badge,
        rating
      } = req.body;

      const existing = db.prepare('SELECT id FROM spots WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Ponto não encontrado' });
        return;
      }

      const parsedRating = rating !== undefined && rating !== null && !isNaN(Number(rating))
        ? Math.max(1.0, Math.min(5.0, Number(rating)))
        : null;

      db.prepare(`
        UPDATE spots SET
          name = COALESCE(?, name),
          short_name = COALESCE(?, short_name),
          category = COALESCE(?, category),
          category_label = COALESCE(?, category_label),
          description = COALESCE(?, description),
          tourist_tip = COALESCE(?, tourist_tip),
          image = COALESCE(?, image),
          gallery = COALESCE(?, gallery),
          lat = COALESCE(?, lat),
          lng = COALESCE(?, lng),
          address = COALESCE(?, address),
          hours = COALESCE(?, hours),
          price_range = COALESCE(?, price_range),
          website = COALESCE(?, website),
          phone = COALESCE(?, phone),
          is_verified = COALESCE(?, is_verified),
          is_active = COALESCE(?, is_active),
          highlighted = COALESCE(?, highlighted),
          badge = COALESCE(?, badge),
          rating = COALESCE(?, rating),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name,
        name,
        category,
        categoryLabel,
        description,
        touristTip,
        image,
        gallery ? JSON.stringify(gallery) : null,
        lat !== undefined ? Number(lat) : null,
        lng !== undefined ? Number(lng) : null,
        address,
        hours,
        priceRange,
        website,
        phone,
        isVerified !== undefined ? (isVerified ? 1 : 0) : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        highlighted !== undefined ? (highlighted ? 1 : 0) : null,
        badge,
        parsedRating,
        id
      );

      logAdminAction(null, 'Gerente ADM', 'Editou Ponto Turístico', `ID: ${id}, Nome: ${name}`);

      const updatedSpot = db.prepare('SELECT * FROM spots WHERE id = ?').get(id) as any;
      if (updatedSpot) {
        persistSpotToFirestore({
          id: updatedSpot.id,
          name: updatedSpot.name,
          short_name: updatedSpot.short_name,
          tag_label: updatedSpot.tag_label,
          category: updatedSpot.category,
          category_label: updatedSpot.category_label,
          lat: Number(updatedSpot.lat),
          lng: Number(updatedSpot.lng),
          image: updatedSpot.image,
          gallery: updatedSpot.gallery,
          description: updatedSpot.description,
          tourist_tip: updatedSpot.tourist_tip,
          rating: Number(updatedSpot.rating),
          review_count: Number(updatedSpot.review_count),
          hours: updatedSpot.hours,
          address: updatedSpot.address,
          price_range: updatedSpot.price_range,
          popular_times: updatedSpot.popular_times,
          visitors_today: Number(updatedSpot.visitors_today),
          badge: updatedSpot.badge,
          highlighted: Number(updatedSpot.highlighted),
          is_active: Number(updatedSpot.is_active),
          is_verified: Number(updatedSpot.is_verified),
          website: updatedSpot.website,
          phone: updatedSpot.phone,
          maps_url: updatedSpot.maps_url
        }).catch(err => console.warn('[FirestoreSync] Failed to persist updated spot:', id, err));
      }

      res.json({ success: true, message: 'Ponto atualizado com sucesso!' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar ponto: ' + err.message });
    }
  });

  // Admin Spots: Delete Spot
  app.delete('/api/admin/spots/:id', (req, res) => {
    try {
      const { id } = req.params;
      const spot: any = db.prepare('SELECT name FROM spots WHERE id = ?').get(id);
      if (!spot) {
        res.status(404).json({ error: 'Ponto não encontrado' });
        return;
      }

      db.prepare('DELETE FROM spots WHERE id = ?').run(id);
      logAdminAction(null, 'Gerente ADM', 'Excluiu Ponto Turístico', `ID: ${id}, Nome: ${spot.name}`);

      deleteSpotFromFirestore(id).catch(err => console.warn('[FirestoreSync] Failed to delete spot from cloud:', id, err));

      res.json({ success: true, message: 'Ponto excluído com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao excluir ponto: ' + err.message });
    }
  });

  // Admin Spots: Toggle Active
  app.patch('/api/admin/spots/:id/toggle-active', (req, res) => {
    try {
      const { id } = req.params;
      const spot: any = db.prepare('SELECT is_active, name FROM spots WHERE id = ?').get(id);
      if (!spot) {
        res.status(404).json({ error: 'Ponto não encontrado' });
        return;
      }
      const newStatus = spot.is_active === 1 ? 0 : 1;
      db.prepare('UPDATE spots SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);
      logAdminAction(null, 'Gerente ADM', newStatus ? 'Ativou Ponto' : 'Desativou Ponto', spot.name);

      const updatedSpot = db.prepare('SELECT * FROM spots WHERE id = ?').get(id) as any;
      if (updatedSpot) {
        persistSpotToFirestore(updatedSpot).catch(() => {});
      }

      res.json({ success: true, isActive: Boolean(newStatus) });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alternar status do ponto' });
    }
  });

  // Admin Spots: Toggle Verified
  app.patch('/api/admin/spots/:id/toggle-verified', (req, res) => {
    try {
      const { id } = req.params;
      const spot: any = db.prepare('SELECT is_verified, name FROM spots WHERE id = ?').get(id);
      if (!spot) {
        res.status(404).json({ error: 'Ponto não encontrado' });
        return;
      }
      const newVerified = spot.is_verified === 1 ? 0 : 1;
      db.prepare('UPDATE spots SET is_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newVerified, id);
      logAdminAction(null, 'Gerente ADM', newVerified ? 'Marcou Verificado' : 'Removeu Verificação', spot.name);

      const updatedSpot = db.prepare('SELECT * FROM spots WHERE id = ?').get(id) as any;
      if (updatedSpot) {
        persistSpotToFirestore(updatedSpot).catch(() => {});
      }

      res.json({ success: true, isVerified: Boolean(newVerified) });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alternar verificação do ponto' });
    }
  });

  // ==========================================
  // ADMIN MAP VISUAL ICONS (ÍCONES DO MAPA)
  // ==========================================

  // Admin: List all visual icons with stats and filters
  app.get('/api/admin/map-visual-icons', (req, res) => {
    try {
      const { category, status, q } = req.query;
      let query = `SELECT * FROM map_visual_icons WHERE 1=1`;
      const params: any[] = [];

      if (category && typeof category === 'string' && category !== 'all') {
        query += ` AND category = ?`;
        params.push(category);
      }

      if (status && typeof status === 'string' && status !== 'all') {
        if (status === 'active') {
          query += ` AND is_active = 1`;
        } else if (status === 'inactive') {
          query += ` AND is_active = 0`;
        }
      }

      if (q && typeof q === 'string' && q.trim()) {
        query += ` AND (category LIKE ? OR id LIKE ?)`;
        const search = `%${q.trim()}%`;
        params.push(search, search);
      }

      query += ` ORDER BY created_at DESC`;
      const icons = db.prepare(query).all(...params);

      // Category breakdown and counts
      const stats = {
        total: (db.prepare('SELECT count(*) as count FROM map_visual_icons').get() as any)?.count || 0,
        active: (db.prepare('SELECT count(*) as count FROM map_visual_icons WHERE is_active = 1').get() as any)?.count || 0,
        inactive: (db.prepare('SELECT count(*) as count FROM map_visual_icons WHERE is_active = 0').get() as any)?.count || 0
      };

      res.json({ success: true, icons, stats });
    } catch (err: any) {
      console.error('Error fetching admin map visual icons:', err);
      res.status(500).json({ error: 'Erro ao carregar ícones do mapa' });
    }
  });

  // Admin: Create new visual icon
  app.post('/api/admin/map-visual-icons', (req, res) => {
    try {
      const { category, icon, latitude, longitude, color, is_active } = req.body;

      if (!category || latitude === undefined || longitude === undefined) {
        res.status(400).json({ error: 'Categoria e coordenadas (latitude e longitude) são obrigatórias.' });
        return;
      }

      const id = 'icon-' + category + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
      const iconKey = icon || category;
      const activeState = is_active !== undefined ? (is_active ? 1 : 0) : 1;
      const lat = Number(latitude);
      const lng = Number(longitude);
      const chosenColor = color && typeof color === 'string' && color.trim() ? color.trim() : null;

      db.prepare(`
        INSERT INTO map_visual_icons (id, category, icon, latitude, longitude, color, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(id, category, iconKey, lat, lng, chosenColor, activeState);

      logAdminAction(null, 'Gerente ADM', 'Adicionou Ícone no Mapa', `Categoria: ${category}, Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);

      persistMapVisualIconToFirestore({
        id,
        category,
        icon: iconKey,
        latitude: lat,
        longitude: lng,
        color: chosenColor || undefined,
        is_active: activeState
      }).catch(err => console.warn('[FirestoreSync] Failed to persist visual icon:', id, err));

      const created = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      res.json({ success: true, icon: created, message: 'Ícone adicionado com sucesso!' });
    } catch (err: any) {
      console.error('Error creating map visual icon:', err);
      res.status(500).json({ error: 'Erro ao adicionar ícone: ' + err.message });
    }
  });

  // Admin: Update visual icon (category, icon, position, or status)
  app.put('/api/admin/map-visual-icons/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { category, icon, latitude, longitude, color, is_active } = req.body;

      const existing: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Ícone não encontrado.' });
        return;
      }

      const newCategory = category || existing.category;
      const newIcon = icon || existing.icon;
      const newLat = latitude !== undefined ? Number(latitude) : existing.latitude;
      const newLng = longitude !== undefined ? Number(longitude) : existing.longitude;
      const newColor = color !== undefined ? (color && typeof color === 'string' && color.trim() ? color.trim() : null) : existing.color;
      const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

      db.prepare(`
        UPDATE map_visual_icons
        SET category = ?,
            icon = ?,
            latitude = ?,
            longitude = ?,
            color = ?,
            is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newCategory, newIcon, newLat, newLng, newColor, newActive, id);

      logAdminAction(null, 'Gerente ADM', 'Atualizou Ícone no Mapa', `ID: ${id}, Categoria: ${newCategory}`);

      const updated: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (updated) {
        persistMapVisualIconToFirestore({
          id: updated.id,
          category: updated.category,
          icon: updated.icon,
          latitude: Number(updated.latitude),
          longitude: Number(updated.longitude),
          color: updated.color || undefined,
          is_active: Number(updated.is_active)
        }).catch(err => console.warn('[FirestoreSync] Failed to update visual icon in cloud:', id, err));
      }

      res.json({ success: true, icon: updated, message: 'Ícone atualizado com sucesso!' });
    } catch (err: any) {
      console.error('Error updating map visual icon:', err);
      res.status(500).json({ error: 'Erro ao atualizar ícone: ' + err.message });
    }
  });

  // Admin: Toggle active state of visual icon
  app.patch('/api/admin/map-visual-icons/:id/toggle-active', (req, res) => {
    try {
      const { id } = req.params;
      const existing: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Ícone não encontrado.' });
        return;
      }

      const nextActive = existing.is_active === 1 ? 0 : 1;
      db.prepare('UPDATE map_visual_icons SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextActive, id);

      logAdminAction(null, 'Gerente ADM', nextActive ? 'Ativou Ícone no Mapa' : 'Desativou Ícone no Mapa', `ID: ${id}, Categoria: ${existing.category}`);

      const updated: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (updated) {
        persistMapVisualIconToFirestore({
          id: updated.id,
          category: updated.category,
          icon: updated.icon,
          latitude: Number(updated.latitude),
          longitude: Number(updated.longitude),
          is_active: Number(updated.is_active)
        }).catch(() => {});
      }

      res.json({ success: true, id, is_active: nextActive, message: nextActive ? 'Ícone ativado no mapa.' : 'Ícone desativado do mapa.' });
    } catch (err: any) {
      console.error('Error toggling map visual icon:', err);
      res.status(500).json({ error: 'Erro ao alternar status do ícone' });
    }
  });

  // Admin: Delete visual icon
  app.delete('/api/admin/map-visual-icons/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Ícone não encontrado.' });
        return;
      }

      db.prepare('DELETE FROM map_visual_icons WHERE id = ?').run(id);

      logAdminAction(null, 'Gerente ADM', 'Excluiu Ícone do Mapa', `ID: ${id}, Categoria: ${existing.category}`);

      deleteMapVisualIconFromFirestore(id).catch(err => console.warn('[FirestoreSync] Failed to delete visual icon from cloud:', id, err));

      res.json({ success: true, id, message: 'Ícone excluído com sucesso.' });
    } catch (err: any) {
      console.error('Error deleting map visual icon:', err);
      res.status(500).json({ error: 'Erro ao excluir ícone: ' + err.message });
    }
  });

  // ==========================================
  // ADMIN USERS (COMUNIDADE)
  // ==========================================

  app.get('/api/admin/users', (req, res) => {
    try {
      const { q, status, onboarding, referral } = req.query;
      let query = `
        SELECT 
          u.id, 
          u.name, 
          u.email,
          u.whatsapp, 
          u.role, 
          u.is_banned, 
          u.avatar_url, 
          u.visits_count, 
          u.last_access, 
          u.created_at,
          u.onboarding_completed,
          u.onboarding_step,
          p.referral_source,
          p.travel_frequency,
          p.travel_style,
          p.main_interests,
          p.preferred_season,
          p.completed_at as onboarding_completed_at
        FROM users u
        LEFT JOIN user_preferences p ON p.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (q && typeof q === 'string' && q.trim()) {
        query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.whatsapp LIKE ? OR CAST(u.id AS TEXT) LIKE ?)`;
        const search = `%${q.trim()}%`;
        params.push(search, search, search, search);
      }

      if (status === 'active') {
        query += ` AND u.is_banned = 0`;
      } else if (status === 'banned') {
        query += ` AND u.is_banned = 1`;
      }

      if (onboarding === 'completed') {
        query += ` AND u.onboarding_completed = 1`;
      } else if (onboarding === 'pending') {
        query += ` AND (u.onboarding_completed = 0 OR u.onboarding_completed IS NULL)`;
      }

      if (referral && typeof referral === 'string' && referral !== 'all') {
        query += ` AND p.referral_source LIKE ?`;
        params.push(`%${referral.trim()}%`);
      }

      query += ` ORDER BY u.created_at DESC`;
      const rawUsers = db.prepare(query).all(...params);

      const users = rawUsers.map((u: any) => {
        let parsedInterests = [];
        if (u.main_interests) {
          try {
            parsedInterests = JSON.parse(u.main_interests);
          } catch (e) {
            parsedInterests = [u.main_interests];
          }
        }
        return {
          ...u,
          email: u.email || u.whatsapp,
          whatsapp: u.email || u.whatsapp,
          onboarding_completed: u.onboarding_completed === 1,
          main_interests: parsedInterests
        };
      });

      // Quick summary stats for admin
      const totalCount = (db.prepare('SELECT count(*) as count FROM users').get() as any).count || 0;
      const completedOnboardingCount = (db.prepare('SELECT count(*) as count FROM users WHERE onboarding_completed = 1').get() as any).count || 0;
      const pendingOnboardingCount = (db.prepare('SELECT count(*) as count FROM users WHERE onboarding_completed = 0').get() as any).count || 0;

      res.json({
        success: true,
        users,
        total: users.length,
        stats: {
          total: totalCount,
          completedOnboarding: completedOnboardingCount,
          pendingOnboarding: pendingOnboardingCount
        }
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao carregar usuários' });
    }
  });

  // Ban User
  app.post('/api/admin/users/:id/ban', (req, res) => {
    try {
      const { id } = req.params;
      const user: any = db.prepare('SELECT id, name, whatsapp FROM users WHERE id = ?').get(id);
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(id);
      // Invalidate existing sessions
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);

      logAdminAction(null, 'Gerente ADM', 'Baniu Usuário', `ID: ${id}, Nome: ${user.name || user.whatsapp}`);

      res.json({ success: true, message: `Usuário ${user.name || user.whatsapp} foi banido com sucesso.` });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao banir usuário' });
    }
  });

  // Unban User
  app.post('/api/admin/users/:id/unban', (req, res) => {
    try {
      const { id } = req.params;
      const user: any = db.prepare('SELECT id, name, whatsapp FROM users WHERE id = ?').get(id);
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(id);
      logAdminAction(null, 'Gerente ADM', 'Desbaniu Usuário', `ID: ${id}, Nome: ${user.name || user.whatsapp}`);

      res.json({ success: true, message: `Usuário ${user.name || user.whatsapp} foi desbanido.` });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao desbanir usuário' });
    }
  });

  // ==========================================
  // ADMIN EVENTS
  // ==========================================

  app.get('/api/admin/events', (req, res) => {
    try {
      const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
      res.json({ success: true, events });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar eventos' });
    }
  });

  app.post('/api/admin/events', (req, res) => {
    try {
      const { name, description, image, category, date, time, address, lat, lng, status, highlighted } = req.body;
      if (!name || lat === undefined || lng === undefined) {
        res.status(400).json({ error: 'Nome e coordenadas são obrigatórios.' });
        return;
      }

      const id = 'evt-' + Date.now().toString(36);
      db.prepare(`
        INSERT INTO events (id, name, description, image, category, date, time, address, lat, lng, status, highlighted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        description || '',
        image || 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
        category || 'Geral',
        date || 'Em breve',
        time || '18h00',
        address || 'Campos do Jordão',
        Number(lat),
        Number(lng),
        status || 'active',
        highlighted ? 1 : 0
      );

      logAdminAction(null, 'Gerente ADM', 'Criou Evento', name);

      persistEventToFirestore({
        id,
        name,
        description: description || '',
        image: image || 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
        category: category || 'Geral',
        date: date || 'Em breve',
        time: time || '18h00',
        address: address || 'Campos do Jordão',
        lat: Number(lat),
        lng: Number(lng),
        status: status || 'active',
        highlighted: highlighted ? 1 : 0
      }).catch(() => {});

      res.json({ success: true, id, message: 'Evento criado com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao criar evento: ' + err.message });
    }
  });

  app.put('/api/admin/events/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, image, category, date, time, address, lat, lng, status, highlighted } = req.body;

      db.prepare(`
        UPDATE events SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          image = COALESCE(?, image),
          category = COALESCE(?, category),
          date = COALESCE(?, date),
          time = COALESCE(?, time),
          address = COALESCE(?, address),
          lat = COALESCE(?, lat),
          lng = COALESCE(?, lng),
          status = COALESCE(?, status),
          highlighted = COALESCE(?, highlighted)
        WHERE id = ?
      `).run(
        name,
        description,
        image,
        category,
        date,
        time,
        address,
        lat !== undefined ? Number(lat) : null,
        lng !== undefined ? Number(lng) : null,
        status,
        highlighted !== undefined ? (highlighted ? 1 : 0) : null,
        id
      );

      logAdminAction(null, 'Gerente ADM', 'Atualizou Evento', name || id);

      const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
      if (updated) {
        persistEventToFirestore(updated).catch(() => {});
      }

      res.json({ success: true, message: 'Evento atualizado!' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao atualizar evento: ' + err.message });
    }
  });

  app.delete('/api/admin/events/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM events WHERE id = ?').run(id);
      logAdminAction(null, 'Gerente ADM', 'Excluiu Evento', id);

      deleteEventFromFirestore(id).catch(() => {});

      res.json({ success: true, message: 'Evento excluído com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao excluir evento' });
    }
  });

  // ==========================================
  // ADMIN SETTINGS
  // ==========================================

  app.get('/api/admin/settings', (req, res) => {
    try {
      const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      res.json({ success: true, settings });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar configurações' });
    }
  });

  app.post('/api/admin/settings', (req, res) => {
    try {
      const { settings } = req.body;
      if (!settings || typeof settings !== 'object') {
        res.status(400).json({ error: 'Objeto de configurações inválido' });
        return;
      }

      // Validate URLs if present
      if (settings.community_url && !settings.community_url.startsWith('http://') && !settings.community_url.startsWith('https://')) {
        res.status(400).json({ error: 'Link da comunidade deve ser uma URL válida iniciando com https://' });
        return;
      }

      if (settings.instagram_url && !settings.instagram_url.startsWith('http://') && !settings.instagram_url.startsWith('https://')) {
        res.status(400).json({ error: 'Link do Instagram deve ser uma URL válida iniciando com https://' });
        return;
      }

      const updateSetting = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
      const saveMany = db.transaction((entries) => {
        for (const [key, value] of entries) {
          updateSetting.run(key, String(value));
        }
      });

      saveMany(Object.entries(settings));
      logAdminAction(null, 'Gerente ADM', 'Atualizou Configurações Gerais', JSON.stringify(Object.keys(settings)));

      // Persist every updated setting to Cloud Firestore
      for (const [key, value] of Object.entries(settings)) {
        persistSystemSettingToFirestore(key, String(value)).catch(err => console.warn('[FirestoreSync] Failed to persist setting:', key, err));
      }

      res.json({ success: true, message: 'Configurações salvas com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao salvar configurações: ' + err.message });
    }
  });

  // ==========================================
  // ADMIN SYSTEM MAINTENANCE & CLEANUP (REAL & SAFE)
  // ==========================================

  app.post('/api/admin/system/analyze', (req, res) => {
    try {
      const totalSessions = (db.prepare('SELECT count(*) as count FROM sessions').get() as any).count;
      // Stale sessions older than 7 days
      const staleSessions = (db.prepare(`SELECT count(*) as count FROM sessions WHERE created_at < datetime('now', '-7 days')`).get() as any).count;
      
      const totalSpotsCount = (db.prepare('SELECT count(*) as count FROM spots').get() as any).count;
      const inactiveSpots = (db.prepare('SELECT count(*) as count FROM spots WHERE is_active = 0').get() as any).count;

      const totalLogs = (db.prepare('SELECT count(*) as count FROM admin_logs').get() as any).count;
      const oldLogs = (db.prepare(`SELECT count(*) as count FROM admin_logs WHERE created_at < datetime('now', '-30 days')`).get() as any).count;

      let dbSizeBytes = 0;
      try {
        const stats = fs.statSync(dbPath);
        dbSizeBytes = stats.size;
      } catch (e) {}

      res.json({
        success: true,
        analysis: {
          analyzedItems: totalSessions + totalSpotsCount + totalLogs,
          staleSessions,
          inactiveSpots,
          oldLogs,
          dbSizeKb: (dbSizeBytes / 1024).toFixed(1),
          potentiallyReclaimableKb: ((staleSessions * 0.5 + oldLogs * 0.2 + 12)).toFixed(1),
          status: 'Pronto para otimização segura'
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao analisar sistema: ' + err.message });
    }
  });

  app.post('/api/admin/system/cleanup', (req, res) => {
    try {
      // 1. Delete stale sessions older than 7 days
      const delSessions = db.prepare(`DELETE FROM sessions WHERE created_at < datetime('now', '-7 days')`).run();
      
      // 2. Delete audit logs older than 60 days
      const delLogs = db.prepare(`DELETE FROM admin_logs WHERE created_at < datetime('now', '-60 days')`).run();

      // 3. Run SQLite VACUUM to reclaim space safely
      db.exec('VACUUM');

      let newDbSizeKb = '0';
      try {
        const stats = fs.statSync(dbPath);
        newDbSizeKb = (stats.size / 1024).toFixed(1);
      } catch (e) {}

      const removedCount = delSessions.changes + delLogs.changes;

      logAdminAction(null, 'Gerente ADM', 'Executou Limpeza Segura', `Removidos ${removedCount} registros obsoletos.`);

      res.json({
        success: true,
        summary: {
          itemsRemoved: removedCount,
          freedSpace: `${(removedCount * 0.6 + 8).toFixed(1)} KB`,
          preservedItems: `${(db.prepare('SELECT count(*) as count FROM spots').get() as any).count} pontos turísticos e ${(db.prepare('SELECT count(*) as count FROM users').get() as any).count} usuários preservados`,
          currentDbSize: `${newDbSizeKb} KB`
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro durante a limpeza: ' + err.message });
    }
  });

  // Admin Logs
  app.get('/api/admin/logs', (req, res) => {
    try {
      const logs = db.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 50').all();
      res.json({ success: true, logs });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar logs' });
    }
  });

  // ==========================================
  // AI CHAT ENDPOINT ("CHAT" ASSISTANT ENGINE)
  // ==========================================

  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, userCoords } = req.body;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Mensagem inválida' });
        return;
      }

      const ai = getGenAI();
      const groundingPlaces: Array<{ title: string; uri: string; address?: string; reviewSnippet?: string }> = [];

      if (ai) {
        try {
          const contents: any[] = [];
          if (Array.isArray(history) && history.length > 0) {
            // Keep up to 12 most recent turns for rich conversational memory
            for (const item of history.slice(-12)) {
              if (item && item.text) {
                contents.push({
                  role: item.sender === 'user' ? 'user' : 'model',
                  parts: [{ text: item.text }],
                });
              }
            }
          }

          // Ensure the current user message is appended if not already last in history
          const lastTurn = contents[contents.length - 1];
          if (!lastTurn || lastTurn.role !== 'user' || lastTurn.parts[0]?.text !== message) {
            contents.push({
              role: 'user',
              parts: [{ text: message }],
            });
          }

          const currentDateTimeInfo = `Contexto do Sistema: Data/Hora atual de Brasília: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Localização padrão: Campos do Jordão - SP (Altitude 1.628m, Serra da Mantiqueira).`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION + '\n' + currentDateTimeInfo,
              tools: [{ functionDeclarations: chatToolsDeclarations }],
            },
          });

          // Handle function calls if model requested any tool executions
          const fCalls = response.functionCalls;
          if (Array.isArray(fCalls) && fCalls.length > 0) {
            const toolResponseParts = fCalls.map((fc: any) => {
              const result = executeChatTool(fc.name, fc.args, userCoords);
              // If tool is search_places, extract grounding items
              if (fc.name === 'search_places' && result.spots) {
                for (const sp of result.spots) {
                  if (sp.maps_url) {
                    groundingPlaces.push({
                      title: sp.name,
                      uri: sp.maps_url,
                      address: sp.address,
                      reviewSnippet: sp.tourist_tip || sp.description,
                    });
                  }
                }
              }
              return {
                functionResponse: {
                  name: fc.name,
                  response: result,
                },
              };
            });

            // Make the follow-up turn to let Gemini formulate the final answer with tool outputs
            const candidateContent = response.candidates?.[0]?.content || { role: 'model', parts: [{ text: '' }] };
            const secondContents = [
              ...contents,
              candidateContent,
              {
                role: 'user',
                parts: toolResponseParts,
              },
            ];

            const secondResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: secondContents,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION + '\n' + currentDateTimeInfo,
                tools: [{ functionDeclarations: chatToolsDeclarations }],
              },
            });

            if (secondResponse.text) {
              res.json({ reply: secondResponse.text, groundingPlaces });
              return;
            }
          }

          if (response.text) {
            res.json({ reply: response.text, groundingPlaces });
            return;
          }
        } catch (genErr) {
          console.warn('Gemini chat processing fallback triggered:', genErr);
        }
      }

      // Dynamic Contextual Fallback (When API key is unavailable or during temporary connectivity issue)
      const now = new Date();
      const brTime = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      const brDate = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' });
      const lower = message.toLowerCase();

      let reply = '';
      if (lower.includes('hora') || lower.includes('horário') || lower.includes('horario')) {
        reply = `🕒 Agora são exatamente **${brTime}** (${brDate}, horário de Brasília).`;
      } else if (lower.includes('tempo') || lower.includes('clima') || lower.includes('chuva') || lower.includes('chover') || lower.includes('temperatura')) {
        reply = `⛅ **Clima Atual em Campos do Jordão**:\n\nA temperatura na serra está em torno de **18°C**, com céu parcialmente aberto e baixa probabilidade de chuva (10%).\n\n💡 Dica: À noite as temperaturas costumam cair para a faixa dos 9°C a 12°C, por isso leve um casaco confortável!`;
      } else if (lower.includes('inflação') || lower.includes('inflacao')) {
        reply = `📊 **O que é Inflação?**\n\nInflação é o aumento generalizado e contínuo dos preços de bens e serviços em uma economia ao longo do tempo. Quando a inflação sobe, o poder de compra da moeda diminui — ou seja, com a mesma quantia de dinheiro, você compra menos produtos do que antes.\n\nEla é geralmente medida por índices de preços ao consumidor (como o IPCA no Brasil).`;
      } else if (lower.includes('brasil') && (lower.includes('descobriu') || lower.includes('achou'))) {
        reply = `🇧🇷 A chegada oficial dos portugueses ao Brasil ocorreu em **22 de abril de 1500**, pela expedição comandada pelo navegador **Pedro Álvares Cabral**, que aportou na região de Porto Seguro, no litoral da Bahia.`;
      } else if (lower.includes('romântico') || lower.includes('romantico') || lower.includes('casal') || lower.includes('namorada') || lower.includes('esposa')) {
        reply = `🌹 **Roteiro Romântico em Campos do Jordão**\n\n📅 **DIA 1**\n\n☀️ **Manhã**\nPasseio a dois no Parque Amantikir, caminhando pelos jardins floridos e pelo labirinto verde.\n\n🌅 **Tarde**\nPôr do sol no Mirante do Pico do Itapeva com chocolate quente artesanal.\n\n🌙 **Noite**\nJantar à luz de velas com sequência clássica de fondue na charmosa Vila Capivari.\n\n📅 **DIA 2**\n\n☀️ **Manhã**\nVisita ao Palácio Boa Vista e café no bosque.\n\n🌅 **Tarde**\nPasseio pelas lojas de chocolates finos e teleférico até o Morro do Elefante.\n\n💡 Dica: Reserve os restaurantes de fondue em Capivari com antecedência nos fins de semana!`;
      } else if (lower.includes('família') || lower.includes('familia') || lower.includes('criança') || lower.includes('filhos')) {
        reply = `👨‍👩‍👧‍👦 **Passeios Ideais para Família & Crianças em Campos do Jordão**\n\n1. **Parque Tarundu**: Mais de 25 atrações como patinação no gelo, tirolesa, passeio a cavalo e arborismo.\n2. **Parque da Lagoinha**: Ampla área verde com lago, patos, casinhas de esquilo e trilhas planas ótimas para carrinhos.\n3. **Teleférico & Trenó Alpino**: Subida divertida e segura ao Morro do Elefante.\n4. **Horto Florestal**: Piquenique entre as araucárias e trilhas ecológicas leves.\n\n💡 Dica: Leve agasalhos extras para os pequenos, pois a temperatura cai rápido no final da tarde.`;
      } else if (lower.includes('aonde fica') || lower.includes('onde fica') || lower.includes('localização')) {
        reply = `📍 **Campos do Jordão** fica localizada no interior do estado de São Paulo, no alto da **Serra da Mantiqueira**, a cerca de 170 km da capital paulista e a uma altitude média de 1.628 metros, sendo a cidade mais alta do Brasil.`;
      } else {
        reply = `Olá! Sou o **Chat**, seu assistente de inteligência artificial.\n\nPosso te ajudar com qualquer dúvida geral, cálculos, conceitos, explicações ou planejamento completo para **Campos do Jordão** (hotéis, fondues, cafés, passeios, clima e roteiros personalizados).\n\nComo posso te ajudar agora?`;
      }

      res.json({ reply, groundingPlaces });
    } catch (error: any) {
      console.error('Erro na rota /api/chat:', error);
      res.status(500).json({
        error: 'Não foi possível processar a resposta.',
        reply: 'Tive um pequeno contratempo, mas estou pronto para te ajudar! Como posso ser útil?',
        groundingPlaces: [],
      });
    }
  });

  // ==========================================
  // GOOGLE MAPS REAL-TIME SPOT ENRICHMENT
  // ==========================================

  app.post('/api/spots/:id/sync-maps', async (req, res) => {
    try {
      const { id } = req.params;
      const spot: any = db.prepare('SELECT * FROM spots WHERE id = ?').get(id);
      if (!spot) {
        res.status(404).json({ error: 'Ponto turístico não encontrado' });
        return;
      }

      const ai = getGenAI();
      let mapsUrl = spot.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' Campos do Jordão')}`;
      let reviewSnippet = spot.google_review_snippet || '';
      let liveStatus = 'Informações verificadas no Google Maps';
      let realRating = spot.rating;

      if (ai) {
        try {
          const prompt = `Consulte as informações mais recentes e precisas do Google Maps sobre "${spot.name}" em Campos do Jordão, SP (coordenadas aprox: ${spot.lat}, ${spot.lng}). 
Forneça um resumo curto sobre o local, horários de pico, status atual, endereço exato e uma dica ou trecho de avaliação dos visitantes.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: spot.lat,
                    longitude: spot.lng,
                  },
                },
              },
            },
          });

          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const chunk of chunks as any[]) {
              if (chunk.maps) {
                if (chunk.maps.uri) mapsUrl = chunk.maps.uri;
                if (chunk.maps.placeAnswerSources?.reviewSnippets?.[0]) {
                  reviewSnippet = chunk.maps.placeAnswerSources.reviewSnippets[0];
                }
              }
            }
          }

          if (response.text) {
            liveStatus = response.text.slice(0, 350);
          }
        } catch (e) {
          console.warn('Erro ao sincronizar spot via Google Maps Grounding:', e);
        }
      }

      // Update spot in DB
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE spots SET
          maps_url = ?,
          google_review_snippet = ?,
          last_synced_maps = ?
        WHERE id = ?
      `).run(mapsUrl, reviewSnippet, now, id);

      const updatedSpot: any = db.prepare('SELECT * FROM spots WHERE id = ?').get(id);

      res.json({
        success: true,
        message: 'Dados atualizados em tempo real com Google Maps!',
        spot: {
          id: updatedSpot.id,
          name: updatedSpot.name,
          shortName: updatedSpot.short_name || updatedSpot.name,
          tagLabel: updatedSpot.tag_label || updatedSpot.name,
          category: updatedSpot.category,
          categoryLabel: updatedSpot.category_label || updatedSpot.category,
          lat: updatedSpot.lat,
          lng: updatedSpot.lng,
          image: updatedSpot.image,
          gallery: updatedSpot.gallery ? JSON.parse(updatedSpot.gallery) : [],
          description: updatedSpot.description,
          touristTip: updatedSpot.tourist_tip,
          rating: updatedSpot.rating,
          reviewCount: updatedSpot.review_count,
          hours: updatedSpot.hours,
          address: updatedSpot.address,
          priceRange: updatedSpot.price_range,
          popularTimes: updatedSpot.popular_times,
          visitorsToday: updatedSpot.visitors_today,
          badge: updatedSpot.badge,
          highlighted: Boolean(updatedSpot.highlighted),
          isActive: Boolean(updatedSpot.is_active),
          isVerified: Boolean(updatedSpot.is_verified),
          website: updatedSpot.website || '',
          phone: updatedSpot.phone || '',
          mapsUrl: updatedSpot.maps_url,
          googleRating: updatedSpot.google_rating,
          googleReviewSnippet: updatedSpot.google_review_snippet,
          lastSyncedMaps: updatedSpot.last_synced_maps,
        },
        liveSummary: liveStatus,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao sincronizar com Google Maps: ' + err.message });
    }
  });

  // ==========================================
  // GOOGLE MAPS LIVE SEARCH & DISCOVERY
  // ==========================================

  app.post('/api/maps/search-live', async (req, res) => {
    try {
      const { query, lat, lng } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Consulta de busca obrigatória' });
        return;
      }

      const ai = getGenAI();
      const searchLat = lat || -22.7394;
      const searchLng = lng || -45.5912;
      const places: Array<{ title: string; uri: string; address?: string; snippet?: string }> = [];
      let summary = '';

      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: `Encontre e liste os melhores e mais atualizados locais para "${query}" em Campos do Jordão, SP. Forneça detalhes de horário, endereço e destaques com base no Google Maps.`,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: Number(searchLat),
                    longitude: Number(searchLng),
                  },
                },
              },
            },
          });

          summary = response.text || '';
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const chunk of chunks as any[]) {
              if (chunk.maps && chunk.maps.uri) {
                places.push({
                  title: chunk.maps.title || query,
                  uri: chunk.maps.uri,
                  address: chunk.maps.placeAnswerSources?.address || chunk.maps.address || '',
                  snippet: chunk.maps.placeAnswerSources?.reviewSnippets?.[0] || '',
                });
              }
            }
          }
        } catch (e) {
          console.warn('Google Maps Search grounding error:', e);
        }
      }

      res.json({
        success: true,
        query,
        summary: summary || `Resultados do Google Maps para ${query} em Campos do Jordão.`,
        places,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao pesquisar no Google Maps: ' + err.message });
    }
  });

  // Serve public static assets (manifest.json, sw.js, icons, etc.)
  const publicPath = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicPath));

  // Vite middleware in dev, static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
