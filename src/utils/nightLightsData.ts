// Geographic night lights data generator for authentic "Earth at Night" urban illumination
// Inspired by Apple Maps night lights and NASA Black Marble nighttime urban imagery.

export interface NightLightPoint {
  coordinates: [number, number]; // [lng, lat]
  intensity: number; // 0.2 to 1.0
  size: number; // relative size multiplier 0.6 to 1.4
  colorType: 'warm_gold' | 'soft_amber' | 'warm_white' | 'incandescent';
  category: 'macro_city' | 'urban_core' | 'neighborhood' | 'artery' | 'rural_cluster';
  minZoom?: number;
  maxZoom?: number;
}

// Seeded PRNG for reproducible, deterministic organic scattering
function createSeededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = createSeededRandom(42918);

// Helper to generate organic cluster around center
function generateCluster(
  centerLng: number,
  centerLat: number,
  radiusLng: number,
  radiusLat: number,
  count: number,
  category: NightLightPoint['category'],
  baseIntensity: number = 0.8,
  falloffExponent: number = 1.6
): NightLightPoint[] {
  const points: NightLightPoint[] = [];

  for (let i = 0; i < count; i++) {
    // Non-linear distribution: denser near center, sparser at periphery
    const u = rng();
    const v = rng();
    const r = Math.pow(u, falloffExponent);
    const theta = v * 2 * Math.PI;

    // Elliptical organic dispersion with small random noise
    const jitterX = (rng() - 0.5) * 0.08 * radiusLng;
    const jitterY = (rng() - 0.5) * 0.08 * radiusLat;
    const lng = centerLng + r * radiusLng * Math.cos(theta) + jitterX;
    const lat = centerLat + r * radiusLat * Math.sin(theta) + jitterY;

    // Intensity gently decays with distance from center
    const distFactor = Math.max(0.2, 1.0 - Math.pow(r, 1.2) * 0.6);
    const intensity = Math.min(1.0, Math.max(0.25, baseIntensity * distFactor * (0.7 + rng() * 0.6)));
    const size = 0.6 + rng() * 0.8;

    const colorTypes: NightLightPoint['colorType'][] = [
      'warm_gold',
      'warm_gold',
      'soft_amber',
      'warm_white',
      'incandescent',
    ];
    const colorType = colorTypes[Math.floor(rng() * colorTypes.length)];

    points.push({
      coordinates: [lng, lat],
      intensity,
      size,
      colorType,
      category,
    });
  }

  return points;
}

// Helper to generate arterial corridor lights (along highways and valley roads)
function generateCorridor(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  count: number,
  spreadKm: number,
  category: NightLightPoint['category'] = 'artery',
  baseIntensity: number = 0.65
): NightLightPoint[] {
  const points: NightLightPoint[] = [];
  const kmToDeg = 0.009; // Approx 1km in degrees

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1 || 1) + (rng() - 0.5) * 0.04;
    const baseLng = startLng + (endLng - startLng) * t;
    const baseLat = startLat + (endLat - startLat) * t;

    // Organic perpendicular offset
    const perpOffset = (rng() - 0.5) * spreadKm * kmToDeg * (0.5 + rng() * 0.5);
    const perpAngle = Math.atan2(endLat - startLat, endLng - startLng) + Math.PI / 2;

    const lng = baseLng + perpOffset * Math.cos(perpAngle) + (rng() - 0.5) * 0.002;
    const lat = baseLat + perpOffset * Math.sin(perpAngle) + (rng() - 0.5) * 0.002;

    const intensity = Math.min(1.0, Math.max(0.3, baseIntensity * (0.75 + rng() * 0.5)));
    const size = 0.6 + rng() * 0.6;

    const colorTypes: NightLightPoint['colorType'][] = [
      'warm_gold',
      'soft_amber',
      'incandescent',
      'warm_white',
    ];

    points.push({
      coordinates: [lng, lat],
      intensity,
      size,
      colorType: colorTypes[Math.floor(rng() * colorTypes.length)],
      category,
    });
  }

  return points;
}

