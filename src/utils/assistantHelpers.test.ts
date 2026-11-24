import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAssistantStorageKey,
  orderSpotsByProximity,
  selectSmartItinerarySpots,
  type AssistantSpotCandidate,
} from './assistantHelpers';

const SAMPLE_SPOTS: AssistantSpotCandidate[] = [
  {
    id: '1',
    name: 'Parque Amantikir',
    category: 'nature',
    categoryLabel: 'Parques & Natureza',
    priceRange: '$$',
    price: 'R$ 80',
    rating: 4.9,
    lat: -22.7839,
    lng: -45.6056,
    description: 'Jardins românticos e mirantes incríveis em Campos do Jordão.',
    highlighted: true,
  },
  {
    id: '2',
    name: 'Vila Capivari',
    category: 'culture',
    categoryLabel: 'Passeio & Cultura',
    priceRange: '$',
    price: 'Gratuito',
    rating: 4.8,
    lat: -22.7192,
    lng: -45.5669,
    description: 'Centro turístico charmoso com arquitetura europeia e lojas.',
  },
  {
    id: '3',
    name: 'Morro do Elefante',
    category: 'viewpoints',
    categoryLabel: 'Mirantes',
    priceRange: '$',
    price: 'Gratuito',
    rating: 4.7,
    lat: -22.7158,
    lng: -45.5621,
    description: 'Mirante clássico pertinho do Capivari com teleférico e vista panorâmica.',
  },
  {
    id: '4',
    name: 'Restaurante Libertango',
    category: 'restaurants',
    categoryLabel: 'Alta Gastronomia',
    priceRange: '$$$$',
    price: 'R$ 240',
    rating: 4.9,
    lat: -22.7181,
    lng: -45.5648,
    description: 'Jantar romântico sofisticado com cortes nobres e carta de vinhos.',
    highlighted: true,
  },
];

test('getAssistantStorageKey isolates state per authenticated user id or email', () => {
  const keyA = getAssistantStorageKey({ id: 'user-101', email: 'alice@monvian.com' });
  const keyB = getAssistantStorageKey({ id: 'user-202', email: 'bob@monvian.com' });
  const keyGuest = getAssistantStorageKey(null);

  assert.notEqual(keyA, keyB);
  assert.notEqual(keyA, keyGuest);
  assert.ok(keyA.includes('user-101'));
  assert.ok(keyB.includes('user-202'));
});

test('orderSpotsByProximity orders spots by geographic closeness instead of jumping back and forth', () => {
  // Start near Vila Capivari (-22.7192, -45.5669). Amantikir (-22.7839) is far away (~7.5km).
  // Libertango (-22.7181) and Morro do Elefante (-22.7158) are right next to Capivari.
  const unordered = [SAMPLE_SPOTS[1], SAMPLE_SPOTS[0], SAMPLE_SPOTS[3], SAMPLE_SPOTS[2]];
  const ordered = orderSpotsByProximity(unordered, { lat: -22.7192, lng: -45.5669 });

  assert.equal(ordered[0].id, '2'); // Vila Capivari first
  assert.equal(ordered[1].id, '4'); // Libertango next (~0.25km)
  assert.equal(ordered[2].id, '3'); // Morro do Elefante next (~0.38km)
  assert.equal(ordered[3].id, '1'); // Parque Amantikir last (~7.5km)
});

test('selectSmartItinerarySpots validates real spot IDs and strips hallucinated IDs', () => {
  const chosen = selectSmartItinerarySpots(SAMPLE_SPOTS, {
    requestedSpotIds: ['invalid-999', '2', '3', 'non-existent'],
    style: 'romantico',
    budgetTier: 'economico',
    limit: 3,
  });

  assert.equal(chosen.length, 2);
  assert.ok(chosen.every((s) => s.id === '2' || s.id === '3'));
});

test('selectSmartItinerarySpots selects appropriate spots for premium romantic itinerary when no explicit IDs passed', () => {
  const chosen = selectSmartItinerarySpots(SAMPLE_SPOTS, {
    style: 'roteiro romantico casal',
    budgetTier: 'premium',
    limit: 3,
  });

  assert.equal(chosen.length, 3);
  const ids = chosen.map((s) => s.id);
  assert.ok(ids.includes('4') || ids.includes('1'));
});
