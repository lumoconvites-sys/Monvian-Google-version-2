import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Spot, SpotCategory, MapModeType, MapVisualIcon } from '../types';
import { Layers, Plus, Minus, Compass } from 'lucide-react';
import { CompassIcon } from './CompassIcon';
import { motion, AnimatePresence } from 'motion/react';
import { playPinTapSound } from '../utils/sound';
import { generateMarkerHtml } from '../utils/mapVisualIcons';
import { setupNightLights, removeNightLights, getNightLightsData } from '../utils/nightLightsLayer';
import { setupFerrisWheel3D } from '../utils/ferrisWheel3DLayer';
import { deviceHeadingManager } from '../utils/deviceHeading';
import { gpsNavigationManager } from '../services/gpsNavigation';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import robotAvatar from '../assets/images/ai_robot_avatar_1790114566623.jpg';
import { getCachedGeoData, isWithinCamposRadius } from '../utils/geoCache';

interface MapComponentProps {
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot | null) => void;
  userCoords: [number, number];
  theme: 'dark' | 'light';
  visualIcons?: MapVisualIcon[];
  userAvatar?: string;
  userName?: string;
  highContrast?: boolean;
  onMapLoad?: () => void;
  onMapClick?: () => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  zoomToUserTrigger?: number;
  onStyleChange?: (style: MapModeType) => void;
  onReturnToChat?: () => void;
  is3DMode?: boolean;
  onOrbitChange?: (orbiting: boolean) => void;
  isDetailOpen?: boolean;
}

// Initial camera configuration focused on the user
const CAMPOS_OVERVIEW_CAMERA = {
  center: [-45.5870, -22.7355] as [number, number],
  zoom: 15.2,
  pitch: 52,
  bearing: -13,
};

export type { MapModeType };

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim();

const createStyle = (type: MapModeType, theme: 'dark' | 'light' = 'dark'): maplibregl.StyleSpecification => {
  if (MAPBOX_TOKEN) {
    let tilePath = theme === 'light' ? 'streets-v12' : 'dark-v11';
    if (type === 'satelite') tilePath = 'satellite-streets-v12';
    if (type === 'carro') tilePath = theme === 'light' ? 'navigation-day-v1' : 'navigation-night-v1';
    if (type === 'transporte' || type === 'animado') tilePath = 'streets-v12';
    if (type === 'explorar') tilePath = theme === 'light' ? 'streets-v12' : 'dark-v11';

    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'mapbox-tiles': {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/${tilePath}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
          ],
          tileSize: 256,
          attribution: '&copy; Mapbox &copy; OpenStreetMap',
        },
      },
      layers: [
        {
          id: 'mapbox-layer',
          type: 'raster',
          source: 'mapbox-tiles',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };
  }

  // Satélite: High-resolution Esri Satellite imagery calibrated +40% brighter with visible street labels
  if (type === 'satelite') {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        },
        'esri-reference': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-brightness-min': 0.22, // +40% mais claro nas sombras e relevos
            'raster-brightness-max': 1.0,
            'raster-contrast': 0.18,       // Nitidez ampliada para topografia e vias
            'raster-saturation': 0.26,     // Cores vivas
          },
        },
        {
          id: 'esri-reference-layer',
          type: 'raster',
          source: 'esri-reference',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-opacity': 0.95,
          },
        },
      ],
    };
  }

  // Animado / Transporte: Colorful illustrated map (Always bright/illustrated with +40% green saturation)
  if (type === 'transporte' || type === 'animado') {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'osm-transport': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-transport-layer',
          type: 'raster',
          source: 'osm-transport',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-contrast': 0.18,
            'raster-brightness-min': 0.0,
            'raster-brightness-max': 1.0,
            'raster-saturation': 1.0, // Max saturation (+40% boosted)
            'raster-hue-rotate': 10,
          },
        },
      ],
    };
  }

  if (theme === 'light') {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'osm-base': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-base-layer',
          type: 'raster',
          source: 'osm-base',
          minzoom: 0,
          maxzoom: 20,
          paint: {
            'raster-contrast': 0.1,
            'raster-brightness-min': 0.0,
            'raster-brightness-max': 1.0,
            'raster-saturation': 0.0, // Natural colors, zero fluorescence
          },
        },
      ],
    };
  }

  // Dark mode fallback (without Mapbox token): Clean dark slate map using OSM tiles (No Carto API key required!)
  const nightLightsData = getNightLightsData();
  return {
    version: 8,
    projection: { type: 'globe' } as any,
    sources: {
      'osm-base': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      },
      'nasa-night-lights': {
        type: 'raster',
        tiles: [
          'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
        ],
        tileSize: 256,
        maxzoom: 8,
        attribution: '&copy; NASA Earth at Night / VIIRS Black Marble',
      },
      'monvian-night-lights-source': {
        type: 'geojson',
        data: nightLightsData,
      },
    },
    layers: [
      {
        id: 'osm-base-layer',
        type: 'raster',
        source: 'osm-base',
        minzoom: 0,
        maxzoom: 20,
        paint: {
          'raster-contrast': 0.35,
          'raster-brightness-min': 0.05,
          'raster-brightness-max': 0.3, // Deep dark slate background
          'raster-saturation': -0.95,   // Desaturated clean dark theme
          'raster-hue-rotate': 180,     // Elegant dark night styling
        },
      },
      {
        id: 'nasa-night-lights-layer',
        type: 'raster',
        source: 'nasa-night-lights',
        minzoom: 0,
        maxzoom: 12,
        paint: {
          'raster-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 0.95,
            3, 0.95,
            6, 0.85,
            8, 0.65,
            9.5, 0.35,
            11.0, 0.0,
          ],
          'raster-resampling': 'linear',
        },
      },
      {
        id: 'monvian-night-lights-glow',
        type: 'circle',
        source: 'monvian-night-lights-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['exponential', 1.35],
            ['zoom'],
            1, 3.5,
            3, 7.0,
            6, 12.0,
            10, 20.0,
            12, 28.0,
            14, 34.0,
            16, 40.0,
          ],
          'circle-color': [
            'match',
            ['get', 'colorType'],
            'warm_gold', '#FFD269',
            'soft_amber', '#FFA940',
            'warm_white', '#FFF1B8',
            'incandescent', '#FFE58F',
            '#FFD269',
          ],
          'circle-blur': 0.75,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, ['*', ['get', 'intensity'], 0.45],
            3, ['*', ['get', 'intensity'], 0.55],
            6, ['*', ['get', 'intensity'], 0.50],
            10, ['*', ['get', 'intensity'], 0.45],
            12, ['*', ['get', 'intensity'], 0.40],
            14, ['*', ['get', 'intensity'], 0.30],
            16, ['*', ['get', 'intensity'], 0.20],
          ],
        },
      },
      {
        id: 'monvian-night-lights-core',
        type: 'circle',
        source: 'monvian-night-lights-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, ['*', ['get', 'size'], 2.0],
            3, ['*', ['get', 'size'], 2.8],
            6, ['*', ['get', 'size'], 3.6],
            10, ['*', ['get', 'size'], 4.5],
            12, ['*', ['get', 'size'], 5.2],
            14, ['*', ['get', 'size'], 4.2],
            16, ['*', ['get', 'size'], 3.0],
          ],
          'circle-color': [
            'match',
            ['get', 'colorType'],
            'warm_gold', '#FFE082',
            'soft_amber', '#FFC107',
            'warm_white', '#FFF8E1',
            'incandescent', '#FFECB3',
            '#FFE082',
          ],
          'circle-blur': 0.15,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, ['*', ['get', 'intensity'], 0.90],
            3, ['*', ['get', 'intensity'], 0.98],
            6, ['*', ['get', 'intensity'], 0.98],
            10, ['*', ['get', 'intensity'], 0.95],
            12, ['*', ['get', 'intensity'], 0.90],
            14, ['*', ['get', 'intensity'], 0.80],
            16, ['*', ['get', 'intensity'], 0.60],
          ],
        },
      },
      {
        id: 'monvian-night-lights-fine',
        type: 'circle',
        source: 'monvian-night-lights-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, ['*', ['get', 'size'], 1.2],
            8, ['*', ['get', 'size'], 2.2],
            11, ['*', ['get', 'size'], 3.2],
            13, ['*', ['get', 'size'], 3.8],
            15, ['*', ['get', 'size'], 3.0],
            17, ['*', ['get', 'size'], 2.0],
          ],
          'circle-color': [
            'match',
            ['get', 'colorType'],
            'warm_gold', '#FFF2B2',
            'soft_amber', '#FFD56B',
            'warm_white', '#FFFFFF',
            'incandescent', '#FFE7A0',
            '#FFF2B2',
          ],
          'circle-blur': 0.12,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4.0, 0.0,
            6.0, ['*', ['get', 'intensity'], 0.60],
            9.0, ['*', ['get', 'intensity'], 0.95],
            12.0, ['*', ['get', 'intensity'], 0.90],
            14.5, ['*', ['get', 'intensity'], 0.75],
            16.5, ['*', ['get', 'intensity'], 0.50],
          ],
        },
      },
    ],
  };
};

