import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.store.delete(String(key));
  }

  clear(): void {
    this.store.clear();
  }
}

const mockLocalStorage = new MemoryStorage();
const mockSessionStorage = new MemoryStorage();

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).sessionStorage = mockSessionStorage;

import {
  getActiveUserScope,
  getScopedStorageKey,
  purgeLegacyUnscopedActivityKeys,
  purgeScopedKeysForUser,
  readScopedJSON,
  readScopedString,
  readUserCategoryFilter,
  readUserSearchCategoryFilter,
  readUserSearchQuery,
  writeScopedJSON,
  writeScopedString,
  writeUserCategoryFilter,
  writeUserSearchCategoryFilter,
  writeUserSearchQuery,
} from './userScopedStorage';
import { favoritesManager } from '../services/favoritesManager';
import {
  getOrCreateItinerarySessionId,
  loadActiveItineraryFromStorage,
  loadUserCreatedItinerariesFromStorage,
  saveActiveItineraryToStorage,
  saveUserCreatedItinerariesToStorage,
} from './itineraryHelpers';
import {
  loadGeolocationNotificationsHistory,
  saveGeolocationNotificationsHistory,
} from '../services/geolocationNotifications';
import { clearSyncSessionStorage } from './persistentAuthStorage';

function loginMockAccount(user: { id: number | string; email: string; name?: string }, token: string) {
  mockLocalStorage.setItem('monvian_token', token);
  mockLocalStorage.setItem('monvian_user', JSON.stringify(user));
  favoritesManager.setActiveAccount(user);
}

function logoutMockAccount() {
  clearSyncSessionStorage();
  favoritesManager.reset();
}

test('Scenario 1 & 2: Account A selects "Farmácias" filter -> logs out -> Account B logs in and starts with clean unselected filters', () => {
  mockLocalStorage.clear();
  mockSessionStorage.clear();

  const accountA = { id: 101, email: 'conta.a@monvian.com', name: 'Conta A' };
  const accountB = { id: 202, email: 'conta.b@monvian.com', name: 'Conta B' };

  // 1. Account A logs in and selects "Farmácias" (pharmacies) + search filters
  loginMockAccount(accountA, 'token-account-a');
  writeUserCategoryFilter('pharmacies', accountA);
  writeUserSearchCategoryFilter('farmacias', accountA);
  writeUserSearchQuery('Drogaria', accountA);

  assert.equal(readUserCategoryFilter(accountA), 'pharmacies');
  assert.equal(readUserSearchCategoryFilter(accountA), 'farmacias');
  assert.equal(readUserSearchQuery(accountA), 'Drogaria');

  // 2. Account A logs out
  logoutMockAccount();

  // While logged out, no category filter is active
  assert.equal(getActiveUserScope(), null);
  assert.equal(readUserCategoryFilter(), null);
  assert.equal(readUserSearchCategoryFilter(), null);
  assert.equal(readUserSearchQuery(), '');

  // 3. Account B logs in on the exact same device
  loginMockAccount(accountB, 'token-account-b');

  // Account B MUST start with clean default filters (null), never inheriting "Farmácias"
  assert.equal(readUserCategoryFilter(accountB), null);
  assert.equal(readUserCategoryFilter(), null);
  assert.equal(readUserSearchCategoryFilter(accountB), null);
  assert.equal(readUserSearchQuery(accountB), '');
});

test('Scenario 3 & 4: Account B selects "Restaurantes" -> Account A and Account B each retain exclusively their own filters across logins', () => {
  mockLocalStorage.clear();
  mockSessionStorage.clear();

  const accountA = { id: 101, email: 'conta.a@monvian.com', name: 'Conta A' };
  const accountB = { id: 202, email: 'conta.b@monvian.com', name: 'Conta B' };

  // Account A selects "pharmacies"
  loginMockAccount(accountA, 'token-account-a');
  writeUserCategoryFilter('pharmacies');
  logoutMockAccount();

  // Account B logs in, verifies clean state, selects "restaurants"
  loginMockAccount(accountB, 'token-account-b');
  assert.equal(readUserCategoryFilter(), null);
  writeUserCategoryFilter('restaurants');
  assert.equal(readUserCategoryFilter(), 'restaurants');

  // Account B logs out and logs back in -> "restaurants" is preserved for Account B
  logoutMockAccount();
  loginMockAccount(accountB, 'token-account-b');
  assert.equal(readUserCategoryFilter(), 'restaurants');

  // Switch back to Account A -> "pharmacies" is preserved exclusively for Account A
  logoutMockAccount();
  loginMockAccount(accountA, 'token-account-a');
  assert.equal(readUserCategoryFilter(), 'pharmacies');
});

