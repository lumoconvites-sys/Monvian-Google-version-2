import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  XpRewardEventDetail,
  XpDiscoveryStartDetail,
  XpProximityUpdateDetail,
  monvianXpManager,
} from '../services/xpService';
import { Spot } from '../types';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { triggerHapticFeedback } from '../utils/haptics';

interface XpRewardNotificationOverlayProps {
  visible?: boolean;
  suppressCard?: boolean;
  onSelectSpot?: (spot: Spot) => void;
}

interface ActiveExpansionState extends XpRewardEventDetail {
  id: string;
  pinX: number;
  pinY: number;
  targetX: number;
  targetY: number;
}

interface CoinTrajectory {
  index: number;
  burstOffsetX: number;
  burstOffsetY: number;
  midControlX: number;
  midControlY: number;
  delay: number;
  rotation: number;
}

const COIN_COUNT = 8;

function resolvePinCoordinates(spotId: string, fallbackX?: number, fallbackY?: number): { x: number; y: number } {
  if (typeof document !== 'undefined') {
    const el = document.querySelector<HTMLElement>(`[data-spot-id="${spotId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    }
  }
  const w = typeof window !== 'undefined' ? window.innerWidth : 390;
  const h = typeof window !== 'undefined' ? window.innerHeight : 844;
  return {
    x: typeof fallbackX === 'number' ? fallbackX : w / 2,
    y: typeof fallbackY === 'number' ? fallbackY : h * 0.42,
  };
}

function resolveProfileTabCoordinates(): { x: number; y: number } {
  if (typeof document !== 'undefined') {
    const profileBtn = document.getElementById('nav-btn-perfil');
    if (profileBtn) {
      const rect = profileBtn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    }
  }
  const w = typeof window !== 'undefined' ? window.innerWidth : 390;
  const h = typeof window !== 'undefined' ? window.innerHeight : 844;
  return {
    x: w * 0.82,
    y: h - 42,
  };
}

function pulseProfileNavButton() {
  if (typeof document === 'undefined') return;
  const profileBtn = document.getElementById('nav-btn-perfil');
  if (!profileBtn) return;
  try {
    profileBtn.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.22) translateY(-3px)', offset: 0.45 },
        { transform: 'scale(1)' },
      ],
      {
        duration: 340,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    );
  } catch {}
}

function formatDistanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '120 m';
  if (meters < 1000) {
    return `${Math.max(1, Math.round(meters))} m`;
  }
  const km = (meters / 1000).toFixed(1).replace('.', ',');
  return `${km} km`;
}

export const XpRewardNotificationOverlay: React.FC<XpRewardNotificationOverlayProps> = ({
  visible = true,
  suppressCard = false,
  onSelectSpot,
}) => {
  const [proximity, setProximity] = useState<XpProximityUpdateDetail | null>(() =>
    monvianXpManager.getLastProximity()
  );
  const [isCharging, setIsCharging] = useState(false);
  const [activeExpansion, setActiveExpansion] = useState<ActiveExpansionState | null>(null);
  const [countedCoins, setCountedCoins] = useState<number>(0);

  useEffect(() => {
    const handleProximityUpdate = (e: CustomEvent<XpProximityUpdateDetail | null>) => {
      setProximity(e.detail || null);
    };

    const handleDiscoveryStart = (e: CustomEvent<XpDiscoveryStartDetail>) => {
      const detail = e.detail;
      if (!detail || !detail.spotId) return;
      setIsCharging(true);
    };

    const handleDiscoveryCancel = () => {
      setIsCharging(false);
    };

    const handleReward = (e: CustomEvent<XpRewardEventDetail>) => {
      const detail = e.detail;
      if (!detail) return;

      setIsCharging(false);
      setCountedCoins(12);

      const pinCoords = resolvePinCoordinates(detail.spotId, detail.originX, detail.originY);
      const profileCoords = resolveProfileTabCoordinates();
      const totalAward = detail.xpAwarded || 100;

      const expansionState: ActiveExpansionState = {
        ...detail,
        id: `${detail.spotId}_${Date.now()}`,
        pinX: pinCoords.x,
        pinY: pinCoords.y,
        targetX: profileCoords.x,
        targetY: profileCoords.y,
      };

      setActiveExpansion(expansionState);

      const timers: number[] = [];
      // Step-by-step coin counter as each coin lands
      for (let i = 0; i < COIN_COUNT; i++) {
        const stepMs = 140 + i * 75;
        const stepValue = Math.min(totalAward, Math.round(((i + 1) / COIN_COUNT) * totalAward));
        const t = window.setTimeout(() => {
          setCountedCoins(stepValue);
          if (i % 2 === 0 || i === COIN_COUNT - 1) {
            pulseProfileNavButton();
            try {
              triggerHapticFeedback(10);
            } catch {}
          }
        }, stepMs);
        timers.push(t);
      }

      const cleanupTimer = window.setTimeout(() => {
        setActiveExpansion((prev) => (prev?.id === expansionState.id ? null : prev));
      }, 2500);
      timers.push(cleanupTimer);

      return () => {
        timers.forEach((id) => window.clearTimeout(id));
      };
    };

    window.addEventListener('monvian:xp_proximity_update' as any, handleProximityUpdate);
    window.addEventListener('monvian:xp_discovery_start' as any, handleDiscoveryStart);
    window.addEventListener('monvian:xp_discovery_cancel' as any, handleDiscoveryCancel);
    window.addEventListener('monvian:xp_awarded' as any, handleReward);
    return () => {
      window.removeEventListener('monvian:xp_proximity_update' as any, handleProximityUpdate);
      window.removeEventListener('monvian:xp_discovery_start' as any, handleDiscoveryStart);
      window.removeEventListener('monvian:xp_discovery_cancel' as any, handleDiscoveryCancel);
      window.removeEventListener('monvian:xp_awarded' as any, handleReward);
    };
  }, []);

  // Build deterministic fan + arc trajectories for the 8 coins bursting from the pin to the Profile icon
  const coins: CoinTrajectory[] = React.useMemo(() => {
    if (!activeExpansion) return [];
    const { pinX, pinY, targetX, targetY } = activeExpansion;
    return Array.from({ length: COIN_COUNT }).map((_, i) => {
      const angle = -Math.PI * 0.85 + (i / (COIN_COUNT - 1)) * (Math.PI * 0.7);
      const radius = 42 + (i % 3) * 14;
      const burstOffsetX = Math.cos(angle) * radius;
      const burstOffsetY = Math.sin(angle) * radius - 24;

      const midControlX = pinX + burstOffsetX * 1.15 + (targetX - pinX) * 0.45;
      const midControlY = Math.min(pinY + burstOffsetY, targetY) - 22;

      return {
        index: i,
        burstOffsetX,
        burstOffsetY,
        midControlX,
        midControlY,
        delay: i * 0.055,
        rotation: (i % 2 === 0 ? 1 : -1) * (360 + i * 45),
      };
    });
  }, [activeExpansion]);

  // Determine the active spot info to display in the floating discovery card
  const displaySpot = proximity?.spot || null;
  const displayName = activeExpansion?.spotName || proximity?.spotName || '';
  const displayImage =
    activeExpansion?.spotImage ||
    proximity?.spotImage ||
    (displaySpot ? getSpotImage(displaySpot) : '');
  const distanceMeters = proximity?.distanceMeters ?? 120;
  const rawProgress = activeExpansion ? 1 : isCharging ? 0.92 : proximity?.progress ?? 0.36;
  const clampedProgress = Math.max(0.22, Math.min(1, rawProgress));

  // SVG progress arc geometry around the 54x54 circular photo
  const svgSize = 62;
  const strokeWidth = 3;
  const radius = (svgSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedProgress);

  const showFloatingCard = Boolean(
    visible && (!suppressCard || activeExpansion) && (proximity || activeExpansion) && displayName
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[120] overflow-hidden select-none">
      {/* 1. Circular Expansion + Jumping Coins + Live Coin Counter on Discovery */}
      <AnimatePresence>
        {activeExpansion && (
          <React.Fragment key={activeExpansion.id}>
            <motion.div
              initial={{ opacity: 0.85, scale: 0.45 }}
              animate={{ opacity: 0, scale: 2.65 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                left: activeExpansion.pinX - 32,
                top: activeExpansion.pinY - 32,
                width: 64,
                height: 64,
              }}
              className="rounded-full border-[2px] border-[#007AFF] bg-[#007AFF]/12 shadow-[0_0_24px_rgba(0,122,255,0.45)]"
            />
            <motion.div
              initial={{ opacity: 0.7, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.95 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                left: activeExpansion.pinX - 24,
                top: activeExpansion.pinY - 24,
                width: 48,
                height: 48,
              }}
              className="rounded-full border-[1.5px] border-white/90"
            />

            {/* 8 Coins bursting out of the spot pin and flying to the Profile icon */}
            {coins.map((coin) => (
              <motion.div
                key={`coin-${activeExpansion.id}-${coin.index}`}
                initial={{
                  x: activeExpansion.pinX - 12,
                  y: activeExpansion.pinY - 20,
                  scale: 0.3,
                  opacity: 0,
                  rotate: 0,
                }}
                animate={{
                  x: [
                    activeExpansion.pinX - 12,
                    activeExpansion.pinX + coin.burstOffsetX - 12,
                    coin.midControlX - 12,
                    activeExpansion.targetX - 12,
                  ],
                  y: [
                    activeExpansion.pinY - 20,
                    activeExpansion.pinY + coin.burstOffsetY - 12,
                    coin.midControlY - 12,
                    activeExpansion.targetY - 12,
                  ],
                  scale: [0.35, 1.15, 0.98, 0.55],
                  opacity: [0, 1, 1, 0],
                  rotate: [0, coin.rotation * 0.4, coin.rotation * 0.8, coin.rotation],
                }}
                transition={{
                  duration: 0.76,
                  delay: coin.delay,
                  times: [0, 0.28, 0.65, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  width: 24,
                  height: 24,
                  willChange: 'transform, opacity',
                }}
              >
                <svg
                  viewBox="0 0 32 32"
                  className="w-full h-full drop-shadow-[0_4px_10px_rgba(245,158,11,0.5)]"
                >
                  <defs>
                    <linearGradient id={`coin-rim-${coin.index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FEF08A" />
                      <stop offset="45%" stopColor="#FACC15" />
                      <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                    <linearGradient id={`coin-face-${coin.index}`} x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="60%" stopColor="#FDE047" />
                      <stop offset="100%" stopColor="#FEF9C3" />
                    </linearGradient>
                  </defs>
                  <circle cx="16" cy="17.5" r="13.5" fill="#B45309" />
                  <circle
                    cx="16"
                    cy="15.5"
                    r="13.5"
                    fill={`url(#coin-rim-${coin.index})`}
                    stroke="#FEF08A"
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="16"
                    cy="15.5"
                    r="10.2"
                    fill={`url(#coin-face-${coin.index})`}
                    stroke="#D97706"
                    strokeWidth="0.9"
                  />
                  <path
                    d="M16 9.5L17.65 13.1L21.6 13.55L18.65 16.2L19.45 20.1L16 18.1L12.55 20.1L13.35 16.2L10.4 13.55L14.35 13.1L16 9.5Z"
                    fill="#FEF9C3"
                  />
                </svg>
              </motion.div>
            ))}

            {/* Live Coin Counter Badge above the Profile Icon in Bottom Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.78 }}
              animate={{ opacity: [0, 1, 1, 0], y: [-10, -36, -44, -52], scale: [0.82, 1.08, 1, 0.92] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.55, times: [0, 0.2, 0.8, 1], ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'fixed',
                left: activeExpansion.targetX,
                top: activeExpansion.targetY - 18,
                transform: 'translateX(-50%)',
              }}
              className="px-2.5 py-0.5 rounded-full bg-[#007AFF] text-white font-black text-[12px] tracking-tight shadow-md border border-white whitespace-nowrap tabular-nums"
            >
              +{countedCoins} XP
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>

      {/* 2. Floating iOS Discovery Card above Bottom Navigation */}
      <AnimatePresence>
        {showFloatingCard && (
          <motion.div
            key="monvian-ios-discovery-card"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            style={{
              bottom: 'max(78px, calc(env(safe-area-inset-bottom, 0px) + 74px))',
            }}
            className="md:hidden fixed left-3.5 right-3.5 z-[49] flex justify-center pointer-events-none"
          >
            <div
              onClick={() => {
                if (displaySpot && onSelectSpot) {
                  triggerHapticFeedback(8);
                  onSelectSpot(displaySpot);
                }
              }}
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
                backgroundColor: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(22px) saturate(180%)',
                WebkitBackdropFilter: 'blur(22px) saturate(180%)',
                boxShadow:
                  '0 12px 32px -6px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
              }}
              className="relative w-full max-w-[392px] rounded-[28px] px-3.5 py-3 border border-white/80 flex items-center gap-3.5 pointer-events-auto cursor-pointer active:scale-[0.985] transition-transform duration-200 overflow-hidden"
            >
              {/* Subtle Circular Expansion Flash inside Card when Spot is Discovered */}
              <AnimatePresence>
                {activeExpansion && (
                  <motion.div
                    key={`card-expansion-${activeExpansion.id}`}
                    initial={{ opacity: 0.55, scale: 0.3 }}
                    animate={{ opacity: 0, scale: 2.8 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-7 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[#007AFF]/20 pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {/* Left: Circular Photograph of the Tourist Spot with iOS Blue (#007AFF) Progress Arc */}
              <div className="relative w-[62px] h-[62px] shrink-0 flex items-center justify-center">
                <svg
                  viewBox={`0 0 ${svgSize} ${svgSize}`}
                  className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none overflow-visible"
                >
                  {/* Subtle White/Gray Track Ring */}
                  <circle
                    cx={svgSize / 2}
                    cy={svgSize / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(0, 0, 0, 0.05)"
                    strokeWidth={strokeWidth}
                  />
                  {/* Active iOS Blue (#007AFF) Progress Arc */}
                  <circle
                    cx={svgSize / 2}
                    cy={svgSize / 2}
                    r={radius}
                    fill="none"
                    stroke="#007AFF"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{
                      transition: 'stroke-dashoffset 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </svg>

                <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-zinc-200 border-[2.5px] border-white shadow-[0_2px_8px_rgba(0,0,0,0.10)]">
                  <img
                    src={displayImage}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getSpotFallbackImage(
                        displayName,
                        displaySpot?.category || 'attraction'
                      );
                    }}
                  />
                </div>
              </div>

              {/* Center: Tourist Spot Name in SF Pro + Remaining Distance */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="text-[17px] font-bold text-black tracking-[-0.02em] leading-[1.2] truncate">
                  {displayName}
                </h4>

                <div className="mt-1 flex items-center gap-1.5">
                  {activeExpansion ? (
                    <span className="text-[13.5px] font-semibold text-[#007AFF] tracking-[-0.01em] tabular-nums truncate">
                      Local descoberto · +{countedCoins} XP
                    </span>
                  ) : (
                    <>
                      {/* Minimalist iOS Location Pin Icon */}
                      <svg
                        viewBox="0 0 16 16"
                        className="w-[13px] h-[13px] shrink-0 text-black/50"
                        fill="currentColor"
                      >
                        <path d="M8 1.333A4.667 4.667 0 0 0 3.333 6c0 3.25 4.084 7.792 4.26 7.983a.533.533 0 0 0 .814 0C8.583 13.792 12.667 9.25 12.667 6A4.667 4.667 0 0 0 8 1.333Zm0 6.5A1.833 1.833 0 1 1 8 4.167a1.833 1.833 0 0 1 0 3.666Z" />
                      </svg>
                      <span className="text-[14px] font-medium text-black/55 tracking-[-0.01em] tabular-nums">
                        {formatDistanceLabel(distanceMeters)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Minimalist Animated iOS Blue (#007AFF) Discovery Waveform Indicator */}
              <div
                aria-hidden="true"
                className="shrink-0 pr-1.5 pl-1 flex items-center justify-center gap-[3.5px] h-8"
              >
                {[
                  { baseHeight: 9, peakHeight: 15, delay: 0 },
                  { baseHeight: 15, peakHeight: 23, delay: 0.14 },
                  { baseHeight: 22, peakHeight: 28, delay: 0.28 },
                  { baseHeight: 15, peakHeight: 23, delay: 0.42 },
                  { baseHeight: 9, peakHeight: 15, delay: 0.56 },
                ].map((bar, idx) => (
                  <motion.span
                    key={idx}
                    animate={{
                      height: activeExpansion
                        ? [bar.baseHeight, bar.peakHeight + 4, bar.baseHeight]
                        : [bar.baseHeight, bar.peakHeight, bar.baseHeight],
                      opacity: [0.78, 1, 0.78],
                    }}
                    transition={{
                      duration: isCharging || activeExpansion ? 0.85 : 1.55,
                      repeat: Infinity,
                      delay: bar.delay,
                      ease: 'easeInOut',
                    }}
                    style={{
                      width: '3px',
                      borderRadius: '9999px',
                      backgroundColor: '#007AFF',
                    }}
                    className="block"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