// Beautiful vector thumbnail graphics matching Apple Maps & premium iOS aesthetic exactly
const ExplorarThumbnail = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    {/* Base dark canvas with subtle city blocks */}
    <rect width="100" height="100" fill="#1b2028" />
    
    {/* Clean street grid with soft junction curves */}
    {/* Diagonal main tourist boulevard */}
    <path d="M -5 70 L 65 -5" stroke="#2c3442" strokeWidth="11" strokeLinecap="round" />
    <path d="M -5 70 L 65 -5" stroke="#3d4758" strokeWidth="7" strokeLinecap="round" />
    
    {/* Crossing avenue */}
    <path d="M 20 105 L 105 20" stroke="#2c3442" strokeWidth="11" strokeLinecap="round" />
    <path d="M 20 105 L 105 20" stroke="#3d4758" strokeWidth="7" strokeLinecap="round" />
    
    {/* Connecting lane */}
    <path d="M 30 32 L 62 64" stroke="#333c4c" strokeWidth="5.5" strokeLinecap="round" />

    {/* Urban architectural footprint blocks (iOS Maps style) */}
    <rect x="8" y="12" width="16" height="20" rx="3" fill="#242b37" stroke="#313b4c" strokeWidth="0.8" />
    <rect x="74" y="28" width="18" height="15" rx="3" fill="#242b37" stroke="#313b4c" strokeWidth="0.8" />
    <rect x="42" y="76" width="22" height="16" rx="3" fill="#242b37" stroke="#313b4c" strokeWidth="0.8" />
    
    {/* Small scenic park patch */}
    <path d="M 4 82 C 10 74, 22 76, 26 86 C 28 92, 20 98, 12 98 Z" fill="#16382a" opacity="0.9" />
    <circle cx="16" cy="86" r="2.2" fill="#22593f" />

    {/* Points of Interest (POI) Pins - Apple Maps aesthetic */}
    
    {/* 1. Tourist Attraction / Landmark (Purple/Indigo Pin with Star/Monument) */}
    <g transform="translate(18, 16)">
      <circle cx="0" cy="0" r="7.2" fill="#5856D6" />
      <circle cx="0" cy="0" r="6.2" fill="#6865EE" />
      {/* Star symbol */}
      <polygon points="0,-3.4 1,-1 3.4,-1 1.5,0.4 2.2,2.8 0,1.4 -2.2,2.8 -1.5,0.4 -3.4,-1 -1,-1" fill="#ffffff" />
    </g>

    {/* 2. Restaurant / Gastronomy (Orange Pin with Fork & Knife) */}
    <g transform="translate(48, 48)">
      <circle cx="0" cy="0" r="7.5" fill="#FF9500" />
      <circle cx="0" cy="0" r="6.5" fill="#FFA524" />
      {/* Fork & Knife silhouette */}
      <path d="M -2 -3 L -2 0 C -2 1.2 -1.2 2 -0.2 2 L -0.2 3.5 L 0.2 3.5 L 0.2 2 C 1.2 2 2 1.2 2 0 L 2 -3" stroke="#ffffff" strokeWidth="0.75" fill="none" strokeLinecap="round" />
      <line x1="0" y1="-3" x2="0" y2="0" stroke="#ffffff" strokeWidth="0.75" />
    </g>

    {/* 3. Hotel / Lodge (Green Pin with Bed icon) */}
    <g transform="translate(80, 40)">
      <circle cx="0" cy="0" r="7" fill="#34C759" />
      <circle cx="0" cy="0" r="6" fill="#30D158" />
      {/* Bed glyph */}
      <rect x="-3" y="-0.5" width="6" height="2.2" rx="0.6" fill="#ffffff" />
      <circle cx="-1.8" cy="-1.8" r="0.9" fill="#ffffff" />
      <line x1="-3" y1="-2" x2="-3" y2="2.5" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="3" y1="0.5" x2="3" y2="2.5" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
    </g>

    {/* 4. Scenic Camera Viewpoint (Teal/Emerald Pin) */}
    <g transform="translate(74, 82)">
      <circle cx="0" cy="0" r="6.8" fill="#30B0C7" />
      <circle cx="0" cy="0" r="5.8" fill="#44BFD4" />
      {/* Camera glyph */}
      <rect x="-2.5" y="-1.2" width="5" height="3.5" rx="0.8" fill="#ffffff" />
      <circle cx="0" cy="0.6" r="0.9" fill="#30B0C7" />
      <rect x="-1" y="-2.1" width="2" height="0.8" rx="0.4" fill="#ffffff" />
    </g>
  </svg>
);

const DeCarroThumbnail = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    {/* Dark atmospheric background with road perspective */}
    <rect width="100" height="100" fill="#171c24" />

    {/* Subtle backdrop road network */}
    <path d="M -10 35 L 110 25" stroke="#252c38" strokeWidth="6" strokeLinecap="round" />
    <path d="M 15 -5 L 30 105" stroke="#232a35" strokeWidth="5" strokeLinecap="round" />

    {/* Perspective Highway / Driving Boulevard curving from lower-center to top-right */}
    {/* Road outer bed */}
    <path
      d="M 12 110 C 28 85, 48 60, 68 36 C 78 24, 88 12, 98 -5"
      fill="none"
      stroke="#28303d"
      strokeWidth="22"
      strokeLinecap="round"
    />
    {/* Asphalt surface */}
    <path
      d="M 12 110 C 28 85, 48 60, 68 36 C 78 24, 88 12, 98 -5"
      fill="none"
      stroke="#353f50"
      strokeWidth="18"
      strokeLinecap="round"
    />
    
    {/* Dash center lane dividers in distance */}
    <path
      d="M 68 36 C 78 24, 88 12, 98 -5"
      fill="none"
      stroke="#55647a"
      strokeWidth="1.2"
      strokeDasharray="3 3"
    />

    {/* Apple Maps GPS Blue Navigation Route Line with vibrant glow */}
    <path
      d="M 14 108 C 29 84, 48 61, 68 38 C 78 26, 88 14, 98 -5"
      fill="none"
      stroke="#0084ff"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="drop-shadow(0 0 4px rgba(0, 132, 255, 0.8))"
    />
    {/* Inner route highlight core */}
    <path
      d="M 14 108 C 29 84, 48 61, 68 38 C 78 26, 88 14, 98 -5"
      fill="none"
      stroke="#60b5ff"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Modern Navigation Car navigating along the blue route */}
    <g transform="translate(47, 63) rotate(-42)">
      {/* Soft car shadow */}
      <rect x="-6" y="-10" width="12" height="20" rx="4" fill="#000000" opacity="0.45" />
      
      {/* Car Body (Clean white/silver iOS navigation puck/car) */}
      <rect x="-5.5" y="-9.5" width="11" height="19" rx="3.5" fill="#f4f6f8" stroke="#d5dbe2" strokeWidth="0.8" />
      
      {/* Windshield & Roof */}
      <rect x="-4" y="-3.5" width="8" height="7.5" rx="1.5" fill="#2d3748" />
      {/* Front windshield glass */}
      <polygon points="-3.8,-4 3.8,-4 2.8,-7 -2.8,-7" fill="#4a5568" />
      {/* Rear windshield glass */}
      <polygon points="-3.8,4.5 3.8,4.5 2.8,7 -2.8,7" fill="#4a5568" />
      
      {/* Modern Cyan Headlight Beams */}
      <polygon points="-4,-9.5 -8,-16 -2,-16 -3,-9.5" fill="#38bdf8" opacity="0.6" />
      <polygon points="4,-9.5 8,-16 2,-16 3,-9.5" fill="#38bdf8" opacity="0.6" />
      {/* Headlight LEDs */}
      <circle cx="-3.5" cy="-9" r="0.9" fill="#ffffff" />
      <circle cx="3.5" cy="-9" r="0.9" fill="#ffffff" />
      
      {/* Red Taillights */}
      <rect x="-4.2" y="8.8" width="2" height="0.8" rx="0.3" fill="#ef4444" />
      <rect x="2.2" y="8.8" width="2" height="0.8" rx="0.3" fill="#ef4444" />
    </g>

    {/* Next-turn directional chevron guidance indicator */}
    <g transform="translate(80, 20) rotate(-45)">
      <circle cx="0" cy="0" r="6" fill="#0084ff" opacity="0.9" />
      <path d="M -2 -2.5 L 1.5 0 L -2 2.5" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

const AnimadoThumbnail = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    {/* Deep obsidian midnight base */}
    <rect width="100" height="100" fill="#141820" />

    {/* Ambient road grid beneath */}
    <path d="M 0 50 Q 50 40 100 50" stroke="#202734" strokeWidth="10" fill="none" />
    <path d="M 50 0 Q 45 50 50 100" stroke="#202734" strokeWidth="10" fill="none" />

    {/* Multiple vibrant motion flux corridors */}
    {/* Flux Corridor 1 - Neon Blue Transit Flow */}
    <path
      d="M -10 25 C 25 35, 45 75, 110 80"
      fill="none"
      stroke="#0066FF"
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.95"
      filter="drop-shadow(0 0 3px rgba(0,102,255,0.8))"
    />
    {/* Flow pulses */}
    <circle cx="28" cy="46" r="2.2" fill="#ffffff" />
    <circle cx="68" cy="77" r="2" fill="#ffffff" />

    {/* Flux Corridor 2 - Neon Sky Blue Pulse */}
    <path
      d="M -10 80 C 35 70, 60 25, 110 20"
      fill="none"
      stroke="#0091ff"
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.95"
      filter="drop-shadow(0 0 3px rgba(0,145,255,0.8))"
    />
    <circle cx="42" cy="55" r="2.4" fill="#ffffff" />
    <circle cx="82" cy="24" r="2" fill="#ffffff" />

    {/* Flux Corridor 3 - Amber / Coral Dynamic Fast Track */}
    <path
      d="M 20 -10 C 25 35, 75 60, 85 110"
      fill="none"
      stroke="#FF9500"
      strokeWidth="3.2"
      strokeLinecap="round"
      opacity="0.85"
      filter="drop-shadow(0 0 3px rgba(255,149,0,0.8))"
    />
    
    {/* Flux Corridor 4 - Purple / Magenta Express Loop */}
    <path
      d="M 85 -5 C 75 35, 25 65, 15 105"
      fill="none"
      stroke="#AF52DE"
      strokeWidth="2.8"
      strokeLinecap="round"
      opacity="0.8"
    />

    {/* Live GPS Dynamic Location Beacon with Pulsing Radar Rings */}
    <g transform="translate(50, 48)">
      {/* Outer expansion ripple */}
      <circle cx="0" cy="0" r="16" fill="none" stroke="#0084ff" strokeWidth="1" opacity="0.3" strokeDasharray="3 2" />
      <circle cx="0" cy="0" r="11" fill="none" stroke="#0084ff" strokeWidth="1.4" opacity="0.55" />
      
      {/* Core beacon puck */}
      <circle cx="0" cy="0" r="6" fill="#0084ff" filter="drop-shadow(0 0 5px rgba(0,132,255,1))" />
      <circle cx="0" cy="0" r="5" fill="#ffffff" />
      <circle cx="0" cy="0" r="3" fill="#0084ff" />

      {/* Dynamic Heading Beam Cone (Direction of travel) */}
      <polygon points="0,0 -8,-17 8,-17" fill="#0084ff" opacity="0.3" />
      <polygon points="0,0 -5,-14 5,-14" fill="#60b5ff" opacity="0.45" />
    </g>
  </svg>
);
const TransporteThumbnail = AnimadoThumbnail;

