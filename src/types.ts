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
}

