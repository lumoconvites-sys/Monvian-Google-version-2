import React, { useEffect, useRef, useState } from 'react';

interface RainEffectProps {
  enabled: boolean;
  weatherCode?: number;
  intensity?: 'fraca' | 'moderada' | 'forte' | 'auto';
  theme?: 'dark' | 'light';
}

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  thickness: number;
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

export const RainEffect: React.FC<RainEffectProps> = ({
  enabled,
  intensity = 'moderada',
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(enabled);
  const [opacityClass, setOpacityClass] = useState(enabled ? 'opacity-100' : 'opacity-0');

  // Handle smooth fade-in and fade-out when toggled
  useEffect(() => {
    if (enabled) {
      setVisible(true);
      // Small tick to trigger CSS opacity transition
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isTabVisible = true;

    // Viewport and DPR sizing
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      if (canvas) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Multiplier based on intensity
    let countMultiplier = 1;
    if (intensity === 'fraca') countMultiplier = 0.65;
    else if (intensity === 'forte') countMultiplier = 1.45;

    const isMobile = width < 768;
    const totalDrops = Math.floor((isMobile ? 120 : 200) * countMultiplier);

    // Initialize raindrops pool
    const drops: Drop[] = [];
    // Slight wind angle (slanted to the left/right simulating mountain gusts)
    const slantX = 0.22; // horizontal drift per unit of vertical fall

    for (let i = 0; i < totalDrops; i++) {
      const layer = Math.random() < 0.4 ? 0 : Math.random() < 0.75 ? 1 : 2;
      const speed =
        layer === 0
          ? 12 + Math.random() * 5
          : layer === 1
            ? 18 + Math.random() * 7
            : 26 + Math.random() * 9;
      const length =
        layer === 0
          ? 10 + Math.random() * 8
          : layer === 1
            ? 18 + Math.random() * 14
            : 30 + Math.random() * 20;
      const thickness = layer === 0 ? 0.9 : layer === 1 ? 1.25 : 1.7;
      const opacity =
        layer === 0
          ? 0.25 + Math.random() * 0.15
          : layer === 1
            ? 0.45 + Math.random() * 0.2
            : 0.65 + Math.random() * 0.25;

      drops.push({
        x: Math.random() * (width + 300) - 150,
        y: Math.random() * height,
        length,
        speed,
        opacity,
        thickness,
        layer,
      });
    }

    // Splash particle pool
    const splashes: Splash[] = [];
    const maxSplashes = isMobile ? 25 : 45;

    const spawnSplash = (x: number, y: number, layer: number) => {
      if (splashes.length >= maxSplashes) return;
      const count = layer === 2 ? 2 : 1;
      for (let s = 0; s < count; s++) {
        splashes.push({
          x: x + (Math.random() * 12 - 6),
          y: y + (Math.random() * 6 - 3),
          radius: 1,
          maxRadius: layer === 2 ? 4 + Math.random() * 3 : 2 + Math.random() * 2,
          alpha: layer === 2 ? 0.6 : 0.35,
          vx: (Math.random() - 0.5) * 1.8,
          vy: -Math.random() * 1.5 - 0.5,
        });
      }
    };

    // Page visibility listener
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Render loop
    const render = () => {
      if (!isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Draw and update raindrops
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];

        // Theme colors
        let strokeColor: string;
        if (theme === 'dark') {
          if (d.layer === 2) {
            strokeColor = `rgba(215, 235, 255, ${d.opacity * 0.85})`;
          } else if (d.layer === 1) {
            strokeColor = `rgba(185, 215, 255, ${d.opacity * 0.75})`;
          } else {
            strokeColor = `rgba(150, 185, 230, ${d.opacity * 0.6})`;
          }
        } else {
          // Light theme needs darker, crisp steel-blue drops to be visible
          if (d.layer === 2) {
            strokeColor = `rgba(50, 100, 170, ${d.opacity * 0.8})`;
          } else if (d.layer === 1) {
            strokeColor = `rgba(70, 120, 185, ${d.opacity * 0.65})`;
          } else {
            strokeColor = `rgba(90, 140, 200, ${d.opacity * 0.5})`;
          }
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = d.thickness;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + slantX * d.length, d.y + d.length);
        ctx.stroke();

        // Advance drop
        d.x += slantX * d.speed;
        d.y += d.speed;

        // Ground splash check
        const groundThreshold = height - (d.layer === 0 ? 30 : d.layer === 1 ? 60 : 90);
        if (d.y >= groundThreshold && Math.random() < (d.layer === 2 ? 0.35 : 0.15)) {
          spawnSplash(d.x, d.y, d.layer);
        }

        // Reset drop when off screen
        if (d.y > height + 20 || d.x > width + 100 || d.x < -100) {
          d.y = -d.length - Math.random() * 40;
          d.x = Math.random() * (width + 300) - 150;
        }
      }

      // 2. Draw and update ground splash particles
      for (let s = splashes.length - 1; s >= 0; s--) {
        const sp = splashes[s];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.radius += 0.25;
        sp.alpha -= 0.045;

        if (sp.alpha <= 0 || sp.radius >= sp.maxRadius) {
          splashes.splice(s, 1);
          continue;
        }

        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, sp.radius * 1.4, sp.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle =
          theme === 'dark'
            ? `rgba(215, 235, 255, ${sp.alpha * 0.65})`
            : `rgba(60, 110, 175, ${sp.alpha * 0.65})`;
        ctx.fill();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [visible, intensity, theme]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-20 transition-opacity duration-500 ease-in-out ${opacityClass}`}
    >
      {/* Dynamic Raindrop Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 w-full h-full block"
      />

      {/* Atmospheric Overcast Vignette (Mountain rain mood) */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-slate-950/35 via-transparent to-slate-950/20'
            : 'bg-gradient-to-b from-slate-700/10 via-transparent to-slate-700/08'
        }`}
      />
    </div>
  );
};

export default RainEffect;
