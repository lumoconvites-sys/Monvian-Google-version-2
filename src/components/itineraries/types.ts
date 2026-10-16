import { Spot, Itinerary, ItineraryDay, ItineraryStep } from '../../types';

export type WizardStep = 'date' | 'people' | 'budget' | 'tinder' | 'generating';

export interface UserTripPreferences {
  tripDate: string; // ISO date string YYYY-MM-DD or formatted
  tripDateFormatted: string;
  adultsCount: number;
  childrenCount: number;
  peopleCount: number;
  budget: string;
  likedSpots: Spot[];
}

export interface SpotCardData {
  spot: Spot;
  shortDescription: string;
  categoryDisplay: string;
  priceDisplay: string;
  isVerified: boolean;
}