const SateliteThumbnail = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    {/* Realistic Aerial Ground Base: Rich textured earthy topography */}
    <rect width="100" height="100" fill="#2e3828" />

    {/* Distinct Agricultural / Topographical Parcel Terrains (Earth & Forest tones) */}
    <path d="M 0 0 L 52 0 L 44 48 L 0 42 Z" fill="#3a482f" />
    <path d="M 52 0 L 100 0 L 100 38 L 48 34 Z" fill="#2b3824" />
    <path d="M 0 42 L 40 46 L 32 100 L 0 100 Z" fill="#423b2c" />
    <path d="M 40 46 L 100 38 L 100 100 L 32 100 Z" fill="#2d3d25" />

    {/* Natural River / Waterway curving across satellite landscape */}
    <path
      d="M -5 15 C 25 18, 20 60, 48 70 C 68 76, 85 85, 105 88"
      fill="none"
      stroke="#1a2e3b"
      strokeWidth="7"
      strokeLinecap="round"
    />
    <path
      d="M -5 15 C 25 18, 20 60, 48 70 C 68 76, 85 85, 105 88"
      fill="none"
      stroke="#203d52"
      strokeWidth="4"
      strokeLinecap="round"
    />

    {/* Realistic Asphalt Highway passing through terrain */}
    <path
      d="M 18 -5 L 82 105"
      stroke="#4b5156"
      strokeWidth="8"
      strokeLinecap="square"
    />
    <path
      d="M 18 -5 L 82 105"
      stroke="#5d656c"
      strokeWidth="5.5"
      strokeLinecap="square"
    />
    {/* Faint center line */}
    <path
      d="M 18 -5 L 82 105"
      stroke="#8f98a0"
      strokeWidth="0.8"
      strokeDasharray="2.5 2.5"
    />

    {/* Secondary Rural Road branching out */}
    <path
      d="M 45 40 Q 75 32 105 28"
      stroke="#636056"
      strokeWidth="3.5"
      strokeLinecap="round"
    />

    {/* Realistic Satellite Buildings & Roofs with 3D Sun Shadowing */}
    {/* Complex A: Residential cluster with terraced rooftops */}
    {/* Shadows */}
    <rect x="58" y="10" width="13" height="9" rx="0.5" fill="#131911" opacity="0.6" />
    <rect x="56" y="8" width="13" height="9" rx="0.5" fill="#a86d52" />
    <rect x="56" y="8" width="6.5" height="9" fill="#bc7d60" />

    <rect x="73" y="14" width="15" height="11" rx="0.5" fill="#131911" opacity="0.6" />
    <rect x="71" y="12" width="15" height="11" rx="0.5" fill="#c2b49c" />
    <rect x="71" y="12" width="7.5" height="11" fill="#d4c7b0" />

    {/* Complex B: Industrial / Commercial light-roof structure */}
    <rect x="10" y="56" width="16" height="13" rx="0.5" fill="#131911" opacity="0.6" />
    <rect x="8" y="54" width="16" height="13" rx="0.5" fill="#9ea5aa" />
    <line x1="8" y1="60.5" x2="24" y2="60.5" stroke="#7a8187" strokeWidth="0.6" />

    {/* Dense Forest Canopy & Organic Tree Clusters (Real aerial look) */}
    {/* Top Right Dense Woods */}
    <ellipse cx="88" cy="55" rx="8" ry="6" fill="#1f2c1a" />
    <circle cx="85" cy="52" r="4.2" fill="#2b3d24" />
    <circle cx="91" cy="56" r="3.8" fill="#32472a" />
    <circle cx="86" cy="58" r="3.4" fill="#263820" />

    {/* Riverbank Vegetation */}
    <ellipse cx="24" cy="38" rx="6" ry="4" fill="#1e2c19" />
    <circle cx="22" cy="36" r="3.2" fill="#2c4025" />
    <circle cx="26" cy="40" r="2.8" fill="#344d2c" />

    {/* Southern Field Tree Line */}
    <circle cx="50" cy="88" r="3.5" fill="#24341e" />
    <circle cx="56" cy="90" r="4" fill="#2e4227" />
    <circle cx="63" cy="91" r="3.6" fill="#1f2c1a" />
    <circle cx="70" cy="93" r="3.2" fill="#2b3c24" />
  </svg>
);

const MODES_CONFIG: {
  id: MapModeType;
  name: string;
  thumbnail: React.ComponentType;
}[] = [
  { id: 'explorar', name: 'Explorar', thumbnail: ExplorarThumbnail },
  { id: 'carro', name: 'De Carro', thumbnail: DeCarroThumbnail },
  { id: 'animado', name: 'Animado', thumbnail: AnimadoThumbnail },
  { id: 'satelite', name: 'Satélite', thumbnail: SateliteThumbnail },
];

interface SpotMarkerRecord {
  marker: maplibregl.Marker;
  circleEl: HTMLDivElement;
}

interface VisualMarkerRecord {
  marker: maplibregl.Marker;
  containerEl: HTMLDivElement;
  badgeEl: HTMLDivElement;
  category: string;
  color?: string;
}

