import React from 'react';

export type PresentationTab = 'explorar' | 'roteiros' | 'salvos';

export const isPresentationCardSeen = (tab: PresentationTab): boolean => {
  try {
    return localStorage.getItem(`monvian_presentation_seen_${tab}`) === 'true';
  } catch {
    return true;
  }
};

export const markPresentationCardSeen = (tab: PresentationTab): void => {
  try {
    localStorage.setItem(`monvian_presentation_seen_${tab}`, 'true');
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
