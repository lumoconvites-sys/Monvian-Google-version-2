import express from 'express';
import { Database } from 'better-sqlite3';

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

    CREATE TABLE IF NOT EXISTS planner_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for spots and drafts table
  try { db.exec(`ALTER TABLE spots ADD COLUMN available_for_itinerary INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.exec(`ALTER TABLE spots ADD COLUMN duration_minutes INTEGER DEFAULT 90;`); } catch (e) {}
  try { db.exec(`ALTER TABLE spots ADD COLUMN tags TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE spots ADD COLUMN price TEXT DEFAULT '';`); } catch (e) {}
  try { db.exec(`ALTER TABLE itinerary_drafts ADD COLUMN adults_count INTEGER DEFAULT 2;`); } catch (e) {}
  try { db.exec(`ALTER TABLE itinerary_drafts ADD COLUMN children_count INTEGER DEFAULT 0;`); } catch (e) {}

  // Update existing spots to be available for itineraries if null
  try {
    db.exec(`UPDATE spots SET available_for_itinerary = 1 WHERE available_for_itinerary IS NULL;`);
    db.exec(`UPDATE spots SET duration_minutes = 90 WHERE duration_minutes IS NULL OR duration_minutes = 0;`);
  } catch (e) {}

  // Seed default itinerary categories if empty
  const catCount = db.prepare('SELECT count(*) as count FROM itinerary_categories').get() as { count: number };
  if (catCount.count === 0) {
    const defaultCategories = [
      { id: 'nature', name: 'Natureza & Trilhas', icon: 'Trees', sort_order: 1, description: 'Jardins, bosques, cachoeiras e mirantes' },
      { id: 'gastronomy', name: 'Gastronomia & Fondue', icon: 'UtensilsCrossed', sort_order: 2, description: 'Alta gastronomia alpina, fondues e trutas' },
      { id: 'cafes', name: 'Cafés & Bistrôs', icon: 'Coffee', sort_order: 3, description: 'Cafés coloniais e bistrôs acolhedores na montanha' },
      { id: 'sweets', name: 'Chocolates & Doces', icon: 'Cake', sort_order: 4, description: 'Chocolaterias tradicionais de Campos do Jordão' },
      { id: 'romantic', name: 'Romântico & Casal', icon: 'Heart', sort_order: 5, description: 'Experiências a dois com vista e aconchego' },
      { id: 'family', name: 'Família & Crianças', icon: 'Users', sort_order: 6, description: 'Parques com atrações ao ar livre e segurança' },
      { id: 'sunset', name: 'Pôr do Sol & Mirantes', icon: 'Sunset', sort_order: 7, description: 'Pontos altos com as vistas mais espetaculares' },
      { id: 'shopping', name: 'Compras & Capivari', icon: 'ShoppingBag', sort_order: 8, description: 'Malharias finas, artesanato e lembranças' },
      { id: 'culture', name: 'Cultura & Palácio', icon: 'Landmark', sort_order: 9, description: 'Palácio Boa Vista, museus e história' },
      { id: 'parks', name: 'Parques & Lazer', icon: 'Compass', sort_order: 10, description: 'Amantikir, Tarundu, Bosques e Horto' },
      { id: 'nightlife', name: 'Noite & Choperias', icon: 'Wine', sort_order: 11, description: 'Cervejarias artesanais e bares em Capivari' },
      { id: 'photo', name: 'Fotografia & Paisagens', icon: 'Camera', sort_order: 12, description: 'Cenários fotogênicos e arquitetura europeia' }
    ];

    const insertCat = db.prepare(`
      INSERT INTO itinerary_categories (id, name, icon, sort_order, description, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    for (const c of defaultCategories) {
      insertCat.run(c.id, c.name, c.icon, c.sort_order, c.description);
    }
    console.log(`[Itineraries] Seeded ${defaultCategories.length} itinerary categories.`);
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
      return spots.find(s => s.name.toLowerCase().includes(idOrName.toLowerCase()));
    };

    // Itinerary 1: Essência de Campos: O Clássico em 2 Dias
    const itin1Id = 'roteiro-classico-2-dias';
    db.prepare(`
      INSERT INTO itineraries (
        id, title, description, cover_image, days_count, categories,
        is_active, is_recommended, usage_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 384, ?)
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

    const s1 = findSpot('amantikir');
    const s2 = findSpot('baden-baden');
    const s3 = findSpot('chocolate-araucaria') || findSpot('chocolate') || spots[0];

    const insertStep = db.prepare(`
      INSERT INTO itinerary_steps (id, itinerary_id, day_id, spot_id, step_order, suggested_time, duration_minutes, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (s1) insertStep.run(`${day1Id}-1`, itin1Id, day1Id, s1.id, 1, '09:30', 120, 'Caminhe pelo labirinto de arbustos e aproveite a luz da manhã nos mirantes.');
    if (s2) insertStep.run(`${day1Id}-2`, itin1Id, day1Id, s2.id, 2, '13:00', 90, 'Almoço no coração do Capivari com pratos alemães e chopes artesanais.');
    if (s3) insertStep.run(`${day1Id}-3`, itin1Id, day1Id, s3.id, 3, '15:30', 60, 'Degustação dos clássicos chocolates artesanais e cafés coloniais da serra.');

    // Day 2
    const day2Id = `${itin1Id}-dia-2`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 2, 'Dia 2: Arte, Pico do Itapeva e Pôr do Sol', 'Visita ao palácio de inverno do governo e contemplação panorâmica a 2.030 metros de altitude.')
    `).run(day2Id, itin1Id);

    const s4 = findSpot('palacio-boa-vista') || findSpot('palacio') || spots[1] || spots[0];
    const s5 = findSpot('itapeva');
    const s6 = findSpot('restaurante-krokodilo') || findSpot('restaurante') || spots[2] || spots[0];

    if (s4) insertStep.run(`${day2Id}-1`, itin1Id, day2Id, s4.id, 1, '10:00', 90, 'Acervo de artistas modernistas brasileiros e arquitetura imponente.');
    if (s5) insertStep.run(`${day2Id}-2`, itin1Id, day2Id, s5.id, 2, '15:30', 90, 'Leve casaco reforçado para apreciar o pôr do sol inesquecível no mirante.');
    if (s6) insertStep.run(`${day2Id}-3`, itin1Id, day2Id, s6.id, 3, '19:30', 120, 'Jantar à luz de velas para encerrar a viagem em grande estilo.');

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

    const r1 = findSpot('amantikir') || spots[0];
    const r2 = findSpot('itapeva') || spots[1];
    const r3 = findSpot('baden-baden') || spots[2];

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

    const e1 = findSpot('tarundu') || findSpot('parque') || spots[0];
    const e2 = findSpot('horto-florestal') || findSpot('horto') || spots[1];
    if (e1) insertStep.run(`${dayEco1}-1`, itin3Id, dayEco1, e1.id, 1, '09:00', 180, 'Patinação no gelo, tirolesa e passeios entre pinheiros.');
    if (e2) insertStep.run(`${dayEco1}-2`, itin3Id, dayEco1, e2.id, 2, '14:30', 120, 'Trilhas em meio às araucárias centenárias e cachoeiras.');

    const dayEco2 = `${itin3Id}-dia-2`;
    db.prepare(`
      INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
      VALUES (?, ?, 2, 'Dia 2: Mirantes das Montanhas', 'Exploração de mirantes e fotografia panorâmica.')
    `).run(dayEco2, itin3Id);

    const e3 = findSpot('amantikir') || spots[0];
    const e4 = findSpot('itapeva') || spots[1];
    if (e3) insertStep.run(`${dayEco2}-1`, itin3Id, dayEco2, e3.id, 1, '09:30', 120, 'Jardins temáticos inspirados em diferentes países.');
    if (e4) insertStep.run(`${dayEco2}-2`, itin3Id, dayEco2, e4.id, 2, '15:00', 90, 'Pico do Itapeva com vista para as cidades do vale.');

    console.log('[Itineraries] Pre-seeded 3 curated initial travel itineraries.');
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
  // Helper to load spots map
  const getSpotsMap = () => {
    const spots = db.prepare('SELECT * FROM spots').all() as any[];
    return new Map(spots.map(s => [
      s.id,
      {
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
      }
    ]));
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
          spot: spot || null,
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

    return {
      id: itineraryRow.id,
      title: itineraryRow.title,
      description: itineraryRow.description || '',
      coverImage: itineraryRow.cover_image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
      daysCount: itineraryRow.days_count || daysHydrated.length || 1,
      categories,
      isActive: itineraryRow.is_active === 1,
      isRecommended: itineraryRow.is_recommended === 1,
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
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

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

      logAdminAction(user.id, user.name, 'Criou Categoria de Roteiro', name);
      res.json({ success: true, id, message: 'Categoria cadastrada com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao cadastrar categoria: ' + err.message });
    }
  });

  // Admin Update Category
  app.put('/api/admin/itinerary-categories/:id', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

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

      logAdminAction(user.id, user.name, 'Editou Categoria de Roteiro', `ID: ${id}`);
      res.json({ success: true, message: 'Categoria atualizada com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao atualizar categoria: ' + err.message });
    }
  });

  // Admin Delete Category
  app.delete('/api/admin/itinerary-categories/:id', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

      const { id } = req.params;
      db.prepare('DELETE FROM itinerary_categories WHERE id = ?').run(id);
      logAdminAction(user.id, user.name, 'Excluiu Categoria de Roteiro', `ID: ${id}`);
      res.json({ success: true, message: 'Categoria excluída' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao excluir categoria: ' + err.message });
    }
  });

  // ==========================================
  // CURATED ITINERARIES API
  // ==========================================

  // List all curated itineraries
  app.get('/api/itineraries', (req, res) => {
    try {
      const includeInactive = req.query.all === 'true';
      const sql = includeInactive
        ? 'SELECT * FROM itineraries ORDER BY is_recommended DESC, created_at DESC'
        : 'SELECT * FROM itineraries WHERE is_active = 1 ORDER BY is_recommended DESC, usage_count DESC';
      
      const rows = db.prepare(sql).all() as any[];
      const itineraries = rows.map(hydrateItinerary);
      res.json({ success: true, itineraries });
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
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

      const {
        title,
        description,
        coverImage,
        daysCount,
        categories,
        isActive,
        isRecommended,
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

      db.transaction(() => {
        db.prepare(`
          INSERT INTO itineraries (
            id, title, description, cover_image, days_count, categories,
            is_active, is_recommended, notes, usage_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          id,
          title,
          description || '',
          coverImage || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
          safeDaysCount,
          safeCategories,
          isActive !== undefined ? (isActive ? 1 : 0) : 1,
          isRecommended !== undefined ? (isRecommended ? 1 : 0) : 0,
          notes || ''
        );

        if (Array.isArray(days) && days.length > 0) {
          const insertDay = db.prepare(`
            INSERT INTO itinerary_days (id, itinerary_id, day_number, title, summary)
            VALUES (?, ?, ?, ?, ?)
          `);
          const insertStep = db.prepare(`
            INSERT INTO itinerary_steps (id, itinerary_id, day_id, spot_id, step_order, suggested_time, duration_minutes, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
                  s.notes || ''
                );
              });
            }
          });
        }
      })();

      logAdminAction(user.id, user.name, 'Criou Roteiro Turístico', title);
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
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

      const { id } = req.params;
      const {
        title,
        description,
        coverImage,
        daysCount,
        categories,
        isActive,
        isRecommended,
        notes,
        days
      } = req.body;

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
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          title,
          description,
          coverImage,
          daysCount ? Number(daysCount) : null,
          categories ? (Array.isArray(categories) ? JSON.stringify(categories) : categories) : null,
          isActive !== undefined ? (isActive ? 1 : 0) : null,
          isRecommended !== undefined ? (isRecommended ? 1 : 0) : null,
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
            INSERT INTO itinerary_steps (id, itinerary_id, day_id, spot_id, step_order, suggested_time, duration_minutes, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
                  s.notes || ''
                );
              });
            }
          });
        }
      })();

      logAdminAction(user.id, user.name, 'Editou Roteiro Turístico', `ID: ${id}`);
      res.json({ success: true, message: 'Roteiro atualizado com sucesso' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar roteiro: ' + err.message });
    }
  });

  // Admin Duplicate Itinerary
  app.post('/api/admin/itineraries/:id/duplicate', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

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
            is_active, is_recommended, notes, usage_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          newId,
          newTitle,
          source.description,
          source.cover_image,
          source.days_count,
          source.categories,
          0, // Start inactive
          0,
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
              INSERT INTO itinerary_steps (id, itinerary_id, day_id, spot_id, step_order, suggested_time, duration_minutes, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              newStepId,
              newId,
              newDayId,
              s.spot_id,
              s.step_order,
              s.suggested_time,
              s.duration_minutes,
              s.notes
            );
          }
        }
      })();

      logAdminAction(user.id, user.name, 'Duplicou Roteiro', `${source.title} -> ${newTitle}`);
      res.json({ success: true, id: newId, message: 'Roteiro duplicado com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao duplicar roteiro: ' + err.message });
    }
  });

  // Admin Toggle Itinerary Status (Active/Inactive)
  app.patch('/api/admin/itineraries/:id/toggle-status', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

      const { id } = req.params;
      const current = db.prepare('SELECT is_active, title FROM itineraries WHERE id = ?').get(id) as any;
      if (!current) {
        res.status(404).json({ error: 'Roteiro não encontrado' });
        return;
      }

      const nextState = current.is_active === 1 ? 0 : 1;
      db.prepare('UPDATE itineraries SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextState, id);
      logAdminAction(user.id, user.name, nextState ? 'Ativou Roteiro' : 'Desativou Roteiro', current.title);
      res.json({ success: true, isActive: nextState === 1 });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alterar status: ' + err.message });
    }
  });

  // Admin Delete Itinerary
  app.delete('/api/admin/itineraries/:id', (req, res) => {
    try {
      const user = getAuthUserSync(req);
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

      const { id } = req.params;
      const current = db.prepare('SELECT title FROM itineraries WHERE id = ?').get(id) as any;
      db.transaction(() => {
        db.prepare('DELETE FROM itinerary_steps WHERE itinerary_id = ?').run(id);
        db.prepare('DELETE FROM itinerary_days WHERE itinerary_id = ?').run(id);
        db.prepare('DELETE FROM itineraries WHERE id = ?').run(id);
      })();

      logAdminAction(user.id, user.name, 'Excluiu Roteiro', current?.title || id);
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
        rows = db.prepare('SELECT * FROM user_itineraries ORDER BY created_at DESC LIMIT 10').all() as any[];
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
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }

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

      logAdminAction(user.id, user.name, 'Atualizou Configurações do Planejador', '');
      res.json({ success: true, message: 'Configurações salvas com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao salvar configurações: ' + err.message });
    }
  });
}
