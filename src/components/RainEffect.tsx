import React, { useEffect, useRef } from 'react';

interface RainEffectProps {
  enabled?: boolean;
  weatherCode?: number;
  theme?: 'dark' | 'light';
}

/**
 * Dynamic and optimized rain animation for Campos do Jordão Map.
 * 
 * Weather codes based on WMO standards (Open-Meteo):
 * Garoa (Drizzle): 51, 52, 53, 54, 55, 56, 57
 * Chuva (Moderate Rain): 61, 63, 80
 * Chuva Forte (Heavy Rain / Storm): 65, 66, 67, 81, 82, 95, 96, 99
 */
export const RainEffect: React.FC<RainEffectProps> = ({
  enabled = true,
  weatherCode = 0,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to calculate rain intensity parameters based on real weather code
  const getRainParams = (code: number, width: number, isLowEndDevice: boolean) => {
    let type: 'none' | 'garoa' | 'chuva' | 'chuva_forte' = 'none';

    if (code >= 51 && code <= 57) {
      type = 'garoa';
    } else if (code === 61 || code === 63 || code === 80) {
      type = 'chuva';
    } else if (
      code === 65 || code === 66 || code === 67 ||
      (code >= 81 && code <= 82) ||
      code >= 95
    ) {
      type = 'chuva_forte';
    }

    if (type === 'none') {
      return { type, maxDrops: 0, minSpeed: 0, maxSpeed: 0, minLength: 0, maxLength: 0, baseOpacity: 0 };
    }

    // Scale particle count based on screen width and device performance capability
    const scaleFactor = Math.min(width, 1000) / 1000;
    const deviceMultiplier = isLowEndDevice ? 0.55 : 1.0;

    let targetCount = 0;
    let minSpeed = 8;
    let maxSpeed = 13;
    let minLength = 10;
    let maxLength = 18;
    let baseOpacity = 0.55;

    if (type === 'garoa') {
      targetCount = Math.round(25 * scaleFactor * deviceMultiplier);
      minSpeed = 9;
      maxSpeed = 14;
      minLength = 12;
      maxLength = 20;
      baseOpacity = 0.50;
    } else if (type === 'chuva') {
      targetCount = Math.round(45 * scaleFactor * deviceMultiplier);
      minSpeed = 15;
      maxSpeed = 22;
      minLength = 18;
      maxLength = 28;
      baseOpacity = 0.65;
    } else if (type === 'chuva_forte') {
      targetCount = Math.round(65 * scaleFactor * deviceMultiplier);
      minSpeed = 20;
      maxSpeed = 28;
      minLength = 24;
      maxLength = 36;
      baseOpacity = 0.80;
    }

    return {
      type,
      maxDrops: Math.max(8, targetCount),
      minSpeed,
      maxSpeed,
      minLength,
      maxLength,
      baseOpacity,
    };
  };

  useEffect(() => {
    if (!enabled) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animFrameId: number;
    let isMounted = true;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Detect low-end hardware concurrency or mobile device for auto-throttling
    const isLowEndDevice =
      (typeof navigator !== 'undefined' &&
        navigator.hardwareConcurrency !== undefined &&
        navigator.hardwareConcurrency <= 4) ||
      width < 640;

    let rainParams = getRainParams(weatherCode, width, isLowEndDevice);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.visualViewport?.height || window.innerHeight;
      rainParams = getRainParams(weatherCode, width, isLowEndDevice);
    };

    window.addEventListener('resize', handleResize);

    // Particle structure
    interface Drop {
      x: number;
      y: number;
      speedY: number;
      speedX: number;
      length: number;
      opacity: number;
    }

    const drops: Drop[] = [];

    const createDrop = (initialYRandom = false): Drop => {
      const p = rainParams;
      const speedY = p.minSpeed + Math.random() * (p.maxSpeed - p.minSpeed);
      const length = p.minLength + Math.random() * (p.maxLength - p.minLength);
      const speedX = Math.random() * 0.7 + 0.3; // subtle natural slant
      const opacity = (Math.random() * 0.4 + 0.6) * p.baseOpacity;

      return {
        x: Math.random() * (width + 100) - 50,
        y: initialYRandom ? Math.random() * height : -length - Math.random() * 100,
        speedY,
        speedX,
        length,
        opacity,
      };
    };

    // Initial drops population
    for (let i = 0; i < rainParams.maxDrops; i++) {
      drops.push(createDrop(true));
    }

    // Smooth global opacity transition for rain start / stop
    let currentFade = rainParams.type !== 'none' ? 1.0 : 0.0;

    const render = () => {
      if (!isMounted) return;

      const targetFade = rainParams.type !== 'none' ? 1.0 : 0.0;
      currentFade += (targetFade - currentFade) * 0.06;

      // When faded out completely and no rain, pause loop to save 100% CPU/GPU
      if (currentFade < 0.005 && targetFade === 0) {
        ctx.clearRect(0, 0, width, height);
        animFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Dynamically adjust pool size when intensity changes
      while (drops.length < rainParams.maxDrops) {
        drops.push(createDrop(false));
      }
      if (drops.length > rainParams.maxDrops) {
        drops.length = rainParams.maxDrops;
      }

      const isDarkTheme = theme === 'dark';

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];

        // Move drop
        drop.y += drop.speedY;
        drop.x += drop.speedX;

        // Reset drop position when leaving canvas
        if (drop.y > height + drop.length) {
          drop.y = -drop.length - Math.random() * 60;
          drop.x = Math.random() * (width + 100) - 50;
          const p = rainParams;
          drop.speedY = p.minSpeed + Math.random() * (p.maxSpeed - p.minSpeed);
          drop.length = p.minLength + Math.random() * (p.maxLength - p.minLength);
        }

        const effectiveOpacity = Math.max(0, Math.min(1, drop.opacity * currentFade));

        if (effectiveOpacity > 0.01) {
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + drop.speedX * 1.5, drop.y + drop.length);

          ctx.strokeStyle = isDarkTheme
            ? `rgba(96, 165, 250, ${effectiveOpacity})`
            : `rgba(37, 99, 235, ${effectiveOpacity})`;

          ctx.lineWidth = 1.75;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      animFrameId = requestAnimationFrame(render);
    };

    // Pause animation when document is not visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animFrameId) cancelAnimationFrame(animFrameId);
      } else {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(render);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    animFrameId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [enabled, weatherCode, theme]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      id="map-rain-canvas"
      className="absolute inset-0 w-full h-full pointer-events-none z-[15] select-none"
      style={{
        willChange: 'transform',
      }}
    />
  );
};
