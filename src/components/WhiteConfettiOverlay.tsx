import React, { useEffect, useRef } from 'react';

interface WhiteConfettiOverlayProps {
  triggerKey: number;
  onComplete?: () => void;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  rotSpeed: number;
  flip: number;
  flipSpeed: number;
  swayPhase: number;
  swayFreq: number;
  swayAmp: number;
  gravity: number;
  drag: number;
  terminalVy: number;
  baseAlpha: number;
  tintIndex: 0 | 1 | 2;
  delaySec: number;
  isRibbon: boolean;
}

const FRONT_PALETTE = ['#FFFFFF', '#FCFDFF', '#F8FAFC'] as const;
const BACK_PALETTE = ['#E5E7EB', '#DCE3EC', '#E2E8F0'] as const;

export const WhiteConfettiOverlay: React.FC<WhiteConfettiOverlayProps> = ({
  triggerKey,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!triggerKey || triggerKey <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = Boolean(
      typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const updateCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize, { passive: true });

    const isMobile = width < 768;
    const totalCount = prefersReducedMotion ? 36 : isMobile ? 135 : 190;
    const pieces: ConfettiPiece[] = new Array(totalCount);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    for (let i = 0; i < totalCount; i++) {
      // Split burst across: 55% central radial explosion, 22.5% left upper-mid pop, 22.5% right upper-mid pop
      const r = Math.random();
      let originX = width * 0.5;
      let originY = height * 0.56;
      let angle = -Math.PI / 2;
      let speed = rand(460, 1080);
      let delaySec = 0;

      if (prefersReducedMotion) {
        originX = rand(width * 0.1, width * 0.9);
        originY = rand(-20, height * 0.2);
        angle = Math.PI / 2 + rand(-0.2, 0.2);
        speed = rand(70, 150);
      } else if (r < 0.56) {
        // Central radial burst fanning upward and across the entire screen
        originX = width * rand(0.42, 0.58);
        originY = height * rand(0.50, 0.62);
        angle = -Math.PI / 2 + rand(-1.22, 1.22);
        speed = rand(520, isMobile ? 1050 : 1220);
        delaySec = rand(0, 0.08);
      } else if (r < 0.78) {
        // Left-side upward celebratory cannon
        originX = width * rand(0.06, 0.20);
        originY = height * rand(0.68, 0.80);
        angle = -Math.PI / 2 + rand(0.15, 0.78);
        speed = rand(580, isMobile ? 1080 : 1260);
        delaySec = rand(0.06, 0.18);
      } else {
        // Right-side upward celebratory cannon
        originX = width * rand(0.80, 0.94);
        originY = height * rand(0.68, 0.80);
        angle = -Math.PI / 2 - rand(0.15, 0.78);
        speed = rand(580, isMobile ? 1080 : 1260);
        delaySec = rand(0.06, 0.18);
      }

      const isRibbon = Math.random() < 0.42;
      const w = isRibbon ? rand(9, 15) : rand(6, 10.5);
      const h = isRibbon ? rand(3.2, 4.8) : rand(4.5, 7.5);

      pieces[i] = {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w,
        h,
        rot: rand(0, Math.PI * 2),
        rotSpeed: rand(-6.5, 6.5),
        flip: rand(0, Math.PI * 2),
        flipSpeed: rand(7.5, 14.5),
        swayPhase: rand(0, Math.PI * 2),
        swayFreq: rand(2.2, 4.4),
        swayAmp: rand(28, 68),
        gravity: prefersReducedMotion ? rand(140, 210) : rand(620, 880),
        drag: rand(0.955, 0.976),
        terminalVy: prefersReducedMotion ? rand(120, 170) : rand(210, 340),
        baseAlpha: rand(0.86, 1.0),
        tintIndex: (i % 3) as 0 | 1 | 2,
        delaySec,
        isRibbon,
      };
    }

    let animationFrameId = 0;
    let isDisposed = false;
    let startTime = performance.now();
    let lastTime = startTime;
    const totalDurationSec = prefersReducedMotion ? 1.85 : 4.5;
    const fadeStartSec = prefersReducedMotion ? 1.15 : 3.25;

    const frame = (now: number) => {
      if (isDisposed) return;

      const elapsedSec = (now - startTime) / 1000;
      // Normalize physics timestep cleanly across 60Hz, 90Hz, and 120Hz ProMotion displays
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.032);
      lastTime = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const globalFade =
        elapsedSec > fadeStartSec
          ? Math.max(0, 1 - (elapsedSec - fadeStartSec) / (totalDurationSec - fadeStartSec))
          : 1;

      const frameDragExponent = dt * 60;
      let activeVisibleCount = 0;

      for (let i = 0; i < totalCount; i++) {
        const p = pieces[i];
        if (elapsedSec < p.delaySec) {
          activeVisibleCount++;
          continue;
        }

        // Exponential air resistance + gravity capped at natural paper terminal velocity
        const damping = Math.pow(p.drag, frameDragExponent);
        p.vx *= damping;
        p.vy = Math.min(p.vy * damping + p.gravity * dt, p.terminalVy);

        p.swayPhase += p.swayFreq * dt;
        const flutterVx = p.vy > 0 ? Math.sin(p.swayPhase) * p.swayAmp : 0;

        p.x += (p.vx + flutterVx) * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpeed * dt;
        p.flip += p.flipSpeed * dt;

        // Smooth edge fade near bottom of viewport
        const bottomFade =
          p.y > height - 90 ? Math.max(0, 1 - (p.y - (height - 90)) / 110) : 1;
        const alpha = p.baseAlpha * globalFade * bottomFade;

        if (alpha <= 0.01 || p.y > height + 32 || p.x < -60 || p.x > width + 60) {
          continue;
        }

        activeVisibleCount++;

        const flipCos = Math.cos(p.flip);
        const scaleY = Math.abs(flipCos);
        const renderScaleY = scaleY < 0.14 ? 0.14 : scaleY;
        const isBackFace = flipCos < 0;

        const cosR = Math.cos(p.rot);
        const sinR = Math.sin(p.rot);
        const a = cosR * dpr;
        const b = sinR * dpr;
        const c = -sinR * renderScaleY * dpr;
        const d = cosR * renderScaleY * dpr;

        // Subtle crisp shadow offset under white confetti so every flake reads clearly over light map tiles
        ctx.setTransform(a, b, c, d, (p.x + 0.8) * dpr, (p.y + 1.4) * dpr);
        ctx.globalAlpha = alpha * 0.16;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);

        // Pure crisp white / cool pearl face
        ctx.setTransform(a, b, c, d, p.x * dpr, p.y * dpr);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = isBackFace ? BACK_PALETTE[p.tintIndex] : FRONT_PALETTE[p.tintIndex];
        ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
      }

      if (elapsedSec >= totalDurationSec || activeVisibleCount === 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onCompleteRef.current?.();
        return;
      }

      animationFrameId = requestAnimationFrame(frame);
    };

    animationFrameId = requestAnimationFrame(frame);

    return () => {
      isDisposed = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [triggerKey]);

  if (!triggerKey || triggerKey <= 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[240] overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none block w-full h-full"
        style={{ willChange: 'transform, contents' }}
      />
    </div>
  );
};

export default WhiteConfettiOverlay;
