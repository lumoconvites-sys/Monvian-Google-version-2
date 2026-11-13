import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  XpRewardEventDetail,
  monvianXpManager,
} from '../services/xpService';
import { triggerHapticFeedback } from '../utils/haptics';

interface XpRewardNotificationOverlayProps {
  visible?: boolean;
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

export const XpRewardNotificationOverlay: React.FC<XpRewardNotificationOverlayProps> = ({
  visible = true,
}) => {
  const [activeExpansion, setActiveExpansion] = useState<ActiveExpansionState | null>(null);
  const [countedCoins, setCountedCoins] = useState<number>(0);
  const timersRef = React.useRef<number[]>([]);

  useEffect(() => {
    const clearAllTimers = () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };

    const handleReward = (e: CustomEvent<XpRewardEventDetail>) => {
      const detail = e.detail;
      if (!detail) return;

      clearAllTimers();
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
        timersRef.current.push(t);
      }

      const cleanupTimer = window.setTimeout(() => {
        setActiveExpansion((prev) => (prev?.id === expansionState.id ? null : prev));
      }, 2500);
      timersRef.current.push(cleanupTimer);
    };

    window.addEventListener('monvian:xp_awarded' as any, handleReward);
    return () => {
      clearAllTimers();
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
    </div>
  );
};
