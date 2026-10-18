import React from 'react';
import { MapModeType } from '../../types';

interface DesktopMapControlsProps {
  currentMode?: MapModeType;
  onChangeMode?: (mode: MapModeType) => void;
  is3DMode: boolean;
  onToggle3DMode: () => void;
  onRecenter?: () => void;
  realWeather?: {
    temperature: number;
    condition: string;
    weatherCode: number;
    isDay: boolean;
  };
}

export const DesktopMapControls: React.FC<DesktopMapControlsProps> = () => {
  // Removed from desktop mode per user request
  return null;
};

export default DesktopMapControls;