// Build comprehensive GeoJSON dataset containing regional macro lights and detailed Campos do Jordão urban lights
export function generateNightLightsGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const allPoints: NightLightPoint[] = [];

  // ==========================================
  // 1. CAMPOS DO JORDÃO (High detail local clusters)
  // ==========================================
  
  // Capivari Tourist Core (Vibrant golden center)
  allPoints.push(...generateCluster(-45.5908, -22.7335, 0.014, 0.012, 140, 'urban_core', 0.95, 1.4));
  allPoints.push(...generateCluster(-45.5860, -22.7310, 0.009, 0.008, 65, 'neighborhood', 0.85, 1.3));

  // Abernéssia Commercial Hub (Sprawling bright center)
  allPoints.push(...generateCluster(-45.6065, -22.7445, 0.018, 0.015, 160, 'urban_core', 0.95, 1.3));

  // Jaguaribe Historical & Residential Center
  allPoints.push(...generateCluster(-45.5990, -22.7390, 0.012, 0.011, 95, 'neighborhood', 0.88, 1.4));

  // Vila Inglesa & Ducha de Prata Valley
  allPoints.push(...generateCluster(-45.5680, -22.7270, 0.012, 0.009, 60, 'neighborhood', 0.8, 1.5));

  // Alto do Capivari & Morro do Elefante slope
  allPoints.push(...generateCluster(-45.5780, -22.7380, 0.010, 0.008, 45, 'neighborhood', 0.75, 1.6));

  // Vila Albertina & Vila Santa Cruz
  allPoints.push(...generateCluster(-45.6140, -22.7330, 0.014, 0.012, 70, 'neighborhood', 0.78, 1.4));

  // Recanto Feliz & Vila Sodipe
  allPoints.push(...generateCluster(-45.5830, -22.7490, 0.011, 0.009, 50, 'neighborhood', 0.75, 1.5));

  // Descansópolis & Gavião Gonzaga
  allPoints.push(...generateCluster(-45.6180, -22.7630, 0.015, 0.012, 60, 'neighborhood', 0.72, 1.6));

  // Portal de Entrada & Approach Avenue
  allPoints.push(...generateCluster(-45.6360, -22.7750, 0.012, 0.009, 50, 'artery', 0.82, 1.4));

  // Connecting Urban Arteries in Campos do Jordão (Av. Januário Miraglia, Av. Frei Orestes Girardi, Av. Emílio Ribas)
  allPoints.push(...generateCorridor(-45.6360, -22.7750, -45.6065, -22.7445, 55, 0.35, 'artery', 0.8));
  allPoints.push(...generateCorridor(-45.6065, -22.7445, -45.5990, -22.7390, 45, 0.30, 'artery', 0.85));
  allPoints.push(...generateCorridor(-45.5990, -22.7390, -45.5908, -22.7335, 45, 0.30, 'artery', 0.88));
  allPoints.push(...generateCorridor(-45.5908, -22.7335, -45.5680, -22.7270, 35, 0.28, 'artery', 0.75));

  // ==========================================
  // 2. SURROUNDING MANTIQUEIRA TOWNS
  // ==========================================
  // Santo Antônio do Pinhal
  allPoints.push(...generateCluster(-45.6660, -22.8250, 0.016, 0.014, 90, 'urban_core', 0.85, 1.4));
  allPoints.push(...generateCorridor(-45.6400, -22.7800, -45.6660, -22.8250, 30, 0.4, 'artery', 0.65));

  // São Bento do Sapucaí
  allPoints.push(...generateCluster(-45.7350, -22.6880, 0.018, 0.015, 95, 'urban_core', 0.85, 1.4));

  // Gonçalves (MG)
  allPoints.push(...generateCluster(-45.8550, -22.6600, 0.015, 0.012, 60, 'neighborhood', 0.78, 1.5));

  // Monteiro Lobato
  allPoints.push(...generateCluster(-45.8400, -22.9550, 0.015, 0.012, 50, 'neighborhood', 0.75, 1.5));

  // ==========================================
  // 3. VALE DO PARAÍBA URBAN CORRIDOR
  // ==========================================
  // Pindamonhangaba
  allPoints.push(...generateCluster(-45.4600, -22.9250, 0.040, 0.035, 170, 'urban_core', 0.9, 1.3));
  allPoints.push(...generateCluster(-45.4200, -22.9500, 0.025, 0.020, 75, 'neighborhood', 0.8, 1.4));

  // Taubaté
  allPoints.push(...generateCluster(-45.5550, -23.0250, 0.055, 0.045, 260, 'urban_core', 0.95, 1.3));
  allPoints.push(...generateCluster(-45.5100, -23.0000, 0.030, 0.025, 90, 'neighborhood', 0.82, 1.4));

  // Tremembé
  allPoints.push(...generateCluster(-45.5480, -22.9580, 0.025, 0.020, 85, 'urban_core', 0.82, 1.4));

  // São José dos Campos (Major metropolitan cluster)
  allPoints.push(...generateCluster(-45.8850, -23.1950, 0.075, 0.065, 380, 'macro_city', 0.98, 1.25));
  allPoints.push(...generateCluster(-45.8200, -23.1700, 0.045, 0.035, 120, 'neighborhood', 0.88, 1.3));

  // Jacareí
  allPoints.push(...generateCluster(-45.9650, -23.3050, 0.045, 0.038, 160, 'urban_core', 0.9, 1.3));

  // Caçapava
  allPoints.push(...generateCluster(-45.7080, -23.1000, 0.030, 0.025, 110, 'urban_core', 0.85, 1.35));

  // Guaratinguetá & Aparecida
  allPoints.push(...generateCluster(-45.1950, -22.8150, 0.038, 0.032, 160, 'urban_core', 0.9, 1.3));
  allPoints.push(...generateCluster(-45.2300, -22.8500, 0.025, 0.020, 110, 'urban_core', 0.9, 1.3));

  // Lorena & Cruzeiro
  allPoints.push(...generateCluster(-45.1200, -22.7350, 0.030, 0.025, 120, 'urban_core', 0.85, 1.35));
  allPoints.push(...generateCluster(-44.9600, -22.5750, 0.025, 0.022, 90, 'urban_core', 0.82, 1.4));

  // Rodovia Presidente Dutra urban lighting spine (Connecting Rio - SP via Vale do Paraíba)
  allPoints.push(...generateCorridor(-45.9650, -23.3050, -45.8850, -23.1950, 60, 0.8, 'artery', 0.85));
  allPoints.push(...generateCorridor(-45.8850, -23.1950, -45.7080, -23.1000, 50, 0.8, 'artery', 0.85));
  allPoints.push(...generateCorridor(-45.7080, -23.1000, -45.5550, -23.0250, 55, 0.8, 'artery', 0.85));
  allPoints.push(...generateCorridor(-45.5550, -23.0250, -45.4600, -22.9250, 45, 0.8, 'artery', 0.85));
  allPoints.push(...generateCorridor(-45.4600, -22.9250, -45.2300, -22.8500, 55, 0.8, 'artery', 0.85));
  allPoints.push(...generateCorridor(-45.2300, -22.8500, -45.1200, -22.7350, 40, 0.8, 'artery', 0.85));

  // SP-123 Floriano Rodrigues Pinheiro (Highway linking Taubaté to Campos do Jordão)
  allPoints.push(...generateCorridor(-45.5700, -22.9800, -45.6360, -22.7750, 65, 0.5, 'artery', 0.8));

  // ==========================================
  // 4. MACRO REGIONAL CITIES (Matching Reference IMG_7031 - Earth at Night)
  // ==========================================
  // São Paulo Mega Metropolis (Vast glowing web)
  allPoints.push(...generateCluster(-46.6333, -23.5505, 0.18, 0.15, 650, 'macro_city', 1.0, 1.2));
  allPoints.push(...generateCluster(-46.5300, -23.4700, 0.08, 0.07, 180, 'macro_city', 0.95, 1.3)); // Guarulhos
  allPoints.push(...generateCluster(-46.5300, -23.6600, 0.09, 0.08, 220, 'macro_city', 0.95, 1.3)); // ABC Paulista
  allPoints.push(...generateCluster(-46.7900, -23.5300, 0.08, 0.07, 160, 'macro_city', 0.92, 1.3)); // Osasco / Barueri

  // Campinas Metropolitan Area
  allPoints.push(...generateCluster(-47.0608, -22.9056, 0.09, 0.08, 320, 'macro_city', 0.98, 1.25));
  allPoints.push(...generateCluster(-46.9900, -22.9700, 0.04, 0.04, 80, 'macro_city', 0.88, 1.4)); // Valinhos / Vinhedo
  allPoints.push(...generateCluster(-47.1600, -22.8200, 0.04, 0.04, 90, 'macro_city', 0.88, 1.4)); // Sumaré / Hortolândia

  // Santos & Baixada Santista Coast
  allPoints.push(...generateCluster(-46.3333, -23.9608, 0.08, 0.04, 220, 'macro_city', 0.95, 1.3));
  allPoints.push(...generateCluster(-46.4100, -24.0100, 0.06, 0.03, 100, 'macro_city', 0.88, 1.4)); // Praia Grande

  // Rio de Janeiro & Baixada
  allPoints.push(...generateCluster(-43.1729, -22.9068, 0.14, 0.10, 480, 'macro_city', 1.0, 1.25));
  allPoints.push(...generateCluster(-43.3500, -22.7800, 0.10, 0.08, 220, 'macro_city', 0.92, 1.3)); // Baixada Fluminense
  allPoints.push(...generateCluster(-43.1000, -22.8800, 0.06, 0.05, 130, 'macro_city', 0.9, 1.3)); // Niterói

  // Belo Horizonte Metropolitan Area
  allPoints.push(...generateCluster(-43.9378, -19.9208, 0.11, 0.09, 380, 'macro_city', 0.98, 1.25));
  allPoints.push(...generateCluster(-44.0500, -19.9300, 0.06, 0.05, 140, 'macro_city', 0.9, 1.3)); // Contagem

  // Curitiba
  allPoints.push(...generateCluster(-49.2731, -25.4284, 0.10, 0.09, 340, 'macro_city', 0.98, 1.25));

  // Brasília
  allPoints.push(...generateCluster(-47.8825, -15.7942, 0.09, 0.08, 300, 'macro_city', 0.98, 1.3));
  allPoints.push(...generateCluster(-48.0500, -15.8300, 0.07, 0.06, 160, 'macro_city', 0.92, 1.3)); // Taguatinga/Ceilândia

  // Goiânia
  allPoints.push(...generateCluster(-49.2648, -16.6869, 0.08, 0.07, 260, 'macro_city', 0.95, 1.3));

  // Porto Alegre
  allPoints.push(...generateCluster(-51.2177, -30.0346, 0.09, 0.08, 290, 'macro_city', 0.96, 1.3));

  // Salvador
  allPoints.push(...generateCluster(-38.5016, -12.9777, 0.09, 0.08, 280, 'macro_city', 0.96, 1.3));

  // Fortaleza
  allPoints.push(...generateCluster(-38.5433, -3.7172, 0.09, 0.08, 280, 'macro_city', 0.96, 1.3));

  // Teresina & São Luís
  allPoints.push(...generateCluster(-42.8019, -5.0920, 0.05, 0.05, 120, 'macro_city', 0.9, 1.35));
  allPoints.push(...generateCluster(-44.3028, -2.5307, 0.06, 0.05, 140, 'macro_city', 0.9, 1.35));

  // Natal & Recife
  allPoints.push(...generateCluster(-35.2094, -5.7945, 0.06, 0.05, 150, 'macro_city', 0.92, 1.35));
  allPoints.push(...generateCluster(-34.8770, -8.0476, 0.09, 0.08, 260, 'macro_city', 0.96, 1.3));

  // Campo Grande
  allPoints.push(...generateCluster(-54.6201, -20.4697, 0.06, 0.05, 160, 'macro_city', 0.92, 1.35));

  // Convert to GeoJSON FeatureCollection
  const features: GeoJSON.Feature<GeoJSON.Point>[] = allPoints.map((pt, idx) => ({
    type: 'Feature',
    id: idx,
    geometry: {
      type: 'Point',
      coordinates: pt.coordinates,
    },
    properties: {
      intensity: pt.intensity,
      size: pt.size,
      colorType: pt.colorType,
      category: pt.category,
    },
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}
