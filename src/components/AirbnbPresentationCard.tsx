import React from 'react';

interface AirbnbPresentationCardProps {
  isOpen: boolean;
  tab: string | null;
  onClose: () => void;
  onAction?: () => void;
  theme?: string;
}

export const AirbnbPresentationCard: React.FC<AirbnbPresentationCardProps> = ({ isOpen }) => {
  if (!isOpen) return null;
  return null;
};
export default AirbnbPresentationCard;
