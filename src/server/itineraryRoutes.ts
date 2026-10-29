import express from 'express';
import { Database } from 'better-sqlite3';
import { CAMPOS_SPOTS } from '../data/spots.js';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries.js';
import {
  saveItineraryToSupabase,
  deleteItineraryFromSupabase,
  toggleItineraryFeaturedInSupabase,
  toggleItineraryStatusInSupabase,
} from '../services/supabaseItineraries.js';

// Haversine formula to calculate distance between coordinates in km
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const SPOT_PHOTO_MAP: Record<string, string> = {
  'parque-amantikir': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
  'amantikir': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
  'parque-capivari': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
  'capivari': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
  'baden-baden': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
  'baden': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
  'morro-do-elefante': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  'morro-elefante': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  'ducha-de-prata': 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
  'ducha-prata': 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
  'parque-das-cerejeiras': 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
  'cerejeiras': 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
  'itapeva': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  'pico-do-itapeva': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  'tarundu': 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
  'portal': 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
  'portal-de-campos-do-jordao': 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
  'horto': 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80',
  'horto-florestal': 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80',
  'felicia-leirner': 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=800&q=80',
  'museu-felicia-leirner': 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=800&q=80',
  'bosque-silencio': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80',
  'pedra-bau': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  'palacio-boa-vista': 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80',
  'chocolate-araucaria': 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
  'vila-capivari': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80'
};