test('Scenario 5: Brand-new Account C (isNewAccount purge) starts with zero inherited filters or preferences even if stale keys existed', () => {
  mockLocalStorage.clear();
  mockSessionStorage.clear();

  const accountA = { id: 101, email: 'conta.a@monvian.com', name: 'Conta A' };
  const newAccountC = { id: 303, email: 'nova.conta@monvian.com', name: 'Nova Conta C' };

  // Account A leaves active data on the device
  loginMockAccount(accountA, 'token-account-a');
  writeUserCategoryFilter('pharmacies', accountA);
  favoritesManager.toggleSpot('spot-vila-capivari');

  // Simulate any stale or pre-existing scoped key for Account C before registration completes
  writeUserCategoryFilter('hotels', newAccountC);
  writeScopedString('monvian_trip_note_campos', 'Nota antiga', newAccountC);
  assert.equal(readUserCategoryFilter(newAccountC), 'hotels');

  // New account creation flow executes purgeScopedKeysForUser(newAccountC)
  logoutMockAccount();
  loginMockAccount(newAccountC, 'token-account-c');
  purgeScopedKeysForUser(newAccountC);
  favoritesManager.setActiveAccount(newAccountC);

  // Brand-new Account C has strictly default state
  assert.equal(readUserCategoryFilter(newAccountC), null);
  assert.equal(readUserCategoryFilter(), null);
  assert.equal(readScopedString('monvian_trip_note_campos', newAccountC), null);
  assert.deepEqual(favoritesManager.getState(), {
    itineraries: [],
    spots: [],
    places: [],
  });

  // Account A's persisted data remains untouched in Account A's scope
  assert.equal(readUserCategoryFilter(accountA), 'pharmacies');
});

