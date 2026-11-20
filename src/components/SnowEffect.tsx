import React, { useEffect, useRef, useState } from 'react';

interface SnowEffectProps {
  enabled: boolean;
  intensity?: 'fraca' | 'moderada' | 'forte';
  theme?: 'dark' | 'light';
}

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  angle: number;
  angleSpeed: number;
  swing: number;
  opacity: number;
  layer: 0 | 1 | 2; // 0: distant snow dust, 1: mid flakes, 2: foreground soft crystals
}

export const SnowEffect: React.FC<SnowEffectProps> = React.memo(({
  enabled,
  intensity = 'moderada',
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(enabled);
  const [opacityClass, setOpacityClass] = useState(enabled ? 'opacity-100' : 'opacity-0');

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

    let countMultiplier = 1;
    if (intensity === 'fraca') countMultiplier = 0.7;
    else if (intensity === 'forte') countMultiplier = 1.45;
    if (prefersReducedMotion) countMultiplier *= 0.4;

    const isMobile = width < 768;
    const totalFlakes = Math.floor((isMobile ? 80 : 145) * countMultiplier);

    const layer0Flakes: Snowflake[] = [];
    const layer1Flakes: Snowflake[] = [];
    const layer2Flakes: Snowflake[] = [];

    for (let i = 0; i < totalFlakes; i++) {
      const layer: 0 | 1 | 2 = Math.random() < 0.45 ? 0 : Math.random() < 0.8 ? 1 : 2;
      const radius =
        layer === 0
          ? 0.9 + Math.random() * 0.9
          : layer === 1
            ? 1.9 + Math.random() * 1.6
            : 3.6 + Math.random() * 2.6;

      const speedY =
        layer === 0
          ? 0.45 + Math.random() * 0.45
          : layer === 1
            ? 0.85 + Math.random() * 0.75
            : 1.4 + Math.random() * 1.1;

      const opacity =
        layer === 0
          ? 0.35 + Math.random() * 0.25
          : layer === 1
            ? 0.6 + Math.random() * 0.25
            : 0.8 + Math.random() * 0.2;

      const flake: Snowflake = {
        x: Math.random() * (width + 100) - 50,
        y: Math.random() * height,
        radius,
        speedY: prefersReducedMotion ? speedY * 0.55 : speedY,
        speedX: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: 0.015 + Math.random() * 0.025,
        swing: layer === 0 ? 0.6 : layer === 1 ? 1.4 : 2.4,
        opacity,
        layer,
      };
      if (layer === 0) layer0Flakes.push(flake);
      else if (layer === 1) layer1Flakes.push(flake);
      else layer2Flakes.push(flake);
    }

    const isDark = theme === 'dark';
    const layer0Fill = isDark ? 'rgba(215, 235, 255, 0.36)' : 'rgba(140, 175, 215, 0.32)';
    const layer1Fill = isDark ? 'rgba(240, 250, 255, 0.68)' : 'rgba(180, 205, 235, 0.62)';

    // Pre-render soft radial glow sprite once on an offscreen canvas
    const spriteSize = 32;
    const glowSprite = document.createElement('canvas');
    glowSprite.width = spriteSize;
    glowSprite.height = spriteSize;
    const sCtx = glowSprite.getContext('2d');
    if (sCtx) {
      const half = spriteSize / 2;
      const grad = sCtx.createRadialGradient(half, half, 0, half, half, half);
      if (isDark) {
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.65, 'rgba(235, 248, 255, 0.8)');
        grad.addColorStop(1, 'rgba(215, 235, 255, 0)');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.55, 'rgba(225, 240, 255, 0.9)');
        grad.addColorStop(1, 'rgba(160, 195, 230, 0.35)');
      }
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(half, half, half, 0, Math.PI * 2);
      sCtx.fill();
    }

    const updateFlake = (f: Snowflake, dtScale: number) => {
      f.angle += f.angleSpeed * dtScale;
      f.y += f.speedY * dtScale;
      f.x += (Math.sin(f.angle) * f.swing * 0.4 + f.speedX + 0.3) * dtScale;

      if (f.y > height + 10) {
        f.y = -10 - Math.random() * 25;
        f.x = Math.random() * (width + 100) - 50;
      }
      if (f.x > width + 50) {
        f.x = -30;
      } else if (f.x < -50) {
        f.x = width + 30;
      }
    };

    const TWO_PI = Math.PI * 2;

    const render = (now: number) => {
      if (isDisposed || !isTabVisible) {
        animationFrameId = 0;
        return;
      }

      // Delta-time normalization calibrated to 60Hz baseline so 60Hz/90Hz/120Hz move at identical physical speed
      const dtMs = lastTime ? Math.min(now - lastTime, 48) : 16.6667;
      lastTime = now;
      const dtScale = dtMs / 16.6667;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Batched Layer 0 (1 single fill call)
      if (layer0Flakes.length > 0) {
        ctx.fillStyle = layer0Fill;
        ctx.beginPath();
        for (let i = 0; i < layer0Flakes.length; i++) {
          const f = layer0Flakes[i];
          updateFlake(f, dtScale);
          ctx.moveTo(f.x + f.radius, f.y);
          ctx.arc(f.x, f.y, f.radius, 0, TWO_PI);
        }
        ctx.fill();
      }

      // Batched Layer 1 (1 single fill call)
      if (layer1Flakes.length > 0) {
        ctx.fillStyle = layer1Fill;
        ctx.beginPath();
        for (let i = 0; i < layer1Flakes.length; i++) {
          const f = layer1Flakes[i];
          updateFlake(f, dtScale);
          ctx.moveTo(f.x + f.radius, f.y);
          ctx.arc(f.x, f.y, f.radius, 0, TWO_PI);
        }
        ctx.fill();
      }

      // Foreground soft crystal sprites
      if (layer2Flakes.length > 0) {
        for (let i = 0; i < layer2Flakes.length; i++) {
          const f = layer2Flakes[i];
          updateFlake(f, dtScale);
          ctx.globalAlpha = f.opacity;
          const size = f.radius * 2;
          ctx.drawImage(glowSprite, f.x - f.radius, f.y - f.radius, size, size);
        }
        ctx.globalAlpha = 1;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible && !animationFrameId && !isDisposed) {
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
  }, [visible, intensity, theme]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-20 transition-opacity duration-500 ease-in-out ${opacityClass}`}
    >
      {/* Dynamic Snowflake Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 w-full h-full block"
      />

      {/* High-Altitude Mountain Frost Aura (Neve das Montanhas atmosphere) */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-sky-900/15 via-transparent to-sky-950/20'
            : 'bg-gradient-to-b from-sky-200/25 via-transparent to-sky-200/15'
        }`}
      />
    </div>
  );
});

export default SnowEffect;