export function setupItineraryDatabase(db: any) {
  // 1. Table: itinerary_categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS itinerary_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'Compass',
      description TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      usage_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS itinerary_days (
      id TEXT PRIMARY KEY,
      itinerary_id TEXT NOT NULL,
      day_number INTEGER NOT NULL,
      title TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS spots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT,
      tag_label TEXT,
      category TEXT,
      category_label TEXT,
      lat REAL,
      lng REAL,
      image TEXT,
      gallery TEXT DEFAULT '[]',
      description TEXT,
      tourist_tip TEXT,
      rating REAL DEFAULT 4.8,
      review_count INTEGER DEFAULT 0,
      hours TEXT,
      address TEXT,
      price_range TEXT,
      available_for_itinerary INTEGER DEFAULT 1,
      duration_minutes INTEGER DEFAULT 90,
      tags TEXT,
      price TEXT,
      maps_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS planner_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed spots table with CAMPOS_SPOTS if empty
  try {
    const spotsCount = (db.prepare('SELECT count(*) as count FROM spots').get() as any)?.count || 0;
    if (spotsCount === 0) {
      const insertSpot = db.prepare(`
        INSERT OR IGNORE INTO spots (
          id, name, short_name, tag_label, category, category_label,
          lat, lng, image, gallery, description, tourist_tip,
          rating, review_count, hours, address, price_range,
          available_for_itinerary, duration_minutes, tags, price, maps_url, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const s of CAMPOS_SPOTS) {
        insertSpot.run(
          s.id,
          s.name,
          s.shortName || s.name,
          s.tagLabel || s.name,
          s.category,
          s.categoryLabel || s.category,
          s.lat,
          s.lng,
          s.image || '',
          JSON.stringify(s.gallery || []),
          s.description || '',
          s.touristTip || '',
          s.rating || 4.8,
          s.reviewCount || 0,
          s.hours || '',
          s.address || '',
          s.priceRange || '',
          s.availableForItinerary !== false ? 1 : 0,
          s.durationMinutes || 90,
          Array.isArray(s.tags) ? s.tags.join(', ') : '',
          s.price || '',
          s.mapsUrl || ''
        );
      }
    }
  } catch (e) {
    console.warn('Spots table init notice:', e);
  }

  // Migrations for spots and drafts table
  try { db.exec(`ALTER TABLE spots ADD COLUMN available_for_itinerary INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.exec(`ALTER TABLE spots ADD COLUMN duration_minutes INTEGER DEFAULT 90;`); } catch (e) {}
  try { db.exec(`ALTER TABLE spots ADD COLUMN tags TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE spots ADD COLUMN price TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itinerary_drafts ADD COLUMN adults_count INTEGER DEFAULT 2;`); } catch (e) {}
  try { db.exec(`ALTER TABLE itinerary_drafts ADD COLUMN children_count INTEGER DEFAULT 0;`); } catch (e) {}

  // Migrations for Premium Itinerary Store
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN price TEXT DEFAULT 'R$ 14,90';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN status TEXT DEFAULT 'published';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN is_featured INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN is_premium INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN badge_text TEXT DEFAULT 'Premium';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN show_badge INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN show_price INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN show_stops_count INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN tips TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN sort_order INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE itineraries ADD COLUMN platanos_price INTEGER DEFAULT 15;`); } catch (e) {}

  try { db.exec(`ALTER TABLE itinerary_steps ADD COLUMN custom_name TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itinerary_steps ADD COLUMN custom_description TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itinerary_steps ADD COLUMN custom_tip TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itinerary_steps ADD COLUMN custom_image TEXT DEFAULT '';`); } catch (e) {}

  // Ensure default data consistency
  try {
    db.exec(`UPDATE itineraries SET status = 'published' WHERE status IS NULL OR status = '';`);
    db.exec(`UPDATE itineraries SET price = 'R$ 14,90' WHERE price IS NULL OR price = '';`);
    db.exec(`UPDATE itineraries SET is_featured = 1 WHERE is_recommended = 1;`);
    db.exec(`UPDATE itineraries SET is_premium = 0, badge_text = 'Grátis', price = 'R$ 0' WHERE id = 'roteiro-classico-2-dias' OR badge_text = 'Livre' OR badge_text = 'Grátis';`);
    db.exec(`UPDATE itineraries SET is_premium = 0, badge_text = '1 Dia', price = 'R$ 0' WHERE id = 'roteiro-bate-volta-essencial';`);
  } catch (e) {}

  // Update existing spots to be available for itineraries if null
  try {
    db.exec(`UPDATE spots SET available_for_itinerary = 1 WHERE available_for_itinerary IS NULL;`);
    db.exec(`UPDATE spots SET duration_minutes = 90 WHERE duration_minutes IS NULL OR duration_minutes = 0;`);
  } catch (e) {}

  // Seed default itinerary categories if empty or add missing standard store categories
  const initialStoreCategories = [
    { id: 'popular', name: 'Mais procurados', icon: 'Sparkles', sort_order: 1, description: 'Os roteiros mais bem avaliados pelos viajantes' },
    { id: 'nature', name: 'Natureza', icon: 'Trees', sort_order: 2, description: 'Jardins, bosques, cachoeiras e mirantes' },
    { id: 'romantic', name: 'Casais', icon: 'Heart', sort_order: 3, description: 'Experiências a dois com vista e aconchego' },
    { id: 'gastronomy', name: 'Gastronomia', icon: 'UtensilsCrossed', sort_order: 4, description: 'Alta gastronomia alpina, fondues e chocolates' },
    { id: 'adventure', name: 'Aventura', icon: 'Compass', sort_order: 5, description: 'Trilhas, arvorismo e passeios radicais' },
    { id: '1day', name: '1 dia', icon: 'Calendar', sort_order: 6, description: 'Roteiros de bate-e-volta e experiências de 1 dia' },
    { id: '2days', name: '2 dias', icon: 'CalendarDays', sort_order: 7, description: 'Roteiros perfeitos para passar o fim de semana' },
    { id: 'family', name: 'Família', icon: 'Users', sort_order: 8, description: 'Parques com atrações ao ar livre e segurança' },
    { id: 'cafes', name: 'Cafés & Bistrôs', icon: 'Coffee', sort_order: 9, description: 'Cafés coloniais e bistrôs acolhedores na montanha' }
  ];

  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO itinerary_categories (id, name, icon, sort_order, description, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  for (const c of initialStoreCategories) {
    insertCat.run(c.id, c.name, c.icon, c.sort_order, c.description);
  }

  // Seed default curated itineraries if empty
  const itinCount = db.prepare('SELECT count(*) as count FROM itineraries').get() as { count: number };
  if (itinCount.count === 0) {
    seedInitialItineraries(db);
  }
}

function seedInitialItineraries(db: any) {
  try {
    const spots = db.prepare('SELECT id, name, category, lat, lng, image FROM spots WHERE is_active = 1').all() as any[];
    if (spots.length === 0) return;

    const spotMap = new Map(spots.map(s => [s.id, s]));
    const findSpot = (idOrName: string) => {
      const byId = spotMap.get(idOrName);
      if (byId) return byId;
      const normalized = idOrName.toLowerCase();
      return spots.find(s => s.id.toLowerCase().includes(normalized) || s.name.toLowerCase().includes(normalized));
    };

    const spotAmantikir = findSpot('parque-amantikir') || findSpot('amantikir') || spots[0];
    const spotCapivari = findSpot('parque-capivari') || findSpot('capivari') || spots[1] || spots[0];
    const spotBaden = findSpot('baden-baden') || findSpot('baden') || spots[2] || spots[0];
    const spotElefante = findSpot('morro-do-elefante') || findSpot('elefante') || spots[3] || spots[0];
    const spotDucha = findSpot('ducha-de-prata') || findSpot('ducha') || spots[4] || spots[0];
    const spotCerejeiras = findSpot('parque-das-cerejeiras') || findSpot('cerejeiras') || spots[5] || spots[0];
    const spotTarundu = findSpot('tarundu') || spots[6] || spots[0];

    // Itinerary 1: Essência de Campos: O Clássico em 2 Dias
    const itin1Id = 'roteiro-classico-2-dias';
    db.prepare(`
      INSERT INTO itineraries (
        id, title, description, cover_image, days_count, categories,
        is_active, is_recommended, is_premium, badge_text, price, usage_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 'Livre', 'R$ 0', 384, ?)
    `).run(
      itin1Id,
      'Essência de Campos: O Clássico em 2 Dias',
      'O roteiro perfeito para a primeira visita a Campos do Jordão, reunindo os pontos turísticos mais emblemáticos, gastronomia suíça e mirantes deslumbrantes.',
      'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
      2,
      JSON.stringify(['nature', 'gastronomy', 'sweets', 'sunset', 'culture']),
      'Recomendamos iniciar os passeios pela manhã para aproveitar a melhor iluminação e evitar filas na Vila Capivari à noite.'
    );

    // Day 1
    const day1Id = `${itin1Id}-dia-1`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 1, 'Dia 1: Jardins Floridos & Charme de Capivari', 'Manhã contemplativa entre labirintos floridos, tarde no centro turístico e noite com fondue tradicional.')
    `).run(day1Id, itin1Id);

    const s1 = spotAmantikir;
    const s2 = spotCapivari;
    const s3 = spotBaden;

    const insertStep = db.prepare(`
      INSERT INTO itinerary_steps (id, itinerary_id, day_id, spot_id, step_order, suggested_time, duration_minutes, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (s1) insertStep.run(`${day1Id}-1`, itin1Id, day1Id, s1.id, 1, '09:30', 120, 'Caminhe pelo labirinto de arbustos e aproveite a luz da manhã nos mirantes.');
    if (s2) insertStep.run(`${day1Id}-2`, itin1Id, day1Id, s2.id, 2, '13:00', 90, 'Passeio pelo Parque Capivari, teleférico e lago central.');
    if (s3) insertStep.run(`${day1Id}-3`, itin1Id, day1Id, s3.id, 3, '15:30', 60, 'Almoço no coração do Capivari com pratos alemães e chopes artesanais.');

    // Day 2
    const day2Id = `${itin1Id}-dia-2`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 2, 'Dia 2: Mirantes, Ducha de Prata & Cerejeiras', 'Visita panorâmica no Morro do Elefante, cachoeiras na Ducha de Prata e bosques floridos.')
    `).run(day2Id, itin1Id);

    const s4 = spotElefante;
    const s5 = spotDucha;
    const s6 = spotCerejeiras;

    if (s4) insertStep.run(`${day2Id}-1`, itin1Id, day2Id, s4.id, 1, '10:00', 90, 'Vista panorâmica espetacular da cidade a partir do alto do Morro do Elefante.');
    if (s5) insertStep.run(`${day2Id}-2`, itin1Id, day2Id, s5.id, 2, '14:30', 90, 'Cachoeiras refrescantes, pontes de madeira e feirinha tradicional.');
    if (s6) insertStep.run(`${day2Id}-3`, itin1Id, day2Id, s6.id, 3, '17:00', 90, 'Bosque relaxante de cerejeiras para contemplar o pôr do sol.');

    // Itinerary 2: Romântico nas Montanhas (1 Dia)
    const itin2Id = 'roteiro-romantico-montanhas';
    db.prepare(`
      INSERT INTO itineraries (
        id, title, description, cover_image, days_count, categories,
        is_active, is_recommended, usage_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 215, ?)
    `).run(
      itin2Id,
      'Roteiro Romântico nas Alturas (1 Dia)',
      'Criado sob medida para casais, unindo cenários apaixonantes, café especial em bosque com araucárias e fondue romântico.',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
      1,
      JSON.stringify(['romantic', 'gastronomy', 'sunset', 'cafes']),
      'Recomendamos fazer reserva prévia nos restaurantes de fondue nos finais de semana.'
    );

    const dayRomId = `${itin2Id}-dia-1`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 1, 'Dia Romântico Exclusivo', 'Um dia aconchegante para viver momentos especiais na Serra da Mantiqueira.')
    `).run(dayRomId, itin2Id);

    const r1 = spotAmantikir;
    const r2 = spotElefante;
    const r3 = spotBaden;

    if (r1) insertStep.run(`${dayRomId}-1`, itin2Id, dayRomId, r1.id, 1, '10:00', 120, 'Passeio a dois pelos labirintos e jardins floridos.');
    if (r2) insertStep.run(`${dayRomId}-2`, itin2Id, dayRomId, r2.id, 2, '15:30', 90, 'Chocolate quente e vista panorâmica para as montanhas no mirante.');
    if (r3) insertStep.run(`${dayRomId}-3`, itin2Id, dayRomId, r3.id, 3, '19:30', 120, 'Jantar romântico com sequência de queijos e chocolates.');

    // Itinerary 3: Ecoturismo & Aventura na Serra (2 Dias)
    const itin3Id = 'roteiro-natureza-aventura';
    db.prepare(`
      INSERT INTO itineraries (
        id, title, description, cover_image, days_count, categories,
        is_active, is_recommended, usage_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 142, ?)
    `).run(
      itin3Id,
      'Ecoturismo & Aventura na Serra',
      'Ideal para quem busca contato intenso com a natureza, trilhas ecológicas, ar puro e atividades ao ar livre.',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
      2,
      JSON.stringify(['nature', 'parks', 'photo']),
      'Use tênis aderente e roupas confortáveis para caminhadas nas trilhas.'
    );

    const dayEco1 = `${itin3Id}-dia-1`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 1, 'Dia 1: Aventura & Bosques', 'Circuito de atividades ao ar livre e contato com a fauna da montanha.')
    `).run(dayEco1, itin3Id);

    const e1 = spotTarundu;
    const e2 = spotCapivari;
    if (e1) insertStep.run(`${dayEco1}-1`, itin3Id, dayEco1, e1.id, 1, '09:00', 180, 'Patinação no gelo, tirolesa e passeios entre pinheiros.');
    if (e2) insertStep.run(`${dayEco1}-2`, itin3Id, dayEco1, e2.id, 2, '14:30', 120, 'Atrações ao ar livre no parque central de Capivari.');

    const dayEco2 = `${itin3Id}-dia-2`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 2, 'Dia 2: Mirantes das Montanhas', 'Exploração de mirantes e fotografia panorâmica.')
    `).run(dayEco2, itin3Id);

    const e3 = spotDucha;
    const e4 = spotCerejeiras;
    if (e3) insertStep.run(`${dayEco2}-1`, itin3Id, dayEco2, e3.id, 1, '09:30', 120, 'Passarelas sobre a água e ar puro da serra.');
    if (e4) insertStep.run(`${dayEco2}-2`, itin3Id, dayEco2, e4.id, 2, '15:00', 90, 'Mirantes e contemplação das cerejeiras.');

    // Itinerary 4: Tour Gastronômico: Sabores & Chocolates da Serra (1 Dia)
    const itin4Id = 'roteiro-gastronomia-chocolates';
    db.prepare(`
      INSERT INTO itineraries (
        id, title, description, cover_image, days_count, categories,
        is_active, is_recommended, is_featured, is_premium, badge_text, usage_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1, 1, 'Gastronomia', 278, ?)
    `).run(
      itin4Id,
      'Tour Gastronômico: Sabores & Chocolates da Serra',
      'Degustações especiais, fondue suíço artesanal, cervejarias consagradas e as fábricas de chocolate mais famosas de Campos do Jordão.',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80',
      1,
      JSON.stringify(['gastronomy', 'sweets', 'cafes', 'popular']),
      'Recomendamos iniciar pela cervejaria no almoço e reservar as fábricas de chocolate para a tarde.'
    );

    const dayGastId = `${itin4Id}-dia-1`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 1, 'Dia 1: Sabores da Montanha', 'Experiência gastronômica completa com chopes nobres e chocolates artesanais.')
    `).run(dayGastId, itin4Id);

    if (spotBaden) insertStep.run(`${dayGastId}-1`, itin4Id, dayGastId, spotBaden.id, 1, '12:30', 90, 'Almoço clássico com pratos alemães e chopes artesanais.');
    if (spotCapivari) insertStep.run(`${dayGastId}-2`, itin4Id, dayGastId, spotCapivari.id, 2, '15:00', 75, 'Passeio pelo boulevard com visita a cafés coloniais.');
    if (spotElefante) insertStep.run(`${dayGastId}-3`, itin4Id, dayGastId, spotElefante.id, 3, '17:00', 60, 'Chocolate quente cremoso e vista das montanhas.');

    // Itinerary 5: Campos em Família: Diversão para Todas as Idades (2 Dias)
    const itin5Id = 'roteiro-familia-divertida';
    db.prepare(`
      INSERT INTO itineraries (
        id, title, description, cover_image, days_count, categories,
        is_active, is_recommended, is_featured, is_premium, badge_text, usage_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 1, 'Família', 312, ?)
    `).run(
      itin5Id,
      'Campos em Família: Diversão para Todas as Idades',
      'Parques ao ar livre com segurança, arvorismo, tirolesas, contato com animais e cenários mágicos que encantam crianças e adultos.',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1000&q=80',
      2,
      JSON.stringify(['family', 'nature', 'adventure', 'parks']),
      'Programe os passeios ao ar livre com calçados confortáveis e agasalhos para as crianças.'
    );

    const dayFam1 = `${itin5Id}-dia-1`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 1, 'Dia 1: Aventura & Emoção no Tarundu', 'Atividades recreativas dinâmicas ao ar livre com segurança total.')
    `).run(dayFam1, itin5Id);

    if (spotTarundu) insertStep.run(`${dayFam1}-1`, itin5Id, dayFam1, spotTarundu.id, 1, '10:00', 180, 'Mais de 30 atrações ao ar livre, tirolesas e passeios a cavalo.');
    if (spotCapivari) insertStep.run(`${dayFam1}-2`, itin5Id, dayFam1, spotCapivari.id, 2, '15:30', 90, 'Teleférico panorâmico e pedalinhos no lago central.');

    const dayFam2 = `${itin5Id}-dia-2`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 2, 'Dia 2: Labirintos & Quedas d Água', 'Labirinto verde no Amantikir e passarelas na Ducha de Prata.')
    `).run(dayFam2, itin5Id);

    if (spotAmantikir) insertStep.run(`${dayFam2}-1`, itin5Id, dayFam2, spotAmantikir.id, 1, '09:30', 120, 'Labirinto de arbustos verde e jardins de vários países.');
    if (spotDucha) insertStep.run(`${dayFam2}-2`, itin5Id, dayFam2, spotDucha.id, 2, '14:00', 90, 'Passarelas de madeira e tirolesa sobre as cachoeiras.');

    // Itinerary 6: Bate-e-Volta: O Melhor de Campos em 24h
    const itin6Id = 'roteiro-bate-volta-essencial';
    db.prepare(`
      INSERT INTO itineraries (
        id, title, description, cover_image, days_count, categories,
        is_active, is_recommended, is_featured, is_premium, badge_text, usage_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 'Bate-e-Volta', 420, ?)
    `).run(
      itin6Id,
      'Bate-e-Volta: O Melhor de Campos em 24h',
      'Roteiro express dinâmico para quem tem apenas um dia para conhecer o essencial da Suíça Brasileira sem perder tempo no trânsito.',
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1000&q=80',
      1,
      JSON.stringify(['1day', 'popular', 'nature', 'gastronomy']),
      'Chegue cedo pelo Portal da Cidade para aproveitar desde as primeiras horas da manhã.'
    );

    const dayBate1 = `${itin6Id}-dia-1`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 1, 'Dia 1: Rota Expressa dos Clássicos', 'Circuito dos principais cartões postais em um único dia inesquecível.')
    `).run(dayBate1, itin6Id);

    const spotPortal = findSpot('portal') || spots[0];
    if (spotPortal) insertStep.run(`${dayBate1}-1`, itin6Id, dayBate1, spotPortal.id, 1, '08:30', 30, 'Foto tradicional no Portal alpino de boas-vindas.');
    if (spotAmantikir) insertStep.run(`${dayBate1}-2`, itin6Id, dayBate1, spotAmantikir.id, 2, '09:30', 110, 'Visita aos jardins botânicos premiados da cidade.');
    if (spotBaden) insertStep.run(`${dayBate1}-3`, itin6Id, dayBate1, spotBaden.id, 3, '13:00', 90, 'Almoço no coração do Capivari.');
    if (spotElefante) insertStep.run(`${dayBate1}-4`, itin6Id, dayBate1, spotElefante.id, 4, '16:00', 75, 'Vista panorâmica do pôr do sol no Morro do Elefante.');

    console.log('[Itineraries] Pre-seeded 6 curated initial travel itineraries.');
  } catch (err) {
    console.error('[Itineraries] Error seeding initial itineraries:', err);
  }
}

export function registerItineraryRoutes(
  app: express.Application,
  db: any,
  getAuthUserSync: any,
  logAdminAction: any,
  getGenAI: any
) {
  // Helper to load spots map with slug/alias resolution
  const getSpotsMap = () => {
    const spots = db.prepare('SELECT * FROM spots').all() as any[];
    const map = new Map<string, any>();

    const normalizeKey = (str: string) => {
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    for (const s of spots) {
      const formattedSpot = {
        id: s.id,
        name: s.name,
        shortName: s.short_name || s.name,
        tagLabel: s.tag_label || s.name,
        category: s.category,
        categoryLabel: s.category_label || s.category,
        lat: s.lat,
        lng: s.lng,
        image: s.image,
        gallery: s.gallery ? JSON.parse(s.gallery) : [],
        description: s.description,
        touristTip: s.tourist_tip,
        rating: s.rating,
        reviewCount: s.review_count,
        hours: s.hours,
        address: s.address,
        priceRange: s.price_range,
        availableForItinerary: s.available_for_itinerary === 1,
        durationMinutes: s.duration_minutes || 90,
        tags: s.tags ? s.tags.split(',').map((t: string) => t.trim()) : [],
        price: s.price || s.price_range || '',
        mapsUrl: s.maps_url,
      };

      // 1. Exact ID
      map.set(s.id, formattedSpot);

      // 2. Strip random trailing 4-char suffix (e.g. 'baden-baden-6556' -> 'baden-baden')
      const baseSlug = s.id.replace(/-[0-9a-f]{4}$/, '');
      if (!map.has(baseSlug)) {
        map.set(baseSlug, formattedSpot);
      }

      // 3. Normalized Name slug
      const nameSlug = normalizeKey(s.name);
      if (!map.has(nameSlug)) {
        map.set(nameSlug, formattedSpot);
      }

      // 4. Without 'parque-' or 'restaurante-' prefix
      if (nameSlug.startsWith('parque-')) {
        const withoutPrefix = nameSlug.replace('parque-', '');
        if (!map.has(withoutPrefix)) {
          map.set(withoutPrefix, formattedSpot);
        }
      }
      if (nameSlug.startsWith('restaurante-')) {
        const withoutPrefix = nameSlug.replace('restaurante-', '');
        if (!map.has(withoutPrefix)) {
          map.set(withoutPrefix, formattedSpot);
        }
      }
    }

    return {
      get: (idOrSlug: string) => {
        if (!idOrSlug) return null;
        if (map.has(idOrSlug)) return map.get(idOrSlug);

        const normalized = normalizeKey(idOrSlug);
        if (map.has(normalized)) return map.get(normalized);

        const withoutPrefix = normalized.replace(/^(parque|restaurante|morro|mirante)-/, '');
        if (map.has(withoutPrefix)) return map.get(withoutPrefix);

        // Fallback fuzzy search against existing spots
        for (const [key, spot] of map.entries()) {
          if (key.includes(normalized) || normalized.includes(key)) {
            return spot;
          }
        }
        return null;
      },
      has: (idOrSlug: string) => Boolean(map.has(idOrSlug) || map.has(normalizeKey(idOrSlug))),
      values: () => Array.from(new Set(map.values()))
    };
  };

  // Helper to hydrate full itinerary object with days and steps
  const hydrateItinerary = (itineraryRow: any) => {
    const spotsMap = getSpotsMap();
    const days = db.prepare('SELECT * FROM itinerary_days WHERE itinerary_id = ? ORDER BY day_number ASC').all(itineraryRow.id) as any[];

    const daysHydrated = days.map(d => {
      const steps = db.prepare('SELECT * FROM itinerary_steps WHERE day_id = ? ORDER BY step_order ASC').all(d.id) as any[];
      const stepsHydrated = steps.map((s, idx) => {
        const spot = spotsMap.get(s.spot_id);
        const nextStep = steps[idx + 1];
        let distanceToNextKm: number | undefined;
        let durationToNextMin: number | undefined;

        if (spot && nextStep) {
          const nextSpot = spotsMap.get(nextStep.spot_id);
          if (nextSpot) {
            distanceToNextKm = calculateDistanceKm(spot.lat, spot.lng, nextSpot.lat, nextSpot.lng);
            // Estimate mountain driving: ~2.5 min per km + 3 min parking/turn
            durationToNextMin = Math.round(distanceToNextKm * 2.5 + 3);
          }
        }

        const resolvedSpot = spot ? {
          ...spot,
          image: (!spot.image || spot.image.startsWith('/uploads/'))
            ? (SPOT_PHOTO_MAP[spot.id] || SPOT_PHOTO_MAP[spot.name?.toLowerCase()] || 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80')
            : spot.image
        } : null;

        return {
          id: s.id,
          itineraryId: s.itinerary_id,
          dayId: s.day_id,
          dayNumber: d.day_number,
          spotId: s.spot_id,
          stepOrder: s.step_order,
          suggestedTime: s.suggested_time || '09:00',
          durationMinutes: s.duration_minutes || 90,
          notes: s.notes || '',
          customName: s.custom_name || '',
          customDescription: s.custom_description || '',
          customTip: s.custom_tip || '',
          customImage: (s.custom_image && !s.custom_image.startsWith('/uploads/')) ? s.custom_image : '',
          spot: resolvedSpot,
          distanceToNextKm,
          durationToNextMin
        };
      });

      return {
        id: d.id,
        itineraryId: d.itinerary_id,
        dayNumber: d.day_number,
        title: d.title || `Dia ${d.day_number}`,
        summary: d.summary || '',
        steps: stepsHydrated
      };
    });

    let categories: string[] = [];
    try {
      categories = JSON.parse(itineraryRow.categories || '[]');
    } catch (e) {
      categories = [];
    }

    const totalPlaces = daysHydrated.reduce((acc, d) => acc + d.steps.length, 0);
    const status = itineraryRow.status || (itineraryRow.is_active === 1 ? 'published' : 'draft');

    return {
      id: itineraryRow.id,
      title: itineraryRow.title,
      description: itineraryRow.description || '',
      coverImage: itineraryRow.cover_image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
      daysCount: itineraryRow.days_count || daysHydrated.length || 1,
      categories,
      isActive: itineraryRow.is_active === 1,
      isRecommended: itineraryRow.is_recommended === 1,
      isFeatured: (itineraryRow.is_featured === 1) || (itineraryRow.is_recommended === 1),
      isPremium: itineraryRow.is_premium !== undefined && itineraryRow.is_premium !== null ? itineraryRow.is_premium === 1 : true,
      price: itineraryRow.price || 'R$ 14,90',
      platanosPrice:
        (itineraryRow.is_premium !== undefined && itineraryRow.is_premium !== null ? itineraryRow.is_premium === 1 : true)
          ? (itineraryRow.platanos_price && Number(itineraryRow.platanos_price) > 0 ? Number(itineraryRow.platanos_price) : 15)
          : 0,
      status,
      badgeText: itineraryRow.badge_text || 'Premium',
      showBadge: itineraryRow.show_badge !== undefined && itineraryRow.show_badge !== null ? itineraryRow.show_badge === 1 : true,
      showPrice: itineraryRow.show_price !== undefined && itineraryRow.show_price !== null ? itineraryRow.show_price === 1 : true,
      showStopsCount: itineraryRow.show_stops_count !== undefined && itineraryRow.show_stops_count !== null ? itineraryRow.show_stops_count === 1 : true,
      tips: itineraryRow.tips || '',
      sortOrder: itineraryRow.sort_order || 0,
      usageCount: itineraryRow.usage_count || 0,
      notes: itineraryRow.notes || '',
      days: daysHydrated,
      placesCount: totalPlaces,
      createdAt: itineraryRow.created_at,
      updatedAt: itineraryRow.updated_at
    };
  };

  // ==========================================
  // ITINERARY CATEGORIES API
  // ==========================================

  // List all categories (for app & admin)
  app.get('/api/itinerary-categories', (req, res) => {
    try {
      const includeInactive = req.query.all === 'true';
      const sql = includeInactive
        ? 'SELECT * FROM itinerary_categories ORDER BY sort_order ASC, name ASC'
        : 'SELECT * FROM itinerary_categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC';
      const rows = db.prepare(sql).all() as any[];
      const categories = rows.map(r => ({
        id: r.id,
        name: r.name,
        icon: r.icon || 'Compass',
        description: r.description || '',
        isActive: r.is_active === 1,
        sortOrder: r.sort_order || 0
      }));
      res.json({ success: true, categories });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao buscar categorias: ' + err.message });
    }
  });

  // Admin Create Category
  app.post('/api/admin/itinerary-categories', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { name, icon, description, sortOrder, isActive } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        return;
      }

      const id = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      db.prepare(`
        INSERT INTO itinerary_categories (id, name, icon, description, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        icon || 'Compass',
        description || '',
        sortOrder || 0,
        isActive !== undefined ? (isActive ? 1 : 0) : 1
      );

      logAdminAction(userId, userName, 'Criou Categoria de Roteiro', name);
      res.json({ success: true, id, message: 'Categoria cadastrada com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao cadastrar categoria: ' + err.message });
    }
  });

  // Admin Update Category
  app.put('/api/admin/itinerary-categories/:id', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { id } = req.params;
      const { name, icon, description, sortOrder, isActive } = req.body;

      db.prepare(`
        UPDATE itinerary_categories SET
          name = COALESCE(?, name),
          icon = COALESCE(?, icon),
          description = COALESCE(?, description),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name,
        icon,
        description,
        sortOrder !== undefined ? sortOrder : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        id
      );

      logAdminAction(userId, userName, 'Editou Categoria de Roteiro', `ID: ${id}`);
      res.json({ success: true, message: 'Categoria atualizada com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao atualizar categoria: ' + err.message });
    }
  });

  // Admin Delete Category
  app.delete('/api/admin/itinerary-categories/:id', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { id } = req.params;
      db.prepare('DELETE FROM itinerary_categories WHERE id = ?').run(id);
      logAdminAction(userId, userName, 'Excluiu Categoria de Roteiro', `ID: ${id}`);
      res.json({ success: true, message: 'Categoria excluída' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao excluir categoria: ' + err.message });
    }
  });

  // ==========================================
  // CURATED ITINERARIES & STORE API
  // ==========================================

  // Helper to check if a raw itinerary row matches category/duration/search before expensive hydration
  const normalizeFilterToken = (val: string) =>
    String(val || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const rowMatchesFilters = (
    row: any,
    categoryFilter?: string,
    durationFilter?: string,
    searchFilter?: string
  ): boolean => {
    let rowCats: string[] = [];
    try {
      const parsed = JSON.parse(row.categories || '[]');
      if (Array.isArray(parsed)) rowCats = parsed.map(normalizeFilterToken);
    } catch {
      rowCats = String(row.categories || '')
        .split(',')
        .map(normalizeFilterToken)
        .filter(Boolean);
    }

    const normTitle = normalizeFilterToken(row.title || '');
    const normDesc = normalizeFilterToken(row.description || '');
    const isFeat = Number(row.is_featured) === 1 || Number(row.is_recommended) === 1;
    const daysCount = Number(row.days_count || 1);
    const isPrem = row.is_premium !== undefined && row.is_premium !== null ? Number(row.is_premium) === 1 : true;

    // 1. Category Filter
    if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'todos') {
      const cat = normalizeFilterToken(categoryFilter);
      if (cat === 'destaque' || cat === 'popular' || cat === 'mais-procurados') {
        if (!isFeat) return false;
      } else if (cat === '1day' || cat === '1-dia' || cat === '1dia') {
        if (daysCount !== 1) return false;
      } else if (cat === '2days' || cat === '2-dias' || cat === '2dias') {
        if (daysCount !== 2) return false;
      } else if (cat === 'natureza' || cat === 'nature') {
        const match =
          rowCats.some((c) => ['nature', 'natureza', 'ecotourism', 'ecoturismo'].includes(c)) ||
          normTitle.includes('natureza');
        if (!match) return false;
      } else if (cat === 'romantico' || cat === 'romantic' || cat === 'casais') {
        const match =
          rowCats.some((c) => ['romantic', 'romantico', 'casais', 'casal', 'romance'].includes(c)) ||
          normTitle.includes('romantic') ||
          normTitle.includes('casal') ||
          normTitle.includes('casais');
        if (!match) return false;
      } else if (cat === 'gastronomia' || cat === 'gastronomy') {
        const match =
          rowCats.some((c) =>
            ['gastronomy', 'gastronomia', 'sweets', 'cafes', 'culinaria', 'fondue'].includes(c)
          ) ||
          normTitle.includes('gastronom') ||
          normTitle.includes('fondue');
        if (!match) return false;
      } else if (cat === 'aventura' || cat === 'adventure') {
        const match =
          rowCats.some((c) => ['adventure', 'aventura', 'trilhas', 'radical', 'esportes'].includes(c)) ||
          normTitle.includes('aventur') ||
          normTitle.includes('trilha');
        if (!match) return false;
      } else if (cat === 'familia' || cat === 'family') {
        const match =
          rowCats.some((c) => ['family', 'familia', 'kids', 'criancas'].includes(c)) ||
          normTitle.includes('familia');
        if (!match) return false;
      } else if (cat === 'terror') {
        const match =
          rowCats.some((c) => ['terror', 'assombrado', 'misterio', 'sobrenatural'].includes(c)) ||
          normTitle.includes('terror');
        if (!match) return false;
      } else {
        const match = rowCats.includes(cat) || rowCats.some((c) => c.includes(cat)) || normTitle.includes(cat);
        if (!match) return false;
      }
    }

    // 2. Duration / Type Filter
    if (durationFilter && durationFilter !== 'all') {
      if (durationFilter === '1day' && daysCount !== 1) return false;
      if (durationFilter === 'multiday' && daysCount < 2) return false;
      if (durationFilter === 'free') {
        const isFree =
          !isPrem ||
          String(row.badge_text || '').toLowerCase() === 'grátis' ||
          row.price === 'R$ 0' ||
          row.price === 'Grátis';
        if (!isFree) return false;
      }
    }

    // 3. Search Query Filter
    if (searchFilter && searchFilter.trim()) {
      const q = normalizeFilterToken(searchFilter);
      const matchesMeta =
        normTitle.includes(q) ||
        normDesc.includes(q) ||
        rowCats.some((c) => c.includes(q));

      if (!matchesMeta) {
        // Check if any spot in this itinerary matches the search query
        const spotMatch = db
          .prepare(
            `SELECT 1 FROM itinerary_steps st
             LEFT JOIN spots sp ON sp.id = st.spot_id
             WHERE st.itinerary_id = ?
               AND (LOWER(COALESCE(sp.name, '')) LIKE ? OR LOWER(COALESCE(st.custom_name, '')) LIKE ?)
             LIMIT 1`
          )
          .get(row.id, `%${q}%`, `%${q}%`);
        if (!spotMatch) return false;
      }
    }

    return true;
  };

  // List curated itineraries (Supports both Cursor/Offset Pagination and full Admin view)
  app.get('/api/itineraries', (req, res) => {
    try {
      const includeInactive = req.query.all === 'true';
      const categoryFilter = (req.query.category as string) || 'all';
      const durationFilter = (req.query.duration as string) || 'all';
      const searchFilter = (req.query.search as string) || '';
      const featuredOnly = req.query.featured === 'true';
      const isPaginated = req.query.paginated === 'true' || req.query.limit !== undefined;

      // Consistent deterministic ordering: sort_order ASC, id ASC
      const sql = includeInactive
        ? 'SELECT * FROM itineraries ORDER BY sort_order ASC, id ASC'
        : "SELECT * FROM itineraries WHERE is_active = 1 AND (status = 'published' OR status IS NULL) ORDER BY sort_order ASC, id ASC";

      const allRows = db.prepare(sql).all() as any[];

      if (!isPaginated) {
        let filteredRows = allRows.filter((r) =>
          rowMatchesFilters(r, categoryFilter, durationFilter, searchFilter)
        );
        if (featuredOnly) {
          filteredRows = filteredRows.filter(
            (r) => Number(r.is_featured) === 1 || Number(r.is_recommended) === 1
          );
        }
        const itineraries = filteredRows.map(hydrateItinerary);
        res.json({ success: true, itineraries });
        return;
      }

      // Paginated execution path: filter lightweight rows first, then hydrate ONLY the current batch
      const limit = Math.max(1, Math.min(24, Number(req.query.limit) || 4));
      const cursor = typeof req.query.cursor === 'string' && req.query.cursor.trim() ? req.query.cursor.trim() : null;
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const includeFeaturedBanner = req.query.includeFeaturedBanner === 'true';
      const excludeIdsRaw = typeof req.query.excludeIds === 'string' ? req.query.excludeIds : '';
      const excludeIds = new Set(
        excludeIdsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );

      let matchingRows = allRows.filter((r) =>
        rowMatchesFilters(r, categoryFilter, durationFilter, searchFilter)
      );
      if (featuredOnly) {
        matchingRows = matchingRows.filter(
          (r) => Number(r.is_featured) === 1 || Number(r.is_recommended) === 1
        );
      }

      // Identify featured banner itinerary if requested (for 'all' or 'destaque' without search)
      let featuredItinerary: any = null;
      if (
        includeFeaturedBanner &&
        !searchFilter.trim() &&
        (categoryFilter === 'all' || categoryFilter === 'destaque')
      ) {
        const featuredRow = matchingRows.find(
          (r) => Number(r.is_featured) === 1 || Number(r.is_recommended) === 1
        );
        if (featuredRow) {
          featuredItinerary = hydrateItinerary(featuredRow);
          excludeIds.add(String(featuredRow.id));
        }
      }

      const discoveryRows = matchingRows.filter((r) => !excludeIds.has(String(r.id)));
      const totalMatching = discoveryRows.length;

      let startIndex = offset;
      if (cursor) {
        const [cursorSortStr, cursorId] = cursor.split('|');
        const cursorSort = Number(cursorSortStr);
        const foundIdx = discoveryRows.findIndex((r) => String(r.id) === cursorId);
        if (foundIdx >= 0) {
          startIndex = foundIdx + 1;
        } else if (!Number.isNaN(cursorSort)) {
          const afterCursorIdx = discoveryRows.findIndex((r) => {
            const rSort = Number(r.sort_order || 0);
            return rSort > cursorSort || (rSort === cursorSort && String(r.id) > (cursorId || ''));
          });
          startIndex = afterCursorIdx >= 0 ? afterCursorIdx : discoveryRows.length;
        }
      }

      const batchRows = discoveryRows.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + batchRows.length < discoveryRows.length;
      const lastRow = batchRows[batchRows.length - 1];
      const nextCursor =
        hasMore && lastRow ? `${Number(lastRow.sort_order || 0)}|${lastRow.id}` : null;
      const nextOffset = startIndex + batchRows.length;

      // Hydrate ONLY the rows in this page batch
      const itineraries = batchRows.map(hydrateItinerary);

      res.json({
        success: true,
        itineraries,
        featuredItinerary,
        hasMore,
        nextCursor,
        nextOffset,
        totalMatching,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao buscar roteiros: ' + err.message });
    }
  });

  // Get single curated itinerary
  app.get('/api/itineraries/:id', (req, res) => {
    try {
      const { id } = req.params;
      const row = db.prepare('SELECT * FROM itineraries WHERE id = ?').get(id) as any;
      if (!row) {
        res.status(404).json({ error: 'Roteiro não encontrado' });
        return;
      }

      const itinerary = hydrateItinerary(row);
      res.json({ success: true, itinerary });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao buscar roteiro: ' + err.message });
    }
  });

  // Clone a store itinerary into the current user's personal "Meu Roteiro"
  app.post('/api/itineraries/:id/clone-to-user', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const sessionId = (req.headers['x-session-id'] as string) || req.body.sessionId || 'guest-session';
      const { id } = req.params;

      let source: any = null;
      const sourceRow = db.prepare('SELECT * FROM itineraries WHERE id = ?').get(id) as any;
      if (sourceRow) {
        source = hydrateItinerary(sourceRow);
        try {
          db.prepare('UPDATE itineraries SET usage_count = usage_count + 1 WHERE id = ?').run(id);
        } catch (e) {}
      } else {
        const found = DEFAULT_CURATED_ITINERARIES.find((i) => i.id === id);
        if (found) {
          source = found;
        } else if (req.body?.itinerary && req.body.itinerary.id) {
          source = req.body.itinerary;
        }
      }

      if (!source) {
        res.status(404).json({ error: 'Roteiro não encontrado na loja' });
        return;
      }

      // Create new personalized user itinerary ID
      const userItinId = 'user-itin-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

      // Build clone of days and steps with new IDs so personal edits never affect store
      const clonedDays = source.days.map((d, dIdx) => ({
        id: `${userItinId}-d-${dIdx + 1}`,
        itineraryId: userItinId,
        dayNumber: d.dayNumber,
        title: d.title,
        summary: d.summary,
        steps: d.steps.map((s, sIdx) => ({
          ...s,
          id: `${userItinId}-d-${dIdx + 1}-s-${sIdx + 1}`,
          itineraryId: userItinId,
          dayId: `${userItinId}-d-${dIdx + 1}`,
          dayNumber: d.dayNumber,
          stepOrder: sIdx + 1
        }))
      }));

      db.prepare(`
        INSERT INTO user_itineraries (
          id, user_id, session_id, title, description, cover_image,
          days_count, trip_date, pace, has_car, less_walking,
          prioritize_food, prioritize_attractions, preferences_json,
          itinerary_data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userItinId,
        user ? user.id : null,
        sessionId,
        source.title,
        source.description || '',
        source.coverImage,
        source.daysCount || clonedDays.length,
        '',
        'Equilibrado',
        1,
        0,
        0,
        1,
        JSON.stringify({
          sourceItineraryId: source.id,
          isPremium: Boolean(source.isPremium),
          badgeText: source.badgeText || 'Premium',
          price: source.price || ''
        }),
        JSON.stringify(clonedDays)
      );

      const userItinerary = {
        id: userItinId,
        title: source.title,
        description: source.description,
        coverImage: source.coverImage,
        daysCount: source.daysCount,
        days: clonedDays,
        categories: source.categories,
        isPremium: Boolean(source.isPremium),
        badgeText: source.badgeText || 'Premium',
        price: source.price || '',
        pace: 'Equilibrado',
        hasCar: true,
        lessWalking: false,
        prioritizeFood: false,
        prioritizeAttractions: true,
        createdAt: new Date().toISOString()
      };

      res.json({
        success: true,
        userItinerary,
        message: 'Roteiro adicionado ao seu planejamento com sucesso!'
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao adicionar roteiro: ' + err.message });
    }
  });

  // Increment usage count when a user applies/creates this route
  app.post('/api/itineraries/:id/use', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('UPDATE itineraries SET usage_count = usage_count + 1 WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao registrar uso' });
    }
  });

  // Admin Create Itinerary
  app.post('/api/admin/itineraries', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const {
        title,
        description,
        coverImage,
        daysCount,
        categories,
        isActive,
        isRecommended,
        isFeatured,
        isPremium,
        price,
        status,
        badgeText,
        showBadge,
        showPrice,
        showStopsCount,
        tips,
        sortOrder,
        notes,
        days
      } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Título do roteiro é obrigatório' });
        return;
      }

      const id = 'itin-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).substring(2, 6);
      const safeDaysCount = Math.max(1, Number(daysCount) || (Array.isArray(days) ? days.length : 1));
      const safeCategories = Array.isArray(categories) ? JSON.stringify(categories) : '[]';

      const finalStatus = status || (isActive ? 'published' : 'draft');
      const finalActive = finalStatus === 'published' ? 1 : 0;
      const finalFeatured = isFeatured !== undefined ? (isFeatured ? 1 : 0) : (isRecommended ? 1 : 0);

      const isPremBool = isPremium !== undefined ? Boolean(isPremium) : true;
      const platanosPriceNum = isPremBool
        ? (req.body.platanosPrice && Number(req.body.platanosPrice) > 0 ? Number(req.body.platanosPrice) : 15)
        : 0;

      db.transaction(() => {
        db.prepare(`
          INSERT INTO itineraries (
            id, title, description, cover_image, days_count, categories,
            is_active, is_recommended, is_featured, is_premium, price, platanos_price,
            status, badge_text, show_badge, show_price, show_stops_count,
            tips, sort_order, notes, usage_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          id,
          title,
          description || '',
          coverImage || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
          safeDaysCount,
          safeCategories,
          finalActive,
          finalFeatured,
          finalFeatured,
          isPremBool ? 1 : 0,
          price || (isPremBool ? `${platanosPriceNum} Plátanos` : 'Grátis'),
          platanosPriceNum,
          finalStatus,
          badgeText || 'Premium',
          showBadge !== undefined ? (showBadge ? 1 : 0) : 1,
          showPrice !== undefined ? (showPrice ? 1 : 0) : 1,
          showStopsCount !== undefined ? (showStopsCount ? 1 : 0) : 1,
          tips || '',
          Number(sortOrder) || 0,
          notes || ''
        );

        if (Array.isArray(days) && days.length > 0) {
          const insertDay = db.prepare(`
            INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
            VALUES (?, ?, ?, ?, ?)
          `);
          const insertStep = db.prepare(`
            INSERT INTO itinerary_steps (
              id, itinerary_id, day_id, spot_id, step_order, suggested_time,
              duration_minutes, notes, custom_name, custom_description, custom_tip, custom_image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          days.forEach((d: any, dIdx: number) => {
            const dayId = `${id}-day-${dIdx + 1}`;
            insertDay.run(dayId, id, dIdx + 1, d.title || `Dia ${dIdx + 1}`, d.summary || '');

            if (Array.isArray(d.steps)) {
              d.steps.forEach((s: any, sIdx: number) => {
                const stepId = `${dayId}-step-${sIdx + 1}`;
                insertStep.run(
                  stepId,
                  id,
                  dayId,
                  s.spotId,
                  sIdx + 1,
                  s.suggestedTime || '09:00',
                  Number(s.durationMinutes) || 90,
                  s.notes || '',
                  s.customName || '',
                  s.customDescription || '',
                  s.customTip || '',
                  s.customImage || ''
                );
              });
            }
          });
        }
      })();

      // Persist authoritatively to Supabase PostgreSQL
      saveItineraryToSupabase({ ...req.body, id }, false).catch((e) =>
        console.warn('[ItineraryRoutes] Supabase sync itin notice:', e)
      );

      logAdminAction(userId, userName, 'Criou Roteiro Turístico', title);
      res.json({ success: true, id, message: 'Roteiro criado com sucesso' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao salvar roteiro: ' + err.message });
    }
  });

  // Admin Update Itinerary
  app.put('/api/admin/itineraries/:id', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { id } = req.params;
      const {
        title,
        description,
        coverImage,
        daysCount,
        categories,
        isActive,
        isRecommended,
        isFeatured,
        isPremium,
        price,
        status,
        badgeText,
        showBadge,
        showPrice,
        showStopsCount,
        tips,
        sortOrder,
        notes,
        days
      } = req.body;

      const finalStatus = status !== undefined ? status : (isActive !== undefined ? (isActive ? 'published' : 'draft') : undefined);
      const finalActive = finalStatus !== undefined ? (finalStatus === 'published' ? 1 : 0) : (isActive !== undefined ? (isActive ? 1 : 0) : undefined);
      const finalFeatured = isFeatured !== undefined ? (isFeatured ? 1 : 0) : (isRecommended !== undefined ? (isRecommended ? 1 : 0) : undefined);

      const platanosPriceParam =
        req.body.platanosPrice !== undefined && req.body.platanosPrice !== null
          ? Number(req.body.platanosPrice)
          : null;

      db.transaction(() => {
        db.prepare(`
          UPDATE itineraries SET
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            cover_image = COALESCE(?, cover_image),
            days_count = COALESCE(?, days_count),
            categories = COALESCE(?, categories),
            is_active = COALESCE(?, is_active),
            is_recommended = COALESCE(?, is_recommended),
            is_featured = COALESCE(?, is_featured),
            is_premium = COALESCE(?, is_premium),
            price = COALESCE(?, price),
            platanos_price = COALESCE(?, platanos_price),
            status = COALESCE(?, status),
            badge_text = COALESCE(?, badge_text),
            show_badge = COALESCE(?, show_badge),
            show_price = COALESCE(?, show_price),
            show_stops_count = COALESCE(?, show_stops_count),
            tips = COALESCE(?, tips),
            sort_order = COALESCE(?, sort_order),
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          title,
          description,
          coverImage,
          daysCount ? Number(daysCount) : null,
          categories ? (Array.isArray(categories) ? JSON.stringify(categories) : categories) : null,
          finalActive,
          finalFeatured,
          finalFeatured,
          isPremium !== undefined ? (isPremium ? 1 : 0) : null,
          price,
          platanosPriceParam,
          finalStatus,
          badgeText,
          showBadge !== undefined ? (showBadge ? 1 : 0) : null,
          showPrice !== undefined ? (showPrice ? 1 : 0) : null,
          showStopsCount !== undefined ? (showStopsCount ? 1 : 0) : null,
          tips,
          sortOrder !== undefined ? Number(sortOrder) : null,
          notes,
          id
        );

        if (Array.isArray(days)) {
          // Clean existing days & steps and re-insert
          db.prepare('DELETE FROM itinerary_steps WHERE itinerary_id = ?').run(id);
          db.prepare('DELETE FROM itinerary_days WHERE itinerary_id = ?').run(id);

          const insertDay = db.prepare(`
            INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
            VALUES (?, ?, ?, ?, ?)
          `);
          const insertStep = db.prepare(`
            INSERT INTO itinerary_steps (
              id, itinerary_id, day_id, spot_id, step_order, suggested_time,
              duration_minutes, notes, custom_name, custom_description, custom_tip, custom_image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          days.forEach((d: any, dIdx: number) => {
            const dayId = `${id}-day-${dIdx + 1}`;
            insertDay.run(dayId, id, dIdx + 1, d.title || `Dia ${dIdx + 1}`, d.summary || '');

            if (Array.isArray(d.steps)) {
              d.steps.forEach((s: any, sIdx: number) => {
                const stepId = `${dayId}-step-${sIdx + 1}`;
                insertStep.run(
                  stepId,
                  id,
                  dayId,
                  s.spotId,
                  sIdx + 1,
                  s.suggestedTime || '09:00',
                  Number(s.durationMinutes) || 90,
                  s.notes || '',
                  s.customName || '',
                  s.customDescription || '',
                  s.customTip || '',
                  s.customImage || ''
                );
              });
            }
          });
        }
      })();

      // Persist authoritatively to Supabase PostgreSQL
      saveItineraryToSupabase({ ...req.body, id }, true).catch((e) =>
        console.warn('[ItineraryRoutes] Supabase sync itin notice:', e)
      );

      logAdminAction(userId, userName, 'Editou Roteiro Turístico', `ID: ${id}`);
      res.json({ success: true, message: 'Roteiro atualizado com sucesso' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar roteiro: ' + err.message });
    }
  });

  // Admin Toggle Status ('published' | 'draft' | 'hidden')
  app.put('/api/admin/itineraries/:id/status', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { id } = req.params;
      const { status } = req.body;
      if (!status || !['published', 'draft', 'hidden'].includes(status)) {
        res.status(400).json({ error: 'Status inválido' });
        return;
      }

      const isActive = status === 'published' ? 1 : 0;
      db.prepare('UPDATE itineraries SET status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, isActive, id);

      logAdminAction(userId, userName, `Alterou status do roteiro para ${status}`, `ID: ${id}`);
      res.json({ success: true, status, isActive: isActive === 1 });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alterar status: ' + err.message });
    }
  });

  // Admin Toggle Featured
  app.put('/api/admin/itineraries/:id/featured', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { id } = req.params;
      const current = db.prepare('SELECT is_featured, is_recommended FROM itineraries WHERE id = ?').get(id) as any;
      if (!current) {
        res.status(404).json({ error: 'Roteiro não encontrado' });
        return;
      }

      const nextVal = (current.is_featured === 1 || current.is_recommended === 1) ? 0 : 1;
      db.prepare('UPDATE itineraries SET is_featured = ?, is_recommended = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(nextVal, nextVal, id);

      logAdminAction(userId, userName, nextVal ? 'Destacou roteiro' : 'Removeu destaque do roteiro', `ID: ${id}`);
      res.json({ success: true, isFeatured: nextVal === 1 });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alterar destaque: ' + err.message });
    }
  });

  // Admin Duplicate Itinerary
  app.post('/api/admin/itineraries/:id/duplicate', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { id } = req.params;
      const source = db.prepare('SELECT * FROM itineraries WHERE id = ?').get(id) as any;
      if (!source) {
        res.status(404).json({ error: 'Roteiro não encontrado' });
        return;
      }

      const newId = 'itin-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).substring(2, 6);
      const newTitle = `${source.title} (Cópia)`;

      db.transaction(() => {
        db.prepare(`
          INSERT INTO itineraries (
            id, title, description, cover_image, days_count, categories,
            is_active, is_recommended, is_featured, is_premium, price,
            status, badge_text, show_badge, show_price, show_stops_count,
            tips, sort_order, notes, usage_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          newId,
          newTitle,
          source.description,
          source.cover_image,
          source.days_count,
          source.categories,
          0, // Start inactive/draft
          0,
          0,
          source.is_premium !== undefined ? source.is_premium : 1,
          source.price || 'R$ 14,90',
          'draft',
          source.badge_text || 'Premium',
          source.show_badge !== undefined ? source.show_badge : 1,
          source.show_price !== undefined ? source.show_price : 1,
          source.show_stops_count !== undefined ? source.show_stops_count : 1,
          source.tips || '',
          source.sort_order || 0,
          source.notes
        );

        const days = db.prepare('SELECT * FROM itinerary_days WHERE itinerary_id = ? ORDER BY day_number ASC').all(id) as any[];
        for (const d of days) {
          const newDayId = `${newId}-day-${d.day_number}`;
          db.prepare(`
            INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
            VALUES (?, ?, ?, ?, ?)
          `).run(newDayId, newId, d.day_number, d.title, d.summary);

          const steps = db.prepare('SELECT * FROM itinerary_steps WHERE day_id = ? ORDER BY step_order ASC').all(d.id) as any[];
          for (const s of steps) {
            const newStepId = `${newDayId}-step-${s.step_order}`;
            db.prepare(`
              INSERT INTO itinerary_steps (
                id, itinerary_id, day_id, spot_id, step_order, suggested_time,
                duration_minutes, notes, custom_name, custom_description, custom_tip, custom_image
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              newStepId,
              newId,
              newDayId,
              s.spot_id,
              s.step_order,
              s.suggested_time,
              s.duration_minutes,
              s.notes,
              s.custom_name || '',
              s.custom_description || '',
              s.custom_tip || '',
              s.custom_image || ''
            );
          }
        }
      })();

      logAdminAction(userId, userName, 'Duplicou Roteiro', `${source.title} -> ${newTitle}`);
      res.json({ success: true, id: newId, message: 'Roteiro duplicado com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao duplicar roteiro: ' + err.message });
    }
  });

  // Admin Toggle Itinerary Status (Active/Inactive)
  app.patch('/api/admin/itineraries/:id/toggle-status', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { id } = req.params;
      const current = db.prepare('SELECT is_active, title FROM itineraries WHERE id = ?').get(id) as any;
      if (!current) {
        res.status(404).json({ error: 'Roteiro não encontrado' });
        return;
      }

      const nextState = current.is_active === 1 ? 0 : 1;
      db.prepare('UPDATE itineraries SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextState, id);
      logAdminAction(userId, userName, nextState ? 'Ativou Roteiro' : 'Desativou Roteiro', current.title);
      res.json({ success: true, isActive: nextState === 1 });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alterar status: ' + err.message });
    }
  });

  // Admin Delete Itinerary
  app.delete('/api/admin/itineraries/:id', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { id } = req.params;
      const current = db.prepare('SELECT title FROM itineraries WHERE id = ?').get(id) as any;
      db.transaction(() => {
        db.prepare('DELETE FROM itinerary_steps WHERE itinerary_id = ?').run(id);
        db.prepare('DELETE FROM itinerary_days WHERE itinerary_id = ?').run(id);
        db.prepare('DELETE FROM itineraries WHERE id = ?').run(id);
      })();

      deleteItineraryFromSupabase(id).catch((e) =>
        console.warn('[ItineraryRoutes] Supabase delete itin notice:', e)
      );

      logAdminAction(userId, userName, 'Excluiu Roteiro', current?.title || id);
      res.json({ success: true, message: 'Roteiro excluído' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao excluir roteiro: ' + err.message });
    }
  });

  // ==========================================
  // ITINERARY GENERATOR ENGINE (AI / SMART ALGORITHM)
  // ==========================================

  app.post('/api/itineraries/generate', async (req, res) => {
    try {
      const {
        categories = [],
        selectedSpotIds = [],
        daysCount = 1,
        pace = 'Equilibrado',
        startTime = '09:00',
        endTime = '20:00',
        hasCar = true,
        lessWalking = false,
        prioritizeFood = false,
        prioritizeAttractions = true,
        tripDate
      } = req.body;

      const numDays = Math.max(1, Math.min(7, Number(daysCount) || 1));

      // 1. Fetch eligible spots from database
      const spotsRows = db.prepare(`
        SELECT * FROM spots
        WHERE is_active = 1
        AND (available_for_itinerary IS NULL OR available_for_itinerary = 1)
      `).all() as any[];

      if (spotsRows.length === 0) {
        res.status(400).json({ error: 'Nenhum ponto turístico disponível no banco de dados para gerar roteiro.' });
        return;
      }

      // Convert rows to Spot objects
      const allSpots = spotsRows.map(s => ({
        id: s.id,
        name: s.name,
        shortName: s.short_name || s.name,
        category: s.category,
        categoryLabel: s.category_label || s.category,
        lat: s.lat,
        lng: s.lng,
        image: s.image,
        description: s.description,
        touristTip: s.tourist_tip,
        rating: s.rating || 4.5,
        reviewCount: s.review_count || 10,
        hours: s.hours,
        address: s.address,
        priceRange: s.price_range,
        durationMinutes: s.duration_minutes || 90,
        tags: s.tags ? s.tags.toLowerCase() : '',
      }));

      // 2. Determine target spots per day based on pace
      let spotsPerDay = 4;
      if (pace === 'Relaxado') spotsPerDay = 3;
      if (pace === 'Intenso') spotsPerDay = 5;

      const totalTargetSpots = numDays * spotsPerDay;

      // 3. Score and prioritize spots according to preferences
      const scoredSpots = allSpots.map(spot => {
        let score = (spot.rating || 4.0) * 10;

        // If explicitly selected by user
        if (Array.isArray(selectedSpotIds) && selectedSpotIds.includes(spot.id)) {
          score += 1000;
        }

        // Category matches
        const catList = Array.isArray(categories) ? categories : [];
        if (catList.length > 0) {
          const matchCat = catList.some(c =>
            spot.category.toLowerCase().includes(c.toLowerCase()) ||
            spot.categoryLabel.toLowerCase().includes(c.toLowerCase()) ||
            spot.tags.includes(c.toLowerCase())
          );
          if (matchCat) score += 50;
        }

        if (prioritizeFood && (spot.category === 'gastronomy' || spot.category === 'cafes' || spot.category === 'sweets')) {
          score += 40;
        }

        if (prioritizeAttractions && (spot.category === 'attractions' || spot.category === 'parks' || spot.category === 'viewpoint')) {
          score += 35;
        }

        if (lessWalking && (spot.category === 'viewpoint' || spot.category === 'gastronomy' || spot.category === 'cafes')) {
          score += 15;
        }

        return { spot, score };
      });

      scoredSpots.sort((a, b) => b.score - a.score);

      // Take candidate pool
      const pool = scoredSpots.slice(0, Math.max(totalTargetSpots + 4, 8)).map(item => item.spot);

      // 4. Cluster and distribute spots across days to minimize travel distance
      // We sort spots by geographic cluster (e.g., proximity to centroids or sequentially)
      const selectedPool = pool.slice(0, totalTargetSpots);

      // Group into days
      const daysData: any[] = [];
      const usedSpotIds = new Set<string>();

      for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
        const dayNumber = dayIdx + 1;
        const daySpots: any[] = [];

        // Pick an anchor spot for this day from remaining candidates
        const available = selectedPool.filter(s => !usedSpotIds.has(s.id));
        if (available.length === 0) break;

        const anchor = available[0];
        daySpots.push(anchor);
        usedSpotIds.add(anchor.id);

        // Find closest spots to the previous spot in the chain
        while (daySpots.length < spotsPerDay) {
          const current = daySpots[daySpots.length - 1];
          const remaining = selectedPool.filter(s => !usedSpotIds.has(s.id));
          if (remaining.length === 0) break;

          // Find spot with smallest distance to current
          remaining.sort((a, b) => {
            const distA = calculateDistanceKm(current.lat, current.lng, a.lat, a.lng);
            const distB = calculateDistanceKm(current.lat, current.lng, b.lat, b.lng);
            return distA - distB;
          });

          const next = remaining[0];
          daySpots.push(next);
          usedSpotIds.add(next.id);
        }

        // Generate suggested times for this day based on startTime and pace
        const [startH, startM] = (startTime || '09:00').split(':').map(Number);
        let currentMinutes = (startH || 9) * 60 + (startM || 0);

        const steps = daySpots.map((spot, stepIdx) => {
          const hours = Math.floor(currentMinutes / 60);
          const mins = currentMinutes % 60;
          const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

          const durationMin = pace === 'Relaxado' ? 120 : pace === 'Intenso' ? 75 : 90;
          const distanceToNext = stepIdx < daySpots.length - 1
            ? calculateDistanceKm(spot.lat, spot.lng, daySpots[stepIdx + 1].lat, daySpots[stepIdx + 1].lng)
            : undefined;
          const travelTimeToNext = distanceToNext !== undefined ? Math.round(distanceToNext * 2.5 + 3) : 0;

          // Advance time for next stop
          currentMinutes += durationMin + travelTimeToNext;

          return {
            id: `gen-step-${dayNumber}-${stepIdx + 1}`,
            spotId: spot.id,
            stepOrder: stepIdx + 1,
            suggestedTime: timeStr,
            durationMinutes: durationMin,
            notes: spot.touristTip || `Aproveite a visita a ${spot.name}.`,
            spot,
            distanceToNextKm: distanceToNext,
            durationToNextMin: travelTimeToNext || undefined
          };
        });

        // Determine title for the day based on dominant category
        let dayTitle = `Dia ${dayNumber}: Experiências na Montanha`;
        if (daySpots.some(s => s.category === 'parks' || s.category === 'nature')) {
          dayTitle = `Dia ${dayNumber}: Natureza, Jardins & Ar Puro`;
        } else if (daySpots.some(s => s.category === 'viewpoint')) {
          dayTitle = `Dia ${dayNumber}: Mirantes Panorâmicos & Pôr do Sol`;
        } else if (daySpots.some(s => s.category === 'gastronomy' || s.category === 'cafes')) {
          dayTitle = `Dia ${dayNumber}: Sabores & Gastronomia de Altitude`;
        }

        daysData.push({
          id: `gen-day-${dayNumber}`,
          dayNumber,
          title: dayTitle,
          summary: `Roteiro planejado para deslocamento inteligente, passando por ${daySpots.map(s => s.shortName || s.name).join(', ')}.`,
          steps
        });
      }

      // Title & Cover Image
      const firstSpot = daysData[0]?.steps[0]?.spot;
      const coverImage = firstSpot?.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80';

      const itineraryTitle = numDays === 1
        ? 'Experiência em Campos do Jordão (1 Dia)'
        : `Roteiro Personalizado de ${numDays} Dias em Campos do Jordão`;

      const generatedItinerary = {
        id: 'gen-' + Date.now(),
        title: itineraryTitle,
        description: `Roteiro ${pace.toLowerCase()} com ${numDays} ${numDays === 1 ? 'dia' : 'dias'}, planejado com base nos pontos turísticos oficiais de Campos do Jordão.`,
        coverImage,
        daysCount: numDays,
        categories: Array.isArray(categories) ? categories : [],
        pace,
        hasCar,
        lessWalking,
        prioritizeFood,
        prioritizeAttractions,
        tripDate: tripDate || '',
        days: daysData,
        placesCount: daysData.reduce((acc, d) => acc + d.steps.length, 0),
        createdAt: new Date().toISOString()
      };

      res.json({
        success: true,
        itinerary: generatedItinerary
      });
    } catch (err: any) {
      console.error('Error generating itinerary:', err);
      res.status(500).json({ error: 'Erro ao gerar roteiro: ' + err.message });
    }
  });

  // ==========================================
  // USER SAVED ITINERARIES API
  // ==========================================

  // List saved itineraries for user or session
  app.get('/api/user-itineraries', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const sessionId = req.headers['x-session-id'] as string || '';

      let rows: any[] = [];
      if (user) {
        rows = db.prepare('SELECT * FROM user_itineraries WHERE user_id = ? ORDER BY created_at DESC').all(user.id) as any[];
      } else if (sessionId) {
        rows = db.prepare('SELECT * FROM user_itineraries WHERE session_id = ? ORDER BY created_at DESC').all(sessionId) as any[];
      } else {
        rows = [];
      }

      const spotsMap = getSpotsMap();
      const itineraries = rows.map(r => {
        let days: any[] = [];
        try {
          days = JSON.parse(r.itinerary_data_json || '[]');
        } catch (e) {
          days = [];
        }

        // Re-hydrate spot data if possible
        days = days.map((d: any) => ({
          ...d,
          steps: (d.steps || []).map((s: any) => ({
            ...s,
            spot: spotsMap.get(s.spotId) || s.spot
          }))
        }));

        let preferences: any = {};
        try {
          preferences = JSON.parse(r.preferences_json || '{}');
        } catch (e) {}

        const isPremium = Boolean(preferences.isPremium || preferences.sourceItineraryId || r.is_premium);

        return {
          id: r.id,
          userId: r.user_id,
          sessionId: r.session_id,
          title: r.title,
          description: r.description || '',
          coverImage: r.cover_image,
          daysCount: r.days_count,
          tripDate: r.trip_date || '',
          pace: r.pace || 'Equilibrado',
          hasCar: r.has_car === 1,
          lessWalking: r.less_walking === 1,
          prioritizeFood: r.prioritize_food === 1,
          prioritizeAttractions: r.prioritize_attractions === 1,
          isPremium,
          badgeText: preferences.badgeText || (isPremium ? 'Premium' : undefined),
          price: preferences.price || (isPremium ? 'R$ 14,90' : undefined),
          days,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      });

      res.json({ success: true, itineraries });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao listar roteiros salvos: ' + err.message });
    }
  });

  // Save / create user itinerary
  app.post('/api/user-itineraries', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const sessionId = req.headers['x-session-id'] as string || '';

      const {
        title,
        description,
        coverImage,
        daysCount,
        tripDate,
        pace,
        hasCar,
        lessWalking,
        prioritizeFood,
        prioritizeAttractions,
        preferences,
        days
      } = req.body;

      if (!title || !Array.isArray(days)) {
        res.status(400).json({ error: 'Título e dias do roteiro são obrigatórios' });
        return;
      }

      const id = 'user-itin-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

      db.prepare(`
        INSERT INTO user_itineraries (
          id, user_id, session_id, title, description, cover_image,
          days_count, trip_date, pace, has_car, less_walking,
          prioritize_food, prioritize_attractions, preferences_json,
          itinerary_data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        user ? user.id : null,
        sessionId,
        title,
        description || '',
        coverImage || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
        daysCount || days.length || 1,
        tripDate || '',
        pace || 'Equilibrado',
        hasCar !== undefined ? (hasCar ? 1 : 0) : 1,
        lessWalking !== undefined ? (lessWalking ? 1 : 0) : 0,
        prioritizeFood !== undefined ? (prioritizeFood ? 1 : 0) : 0,
        prioritizeAttractions !== undefined ? (prioritizeAttractions ? 1 : 0) : 1,
        preferences ? JSON.stringify(preferences) : '{}',
        JSON.stringify(days)
      );

      res.json({ success: true, id, message: 'Roteiro salvo com sucesso!' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao salvar roteiro: ' + err.message });
    }
  });

  // Update user itinerary (edit steps, notes, times)
  app.put('/api/user-itineraries/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, coverImage, tripDate, days } = req.body;

      db.prepare(`
        UPDATE user_itineraries SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          cover_image = COALESCE(?, cover_image),
          trip_date = COALESCE(?, trip_date),
          itinerary_data_json = COALESCE(?, itinerary_data_json),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        title,
        description,
        coverImage,
        tripDate,
        days ? JSON.stringify(days) : null,
        id
      );

      res.json({ success: true, message: 'Roteiro atualizado com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao atualizar roteiro: ' + err.message });
    }
  });

  // Delete user itinerary
  app.delete('/api/user-itineraries/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM user_itineraries WHERE id = ?').run(id);
      res.json({ success: true, message: 'Roteiro excluído' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao excluir roteiro: ' + err.message });
    }
  });

  // Save itinerary wizard draft (step-by-step: date, people, budget, liked spots)
  app.post('/api/user-itineraries/draft', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const sessionId = (req.headers['x-session-id'] as string) || req.body.sessionId || 'default-guest-session';
      const { tripDate, peopleCount, adultsCount, childrenCount, budget, likedSpots } = req.body;

      db.prepare(`
        INSERT INTO itinerary_drafts (session_id, user_id, trip_date, people_count, adults_count, children_count, budget, liked_spots_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id) DO UPDATE SET
          user_id = COALESCE(excluded.user_id, itinerary_drafts.user_id),
          trip_date = COALESCE(excluded.trip_date, itinerary_drafts.trip_date),
          people_count = COALESCE(excluded.people_count, itinerary_drafts.people_count),
          adults_count = COALESCE(excluded.adults_count, itinerary_drafts.adults_count),
          children_count = COALESCE(excluded.children_count, itinerary_drafts.children_count),
          budget = COALESCE(excluded.budget, itinerary_drafts.budget),
          liked_spots_json = COALESCE(excluded.liked_spots_json, itinerary_drafts.liked_spots_json),
          updated_at = CURRENT_TIMESTAMP
      `).run(
        sessionId,
        user ? user.id : null,
        tripDate !== undefined ? tripDate : null,
        peopleCount !== undefined ? peopleCount : null,
        adultsCount !== undefined ? adultsCount : null,
        childrenCount !== undefined ? childrenCount : null,
        budget !== undefined ? budget : null,
        likedSpots !== undefined ? JSON.stringify(likedSpots) : null
      );

      res.json({ success: true, message: 'Etapa salva no banco de dados com sucesso' });
    } catch (err: any) {
      console.error('Error saving itinerary draft:', err);
      res.status(500).json({ error: 'Erro ao salvar rascunho: ' + err.message });
    }
  });

  // Get itinerary wizard draft
  app.get('/api/user-itineraries/draft', (req, res) => {
    try {
      const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string) || 'default-guest-session';
      const row = db.prepare('SELECT * FROM itinerary_drafts WHERE session_id = ?').get(sessionId) as any;
      if (!row) {
        res.json({ success: true, draft: null });
        return;
      }
      let likedSpots = [];
      try {
        likedSpots = JSON.parse(row.liked_spots_json || '[]');
      } catch (e) {}

      res.json({
        success: true,
        draft: {
          sessionId: row.session_id,
          tripDate: row.trip_date,
          peopleCount: row.people_count,
          adultsCount: row.adults_count !== undefined && row.adults_count !== null ? row.adults_count : 2,
          childrenCount: row.children_count !== undefined && row.children_count !== null ? row.children_count : 0,
          budget: row.budget,
          likedSpots,
          updatedAt: row.updated_at
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao buscar rascunho: ' + err.message });
    }
  });

  // Clear draft
  app.delete('/api/user-itineraries/draft', (req, res) => {
    try {
      const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string) || 'default-guest-session';
      db.prepare('DELETE FROM itinerary_drafts WHERE session_id = ?').run(sessionId);
      res.json({ success: true, message: 'Rascunho limpo' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao limpar rascunho' });
    }
  });

  // ==========================================
  // PLANNER SETTINGS API
  // ==========================================

  app.get('/api/planner-settings', (req, res) => {
    try {
      const rows = db.prepare('SELECT key, value FROM planner_settings').all() as any[];
      const settings: Record<string, string> = {};
      for (const r of rows) {
        settings[r.key] = r.value;
      }
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao buscar configurações do planejador' });
    }
  });

  app.put('/api/admin/planner-settings', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      const userId = user?.id || 1;
      const userName = user?.name || 'Administrador';

      const { settings } = req.body;
      if (typeof settings === 'object') {
        const upsert = db.prepare(`
          INSERT INTO planner_settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `);
        for (const [k, v] of Object.entries(settings)) {
          upsert.run(k, String(v));
        }
      }

      logAdminAction(userId, userName, 'Atualizou Configurações do Planejador', '');
      res.json({ success: true, message: 'Configurações salvas com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao salvar configurações: ' + err.message });
    }
  });
}