test('Scenario 6: Complete isolation of Favorites, Active Itinerary, Custom Itineraries, Session IDs, Trip Notes, and Geolocation Notifications', () => {
  mockLocalStorage.clear();
  mockSessionStorage.clear();

  const accountA = { id: 101, email: 'conta.a@monvian.com', name: 'Conta A' };
  const accountB = { id: 202, email: 'conta.b@monvian.com', name: 'Conta B' };

  // 1. Account A logs in and populates all personal features
  loginMockAccount(accountA, 'token-account-a');
  favoritesManager.toggleSpot('spot-horto-florestal');
  favoritesManager.toggleItinerary('itin-romantico');
  const sessionA = getOrCreateItinerarySessionId();
  writeScopedString('monvian_trip_note_campos', 'Roteiro especial da Conta A');
  saveActiveItineraryToStorage({
    id: 'itin-a-1',
    title: 'Roteiro Exclusivo Conta A',
    description: 'Privado A',
    duration: '1 dia',
    totalTime: '4h',
    category: 'Casal',
    image: '',
    stops: [],
    days: [{ id: 'day-1', dayNumber: 1, title: 'Dia 1', steps: [] }],
  } as any);
  saveUserCreatedItinerariesToStorage([
    {
      id: 'custom-a-1',
      title: 'Personalizado Conta A',
      description: 'Criado pela Conta A',
      duration: '1 dia',
      totalTime: '3h',
      category: 'Gastronomia',
      image: '',
      stops: [],
      days: [{ id: 'day-1', dayNumber: 1, title: 'Dia 1', steps: [] }],
    } as any,
  ]);
  saveGeolocationNotificationsHistory([
    {
      id: 'notif-a-1',
      spotId: 'spot-1',
      spotName: 'Parque Capivari',
      title: 'Você chegou ao Parque Capivari',
      imageUrl: '/images/parque-capivari.jpg',
      createdAt: new Date().toISOString(),
      isRead: false,
    },
  ]);

  assert.deepEqual(favoritesManager.getState().spots, ['spot-horto-florestal']);
  assert.equal(loadActiveItineraryFromStorage()?.id, 'itin-a-1');
  assert.equal(loadUserCreatedItinerariesFromStorage().length, 1);
  assert.equal(loadGeolocationNotificationsHistory().length, 1);

  // 2. Account A logs out and Account B logs in
  logoutMockAccount();
  loginMockAccount(accountB, 'token-account-b');

  // Account B MUST NOT see any data from Account A
  assert.deepEqual(favoritesManager.getState(), {
    itineraries: [],
    spots: [],
    places: [],
  });
  assert.equal(loadActiveItineraryFromStorage(), null);
  assert.deepEqual(loadUserCreatedItinerariesFromStorage(), []);
  assert.equal(readScopedString('monvian_trip_note_campos'), null);
  assert.deepEqual(loadGeolocationNotificationsHistory(), []);
  const sessionB = getOrCreateItinerarySessionId();
  assert.notEqual(sessionA, sessionB);

  // 3. Account B saves its own favorite and custom itinerary
  favoritesManager.toggleSpot('spot-baden-baden');
  saveUserCreatedItinerariesToStorage([
    {
      id: 'custom-b-1',
      title: 'Personalizado Conta B',
      description: 'Criado pela Conta B',
      duration: '2 dias',
      totalTime: '6h',
      category: 'Aventura',
      image: '',
      stops: [],
    } as any,
  ]);

  // 4. Switch back to Account A and verify zero cross-contamination
  logoutMockAccount();
  loginMockAccount(accountA, 'token-account-a');

  assert.deepEqual(favoritesManager.getState().spots, ['spot-horto-florestal']);
  assert.deepEqual(favoritesManager.getState().itineraries, ['itin-romantico']);
  assert.equal(loadActiveItineraryFromStorage()?.id, 'itin-a-1');
  assert.equal(loadUserCreatedItinerariesFromStorage()[0]?.id, 'custom-a-1');
  assert.equal(readScopedString('monvian_trip_note_campos'), 'Roteiro especial da Conta A');
  assert.equal(loadGeolocationNotificationsHistory()[0]?.id, 'notif-a-1');
});

test('Scenario 7: Legacy unscoped keys are purged and same-email different-ID accounts cannot collide', () => {
  mockLocalStorage.clear();

  // Simulate legacy unscoped keys left on device from older versions
  mockLocalStorage.setItem('monvian_selected_category_filter', 'pharmacies');
  mockLocalStorage.setItem('monvian_saved_spots', JSON.stringify(['legacy-spot']));
  mockLocalStorage.setItem('monvian_user_itinerary_legacy', JSON.stringify({ id: 'legacy' }));

  purgeLegacyUnscopedActivityKeys();

  assert.equal(mockLocalStorage.getItem('monvian_selected_category_filter'), null);
  assert.equal(mockLocalStorage.getItem('monvian_saved_spots'), null);
  assert.equal(mockLocalStorage.getItem('monvian_user_itinerary_legacy'), null);

  // Verify two distinct user IDs produce distinct storage keys even if email were recycled
  const scopeUser1 = getScopedStorageKey('monvian_selected_category_filter', {
    id: 5001,
    email: 'user@monvian.com',
  });
  const scopeUser2 = getScopedStorageKey('monvian_selected_category_filter', {
    id: 5002,
    email: 'user@monvian.com',
  });
  assert.notEqual(scopeUser1, scopeUser2);

  // Verify readScopedJSON does not leak when unauthenticated
  logoutMockAccount();
  assert.deepEqual(readScopedJSON('monvian_saved_spots', []), []);
  writeScopedJSON('monvian_saved_spots', ['should-not-write-when-logged-out']);
  assert.deepEqual(readScopedJSON('monvian_saved_spots', []), []);
});
