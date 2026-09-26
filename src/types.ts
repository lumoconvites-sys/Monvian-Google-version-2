export type MapModeType = 'explorar' | 'carro' | 'transporte' | 'animado' | 'satelite';

export type SpotCategory = 
  | 'hotels'
  | 'restaurants'
  | 'cafes'
  | 'sweets'
  | 'attractions'
  | 'events'
  | 'pharmacies'
  | 'nature' 
  | 'gastronomy' 
  | 'culture' 
  | 'parks' 
  | 'viewpoint' 
  | 'services';

export interface MapsGroundingPlace {
  title: string;
  uri: string;
  address?: string;
  reviewSnippet?: string;
}

export interface Spot {
  id: string;
  name: string;
  shortName: string;
  tagLabel: string;
  category: SpotCategory;
  categoryLabel: string;
  lat: number;
  lng: number;
  image: string;
  gallery?: string[];
  description: string;
  touristTip: string;
  rating: number;
  reviewCount: number;
  hours: string;
  address: string;
  priceRange?: 'Grátis' | '$' | '$$' | '$$$' | '$$$$';
  popularTimes?: string;
  visitorsToday: number;
  badge?: string;
  highlighted?: boolean;
  availableForItinerary?: boolean;
  durationMinutes?: number;
  tags?: string[];
  price?: string;
  mapsUrl?: string;
  googleRating?: number;
  googleReviewSnippet?: string;
  lastSyncedMaps?: string;
  website?: string;
  phone?: string;
}

export interface WeatherInfo {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  altitude: string;
  thermalSensation: number;
  rainChance: number;
  forecast: {
    day: string;
    temp: number;
    icon: string;
  }[];
}

export interface ChatMessage {
  id: string;
  author: string;
  avatar: string;
  text: string;
  time: string;
  location?: string;
  likes: number;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  groundingPlaces?: MapsGroundingPlace[];
}

export interface UserPreferences {
  referral_source?: string;
  travel_frequency?: string;
  travel_style?: string;
  main_interests?: string[];
  preferred_season?: string;
  onboarding_completed_at?: string;
}

export interface User {
  id: number;
  name: string;
  email?: string;
  whatsapp?: string;
  role: 'admin' | 'user' | 'creator';
  is_banned?: number;
  avatar_url?: string;
  visits_count?: number;
  last_access?: string;
  created_at?: string;
  onboarding_completed?: boolean;
  onboarding_step?: number;
  referral_source?: string;
  travel_frequency?: string;
  travel_style?: string;
  main_interests?: string[];
  preferred_season?: string;
  onboarding_completed_at?: string;
}

export interface MapVisualIcon {
  id: string;
  category: string;
  icon: string;
  latitude: number;
  longitude: number;
  color?: string;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export interface ItineraryCategory {
  id: string;
  name: string;
  icon: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ItineraryStep {
  id: string;
  itineraryId?: string;
  dayId?: string;
  dayNumber?: number;
  spotId: string;
  stepOrder: number;
  suggestedTime: string;
  durationMinutes: number;
  notes?: string;
  spot?: Spot;
  distanceToNextKm?: number;
  durationToNextMin?: number;
  isPinned?: boolean;
  pinnedAt?: number;
}

export interface ItineraryDay {
  id: string;
  itineraryId?: string;
  dayNumber: number;
  title: string;
  summary?: string;
  steps: ItineraryStep[];
}

export interface Itinerary {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  daysCount: number;
  categories: string[];
  isActive: boolean;
  isRecommended: boolean;
  usageCount: number;
  notes?: string;
  days: ItineraryDay[];
  placesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserItinerary {
  id: string;
  userId?: number;
  sessionId?: string;
  title: string;
  description?: string;
  coverImage?: string;
  daysCount: number;
  tripDate?: string;
  pace: 'Relaxado' | 'Equilibrado' | 'Intenso';
  hasCar: boolean;
  lessWalking: boolean;
  prioritizeFood: boolean;
  prioritizeAttractions: boolean;
  preferencesJson?: string;
  itineraryDataJson?: string;
  days: ItineraryDay[];
  createdAt: string;
  updatedAt?: string;
}

export interface ItineraryPreferences {
  categories: string[];
  selectedSpotIds: string[];
  daysCount: number;
  tripDate?: string;
  pace: 'Relaxado' | 'Equilibrado' | 'Intenso';
  startTime: string;
  endTime: string;
  hasCar: boolean;
  lessWalking: boolean;
  prioritizeFood: boolean;
  prioritizeAttractions: boolean;
}

