import React from 'react';
import { Itinerary } from '../../types';
import { AirbnbItineraryExplorer } from './AirbnbItineraryExplorer';

interface ItineraryStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyItinerary: (itinerary: Itinerary) => Promise<void>;
  theme?: 'dark' | 'light';
}

export const ItineraryStoreModal: React.FC<ItineraryStoreModalProps> = ({
  isOpen,
  onClose,
  onApplyItinerary,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] w-full h-full overflow-hidden select-none bg-[#0B0C0E]">
      <AirbnbItineraryExplorer
        onSelectItinerary={async (itin) => {
          await onApplyItinerary(itin);
          onClose();
        }}
        onOpenMap={onClose}
        theme={theme}
      />
    </div>
  );
};
