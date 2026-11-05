import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XpRewardEventDetail, XpDiscoveryStartDetail } from '../services/xpService';
import { triggerHapticFeedback } from '../utils/haptics';

interface ActiveBurstState extends XpRewardEventDetail {
  id: string;
  pinX: number;
  pinY: number;
  targetX: number;
  targetY: number;
}

interface ChargingPinState {
  spotId: string;
  spotName: string;
  pinX: number;
  pinY: number;
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
        { transform: 'scale(1.28) translateY(-4px)', offset: 0.4 },
        { transform: 'scale(0.94) translateY(0px)', offset: 0.75 },
        { transform: 'scale(1)' },
      ],
      {
        duration: 360,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    );
  } catch {}
}

export const XpRewardNotificationOverlay: React.FC = () => {
  const [chargingPin, setChargingPin] = useState<ChargingPinState | null>(null);
  const [activeBurst, setActiveBurst] = useState<ActiveBurstState | null>(null);
  const [profileImpactActive, setProfileImpactActive] = useState(false);

  useEffect(() => {
    const handleDiscoveryStart = (e: CustomEvent<XpDiscoveryStartDetail>) => {
      const detail = e.detail;
      if (!detail || !detail.spotId) return;
      const { x, y } = resolvePinCoordinates(detail.spotId);
      setChargingPin({
        spotId: detail.spotId,
        spotName: detail.spotName,
        pinX: x,
        pinY: y,
      });
    };

    const handleDiscoveryCancel = () => {
      setChargingPin(null);
    };

    const handleReward = (e: CustomEvent<XpRewardEventDetail>) => {
      const detail = e.detail;
      if (!detail) return;

      setChargingPin(null);

      const pinCoords = resolvePinCoordinates(detail.spotId, detail.originX, detail.originY);
      const profileCoords = resolveProfileTabCoordinates();

      const burstState: ActiveBurstState = {
        ...detail,
        id: `${detail.spotId}_${Date.now()}`,
        pinX: pinCoords.x,
        pinY: pinCoords.y,
        targetX: profileCoords.x,
        targetY: profileCoords.y,
      };

      setActiveBurst(burstState);

      // Schedule tactile & visual pulses on the bottom Profile button as the coins arrive
      const impactTimers: number[] = [];
      for (let i = 0; i < COIN_COUNT; i++) {
        const arrivalMs = 520 + i * 62;
        const t = window.setTimeout(() => {
          if (i === 0) {
            setProfileImpactActive(true);
          }
          if (i % 2 === 0) {
            pulseProfileNavButton();
            try {
              triggerHapticFeedback(12);
            } catch {}
          }
        }, arrivalMs);
        impactTimers.push(t);
      }

      const endImpactTimer = window.setTimeout(() => {
        setProfileImpactActive(false);
      }, 1650);
      impactTimers.push(endImpactTimer);

      const cleanupTimer = window.setTimeout(() => {
        setActiveBurst((prev) => (prev?.id === burstState.id ? null : prev));
      }, 2400);
      impactTimers.push(cleanupTimer);

      return () => {
        impactTimers.forEach((id) => window.clearTimeout(id));
      };
    };

    window.addEventListener('monvian:xp_discovery_start' as any, handleDiscoveryStart);
    window.addEventListener('monvian:xp_discovery_cancel' as any, handleDiscoveryCancel);
    window.addEventListener('monvian:xp_awarded' as any, handleReward);
    return () => {
      window.removeEventListener('monvian:xp_discovery_start' as any, handleDiscoveryStart);
      window.removeEventListener('monvian:xp_discovery_cancel' as any, handleDiscoveryCancel);
      window.removeEventListener('monvian:xp_awarded' as any, handleReward);
    };
  }, []);

  // Build deterministic fan + arc trajectories for the 8 golden coins bursting from the pin
  const coins: CoinTrajectory[] = React.useMemo(() => {
    if (!activeBurst) return [];
    const { pinX, pinY, targetX, targetY } = activeBurst;
    return Array.from({ length: COIN_COUNT }).map((_, i) => {
      // Spread coins in an upward fan above the jumping pin (-52px to +52px horizontally, -45px to -85px vertically)
      const angle = -Math.PI * 0.85 + (i / (COIN_COUNT - 1)) * (Math.PI * 0.7);
      const radius = 44 + (i % 3) * 14;
      const burstOffsetX = Math.cos(angle) * radius;
      const burstOffsetY = Math.sin(angle) * radius - 26;

      // Parabolic midpoint toward the bottom-right Profile button
      const midControlX = pinX + burstOffsetX * 1.15 + (targetX - pinX) * 0.45;
      const midControlY = Math.min(pinY + burstOffsetY, targetY) - 24;

      return {
        index: i,
        burstOffsetX,
        burstOffsetY,
        midControlX,
        midControlY,
        delay: i * 0.058,
        rotation: (i % 2 === 0 ? 1 : -1) * (360 + i * 45),
      };
    });
  }, [activeBurst]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[300] overflow-hidden select-none">
      {/* 1. 1.5s Pin Charging Micro-Label right above the pin */}
      <AnimatePresence>
        {chargingPin && (
          <motion.div
            key={`charge-${chargingPin.spotId}`}
            initial={{ opacity: 0, scale: 0.82, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            style={{
              position: 'fixed',
              left: chargingPin.pinX,
              top: Math.max(48, chargingPin.pinY - 56),
              transform: 'translate(-50%, -100%)',
            }}
            className="px-3 py-1 rounded-full bg-white text-zinc-950 border border-black/10 shadow-[0_6px_20px_rgba(0,0,0,0.18)] flex items-center gap-1.5 whitespace-nowrap"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[11.5px] font-bold tracking-tight">
              Descobrindo {chargingPin.spotName}...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Pin Jump Shockwave + Floating "+100 XP" Badge + Golden Coins Flying to Profile */}
      <AnimatePresence>
        {activeBurst && (
          <React.Fragment key={activeBurst.id}>
            {/* Golden Shockwave Ring at the Jumping Pin */}
            <motion.div
              initial={{ opacity: 0.95, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                left: activeBurst.pinX - 28,
                top: activeBurst.pinY - 28,
                width: 56,
                height: 56,
              }}
              className="rounded-full border-[3px] border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.8)]"
            />

            {/* Floating "+100 XP" & Spot Discovered Badge rising directly from the jumping pin */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1.16, 1, 0.94],
                y: [-16, -54, -68, -86],
              }}
              transition={{
                duration: 1.85,
                times: [0, 0.22, 0.78, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                position: 'fixed',
                left: activeBurst.pinX,
                top: activeBurst.pinY - 24,
                transform: 'translateX(-50%)',
              }}
              className="flex flex-col items-center"
            >
              <div
                className="px-3.5 py-1.5 rounded-full bg-[#fefefe] text-zinc-950 border border-white flex items-center gap-2 whitespace-nowrap"
                style={{
                  boxShadow:
                    '0 10px 26px rgba(0,0,0,0.22), 0 3px 6px rgba(0,0,0,0.1), inset 0 2px 0 #ffffff',
                  borderBottom: '3px solid #e4e4e7',
                }}
              >
                <span className="px-2 py-0.5 rounded-full bg-[#0066FF] text-white font-black text-[12px] tracking-tight tabular-nums">
                  +{activeBurst.xpAwarded} XP
                </span>
                <span className="text-[12.5px] font-bold tracking-tight text-zinc-900 max-w-[170px] truncate">
                  {activeBurst.spotName}
                </span>
              </div>
              {activeBurst.leveledUp && (
                <span className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-extrabold text-[10.5px] tracking-wide uppercase shadow-md">
                  Novo Nível · {activeBurst.levelTitle}
                </span>
              )}
            </motion.div>

            {/* 8 3D Golden Coins bursting out of the pin and flying into the Profile tab icon */}
            {coins.map((coin) => (
              <motion.div
                key={`coin-${activeBurst.id}-${coin.index}`}
                initial={{
                  x: activeBurst.pinX - 13,
                  y: activeBurst.pinY - 22,
                  scale: 0.3,
                  opacity: 0,
                  rotate: 0,
                }}
                animate={{
                  x: [
                    activeBurst.pinX - 13,
                    activeBurst.pinX + coin.burstOffsetX - 13,
                    coin.midControlX - 13,
                    activeBurst.targetX - 13,
                  ],
                  y: [
                    activeBurst.pinY - 22,
                    activeBurst.pinY + coin.burstOffsetY - 13,
                    coin.midControlY - 13,
                    activeBurst.targetY - 13,
                  ],
                  scale: [0.35, 1.18, 1.0, 0.55],
                  opacity: [0, 1, 1, 0],
                  rotate: [0, coin.rotation * 0.4, coin.rotation * 0.8, coin.rotation],
                }}
                transition={{
                  duration: 0.78,
                  delay: coin.delay,
                  times: [0, 0.28, 0.65, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  width: 26,
                  height: 26,
                  willChange: 'transform, opacity',
                }}
              >
                {/* 3D Golden Coin SVG with specular highlight and embossed star */}
                <svg
                  viewBox="0 0 32 32"
                  className="w-full h-full drop-shadow-[0_4px_10px_rgba(245,158,11,0.55)]"
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
                  {/* Coin 3D Bottom Thickness Edge */}
                  <circle cx="16" cy="17.5" r="13.5" fill="#B45309" />
                  {/* Coin Outer Gold Rim */}
                  <circle
                    cx="16"
                    cy="15.5"
                    r="13.5"
                    fill={`url(#coin-rim-${coin.index})`}
                    stroke="#FEF08A"
                    strokeWidth="1.2"
                  />
                  {/* Coin Inner Recessed Face */}
                  <circle
                    cx="16"
                    cy="15.5"
                    r="10.2"
                    fill={`url(#coin-face-${coin.index})`}
                    stroke="#D97706"
                    strokeWidth="0.9"
                  />
                  {/* Embossed Center Star Emblem */}
                  <path
                    d="M16 9.5L17.65 13.1L21.6 13.55L18.65 16.2L19.45 20.1L16 18.1L12.55 20.1L13.35 16.2L10.4 13.55L14.35 13.1L16 9.5Z"
                    fill="#B45309"
                    opacity="0.35"
                    transform="translate(0, 0.8)"
                  />
                  <path
                    d="M16 9.5L17.65 13.1L21.6 13.55L18.65 16.2L19.45 20.1L16 18.1L12.55 20.1L13.35 16.2L10.4 13.55L14.35 13.1L16 9.5Z"
                    fill="#FEF9C3"
                  />
                </svg>
              </motion.div>
            ))}
          </React.Fragment>
        )}
      </AnimatePresence>

      {/* 3. Impact Glow & Floating "+100 XP" at the Profile Icon in Bottom Navigation */}
      <AnimatePresence>
        {profileImpactActive && activeBurst && (
          <React.Fragment key={`impact-${activeBurst.id}`}>
            {/* Golden-Blue Halo Ring around the Profile Tab Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], scale: [0.7, 1.55, 1.85] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                left: activeBurst.targetX - 24,
                top: activeBurst.targetY - 24,
                width: 48,
                height: 48,
              }}
              className="rounded-full border-2 border-[#0066FF] bg-amber-300/25 shadow-[0_0_20px_rgba(0,102,255,0.65)]"
            />

            {/* Mini "+100 XP" badge rising directly above the Profile tab icon */}
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.75 }}
              animate={{ opacity: [0, 1, 1, 0], y: [-12, -38, -46, -56], scale: [0.8, 1.08, 1, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.15, times: [0, 0.25, 0.75, 1], ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'fixed',
                left: activeBurst.targetX,
                top: activeBurst.targetY - 18,
                transform: 'translateX(-50%)',
              }}
              className="px-2.5 py-0.5 rounded-full bg-[#0066FF] text-white font-black text-[11.5px] tracking-tight shadow-md border border-white whitespace-nowrap tabular-nums"
            >
              +{activeBurst.xpAwarded} XP
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
};
