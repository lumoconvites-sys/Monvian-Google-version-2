import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Spot, SpotCategory, MapModeType, MapVisualIcon } from '../types';
import { Layers, Plus, Minus } from 'lucide-react';
import { CompassIcon } from './CompassIcon';
import { motion, AnimatePresence } from 'motion/react';
import { playPinTapSound } from '../utils/sound';
import { generateMarkerHtml } from '../utils/mapVisualIcons';
import { setupNightLights, removeNightLights } from '../utils/nightLightsLayer';

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
}

// Initial camera overview configuration strictly matching the reference view (IMG_6912)
// Wide regional tourist view with perspective tilt (pitch) and slight orientation (bearing)
const CAMPOS_OVERVIEW_CAMERA = {
  center: [-45.5830, -22.7290] as [number, number],
  zoom: 11.75,
  pitch: 52,
  bearing: -13,
};

export type { MapModeType };

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim();

const createStyle = (type: MapModeType, theme: 'dark' | 'light' = 'dark'): maplibregl.StyleSpecification => {
  if (MAPBOX_TOKEN) {
    let tilePath = theme === 'light' ? 'light-v11' : 'dark-v11';
    if (type === 'satelite') tilePath = 'satellite-streets-v12';
    if (type === 'carro') tilePath = theme === 'light' ? 'navigation-day-v1' : 'navigation-night-v1';
    if (type === 'transporte' || type === 'animado') tilePath = 'streets-v12';
    if (type === 'explorar') tilePath = theme === 'light' ? 'light-v11' : 'dark-v11';

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

  // Satélite: High-resolution Esri Satellite imagery
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
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };
  }

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
        },
      ],
    };
  }

  // Explorar & De Carro:
  // Dark mode: CARTO Dark Matter optimized with high contrast so ground is pure pitch black (#000000) and all streets, names & landmarks are pure crisp white (#FFFFFF)
  // Light mode: CARTO Voyager with rich vibrant colors, high contrast and crystal-clear street labels
  const cartoTiles =
    theme === 'light'
      ? [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ]
      : [
          'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
        ];

  return {
    version: 8,
    projection: { type: 'globe' } as any,
    sources: {
      'carto-base': {
        type: 'raster',
        tiles: cartoTiles,
        tileSize: 256,
        attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'carto-base-layer',
        type: 'raster',
        source: 'carto-base',
        minzoom: 0,
        maxzoom: 20,
        paint: {
          'raster-contrast': theme === 'dark' ? 0.75 : 0.2,
          'raster-brightness-min': 0.0,
          'raster-brightness-max': 1.0,
          'raster-saturation': theme === 'dark' ? -0.9 : 0.15,
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

    {/* 3. Hotel / Lodge (Blue Pin with Bed icon) */}
    <g transform="translate(80, 40)">
      <circle cx="0" cy="0" r="7" fill="#007AFF" />
      <circle cx="0" cy="0" r="6" fill="#1A8CFF" />
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
    {/* Flux Corridor 1 - Neon Emerald Transit Flow */}
    <path
      d="M -10 25 C 25 35, 45 75, 110 80"
      fill="none"
      stroke="#00C896"
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.95"
      filter="drop-shadow(0 0 3px rgba(0,200,150,0.8))"
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
      <circle cx="0" cy="0" r="16" fill="none" stroke="#00C896" strokeWidth="1" opacity="0.3" strokeDasharray="3 2" />
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userAvatarRef = useRef<string>('');
  const spotMarkersRef = useRef<Map<string, SpotMarkerRecord>>(new Map());
  const visualMarkersRef = useRef<Map<string, VisualMarkerRecord>>(new Map());
  const onSelectSpotRef = useRef(onSelectSpot);

  useEffect(() => {
    onSelectSpotRef.current = onSelectSpot;
  }, [onSelectSpot]);

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

  const [currentStyle, setCurrentStyle] = useState<MapModeType>(() => (theme === 'light' ? 'animado' : 'explorar'));
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [compassRotation, setCompassRotation] = useState<number>(0);
  const hasCenteredInitiallyRef = useRef<boolean>(false);
  const lastCameraState = useRef<any>(null);

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

  // Sync highContrast class on container if needed
  useEffect(() => {
    if (mapContainerRef.current) {
      mapContainerRef.current.classList.toggle('high-contrast-map', highContrast);
    }
  }, [highContrast]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialMode: MapModeType = theme === 'light' ? 'animado' : currentStyle;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createStyle(initialMode, theme),
      center: CAMPOS_OVERVIEW_CAMERA.center,
      zoom: CAMPOS_OVERVIEW_CAMERA.zoom,
      pitch: CAMPOS_OVERVIEW_CAMERA.pitch,
      bearing: CAMPOS_OVERVIEW_CAMERA.bearing,
      projection: { type: 'globe' },
      attributionControl: false,
    } as any);

    map.on('load', () => {
      map.resize();
      if ('setProjection' in map && typeof (map as any).setProjection === 'function') {
        try {
          (map as any).setProjection({ type: 'globe' });
        } catch (e) {
          // Fallback if not supported on runtime version
        }
      }
      map.setPadding({ top: 60, right: 20, bottom: 85, left: 20 });
      setupNightLights(map, themeRef.current);
      if (onMapLoadRef.current) {
        onMapLoadRef.current();
      }
    });

    map.on('styledata', () => {
      if (map.isStyleLoaded()) {
        setupNightLights(map, themeRef.current);
      }
    });

    // Dismiss all cards, previews and opened overlays on map touch/click/drag
    const dismissAllOverlays = () => {
      setShowStyleMenu(false);
      onSelectSpotRef.current(null);
      if (onMapClickRef.current) {
        onMapClickRef.current();
      }
    };

    map.on('click', () => {
      dismissAllOverlays();
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
        isInteracting = true;
        mapContainerRef.current?.classList.add('map-panning-active');
      } else {
        interactionTimeout = setTimeout(() => {
          if (!map.isMoving()) {
            isInteracting = false;
            mapContainerRef.current?.classList.remove('map-panning-active');
          }
        }, 120);
      }
    };

    map.on('movestart', () => setInteracting(true));
    map.on('moveend', () => setInteracting(false));
    map.on('dragstart', () => {
      setInteracting(true);
      dismissAllOverlays();
    });
    map.on('dragend', () => setInteracting(false));
    map.on('zoomstart', () => setInteracting(true));
    map.on('zoomend', () => setInteracting(false));

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

    // Handle container resize
    const handleResize = () => {
      map.resize();
    };
    window.addEventListener('resize', handleResize);

    // Also observe the map container element directly to handle dynamic safe area or viewport shifts
    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
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
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualizar estilo quando o modo ou tema mudar (Suave, mantém localização, zoom e centro intactos)
  const handleSelectMode = (mode: MapModeType) => {
    setCurrentStyle(mode);
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
    } else {
      setCurrentStyle((prev) => {
        const nextStyle = prev === 'animado' || prev === 'transporte' ? 'explorar' : prev;
        map.setStyle(createStyle(nextStyle, 'dark'));
        return nextStyle;
      });
    }
  }, [theme]);

  // Helper to update selection visual state without recreating DOM or reloading images
  const updateMarkerSelection = (record: SpotMarkerRecord, isSelected: boolean) => {
    if (isSelected) {
      record.circleEl.className = 'relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-[#007AFF] ring-2 ring-[#007AFF]/70 bg-zinc-900 shrink-0';
    } else {
      record.circleEl.className = 'relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white hover:border-[#007AFF] bg-zinc-900 shrink-0';
    }
  };

  // Render Spots Markers with smart reconciliation (never destroy or recreate existing DOM/images)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentSpotIds = new Set(spots.map((s) => s.id));

    // Remove only markers that are no longer present in the spots list
    spotMarkersRef.current.forEach((record, spotId) => {
      if (!currentSpotIds.has(spotId)) {
        record.marker.remove();
        spotMarkersRef.current.delete(spotId);
      }
    });

    // Add only new markers (keep existing ones completely untouched)
    spots.forEach((spot) => {
      const existing = spotMarkersRef.current.get(spot.id);
      if (existing) {
        // Spot already exists! Keep the DOM and <img> completely untouched.
        // Only update position if coordinates changed
        const currentLngLat = existing.marker.getLngLat();
        if (Math.abs(currentLngLat.lng - spot.lng) > 0.00001 || Math.abs(currentLngLat.lat - spot.lat) > 0.00001) {
          existing.marker.setLngLat([spot.lng, spot.lat]);
        }
        return;
      }

      const el = document.createElement('div');
      el.id = `spot-marker-${spot.id}`;
      el.className = 'spot-marker-container flex flex-col items-center cursor-pointer select-none z-10';

      const circleDiv = document.createElement('div');
      circleDiv.className = 'relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white hover:border-[#007AFF] bg-zinc-900 shrink-0';

      const img = document.createElement('img');
      img.src = spot.image;
      img.alt = spot.name;
      img.className = 'w-full h-full object-cover pointer-events-none';
      img.loading = 'eager';
      img.onerror = () => {
        img.src = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=150&q=80';
      };
      circleDiv.appendChild(img);

      el.appendChild(circleDiv);

      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });

      el.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });

      el.addEventListener('click', (e) => {
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
  }, [spots]);

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
          existing.badgeEl.innerHTML = generateMarkerHtml(item.category, 28, itemColor);
        }
      } else {
        const containerEl = document.createElement('div');
        containerEl.id = `visual-icon-${item.id}`;
        containerEl.className = 'map-visual-icon-marker select-none';
        containerEl.style.width = '28px';
        containerEl.style.height = '28px';
        containerEl.style.display = 'flex';
        containerEl.style.alignItems = 'center';
        containerEl.style.justifyContent = 'center';
        containerEl.style.pointerEvents = 'none';
        containerEl.style.userSelect = 'none';
        containerEl.style.cursor = 'default';

        const badgeEl = document.createElement('div');
        badgeEl.className = 'visual-icon-badge-inner flex items-center justify-center';
        badgeEl.innerHTML = generateMarkerHtml(item.category, 28, item.color);
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
    userEl.className = 'flex flex-col items-center cursor-pointer select-none z-20';

    const userCircle = document.createElement('div');
    userCircle.className = 'relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white ring-2 ring-[#007AFF] bg-zinc-900 shadow-md';

    const userImg = document.createElement('img');
    userImg.id = 'user-voce-marker-img';
    userImg.src = defaultAvatar;
    userImg.alt = userName || 'Você';
    userImg.className = 'w-full h-full object-cover pointer-events-none';
    userCircle.appendChild(userImg);

    userEl.appendChild(userCircle);

    userEl.addEventListener('click', () => {
      playPinTapSound();
      userCircle.classList.remove('pin-tap-anim');
      void userCircle.offsetWidth;
      userCircle.classList.add('pin-tap-anim');
      map.flyTo({
        center: userCoords,
        zoom: 15.5,
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

  // User coordinates tracking: strictly avoid automatic flyTo on load
  // to ensure the camera always opens in the wide regional perspective requested in the second image.
  useEffect(() => {
    hasCenteredInitiallyRef.current = true;
  }, [userCoords]);

  // Controls Handlers
  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 300 });
  };

  const handleCenterUser = () => {
    setCompassRotation((prev) => prev + 360);
    const map = mapRef.current;
    if (!map) return;

    const currentZoom = map.getZoom();
    // If the user is currently zoomed in, clicking the button returns to the wide tourist overview
    if (currentZoom > 13.5) {
      map.flyTo({
        center: CAMPOS_OVERVIEW_CAMERA.center,
        zoom: CAMPOS_OVERVIEW_CAMERA.zoom,
        pitch: CAMPOS_OVERVIEW_CAMERA.pitch,
        bearing: CAMPOS_OVERVIEW_CAMERA.bearing,
        speed: 1.2,
        essential: true,
      });
    } else {
      // Otherwise, smoothly zoom in to the user's location with perspective
      map.flyTo({
        center: userCoords,
        zoom: 14.8,
        pitch: 52,
        bearing: -13,
        speed: 1.2,
        essential: true,
      });
    }
  };

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden bg-zinc-50 dark:bg-black"
    >
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" tabIndex={0} />

      {/* Floating Map Controls on Right Side (Always floats above map and spot icons, identical to top filter bar) */}
      <aside
        aria-label="Controles do mapa"
        className="absolute right-4 top-1/2 -translate-y-[calc(50%+16px)] z-30 flex flex-col gap-2.5 pointer-events-auto select-none"
        style={{
          right: 'max(16px, env(safe-area-inset-right, 0px))',
          zIndex: 35,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Zoom In (+) */}
        <button
          id="btn-map-zoom-in"
          onClick={handleZoomIn}
          className="w-12 h-12 rounded-full ios-glass-btn active:scale-95 text-zinc-700 dark:text-white/95 flex items-center justify-center focus:outline-none cursor-pointer"
          title="Aproximar mapa"
        >
          <Plus className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Zoom Out (-) */}
        <button
          id="btn-map-zoom-out"
          onClick={handleZoomOut}
          className="w-12 h-12 rounded-full ios-glass-btn active:scale-95 text-zinc-700 dark:text-white/95 flex items-center justify-center focus:outline-none cursor-pointer"
          title="Afastar mapa"
        >
          <Minus className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Center on "Você" / My Location (Compass Icon) */}
        <button
          id="btn-map-locate-me"
          onClick={handleCenterUser}
          className="w-12 h-12 sm:w-13 sm:h-13 rounded-[18px] sm:rounded-[20px] ios-glass-btn active:scale-95 text-zinc-700 dark:text-white/95 flex items-center justify-center focus:outline-none cursor-pointer group"
          title="Centralizar Bússola"
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
          className="w-12 h-12 rounded-full ios-glass-btn active:scale-95 text-zinc-700 dark:text-white/95 flex items-center justify-center focus:outline-none cursor-pointer"
          title="Modos do Mapa"
        >
          <Layers className="w-5 h-5 stroke-[2]" />
        </button>
      </aside>

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
              style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}
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
    </div>
  );
};

export const MapComponent = React.memo(MapComponentInner);

