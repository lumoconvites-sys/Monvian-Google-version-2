import React, { useEffect, useRef, useState } from 'react';

interface RainEffectProps {
  enabled: boolean;
  weatherCode?: number;
  intensity?: 'fraca' | 'moderada' | 'forte' | 'auto';
  hasLightning?: boolean;
  theme?: 'dark' | 'light';
}

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
  layer: 0 | 1 | 2; // 0: distant, 1: mid, 2: foreground
}

interface Splash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  vx: number;
  vy: number;
}

interface BoltSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  alpha: number;
}

interface ActiveLightning {
  segments: BoltSegment[];
  flashAlpha: number;
  boltAlpha: number;
  ageMs: number;
  maxAgeMs: number;
  reStrikeMs: number;
  reStruck: boolean;
}

export const RainEffect: React.FC<RainEffectProps> = React.memo(({
  enabled,
  weatherCode,
  intensity = 'moderada',
  hasLightning = false,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(enabled);
  const [opacityClass, setOpacityClass] = useState(enabled ? 'opacity-100' : 'opacity-0');

  const resolvedIntensity: 'fraca' | 'moderada' | 'forte' = (() => {
    if (intensity === 'fraca' || intensity === 'moderada' || intensity === 'forte') {
      return intensity;
    }
    if (typeof weatherCode === 'number') {
      if ([65, 67, 82, 95, 96, 99].includes(weatherCode)) return 'forte';
      if ([55, 57, 63, 81].includes(weatherCode)) return 'moderada';
    }
    return 'fraca';
  })();

  const lightningActive = Boolean(
    hasLightning ||
      resolvedIntensity === 'forte' ||
      (typeof weatherCode === 'number' && [65, 82, 95, 96, 99].includes(weatherCode))
  );

  useEffect(() => {
    if (enabled) {
      setVisible(true);
      const timer = setTimeout(() => setOpacityClass('opacity-100'), 20);
      return () => clearTimeout(timer);
    } else {
      setOpacityClass('opacity-0');
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId = 0;
    let resizeRafId = 0;
    let isTabVisible = !document.hidden;
    let isDisposed = false;
    let lastTime = 0;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const applyResize = () => {
      resizeRafId = 0;
      width = window.innerWidth;
      height = window.innerHeight;
      if (canvas) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    };
    const handleResize = () => {
      if (!resizeRafId) {
        resizeRafId = requestAnimationFrame(applyResize);
      }
    };
    applyResize();
    window.addEventListener('resize', handleResize, { passive: true });

    const baseCountMultiplier =
      resolvedIntensity === 'fraca'
        ? 0.55
        : resolvedIntensity === 'forte'
          ? 1.55
          : 1.0;
    const countMultiplier = prefersReducedMotion ? baseCountMultiplier * 0.45 : baseCountMultiplier;

    const speedMultiplier =
      (resolvedIntensity === 'fraca'
        ? 0.72
        : resolvedIntensity === 'forte'
          ? 1.32
          : 1.0) * (prefersReducedMotion ? 0.65 : 1.0);

    const slantX =
      resolvedIntensity === 'fraca'
        ? 0.11
        : resolvedIntensity === 'forte'
          ? 0.29
          : 0.2;

    const isMobile = width < 768;
    const totalDrops = Math.floor((isMobile ? 110 : 185) * countMultiplier);

    const layer0Drops: Drop[] = [];
    const layer1Drops: Drop[] = [];
    const layer2Drops: Drop[] = [];

    for (let i = 0; i < totalDrops; i++) {
      const layer: 0 | 1 | 2 = Math.random() < 0.4 ? 0 : Math.random() < 0.75 ? 1 : 2;
      const baseSpeed =
        layer === 0
          ? 11 + Math.random() * 5
          : layer === 1
            ? 17 + Math.random() * 7
            : 25 + Math.random() * 9;
      const speed = baseSpeed * speedMultiplier;

      const baseLength =
        layer === 0
          ? 9 + Math.random() * 7
          : layer === 1
            ? 17 + Math.random() * 13
            : 28 + Math.random() * 18;
      const length =
        resolvedIntensity === 'fraca'
          ? baseLength * 0.78
          : resolvedIntensity === 'forte'
            ? baseLength * 1.25
            : baseLength;

      const drop: Drop = {
        x: Math.random() * (width + 320) - 160,
        y: Math.random() * height,
        length,
        speed,
        layer,
      };
      if (layer === 0) layer0Drops.push(drop);
      else if (layer === 1) layer1Drops.push(drop);
      else layer2Drops.push(drop);
    }

    const intensityWidthFactor =
      resolvedIntensity === 'fraca' ? 0.85 : resolvedIntensity === 'forte' ? 1.18 : 1;
    const intensityAlphaFactor = resolvedIntensity === 'fraca' ? 0.82 : 1;

    const layerConfigs = [
      {
        drops: layer0Drops,
        width: 0.85 * intensityWidthFactor,
        stroke:
          theme === 'dark'
            ? `rgba(150, 185, 230, ${(0.18 * intensityAlphaFactor).toFixed(3)})`
            : `rgba(90, 140, 200, ${(0.15 * intensityAlphaFactor).toFixed(3)})`,
        groundOffset: 30,
        splashChance: 0.14,
      },
      {
        drops: layer1Drops,
        width: 1.2 * intensityWidthFactor,
        stroke:
          theme === 'dark'
            ? `rgba(185, 215, 255, ${(0.38 * intensityAlphaFactor).toFixed(3)})`
            : `rgba(70, 120, 185, ${(0.34 * intensityAlphaFactor).toFixed(3)})`,
        groundOffset: 60,
        splashChance: 0.16,
      },
      {
        drops: layer2Drops,
        width: 1.65 * intensityWidthFactor,
        stroke:
          theme === 'dark'
            ? `rgba(215, 235, 255, ${(0.62 * intensityAlphaFactor).toFixed(3)})`
            : `rgba(50, 100, 170, ${(0.58 * intensityAlphaFactor).toFixed(3)})`,
        groundOffset: 90,
        splashChance: 0.32,
      },
    ];

    const splashes: Splash[] = [];
    const maxSplashes =
      resolvedIntensity === 'fraca'
        ? isMobile
          ? 14
          : 24
        : resolvedIntensity === 'forte'
          ? isMobile
            ? 40
            : 70
          : isMobile
            ? 24
            : 42;

    const spawnSplash = (x: number, y: number, layer: number) => {
      if (splashes.length >= maxSplashes) return;
      const count = layer === 2 ? (resolvedIntensity === 'forte' ? 3 : 2) : 1;
      for (let s = 0; s < count; s++) {
        splashes.push({
          x: x + (Math.random() * 12 - 6),
          y: y + (Math.random() * 6 - 3),
          radius: 1,
          maxRadius: layer === 2 ? 4 + Math.random() * 3.5 : 2 + Math.random() * 2,
          alpha: layer === 2 ? 0.65 : 0.38,
          vx: (Math.random() - 0.5) * 2.0,
          vy: -Math.random() * 1.6 - 0.5,
        });
      }
    };

    const effectiveLightningActive = lightningActive && !prefersReducedMotion;
    let activeLightning: ActiveLightning | null = null;
    let nextLightningTime =
      performance.now() + (effectiveLightningActive ? 1800 + Math.random() * 3200 : 99999999);

    const createLightningBolt = (): ActiveLightning => {
      const segments: BoltSegment[] = [];
      const startX = width * (0.18 + Math.random() * 0.64);
      const startY = -10;
      const endY = height * (0.42 + Math.random() * 0.28);

      const buildBranch = (
        x0: number,
        y0: number,
        targetY: number,
        lineW: number,
        branchAlpha: number,
        depth: number
      ) => {
        let cx = x0;
        let cy = y0;
        const steps = depth === 0 ? 14 : 7;
        const stepY = (targetY - y0) / steps;

        for (let i = 0; i < steps; i++) {
          const nx = cx + (Math.random() - 0.48) * (depth === 0 ? 38 : 24);
          const ny = cy + stepY * (0.75 + Math.random() * 0.5);
          segments.push({
            x1: cx,
            y1: cy,
            x2: nx,
            y2: ny,
            width: Math.max(0.8, lineW * (1 - (i / steps) * 0.45)),
            alpha: branchAlpha,
          });

          if (depth < 2 && i > 2 && i < steps - 2 && Math.random() < (depth === 0 ? 0.34 : 0.2)) {
            buildBranch(
              nx,
              ny,
              ny + (targetY - ny) * (0.45 + Math.random() * 0.35),
              lineW * 0.55,
              branchAlpha * 0.65,
              depth + 1
            );
          }

          cx = nx;
          cy = ny;
        }
      };

      buildBranch(startX, startY, endY, 2.8, 1.0, 0);

      return {
        segments,
        flashAlpha: 0.42 + Math.random() * 0.22,
        boltAlpha: 1.0,
        ageMs: 0,
        maxAgeMs: 400 + Math.random() * 200,
        reStrikeMs: Math.random() < 0.65 ? 115 + Math.random() * 85 : -1,
        reStruck: false,
      };
    };

    const TWO_PI = Math.PI * 2;
    const splashColorBase = theme === 'dark' ? 'rgba(215, 235, 255, ' : 'rgba(60, 110, 175, ';

    const render = (now: number) => {
      if (isDisposed || !isTabVisible) {
        animationFrameId = 0;
        return;
      }

      const dtMs = lastTime ? Math.min(now - lastTime, 48) : 16.6667;
      lastTime = now;
      const dtScale = dtMs / 16.6667;

      if (effectiveLightningActive && !activeLightning && now >= nextLightningTime) {
        activeLightning = createLightningBolt();
        nextLightningTime = now + 3600 + Math.random() * 5200;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // 0. Draw Lightning Sky Flash & Branched Bolt (time-normalized for 60Hz & 120Hz)
      if (activeLightning) {
        activeLightning.ageMs += dtMs;

        if (
          activeLightning.reStrikeMs > 0 &&
          !activeLightning.reStruck &&
          activeLightning.ageMs >= activeLightning.reStrikeMs
        ) {
          activeLightning.reStruck = true;
          activeLightning.flashAlpha = 0.52;
          activeLightning.boltAlpha = 1.0;
        } else {
          activeLightning.flashAlpha *= Math.pow(0.82, dtScale);
          activeLightning.boltAlpha *= Math.pow(0.84, dtScale);
        }

        if (activeLightning.flashAlpha > 0.01) {
          const flashGrad = ctx.createLinearGradient(0, 0, 0, height);
          flashGrad.addColorStop(0, `rgba(210, 232, 255, ${activeLightning.flashAlpha})`);
          flashGrad.addColorStop(0.55, `rgba(175, 210, 250, ${activeLightning.flashAlpha * 0.45})`);
          flashGrad.addColorStop(1, `rgba(140, 180, 230, ${activeLightning.flashAlpha * 0.12})`);
          ctx.fillStyle = flashGrad;
          ctx.fillRect(0, 0, width, height);
        }

        if (activeLightning.boltAlpha > 0.04) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = 'rgba(125, 211, 252, 0.95)';
          ctx.shadowBlur = 16;

          for (let i = 0; i < activeLightning.segments.length; i++) {
            const seg = activeLightning.segments[i];
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = `rgba(240, 249, 255, ${seg.alpha * activeLightning.boltAlpha})`;
            ctx.lineWidth = seg.width;
            ctx.stroke();
          }
          ctx.restore();
        }

        if (activeLightning.ageMs >= activeLightning.maxAgeMs) {
          activeLightning = null;
        }
      }

      // 1. Draw and update raindrops in 3 batched stroke() calls (instead of 200-320 per frame)
      ctx.lineCap = 'round';
      for (let l = 0; l < layerConfigs.length; l++) {
        const cfg = layerConfigs[l];
        const arr = cfg.drops;
        if (arr.length === 0) continue;

        ctx.strokeStyle = cfg.stroke;
        ctx.lineWidth = cfg.width;
        ctx.beginPath();

        const groundThreshold = height - cfg.groundOffset;
        for (let i = 0; i < arr.length; i++) {
          const d = arr[i];
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + slantX * d.length, d.y + d.length);

          d.x += slantX * d.speed * dtScale;
          d.y += d.speed * dtScale;

          if (d.y >= groundThreshold && Math.random() < cfg.splashChance) {
            spawnSplash(d.x, d.y, d.layer);
          }

          if (d.y > height + 20 || d.x > width + 120 || d.x < -120) {
            d.y = -d.length - Math.random() * 40;
            d.x = Math.random() * (width + 320) - 160;
          }
        }
        ctx.stroke();
      }

      // 2. Draw and update ground splash particles
      for (let s = splashes.length - 1; s >= 0; s--) {
        const sp = splashes[s];
        sp.x += sp.vx * dtScale;
        sp.y += sp.vy * dtScale;
        sp.radius += 0.25 * dtScale;
        sp.alpha -= 0.045 * dtScale;

        if (sp.alpha <= 0 || sp.radius >= sp.maxRadius) {
          splashes.splice(s, 1);
          continue;
        }

        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, sp.radius * 1.4, sp.radius * 0.6, 0, 0, TWO_PI);
        ctx.fillStyle = `${splashColorBase}${(sp.alpha * 0.65).toFixed(3)})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible && animationFrameId === 0 && !isDisposed) {
        lastTime = 0;
        animationFrameId = requestAnimationFrame(render);
      } else if (!isTabVisible && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (isTabVisible) {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      isDisposed = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [visible, resolvedIntensity, lightningActive, theme]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-20 transition-opacity duration-500 ease-in-out ${opacityClass}`}
    >
      {/* Dynamic Raindrop & Lightning Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 w-full h-full block"
      />

      {/* Atmospheric Overcast Vignette (Mountain rain mood) */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          theme === 'dark'
            ? resolvedIntensity === 'forte'
              ? 'bg-gradient-to-b from-slate-950/50 via-slate-950/15 to-slate-950/30'
              : 'bg-gradient-to-b from-slate-950/35 via-transparent to-slate-950/20'
            : resolvedIntensity === 'forte'
              ? 'bg-gradient-to-b from-slate-800/20 via-transparent to-slate-800/15'
              : 'bg-gradient-to-b from-slate-700/10 via-transparent to-slate-700/08'
        }`}
      />
    </div>
  );
});

export default RainEffect;
