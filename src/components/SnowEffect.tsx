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

export const SnowEffect: React.FC<SnowEffectProps> = ({
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isTabVisible = true;

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

    let countMultiplier = 1;
    if (intensity === 'fraca') countMultiplier = 0.7;
    else if (intensity === 'forte') countMultiplier = 1.45;

    const isMobile = width < 768;
    const totalFlakes = Math.floor((isMobile ? 85 : 155) * countMultiplier);

    const flakes: Snowflake[] = [];

    for (let i = 0; i < totalFlakes; i++) {
      const layer = Math.random() < 0.45 ? 0 : Math.random() < 0.8 ? 1 : 2;
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

      flakes.push({
        x: Math.random() * (width + 100) - 50,
        y: Math.random() * height,
        radius,
        speedY,
        speedX: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: 0.015 + Math.random() * 0.025,
        swing: layer === 0 ? 0.6 : layer === 1 ? 1.4 : 2.4,
        opacity,
        layer,
      });
    }

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = () => {
      if (!isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const isDark = theme === 'dark';

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];

        // Update oscillation & position
        f.angle += f.angleSpeed;
        f.y += f.speedY;
        f.x += Math.sin(f.angle) * f.swing * 0.4 + f.speedX + 0.3; // gentle mountain breeze to the right

        // Reset if off bottom or horizontal bounds
        if (f.y > height + 10) {
          f.y = -10 - Math.random() * 25;
          f.x = Math.random() * (width + 100) - 50;
        }
        if (f.x > width + 50) {
          f.x = -30;
        } else if (f.x < -50) {
          f.x = width + 30;
        }

        // Draw snowflake
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);

        if (f.layer === 2) {
          // Foreground fluffy flake with soft radial glow
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
          if (isDark) {
            grad.addColorStop(0, `rgba(255, 255, 255, ${f.opacity})`);
            grad.addColorStop(0.65, `rgba(235, 248, 255, ${f.opacity * 0.8})`);
            grad.addColorStop(1, 'rgba(215, 235, 255, 0)');
          } else {
            // Light theme: gentle cool-toned snowflake with contrast
            grad.addColorStop(0, `rgba(255, 255, 255, ${f.opacity})`);
            grad.addColorStop(0.55, `rgba(225, 240, 255, ${f.opacity * 0.9})`);
            grad.addColorStop(1, `rgba(160, 195, 230, ${f.opacity * 0.35})`);
          }
          ctx.fillStyle = grad;

          // Shadow for contrast in light theme
          if (!isDark) {
            ctx.shadowColor = 'rgba(70, 110, 160, 0.35)';
            ctx.shadowBlur = 2;
          } else {
            ctx.shadowColor = 'rgba(190, 230, 255, 0.4)';
            ctx.shadowBlur = 3;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // Midground & background dust flakes
          if (isDark) {
            ctx.fillStyle =
              f.layer === 1
                ? `rgba(240, 250, 255, ${f.opacity * 0.9})`
                : `rgba(215, 235, 255, ${f.opacity * 0.65})`;
          } else {
            ctx.fillStyle =
              f.layer === 1
                ? `rgba(180, 205, 235, ${f.opacity * 0.85})`
                : `rgba(140, 175, 215, ${f.opacity * 0.6})`;
          }
          ctx.fill();
        }
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
};

export default SnowEffect;