export const MapComponentInner: React.FC<MapComponentProps> = ({
  spots,
  selectedSpot,
  onSelectSpot,
  userCoords,
  theme,
  visualIcons = [],
  userAvatar,
  userName,
  highContrast = false,
  onMapLoad,
  onMapClick,
  onInteractionChange,
  zoomToUserTrigger,
  onStyleChange,
  onReturnToChat,
  is3DMode,
  onOrbitChange,
  isDetailOpen = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const effectiveSpots = useMemo(() => {
    const cached = getCachedGeoData<Spot[]>('campos_spots_40km');
    if (cached && cached.length > 0 && (!spots || spots.length === 0)) {
      return cached;
    }
    return spots || cached || [];
  }, [spots]);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userBeamElRef = useRef<HTMLDivElement | null>(null);
  const userCircleElRef = useRef<HTMLDivElement | null>(null);
  const userLabelElRef = useRef<HTMLDivElement | null>(null);
  const userCarElRef = useRef<HTMLDivElement | null>(null);
  const userCarGraphicRef = useRef<HTMLDivElement | null>(null);
  const userCarSpeedBadgeRef = useRef<HTMLDivElement | null>(null);
  const isFollowingUserRef = useRef<boolean>(false);
  const isOrientingHeadingRef = useRef<boolean>(false);
  const lastCameraEaseTimeRef = useRef<number>(0);
  const userAvatarRef = useRef<string>('');
  const spotMarkersRef = useRef<Map<string, SpotMarkerRecord>>(new Map());
  const visualMarkersRef = useRef<Map<string, VisualMarkerRecord>>(new Map());
  const onSelectSpotRef = useRef(onSelectSpot);

  useEffect(() => {
    onSelectSpotRef.current = onSelectSpot;
  }, [onSelectSpot]);

  const onReturnToChatRef = useRef(onReturnToChat);
  useEffect(() => {
    onReturnToChatRef.current = onReturnToChat;
  }, [onReturnToChat]);

  const onStyleChangeRef = useRef(onStyleChange);
  useEffect(() => {
    onStyleChangeRef.current = onStyleChange;
  }, [onStyleChange]);

  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const onMapLoadRef = useRef(onMapLoad);
  useEffect(() => {
    onMapLoadRef.current = onMapLoad;
  }, [onMapLoad]);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const onInteractionChangeRef = useRef(onInteractionChange);
  useEffect(() => {
    onInteractionChangeRef.current = onInteractionChange;
  }, [onInteractionChange]);

  const onOrbitChangeRef = useRef(onOrbitChange);
  useEffect(() => {
    onOrbitChangeRef.current = onOrbitChange;
  }, [onOrbitChange]);

  const [currentStyle, setCurrentStyle] = useState<MapModeType>(() => (theme === 'dark' ? 'explorar' : 'animado'));
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);
  const orbitAnimFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onOrbitChangeRef.current?.(isOrbiting);
  }, [isOrbiting]);

  const stopOrbit = useCallback(() => {
    setIsOrbiting(false);
    if (orbitAnimFrameRef.current) {
      cancelAnimationFrame(orbitAnimFrameRef.current);
      orbitAnimFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isDetailOpen) {
      stopOrbit();
    }
  }, [isDetailOpen, stopOrbit]);

  const handleOrbitScreenTap = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    stopOrbit();
  }, [stopOrbit]);

  const [showCompassPrompt, setShowCompassPrompt] = useState<boolean>(() => {
    return deviceHeadingManager.isPermissionRequired() && !deviceHeadingManager.isPermissionHandled();
  });
  const [compassRotation, setCompassRotation] = useState<number>(0);
  const hasCenteredInitiallyRef = useRef<boolean>(false);
  const lastCameraState = useRef<any>(null);

  const handleEnableCompass = async () => {
    await deviceHeadingManager.requestPermission();
    setShowCompassPrompt(false);
  };

  const handleDismissCompass = () => {
    deviceHeadingManager.markPermissionHandled();
    setShowCompassPrompt(false);
  };

  // Restore camera when spot is deselected
  useEffect(() => {
    if (!selectedSpot && lastCameraState.current) {
      const map = mapRef.current;
      if (map) {
        map.flyTo({
          center: lastCameraState.current.center,
          zoom: lastCameraState.current.zoom,
          pitch: lastCameraState.current.pitch,
          bearing: lastCameraState.current.bearing,
          speed: 1.2,
          essential: true,
        });
      }
      lastCameraState.current = null; // Clear it
    }
  }, [selectedSpot]);

  // Center camera & start 360° orbit rotation with 40% blur overlay when a spot is selected
  useEffect(() => {
    if (!selectedSpot) {
      stopOrbit();
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    if (!lastCameraState.current) {
      lastCameraState.current = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };
    }

    isFollowingUserRef.current = false;
    isOrientingHeadingRef.current = false;

    let currentBearing = map.getBearing() || 0;

    map.flyTo({
      center: [selectedSpot.lng, selectedSpot.lat],
      zoom: 16.8,
      pitch: 58,
      bearing: currentBearing,
      speed: 1.3,
      essential: true,
    });

    setIsOrbiting(true);

    let active = true;
    const rotateLoop = () => {
      if (!active || !mapRef.current) return;
      currentBearing = (currentBearing + 0.38) % 360;
      mapRef.current.setBearing(currentBearing);
      orbitAnimFrameRef.current = requestAnimationFrame(rotateLoop);
    };

    const delayTimer = setTimeout(() => {
      if (active) {
        orbitAnimFrameRef.current = requestAnimationFrame(rotateLoop);
      }
    }, 1100);

    return () => {
      active = false;
      clearTimeout(delayTimer);
      if (orbitAnimFrameRef.current) {
        cancelAnimationFrame(orbitAnimFrameRef.current);
        orbitAnimFrameRef.current = null;
      }
    };
  }, [selectedSpot?.id, stopOrbit]);

  // Sync highContrast class on container if needed
  useEffect(() => {
    if (mapContainerRef.current) {
      mapContainerRef.current.classList.toggle('high-contrast-map', highContrast);
    }
  }, [highContrast]);

  // Handle 3D Terrain Pitch & Mountain Elevation toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (is3DMode) {
      map.easeTo({
        pitch: 62,
        bearing: -18,
        duration: 1100,
        essential: true,
      });
    } else if (is3DMode === false) {
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1100,
        essential: true,
      });
    }
  }, [is3DMode]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialMode: MapModeType = theme === 'light' ? 'animado' : currentStyle;
    const initialCenter = (userCoords && !isNaN(userCoords[0])) ? userCoords : CAMPOS_OVERVIEW_CAMERA.center;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: createStyle(initialMode, theme),
        center: initialCenter,
        zoom: 15.2,
        pitch: CAMPOS_OVERVIEW_CAMERA.pitch,
        bearing: CAMPOS_OVERVIEW_CAMERA.bearing,
        attributionControl: false,
      } as any);
    } catch (err) {
      console.warn('[MapComponent initialization caught error]:', err);
      return;
    }

    map.on('load', () => {
      map.resize();
      setTimeout(() => { try { map.resize(); } catch (e) {} }, 80);
      setTimeout(() => { try { map.resize(); } catch (e) {} }, 250);
      setTimeout(() => { try { map.resize(); } catch (e) {} }, 600);
      if ('setProjection' in map && typeof (map as any).setProjection === 'function') {
        try {
          (map as any).setProjection({ type: 'globe' });
        } catch (e) {
          // Fallback if not supported on runtime version
        }
      }
      map.setPadding({ top: 60, right: 20, bottom: 85, left: 20 });
      setupNightLights(map, themeRef.current);
      setupFerrisWheel3D(map, themeRef.current === 'dark');
      deviceHeadingManager.setMapBearing(map.getBearing());
      if (onMapLoadRef.current) {
        onMapLoadRef.current();
      }
      setTimeout(() => {
        onStyleChangeRef.current?.(initialMode);
      }, 0);
    });

    map.on('rotate', () => {
      deviceHeadingManager.setMapBearing(map.getBearing());
    });

    map.on('styledata', () => {
      if (map.isStyleLoaded()) {
        setupNightLights(map, themeRef.current);
        setupFerrisWheel3D(map, themeRef.current === 'dark');
      }
    });

    // Dismiss all cards, previews and opened overlays on map touch/click/drag
    const dismissAllOverlays = () => {
      stopOrbit();
      setShowStyleMenu(false);
      onSelectSpotRef.current(null);
      if (onMapClickRef.current) {
        onMapClickRef.current();
      }
    };

    map.on('click', () => {
      deviceHeadingManager.requestPermission();
      dismissAllOverlays();
    });

    map.on('rotate', () => {
      deviceHeadingManager.setMapBearing(map.getBearing());
      const carGraphic = userCarGraphicRef.current;
      if (carGraphic) {
        const heading = gpsNavigationManager.getCurrentHeading();
        const carScreenAngle = (heading - map.getBearing() + 360) % 360;
        carGraphic.style.transform = `rotate(${carScreenAngle.toFixed(1)}deg)`;
        carGraphic.style.webkitTransform = `rotate(${carScreenAngle.toFixed(1)}deg)`;
      }
    });

    // Fade in/out spot markers during map drag/move
    let isInteracting = false;
    let interactionTimeout: NodeJS.Timeout | null = null;

    const setInteracting = (active: boolean) => {
      if (interactionTimeout) {
        clearTimeout(interactionTimeout);
        interactionTimeout = null;
      }

      if (active) {
        if (!isInteracting) {
          isInteracting = true;
          mapContainerRef.current?.classList.add('map-panning-active');
          onInteractionChangeRef.current?.(true);
        }
      } else {
        interactionTimeout = setTimeout(() => {
          if (!map.isMoving()) {
            isInteracting = false;
            mapContainerRef.current?.classList.remove('map-panning-active');
            onInteractionChangeRef.current?.(false);
          }
        }, 150);
      }
    };

    map.on('movestart', () => setInteracting(true));
    map.on('move', () => setInteracting(true));
    map.on('moveend', () => setInteracting(false));
    map.on('dragstart', () => {
      setInteracting(true);
      dismissAllOverlays();
      isFollowingUserRef.current = false; // User took manual camera control
      isOrientingHeadingRef.current = false;
    });
    map.on('dragend', () => setInteracting(false));
    map.on('zoomstart', () => setInteracting(true));
    map.on('zoomend', () => setInteracting(false));
    map.on('rotatestart', () => {
      setInteracting(true);
      isOrientingHeadingRef.current = false; // User manually rotated map
    });
    map.on('rotateend', () => setInteracting(false));
    map.on('pitchstart', () => setInteracting(true));
    map.on('pitchend', () => setInteracting(false));

    const canvas = map.getCanvas();
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      setInteracting(true);
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      setInteracting(false);
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const distX = Math.abs(touch.clientX - touchStartX);
        const distY = Math.abs(touch.clientY - touchStartY);
        const elapsed = Date.now() - touchStartTime;
        // Clean tap gesture on the map canvas
        if (elapsed < 450 && distX < 15 && distY < 15) {
          dismissAllOverlays();
        }
      }
    };

    const handleMouseDown = () => setInteracting(true);
    const handleMouseUp = () => setInteracting(false);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Handle container resize & iOS viewport/orientation/visibility shifts
    const handleResize = () => {
      if (!map) return;
      map.resize();
      requestAnimationFrame(() => map && map.resize());
    };
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    window.addEventListener('pageshow', handleResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize, { passive: true });
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && map) {
        handleResize();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility, { passive: true });

    // Also observe the map container element directly to handle dynamic safe area or viewport shifts
    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    mapRef.current = map;

    return () => {
      if (interactionTimeout) clearTimeout(interactionTimeout);
      if (resizeObserver) resizeObserver.disconnect();
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('pageshow', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      document.removeEventListener('visibilitychange', handleVisibility);

      // Clean up all markers from map and memory to prevent leaks
      spotMarkersRef.current.forEach((r) => r.marker.remove());
      spotMarkersRef.current.clear();
      visualIconMarkersRef.current.forEach((r) => r.marker.remove());
      visualIconMarkersRef.current.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualizar estilo quando o modo ou tema mudar (Suave, mantém localização, zoom e centro intactos)
  const handleSelectMode = (mode: MapModeType) => {
    setCurrentStyle(mode);
    onStyleChangeRef.current?.(mode);
    const map = mapRef.current;
    if (map) {
      map.setStyle(createStyle(mode, theme));
    }
    setShowStyleMenu(false);
  };

  // Observar mudança de tema para atualizar o mapa automaticamente
  // Na versão clara (branca), carrega automaticamente o mapa "Animado" (antigo Transporte Público)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (theme === 'light') {
      setCurrentStyle('animado');
      map.setStyle(createStyle('animado', 'light'));
      setTimeout(() => {
        onStyleChangeRef.current?.('animado');
      }, 0);
    } else {
      const nextStyle = currentStyle === 'animado' || currentStyle === 'transporte' ? 'explorar' : currentStyle;
      setCurrentStyle(nextStyle);
      map.setStyle(createStyle(nextStyle, 'dark'));
      setTimeout(() => {
        onStyleChangeRef.current?.(nextStyle);
      }, 0);
    }
  }, [theme]);

  // Helper to update selection visual state without recreating DOM or reloading images
  const updateMarkerSelection = (record: SpotMarkerRecord, isSelected: boolean) => {
    if (isSelected) {
      record.circleEl.className = 'relative w-[39px] h-[39px] sm:w-[41px] sm:h-[41px] rounded-full overflow-hidden border-2 border-[#FFFFFF] ring-2 ring-[#FFFFFF]/70 bg-zinc-900 shrink-0 shadow-md transition-transform scale-110';
    } else {
      record.circleEl.className = 'relative w-[39px] h-[39px] sm:w-[41px] sm:h-[41px] rounded-full overflow-hidden border-2 border-white hover:border-[#FFFFFF] bg-zinc-900 shrink-0 shadow-sm transition-transform';
    }
  };

  // Render Spots Markers with smart reconciliation (never destroy or recreate existing DOM/images)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentSpotIds = new Set(effectiveSpots.map((s) => s.id));

    // Remove only markers that are no longer present in the spots list
    spotMarkersRef.current.forEach((record, spotId) => {
      if (!currentSpotIds.has(spotId)) {
        record.marker.remove();
        spotMarkersRef.current.delete(spotId);
      }
    });

    // Add only new markers (keep existing ones completely untouched)
    effectiveSpots.forEach((spot, idx) => {
      const existing = spotMarkersRef.current.get(spot.id);
      if (existing) {
        // Spot already exists! Keep the DOM and <img> completely untouched.
        // Only update position if coordinates changed
        const currentLngLat = existing.marker.getLngLat();
        if (Math.abs(currentLngLat.lng - spot.lng) > 0.00001 || Math.abs(currentLngLat.lat - spot.lat) > 0.00001) {
          existing.marker.setLngLat([spot.lng, spot.lat]);
        }
        updateMarkerSelection(existing, spot.id === selectedSpot?.id);
        return;
      }

      const el = document.createElement('div');
      el.id = `spot-marker-${spot.id}`;
      el.className = 'spot-marker-container flex flex-col items-center cursor-pointer select-none z-10';
      el.style.willChange = 'transform';
      el.style.transform = 'translate3d(0,0,0)';

      const circleDiv = document.createElement('div');
      circleDiv.className = 'relative w-[39px] h-[39px] sm:w-[41px] sm:h-[41px] rounded-full overflow-hidden border-2 border-white hover:border-[#FFFFFF] bg-zinc-900 shrink-0 shadow-sm transition-transform pin-pop-in';
      circleDiv.style.willChange = 'transform';
      circleDiv.style.backfaceVisibility = 'hidden';
      circleDiv.style.transform = 'translate3d(0,0,0)';
      // Subtle stagger based on order to create an organic fluid ripple on load/filter
      circleDiv.style.animationDelay = `${Math.min(idx * 22, 280)}ms`;

      circleDiv.addEventListener('animationend', () => {
        circleDiv.classList.remove('pin-pop-in');
        circleDiv.style.animationDelay = '';
      }, { once: true });

      const img = document.createElement('img');
      img.src = getSpotImage(spot);
      img.alt = spot.name;
      img.className = 'w-full h-full object-cover pointer-events-none';
      img.loading = 'eager';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        img.src = getSpotFallbackImage(spot.name, spot.category);
      };
      circleDiv.appendChild(img);

      el.appendChild(circleDiv);

      // Smart touch & drag tracking: allow map dragging & pinch-to-zoom even when finger starts on a pin
      let touchStartX = 0;
      let touchStartY = 0;
      let hasMovedSignificantly = false;

      el.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          hasMovedSignificantly = false;
        }
      }, { passive: true });

      el.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length > 0) {
          const dx = e.touches[0].clientX - touchStartX;
          const dy = e.touches[0].clientY - touchStartY;
          if (Math.hypot(dx, dy) > 8) {
            hasMovedSignificantly = true;
          }
        }
      }, { passive: true });

      let pointerStartX = 0;
      let pointerStartY = 0;
      let pointerMoved = false;

      el.addEventListener('pointerdown', (e) => {
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        pointerMoved = false;
      }, { passive: true });

      el.addEventListener('pointermove', (e) => {
        if (e.buttons > 0) {
          const dx = e.clientX - pointerStartX;
          const dy = e.clientY - pointerStartY;
          if (Math.hypot(dx, dy) > 8) {
            pointerMoved = true;
          }
        }
      }, { passive: true });

      el.addEventListener('click', (e) => {
        if (hasMovedSignificantly || pointerMoved) {
          hasMovedSignificantly = false;
          pointerMoved = false;
          return;
        }
        e.stopPropagation();
        playPinTapSound();
        circleDiv.classList.remove('pin-tap-anim');
        void circleDiv.offsetWidth;
        circleDiv.classList.add('pin-tap-anim');

        if (!lastCameraState.current) {
          lastCameraState.current = {
            center: map.getCenter(),
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          };
        }
        onSelectSpotRef.current(spot);
        map.flyTo({
          center: [spot.lng, spot.lat],
          zoom: 15.2,
          speed: 1.2,
        });
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map);

      const record: SpotMarkerRecord = {
        marker,
        circleEl: circleDiv,
      };

      spotMarkersRef.current.set(spot.id, record);
    });
  }, [effectiveSpots]);

  // Synchronize selection styling without re-creating any DOM or images
  useEffect(() => {
    spotMarkersRef.current.forEach((record, spotId) => {
      updateMarkerSelection(record, spotId === selectedSpot?.id);
    });
  }, [selectedSpot?.id]);

  // Synchronize visual icons layer (Firmly anchored at GPS coordinates, fully persistent like spots)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeList = (visualIcons || []).filter((i) => i.is_active === 1);
    const activeIds = new Set(activeList.map((i) => i.id));

    // Remove markers that were deleted or deactivated
    visualMarkersRef.current.forEach((record, id) => {
      if (!activeIds.has(id)) {
        record.marker.remove();
        visualMarkersRef.current.delete(id);
      }
    });

    // Add or update active markers
    activeList.forEach((item) => {
      const existing = visualMarkersRef.current.get(item.id);
      if (existing) {
        const currentLngLat = existing.marker.getLngLat();
        if (
          Math.abs(currentLngLat.lng - item.longitude) > 0.000001 ||
          Math.abs(currentLngLat.lat - item.latitude) > 0.000001
        ) {
          existing.marker.setLngLat([item.longitude, item.latitude]);
        }
        const itemColor = item.color || undefined;
        if (existing.category !== item.category || existing.color !== itemColor) {
          existing.category = item.category;
          existing.color = itemColor;
          existing.badgeEl.innerHTML = generateMarkerHtml(item.category, 18, itemColor);
        }
      } else {
        const containerEl = document.createElement('div');
        containerEl.id = `visual-icon-${item.id}`;
        containerEl.className = 'map-visual-icon-marker select-none';
        containerEl.style.width = '18px';
        containerEl.style.height = '18px';
        containerEl.style.display = 'flex';
        containerEl.style.alignItems = 'center';
        containerEl.style.justifyContent = 'center';
        containerEl.style.pointerEvents = 'none';
        containerEl.style.userSelect = 'none';
        containerEl.style.cursor = 'default';

        const badgeEl = document.createElement('div');
        badgeEl.className = 'visual-icon-badge-inner flex items-center justify-center';
        badgeEl.innerHTML = generateMarkerHtml(item.category, 18, item.color);
        containerEl.appendChild(badgeEl);

        const marker = new maplibregl.Marker({
          element: containerEl,
          anchor: 'center',
        })
          .setLngLat([item.longitude, item.latitude])
          .addTo(map);

        visualMarkersRef.current.set(item.id, {
          marker,
          containerEl,
          badgeEl,
          category: item.category,
          color: item.color,
        });
      }
    });
  }, [visualIcons]);

  // Render user "Você" Marker on Map (Persistent, only moves coordinates, never reloads image)
  const defaultAvatar = userAvatar || '/fotoperfil.png';

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userCoords || isNaN(userCoords[0])) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(userCoords);
      if (userAvatarRef.current !== defaultAvatar) {
        userAvatarRef.current = defaultAvatar;
        const existingImg = document.getElementById('user-voce-marker-img') as HTMLImageElement;
        if (existingImg) {
          existingImg.src = defaultAvatar;
        }
      }
      return;
    }

    userAvatarRef.current = defaultAvatar;
    const userEl = document.createElement('div');
    userEl.id = 'user-voce-marker';
    userEl.className = 'relative flex items-center justify-center cursor-pointer select-none z-20';
    userEl.style.width = '48px';
    userEl.style.height = '48px';

    // Check if logged-in user is Gold
    const isGoldUser = Boolean(
      (() => {
        try {
          const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
          const cleanEmail = (u.email || u.whatsapp || '').trim().toLowerCase();
          const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail);
          return isGoldAdmin || Boolean(u.isGold || u.is_gold === 1 || u.isPremium || u.is_premium === 1);
        } catch {
          return false;
        }
      })()
    );

    // 1. Apple Maps Directional Flashlight / Heading Cone Beam (Pedestrian Mode)
    const beamContainer = document.createElement('div');
    beamContainer.id = 'user-voce-beam';
    beamContainer.className = 'absolute pointer-events-none z-0 flex items-center justify-center';
    beamContainer.style.width = '108px';
    beamContainer.style.height = '108px';
    beamContainer.style.top = '-30px';
    beamContainer.style.left = '-30px';
    beamContainer.style.transformOrigin = '54px 54px';
    beamContainer.style.willChange = 'transform';
    beamContainer.style.backfaceVisibility = 'hidden';
    beamContainer.style.webkitBackfaceVisibility = 'hidden';
    beamContainer.style.transition = 'opacity 300ms ease';

    const beamDropShadow = isGoldUser ? 'drop-shadow(0 -2px 12px rgba(230, 172, 51, 0.85))' : 'drop-shadow(0 -2px 10px rgba(0, 122, 255, 0.75))';
    const radCol0 = isGoldUser ? '#FFF4A3' : '#FFFFFF';
    const radCol40 = isGoldUser ? '#F5BE38' : '#0A84FF';
    const radCol80 = isGoldUser ? '#E6AC33' : '#FFFFFF';
    const radCol100 = isGoldUser ? '#B88214' : '#FFFFFF';

    const fanCol0 = isGoldUser ? '#F5BE38' : '#FFFFFF';
    const fanCol35 = isGoldUser ? '#FFF4A3' : '#0A84FF';
    const fanCol75 = isGoldUser ? '#E6AC33' : '#93C5FD';
    const fanCol100 = isGoldUser ? '#B88214' : '#DBEAFE';

    const centerGlowFill = isGoldUser ? '#F5BE38' : '#FFFFFF';

    beamContainer.innerHTML = `
      <svg viewBox="0 0 108 108" class="w-full h-full overflow-visible pointer-events-none" style="filter: ${beamDropShadow};">
        <defs>
          <radialGradient id="apple-heading-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${radCol0}" stop-opacity="0.95" />
            <stop offset="40%" stop-color="${radCol40}" stop-opacity="0.75" />
            <stop offset="80%" stop-color="${radCol80}" stop-opacity="0.35" />
            <stop offset="100%" stop-color="${radCol100}" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="apple-heading-fan" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="${fanCol0}" stop-opacity="0.9" />
            <stop offset="35%" stop-color="${fanCol35}" stop-opacity="0.75" />
            <stop offset="75%" stop-color="${fanCol75}" stop-opacity="0.35" />
            <stop offset="100%" stop-color="${fanCol100}" stop-opacity="0" />
          </linearGradient>
        </defs>
        <!-- Soft Light Cone (approx 54 deg fan pointing up) -->
        <path d="M 54 54 L 30.5 7.8 A 52 52 0 0 1 77.5 7.8 Z" fill="url(#apple-heading-fan)" />
        <!-- Inner Core Bright Cone (approx 32 deg fan) -->
        <path d="M 54 54 L 42.4 13.8 A 42 42 0 0 1 65.6 13.8 Z" fill="url(#apple-heading-radial)" opacity="0.95" />
        <!-- Soft Center Glow Circle -->
        <circle cx="54" cy="54" r="24" fill="${centerGlowFill}" opacity="0.22" />
      </svg>
    `;

    userBeamElRef.current = beamContainer;
    userEl.appendChild(beamContainer);

    // 2. Pedestrian User Avatar Circle
    const userCircle = document.createElement('div');
    userCircle.id = 'user-voce-circle';
    const ringClass = isGoldUser ? 'ring-[#F5BE38]' : 'ring-[#FFFFFF]';
    userCircle.className = `relative z-10 w-[39px] h-[39px] sm:w-[41px] sm:h-[41px] rounded-full overflow-hidden border-2 border-white ring-2 ${ringClass} bg-zinc-900 shadow-md user-photo-pulse transition-all duration-300`;

    const userImg = document.createElement('img');
    userImg.id = 'user-voce-marker-img';
    userImg.src = defaultAvatar;
    userImg.alt = 'Eu';
    userImg.className = 'w-full h-full object-cover pointer-events-none';
    userCircle.appendChild(userImg);

    userCircleElRef.current = userCircle;
    userEl.appendChild(userCircle);

    // 3. Pedestrian Label "Eu" embaixo do ícone
    const userLabel = document.createElement('div');
    userLabel.id = 'user-voce-marker-label';
    userLabel.className = 'absolute top-[48px] left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black tracking-tight text-white bg-black/80 border border-white/20 shadow-md backdrop-blur-md select-none pointer-events-none whitespace-nowrap leading-none transition-opacity duration-300';
    userLabel.innerText = 'Eu';
    userLabelElRef.current = userLabel;
    userEl.appendChild(userLabel);

    // 4. Premium 3D-styled Red Ferrari Marker (scaled proportionally to street width)
    const carContainer = document.createElement('div');
    carContainer.id = 'user-voce-car';
    carContainer.className = 'absolute pointer-events-none z-30 flex flex-col items-center justify-center transition-all duration-300 opacity-0 scale-50';
    // Calibrated proportional Ferrari dimensions: 80px wide x 135px long
    // Fills the road width comfortably like in Apple Maps / Waze high-detail 3D navigation
    carContainer.style.width = '80px';
    carContainer.style.height = '135px';
    carContainer.style.top = '-67px';
    carContainer.style.left = '-40px';

    const carGraphic = document.createElement('div');
    carGraphic.id = 'user-car-graphic';
    carGraphic.className = 'w-full h-full flex items-center justify-center will-change-transform';
    carGraphic.style.transformOrigin = 'center center';
    carGraphic.innerHTML = `
      <svg viewBox="0 0 32 54" class="w-full h-full overflow-visible pointer-events-none" style="filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.55));">
        <defs>
          <!-- Forward Headlight Projector Beams (Soft Golden Xenon) -->
          <linearGradient id="ferrari-beam" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.75" />
            <stop offset="35%" stop-color="#FEF08A" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#FEF08A" stop-opacity="0" />
          </linearGradient>

          <!-- Iconic Rosso Corsa Ferrari Metallic Body Gradient -->
          <linearGradient id="ferrari-rosso-corsa" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#800A0A" />
            <stop offset="14%" stop-color="#C51616" />
            <stop offset="32%" stop-color="#E71B1B" />
            <stop offset="50%" stop-color="#FF3838" />
            <stop offset="68%" stop-color="#E71B1B" />
            <stop offset="86%" stop-color="#C51616" />
            <stop offset="100%" stop-color="#800A0A" />
          </linearGradient>

          <!-- Carbon Fiber Roof & Aerodynamic Aero-Bridge -->
          <linearGradient id="ferrari-carbon-cockpit" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.9" />
            <stop offset="42%" stop-color="#090D16" stop-opacity="0.98" />
            <stop offset="85%" stop-color="#1E293B" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#0284C7" stop-opacity="0.7" />
          </linearGradient>

          <!-- Glass Engine Cover / Bonnet Glare -->
          <linearGradient id="ferrari-engine-glass" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1E293B" stop-opacity="0.9" />
            <stop offset="50%" stop-color="#0F172A" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#E2E8F0" stop-opacity="0.4" />
          </linearGradient>
        </defs>

        <!-- Forward Light Beams extending onto the road ahead -->
        <polygon points="8,10 -2,-12 12,-12" fill="url(#ferrari-beam)" />
        <polygon points="24,10 20,-12 34,-12" fill="url(#ferrari-beam)" />

        <!-- Ground Ambient Occlusion Shadow -->
        <ellipse cx="16" cy="28" rx="12" ry="20" fill="rgba(0,0,0,0.55)" filter="blur(2px)" />

        <!-- Wide Low-Profile Pirelli P-Zero Tires (Peeking subtly at corners) -->
        <rect x="2" y="10" width="3" height="8" rx="1.5" fill="#18181B" />
        <rect x="27" y="10" width="3" height="8" rx="1.5" fill="#18181B" />
        <rect x="1.5" y="36" width="3.5" height="9.5" rx="1.5" fill="#18181B" />
        <rect x="27" y="36" width="3.5" height="9.5" rx="1.5" fill="#18181B" />

        <!-- Aerodynamic Side Mirrors (Carbon Stalks) -->
        <path d="M 2.5 18 C 1.5 17, 4.5 15, 6 16.5 L 5 19.5 Z" fill="#450A0A" />
        <path d="M 29.5 18 C 30.5 17, 27.5 15, 26 16.5 L 27 19.5 Z" fill="#450A0A" />

        <!-- Sculpted Ferrari Body: Sharp nose, wide air-intake hips, rear diffuser profile -->
        <path d="M 16 5 
                 C 20.5 5, 24.5 7.5, 25.5 12
                 C 26.2 16, 25.5 21, 26.5 28
                 C 27.2 33, 28 38, 27.5 45
                 C 27 49, 23 50.5, 16 50.5
                 C 9 50.5, 5 49, 4.5 45
                 C 4 38, 4.8 33, 5.5 28
                 C 6.5 21, 5.8 16, 6.5 12
                 C 7.5 7.5, 11.5 5, 16 5 Z" 
              fill="url(#ferrari-rosso-corsa)" 
              stroke="#FFA3A3" 
              stroke-width="0.55" />

        <!-- Front Splitter & Formula 1-Inspired S-Duct Hood Channel -->
        <path d="M 11 7 Q 16 9.5 21 7 L 19 12 Q 16 14 13 12 Z" fill="#18181B" opacity="0.85" />
        <path d="M 13 11 L 16 16 L 19 11" stroke="#991B1B" stroke-width="0.6" fill="none" />

        <!-- Aggressive Slanted LED Matrix Headlights -->
        <path d="M 8.5 10.5 L 12 12.5 L 11 14.5 L 8 12.5 Z" fill="#FFFFFF" style="filter: drop-shadow(0 0 1.5px #60A5FA);" />
        <path d="M 23.5 10.5 L 20 12.5 L 21 14.5 L 24 12.5 Z" fill="#FFFFFF" style="filter: drop-shadow(0 0 1.5px #60A5FA);" />

        <!-- Tinted Teardrop Cockpit Windshield -->
        <path d="M 10 18 L 22 18 L 20.5 27 L 11.5 27 Z" fill="url(#ferrari-carbon-cockpit)" />

        <!-- Black Carbon Contrast Roof with Giallo Modena Prancing Horse Crest Dot -->
        <path d="M 11.5 27 L 20.5 27 L 19.5 35 L 12.5 35 Z" fill="#090D16" />
        <!-- Miniature Yellow Emblem dot on roof/hood -->
        <circle cx="16" cy="14" r="0.8" fill="#FACC15" />

        <!-- Rear Mid-Engine Bay Glass Hatch with Heat Vents -->
        <path d="M 12.5 35 L 19.5 35 L 21 43 L 11 43 Z" fill="url(#ferrari-engine-glass)" />
        <line x1="13.5" y1="37.5" x2="18.5" y2="37.5" stroke="#E2E8F0" stroke-width="0.5" opacity="0.6" />
        <line x1="13" y1="40" x2="19" y2="40" stroke="#E2E8F0" stroke-width="0.5" opacity="0.6" />

        <!-- Rear Twin Round Ferrari Afterburner Taillights & Twin Exhaust Tips -->
        <circle cx="8" cy="48.5" r="1.6" fill="#EF4444" style="filter: drop-shadow(0 0 2px #DC2626);" />
        <circle cx="24" cy="48.5" r="1.6" fill="#EF4444" style="filter: drop-shadow(0 0 2px #DC2626);" />
        <circle cx="8" cy="48.5" r="0.7" fill="#FEE2E2" />
        <circle cx="24" cy="48.5" r="0.7" fill="#FEE2E2" />

        <!-- Rear Aerodynamic Active Diffuser -->
        <rect x="12" y="49.5" width="8" height="1.8" rx="0.5" fill="#090D16" />
        <circle cx="13.5" cy="50" r="0.6" fill="#71717A" />
        <circle cx="18.5" cy="50" r="0.6" fill="#71717A" />
      </svg>
    `;

    carContainer.appendChild(carGraphic);

    // Car Speed Badge (Compact, non-intrusive floating HUD badge)
    const carSpeedBadge = document.createElement('div');
    carSpeedBadge.id = 'user-car-speed-badge';
    carSpeedBadge.className = 'mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-tight text-white bg-red-600/90 border border-white/25 shadow-md backdrop-blur-md select-none pointer-events-none whitespace-nowrap leading-none';
    carSpeedBadge.innerText = '0 km/h';
    carContainer.appendChild(carSpeedBadge);

    userCarElRef.current = carContainer;
    userCarGraphicRef.current = carGraphic;
    userCarSpeedBadgeRef.current = carSpeedBadge;
    userEl.appendChild(carContainer);

    let userTouchStartX = 0;
    let userTouchStartY = 0;
    let userHasMoved = false;

    userEl.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) {
        userTouchStartX = e.touches[0].clientX;
        userTouchStartY = e.touches[0].clientY;
        userHasMoved = false;
      }
    }, { passive: true });

    userEl.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 0) {
        const dx = e.touches[0].clientX - userTouchStartX;
        const dy = e.touches[0].clientY - userTouchStartY;
        if (Math.hypot(dx, dy) > 8) {
          userHasMoved = true;
        }
      }
    }, { passive: true });

    let userPointerStartX = 0;
    let userPointerStartY = 0;
    let userPointerMoved = false;

    userEl.addEventListener('pointerdown', (e) => {
      userPointerStartX = e.clientX;
      userPointerStartY = e.clientY;
      userPointerMoved = false;
    }, { passive: true });

    userEl.addEventListener('pointermove', (e) => {
      if (e.buttons > 0) {
        const dx = e.clientX - userPointerStartX;
        const dy = e.clientY - userPointerStartY;
        if (Math.hypot(dx, dy) > 8) {
          userPointerMoved = true;
        }
      }
    }, { passive: true });

    userEl.addEventListener('click', () => {
      if (userHasMoved || userPointerMoved) {
        userHasMoved = false;
        userPointerMoved = false;
        return;
      }
      // Trigger sensor permission silently if not already granted
      deviceHeadingManager.requestPermission();
      playPinTapSound();

      userCircle.classList.remove('pin-tap-anim');
      void userCircle.offsetWidth;
      userCircle.classList.add('pin-tap-anim');

      isFollowingUserRef.current = true;
      const isCar = gpsNavigationManager.isCarMode();
      const currentPos = gpsNavigationManager.getCurrentInterpolatedCoords();

      map.flyTo({
        center: currentPos,
        zoom: isCar ? 15.6 : 15.2,
        pitch: isCar ? 48 : 52,
        bearing: isCar ? gpsNavigationManager.getCurrentHeading() : map.getBearing(),
        speed: 1.2,
      });
    });

    const uMarker = new maplibregl.Marker({
      element: userEl,
      anchor: 'center',
    })
      .setLngLat(userCoords)
      .addTo(map);

    userMarkerRef.current = uMarker;
  }, [userCoords, defaultAvatar, userName]);

  // High-performance 60fps GPS continuous interpolation and navigation subscription
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const unsubscribe = gpsNavigationManager.subscribe((navState) => {
      if (!userMarkerRef.current) return;

      // 1. Move marker smoothly at 60fps without jumping
      userMarkerRef.current.setLngLat(navState.interpolatedCoords);

      const circleEl = userCircleElRef.current;
      const beamEl = userBeamElRef.current;
      const labelEl = userLabelElRef.current;
      const carEl = userCarElRef.current;
      const carGraphic = userCarGraphicRef.current;
      const speedBadge = userCarSpeedBadgeRef.current;

      const mapBearing = map.getBearing();

      if (navState.isCarMode) {
        // Active Car Mode (speed > 15 km/h with stability margin)
        if (circleEl) {
          circleEl.style.opacity = '0';
          circleEl.style.transform = 'scale(0.5)';
          circleEl.style.pointerEvents = 'none';
        }
        if (beamEl) {
          beamEl.style.opacity = '0';
        }
        if (labelEl) {
          labelEl.style.opacity = '0';
        }
        if (carEl) {
          carEl.style.opacity = '1';
          carEl.style.transform = 'scale(1)';
          carEl.style.pointerEvents = 'auto';
        }
        if (carGraphic) {
          // When in car navigation mode, the camera rotates with the vehicle's heading,
          // so the car graphic is always pointing forward/upward (0°) on screen.
          // In case user manually rotated or during brief transitions, align smoothly with mapBearing:
          const carScreenAngle = isFollowingUserRef.current
            ? 0
            : (navState.heading - mapBearing + 360) % 360;
          carGraphic.style.transform = `rotate(${carScreenAngle.toFixed(1)}deg)`;
          carGraphic.style.webkitTransform = `rotate(${carScreenAngle.toFixed(1)}deg)`;
        }
        if (speedBadge) {
          speedBadge.innerText = `${Math.round(navState.speed)} km/h`;
        }
      } else {
        // Standard Pedestrian / Stationary Mode (<= 15 km/h)
        if (carEl) {
          carEl.style.opacity = '0';
          carEl.style.transform = 'scale(0.5)';
          carEl.style.pointerEvents = 'none';
        }
        if (circleEl) {
          circleEl.style.opacity = '1';
          circleEl.style.transform = 'scale(1)';
          circleEl.style.pointerEvents = 'auto';
        }
        if (beamEl) {
          beamEl.style.opacity = '1';
        }
        if (labelEl) {
          labelEl.style.opacity = '1';
        }
      }

      // Smooth camera follow when user is moving and follow mode is active
      if (isFollowingUserRef.current) {
        const now = performance.now();
        if (now - lastCameraEaseTimeRef.current > 70) {
          lastCameraEaseTimeRef.current = now;

          if (navState.isCarMode) {
            // ============================================================
            // WAZE-STYLE 3D DRIVING NAVIGATION PERSPECTIVE
            // ============================================================
            // 1. Course heading: camera stays behind the Ferrari pointing in driving direction
            const drivingHeading = navState.heading;

            // 2. Speed-adaptive Close-up Street Zoom:
            // - Low speeds / stops / city corners (0-25 km/h): close-up street view (zoom 18.7 - 18.4)
            // - Moderate city speeds (25-55 km/h): zoom 18.2 - 17.7
            // - High highway speeds (55-90+ km/h): zoom 17.2 - 16.8
            const speed = Math.max(0, navState.speed);
            let targetZoom = 18.6;
            if (speed > 80) {
              targetZoom = 16.8;
            } else if (speed > 55) {
              targetZoom = 17.3;
            } else if (speed > 35) {
              targetZoom = 17.8;
            } else if (speed > 18) {
              targetZoom = 18.2;
            } else {
              targetZoom = 18.6;
            }

            // 3. Perspective 3D Pitch:
            // 55° - 58° tilt reveals road ahead while keeping street labels and car clear
            const targetPitch = speed > 50 ? 58 : 55;

            // 4. Position the Ferrari in the lower third / bottom center of the screen
            // In 3D perspective, offset [0, containerHeight * 0.28] keeps the vehicle
            // perfectly placed in the lower-middle screen, showing plenty of road ahead
            const containerHeight = mapContainerRef.current?.clientHeight || 700;
            const bottomOffsetPixels = Math.round(containerHeight * 0.28);

            map.easeTo({
              center: navState.interpolatedCoords,
              offset: [0, bottomOffsetPixels],
              bearing: drivingHeading,
              pitch: targetPitch,
              zoom: targetZoom,
              duration: 200,
              easing: (t) => t * (2 - t),
            });
          } else if (isOrientingHeadingRef.current) {
            // Pedestrian / stationary orienting compass mode
            const deviceHeading = deviceHeadingManager.getCurrentHeading();
            map.easeTo({
              center: navState.interpolatedCoords,
              offset: [0, 0],
              bearing: deviceHeading || 0,
              duration: 110,
              easing: (t) => t,
            });
          } else if (navState.isMoving) {
            map.easeTo({
              center: navState.interpolatedCoords,
              offset: [0, 0],
              duration: 140,
              easing: (t) => t,
            });
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Subscribe to device orientation / compass heading for smooth marker beam rotation
  // When isOrientingHeadingRef is active, the camera rotates to match the device heading,
  // so compensatedHeading will naturally stay at 0° (pointing straight up to the top of screen).
  // Also when moving/rotating while stationary in orient mode, continuously ease the camera.
  useEffect(() => {
    let lastSensorEaseTime = 0;
    const unsubscribe = deviceHeadingManager.subscribe((rawHeading, compensatedHeading) => {
      const beamEl = userBeamElRef.current || (document.getElementById('user-voce-beam') as HTMLElement | null);
      if (beamEl) {
        const rotStr = `rotate(${compensatedHeading.toFixed(1)}deg) translateZ(0)`;
        beamEl.style.transform = rotStr;
        beamEl.style.webkitTransform = rotStr;
      }

      // If in Orienting Mode and not moving at high speed, dynamically sync map bearing with compass smoothly
      const map = mapRef.current;
      if (map && isFollowingUserRef.current && isOrientingHeadingRef.current) {
        const isCar = gpsNavigationManager.isCarMode();
        // If not in fast car motion (where GPS course takes over), follow device compass heading
        if (!isCar) {
          const now = performance.now();
          if (now - lastSensorEaseTime > 60) {
            lastSensorEaseTime = now;
            map.easeTo({
              bearing: rawHeading,
              duration: 180,
              easing: (t) => t * (2 - t), // smooth quadratic ease-out
            });
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // User coordinates tracking: ensure map starts with zoom focused on user
  useEffect(() => {
    if (!hasCenteredInitiallyRef.current && userCoords && !isNaN(userCoords[0])) {
      hasCenteredInitiallyRef.current = true;
      const map = mapRef.current;
      if (map) {
        map.flyTo({
          center: userCoords,
          zoom: 15.2,
          pitch: 52,
          bearing: -13,
          duration: 1000,
          essential: true,
        });
      }
    }
  }, [userCoords]);

  useEffect(() => {
    if (zoomToUserTrigger && zoomToUserTrigger > 0) {
      const map = mapRef.current;
      if (!map) return;
      const currentCoords = gpsNavigationManager.getCurrentInterpolatedCoords();
      const isCar = gpsNavigationManager.isCarMode();
      isFollowingUserRef.current = true;
      isOrientingHeadingRef.current = true;

      const containerHeight = mapContainerRef.current?.clientHeight || 700;
      const bottomOffsetPixels = isCar ? Math.round(containerHeight * 0.28) : 0;

      map.flyTo({
        center: currentCoords,
        offset: [0, bottomOffsetPixels],
        zoom: isCar ? 18.5 : 15.2,
        pitch: isCar ? 55 : 52,
        bearing: isCar ? gpsNavigationManager.getCurrentHeading() : -13,
        duration: 1500,
        curve: 1.4,
        essential: true,
      });
    }
  }, [zoomToUserTrigger]);

  // Controls Handlers
  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 300 });
  };

  const handleCenterUser = async () => {
    setCompassRotation((prev) => prev + 360);
    const map = mapRef.current;
    if (!map) return;

    // 1. Request or awaken device compass sensor permission if on iOS Safari
    deviceHeadingManager.requestPermission();
    playPinTapSound();

    const currentCoords = gpsNavigationManager.getCurrentInterpolatedCoords();
    const isCar = gpsNavigationManager.isCarMode();

    // 2. Fetch current real heading from device orientation or vehicle course
    const deviceHeading = deviceHeadingManager.getCurrentHeading();
    const targetBearing = isCar
      ? gpsNavigationManager.getCurrentHeading()
      : (deviceHeading || 0);

    // 3. Mark both follow and orienting modes active so camera remains locked to user heading
    isFollowingUserRef.current = true;
    isOrientingHeadingRef.current = true;

    // 4. Smoothly fly to user location, orienting bearing to match driving direction
    // and 3D perspective with fluid deceleration curve
    const containerHeight = mapContainerRef.current?.clientHeight || 700;
    const bottomOffsetPixels = isCar ? Math.round(containerHeight * 0.28) : 0;

    map.flyTo({
      center: currentCoords,
      offset: [0, bottomOffsetPixels],
      zoom: isCar ? 18.5 : 15.4,
      pitch: isCar ? 55 : 54,
      bearing: targetBearing,
      duration: 1600,
      curve: 1.42,
      easing: (t) => {
        // Natural Apple-style cubic ease-out curve
        return 1 - Math.pow(1 - t, 3.2);
      },
      essential: true,
    });
  };

  const isWhiteControls = theme === 'light' || currentStyle === 'animado' || currentStyle === 'satelite' || currentStyle === 'transporte';

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden bg-zinc-50 dark:bg-black rounded-t-[26px] ios-page-top-rounded"
      style={{
        borderTopLeftRadius: '26px',
        borderTopRightRadius: '26px',
        overflow: 'hidden',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        isolation: 'isolate',
      }}
    >
      {/* Map Container */}
      <div 
        ref={mapContainerRef} 
        className={`absolute inset-0 w-full h-full z-0 rounded-t-[26px] overflow-hidden ios-page-top-rounded ${
          theme === 'light' || currentStyle === 'animado' || currentStyle === 'transporte'
            ? 'map-canvas-green-boost'
            : currentStyle === 'satelite'
            ? 'map-canvas-satellite-boost'
            : ''
        }`} 
        style={{
          borderTopLeftRadius: '26px',
          borderTopRightRadius: '26px',
          overflow: 'hidden',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        }}
        tabIndex={0} 
      />

      {/* 360° Orbit Focus Indicator (Top pill; stops orbit when tapped, leaves banner and map interactive) */}
      <AnimatePresence>
        {isOrbiting && selectedSpot && !isDetailOpen && (
          <motion.div
            key="spot-360-orbit-overlay"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="fixed top-0 left-0 right-0 z-30 pointer-events-none flex flex-col items-center justify-start py-10 select-none overflow-hidden"
          >
            {/* Top Translucent AI Bar (Clean, shadow around bar, works in dark and white mode) */}
            <div
              onClick={handleOrbitScreenTap}
              onTouchStart={handleOrbitScreenTap}
              className={`mt-12 sm:mt-14 px-4.5 py-2.5 rounded-full backdrop-blur-2xl flex items-center gap-3 pointer-events-auto cursor-pointer active:scale-95 z-10 select-none max-w-[92%] transition-all ${
                isWhiteControls
                  ? 'bg-white/80 text-zinc-900 border border-white shadow-[0_12px_36px_rgba(0,0,0,0.22)]'
                  : 'bg-black/60 text-white border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.65)]'
              }`}
            >
              {/* Round AI Avatar Photo */}
              <div
                className={`w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-xs border ${
                  isWhiteControls ? 'border-white bg-zinc-100' : 'border-white/30 bg-zinc-900'
                }`}
              >
                <img
                  src={robotAvatar}
                  alt="IA"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Text phrase */}
              <span className={`text-xs sm:text-sm font-bold tracking-tight truncate ${
                isWhiteControls ? 'text-zinc-900' : 'text-zinc-100'
              }`}>
                Visualização 360 graus do local...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Map Controls on Right Side (Hidden during 360° orbit) */}
      {!isOrbiting && (
        <aside
          aria-label="Controles do mapa"
          className="absolute right-4 md:right-6 top-1/2 -translate-y-[calc(50%+16px)] z-30 flex flex-col gap-3 pointer-events-auto select-none"
          style={{
            zIndex: 35,
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Zoom In (+) */}
          <button
            id="btn-map-zoom-in"
            onClick={handleZoomIn}
            className="w-12 h-12 rounded-full active:scale-95 flex items-center justify-center focus:outline-none cursor-pointer transition-all bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            title="Aproximar mapa"
          >
            <Plus className="w-6 h-6 stroke-[2.4]" />
          </button>

          {/* Zoom Out (-) */}
          <button
            id="btn-map-zoom-out"
            onClick={handleZoomOut}
            className="w-12 h-12 rounded-full active:scale-95 flex items-center justify-center focus:outline-none cursor-pointer transition-all bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            title="Afastar mapa"
          >
            <Minus className="w-6 h-6 stroke-[2.4]" />
          </button>

          {/* Center & Orient on "Você" / My Location (Compass Icon) */}
          <button
            id="btn-map-locate-me"
            onClick={handleCenterUser}
            className="w-12 h-12 sm:w-13 sm:h-13 rounded-[18px] sm:rounded-[20px] active:scale-95 flex items-center justify-center focus:outline-none cursor-pointer group transition-all bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            title="Centralizar e orientar"
          >
            <motion.div
              animate={{ rotate: compassRotation }}
              transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center pointer-events-none"
            >
              <CompassIcon size={32} className="w-full h-full" />
            </motion.div>
          </button>

          {/* Layers / Styles Switcher Button */}
          <button
            id="btn-map-layer-switch"
            onClick={() => setShowStyleMenu(true)}
            className="w-12 h-12 rounded-full active:scale-95 flex items-center justify-center focus:outline-none cursor-pointer transition-all bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            title="Modos do Mapa"
          >
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </button>
        </aside>
      )}

      {/* NEW Apple Maps Style "Modos do Mapa" Modal (Matches Reference Image 2) */}
      <AnimatePresence>
        {showStyleMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
            {/* Soft Backdrop to dismiss */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowStyleMenu(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              id="map-modes-modal"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              className="relative w-full max-w-[440px] ios-glass rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 text-zinc-800 dark:text-white select-none overflow-hidden z-10"
              style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
            >
              {/* Header: Title Centered */}
              <div className="relative flex items-center justify-center mb-5 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-center">
                  Modos do Mapa
                </h2>
              </div>

              {/* 4 Options Grid */}
              <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5">
                {MODES_CONFIG.map((mode) => {
                  const isSelected =
                    currentStyle === mode.id ||
                    ((mode.id === 'animado' || mode.id === 'transporte') &&
                      (currentStyle === 'animado' || currentStyle === 'transporte'));
                  const ThumbnailComponent = mode.thumbnail;

                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleSelectMode(mode.id)}
                      className="flex flex-col items-center group cursor-pointer focus:outline-none"
                    >
                      {/* Thumbnail Container */}
                      <div
                        className={`relative w-full aspect-square rounded-[18px] sm:rounded-[22px] overflow-hidden transition-all duration-150 p-0.5 ${
                          isSelected
                            ? 'ring-[3px] ring-[#0084ff] shadow-[0_0_18px_rgba(0,132,255,0.7)] scale-[1.03] border-transparent'
                            : 'border border-zinc-200 dark:border-white/10 group-hover:border-zinc-300 dark:group-hover:border-white/30 opacity-80 group-hover:opacity-100 group-hover:scale-[1.01]'
                        }`}
                      >
                        <div className="w-full h-full rounded-[15px] sm:rounded-[19px] overflow-hidden bg-zinc-200 dark:bg-zinc-900">
                          <ThumbnailComponent />
                        </div>
                      </div>

                      {/* Mode Label */}
                      <span
                        className={`text-[11px] sm:text-[13px] text-center mt-2.5 leading-tight font-black transition-colors ${
                          isSelected ? 'text-zinc-800 dark:text-white' : 'text-zinc-500 dark:text-zinc-300 group-hover:text-zinc-800 dark:group-hover:text-white'
                        }`}
                      >
                        {mode.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* One-Time Apple-Style Compass & Sensor Orientation Request */}
      <AnimatePresence>
        {showCompassPrompt && (
          <motion.div
            id="compass-orientation-prompt"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto z-40 p-4 rounded-2xl bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/15 text-white shadow-2xl flex flex-col gap-3 pointer-events-auto"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FFFFFF]/20 flex items-center justify-center shrink-0 text-[#FFFFFF]">
                <Compass className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white tracking-tight">Orientação no Mapa</h4>
                <p className="text-xs text-zinc-300 mt-0.5 leading-snug">
                  Ative os sensores para que o feixe azul do seu marcador acompanhe para onde o celular está apontando.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                id="btn-dismiss-compass"
                type="button"
                onClick={handleDismissCompass}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 active:scale-95 transition-all cursor-pointer"
              >
                Agora Não
              </button>
              <button
                id="btn-enable-compass"
                type="button"
                onClick={handleEnableCompass}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#FFFFFF] hover:bg-zinc-200 text-black active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Ativar Orientação
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const MapComponent = React.memo(MapComponentInner);

