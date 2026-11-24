import React from 'react';
import { readScopedString, writeScopedString } from '../utils/userScopedStorage';

export type PresentationTab = 'explorar' | 'roteiros' | 'salvos';

export const isPresentationCardSeen = (tab: PresentationTab, userOverride?: any): boolean => {
  try {
    return readScopedString(`monvian_presentation_seen_${tab}`, userOverride) === 'true';
  } catch {
    return true;
  }
};

export const markPresentationCardSeen = (tab: PresentationTab, userOverride?: any): void => {
  try {
    writeScopedString(`monvian_presentation_seen_${tab}`, 'true', userOverride);
  } catch {}
};

interface AirbnbPresentationCardProps {
  isOpen: boolean;
  tab: PresentationTab | null;
  onClose: () => void;
  onAction?: () => void;
  theme?: string;
}

export const AirbnbPresentationCard: React.FC<AirbnbPresentationCardProps> = ({ isOpen }) => {
  if (!isOpen) return null;
  return null;
};

export default AirbnbPresentationCard;
