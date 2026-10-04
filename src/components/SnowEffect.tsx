import React, { useEffect, useRef } from 'react';

interface SnowEffectProps {
  enabled?: boolean;
  theme?: 'dark' | 'light';
}

export const SnowEffect: React.FC<SnowEffectProps> = ({ enabled = false, theme = 'dark' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const flakeCount = Math.floor(Math.min(width, 1200) / 18);
    const flakes: {
      x: number;
      y: number;
      r: number;
      d: number;
      opacity: number;
      speedY: number;
      speedX: number;
      shape: 'crystal' | 'dot';
    }[] = [];

    for (let i = 0; i < flakeCount; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 6 + 2,
        d: Math.random() * flakeCount,
        opacity: Math.random() * 0.45 + 0.15,
        speedY: Math.random() * 0.8 + 0.3,
        speedX: Math.random() * 0.4 - 0.2,
        shape: Math.random() > 0.65 ? 'crystal' : 'dot',
      });
    }

    const drawSnowflakeCrystal = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      radius: number,
      opacity: number
    ) => {
      context.save();
      context.translate(x, y);

      // Snowflake styling for realistic appearance
      const strokeColor = theme === 'light' ? `rgba(255, 255, 255, ${Math.min(1, opacity + 0.3)})` : `rgba(255, 255, 255, ${opacity})`;
      const fillColor = theme === 'light' ? `rgba(255, 255, 255, ${Math.min(1, opacity + 0.2)})` : `rgba(255, 255, 255, ${opacity * 0.9})`;

      context.shadowBlur = theme === 'light' ? 3 : 6;
      context.shadowColor = theme === 'light' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.6)';
      context.strokeStyle = strokeColor;
      context.fillStyle = fillColor;
      context.lineWidth = 1.2;

      // 6-arm star/crystal
      for (let i = 0; i < 6; i++) {
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -radius);
        context.stroke();

        if (radius > 4) {
          context.beginPath();
          context.moveTo(0, -radius * 0.55);
          context.lineTo(radius * 0.28, -radius * 0.75);
          context.moveTo(0, -radius * 0.55);
          context.lineTo(-radius * 0.28, -radius * 0.75);
          context.stroke();
        }

        context.rotate(Math.PI / 3);
      }
      context.restore();
    };

    let angle = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      angle += 0.008;

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.speedY;
        f.x += Math.sin(angle + f.d) * 0.4 + f.speedX;

        if (f.y > height + 10) {
          f.y = -10;
          f.x = Math.random() * width;
        }
        if (f.x > width + 10) f.x = -10;
        if (f.x < -10) f.x = width + 10;

        if (f.shape === 'crystal') {
          drawSnowflakeCrystal(ctx, f.x, f.y, f.r * 1.5, f.opacity);
        } else {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r * 0.8, 0, Math.PI * 2);

          const dotColor = theme === 'light' ? `rgba(255, 255, 255, ${Math.min(1, f.opacity + 0.3)})` : `rgba(255, 255, 255, ${f.opacity})`;
          const shadowColor = theme === 'light' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.5)';

          ctx.fillStyle = dotColor;
          ctx.shadowBlur = theme === 'light' ? 3 : 5;
          ctx.shadowColor = shadowColor;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled, theme]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      id="snow-canvas-overlay"
      className="pointer-events-none absolute inset-0 z-[15] h-full w-full opacity-90 select-none"
    />
  );
};
