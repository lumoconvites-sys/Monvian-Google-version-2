import React, { useEffect, useRef } from 'react';

export interface WhiteConfettiOverlayProps {
  triggerKey: number;
  onComplete?: () => void;
}

type ParticleKind = 0 | 1 | 2; // 0 = rectangular 3D flake, 1 = curved 3D ribbon, 2 = micro cluster shard

interface ConfettiParticle3D {
  kind: ParticleKind;
  x: number;
  y: number;
  z: number; // 3D depth layer: 0.25 (far) .. 1.45 (close foreground)
  vx: number;
  vy: number;
  vz: number;
  w: number;
  h: number;
  // 3D Euler angles & angular velocities
  yaw: number;
  yawSpeed: number;
  pitch: number;
  pitchSpeed: number;
  roll: number;
  rollSpeed: number;
  // Aerodynamic oscillation & ribbon curvature
  swayPhase: number;
  swayFreq: number;
  swayAmp: number;
  ribbonCurveAmp: number;
  ribbonCurvePhase: number;
  ribbonCurveSpeed: number;
  // Physics constants
  gravity: number;
  drag: number;
  terminalVy: number;
  baseAlpha: number;
  materialIdx: 0 | 1 | 2 | 3; // 0 = Pure Satin White, 1 = Pearl White, 2 = Brushed Silver, 3 = Specular Chrome Silver
  delaySec: number;
}

// Precomputed 3D lighting LUT palettes (zero runtime string allocations during 120fps render loop)
// Ordered from deepest shaded back-face (0) -> mid silver/pearl (4) -> lit white (7) -> pure specular glare (9)
const MATERIAL_SHADE_LUTS: readonly (readonly string[])[] = [
  // 0: Pure Satin White
  [
    '#CBD5E1',
    '#D6DEE8',
    '#E2E8F0',
    '#ECF1F7',
    '#F3F6FA',
    '#F8FAFC',
    '#FCFDFE',
    '#FFFFFF',
    '#FFFFFF',
    '#FFFFFF',
  ],
  // 1: Cool Pearl White
  [
    '#C3CDD9',
    '#CFD8E3',
    '#DCE3ED',
    '#E6ECF4',
    '#EFF4F9',
    '#F5F8FC',
    '#FAFDFE',
    '#FFFFFF',
    '#FFFFFF',
    '#FFFFFF',
  ],
  // 2: Brushed Metallic Silver
  [
    '#94A3B8',
    '#A3B1C6',
    '#B4C0D3',
    '#C4CFE0',
    '#D3DCEB',
    '#E2E8F0',
    '#EEF2F7',
    '#F8FAFC',
    '#FFFFFF',
    '#FFFFFF',
  ],
  // 3: Specular Chrome Silver
  [
    '#8B9AB0',
    '#9AA8BE',
    '#AEBBD0',
    '#C2CEE0',
    '#D5DFEE',
    '#E6ECF5',
    '#F3F7FB',
    '#FFFFFF'.replace('', ''),
    '#FFFFFF',
    '#FFFFFF',
  ],
];

// Normalized directional key light coming from top-left-front
const LIGHT_X = -0.38;
const LIGHT_Y = -0.68;
const LIGHT_Z = 0.62;

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
    const ctx = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
    });
    if (!ctx) return;

    const prefersReducedMotion = Boolean(
      typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );

    let width = window.innerWidth || 390;
    let height = window.innerHeight || 844;
    let dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const updateCanvasSize = () => {
      width = window.innerWidth || 390;
      height = window.innerHeight || 844;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize, { passive: true });

    const isMobile = width < 768;
    // Balanced high-density particle count for 120 FPS fluid rendering without memory bloat
    const totalCount = prefersReducedMotion ? 54 : isMobile ? 410 : 540;
    const particles: ConfettiParticle3D[] = new Array(totalCount);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const heightScale = Math.max(0.86, Math.min(1.28, height / 844));

    // Pre-generate 7 focal burst cluster centers across the screen so small confetti burst in tight natural clusters
    const clusterCenters = [
      { x: width * 0.5, y: height * 0.44, angleBase: -Math.PI * 0.5, spread: 1.55, delay: 0.0 },
      { x: width * 0.24, y: height * 0.36, angleBase: -Math.PI * 0.44, spread: 1.35, delay: 0.02 },
      { x: width * 0.76, y: height * 0.36, angleBase: -Math.PI * 0.56, spread: 1.35, delay: 0.02 },
      { x: width * 0.14, y: height * 0.68, angleBase: -Math.PI * 0.33, spread: 0.78, delay: 0.03 },
      { x: width * 0.86, y: height * 0.68, angleBase: -Math.PI * 0.67, spread: 0.78, delay: 0.03 },
      { x: width * 0.36, y: height * 0.22, angleBase: -Math.PI * 0.48, spread: 1.65, delay: 0.05 },
      { x: width * 0.64, y: height * 0.22, angleBase: -Math.PI * 0.52, spread: 1.65, delay: 0.05 },
    ];

    for (let i = 0; i < totalCount; i++) {
      const r = Math.random();
      let originX = width * 0.5;
      let originY = height * 0.46;
      let angle = -Math.PI / 2;
      let speed = rand(520, 1280) * heightScale;
      let delaySec = 0;

      if (prefersReducedMotion) {
        originX = rand(width * 0.06, width * 0.94);
        originY = rand(-20, height * 0.35);
        angle = Math.PI / 2 + rand(-0.25, 0.25);
        speed = rand(65, 145);
      } else if (r < 0.68) {
        // Grouped 3D cluster explosions distributed across the screen
        const cluster = clusterCenters[i % clusterCenters.length];
        // Tight spatial grouping around cluster core
        originX = cluster.x + rand(-width * 0.055, width * 0.055);
        originY = cluster.y + rand(-height * 0.045, height * 0.045);
        angle = cluster.angleBase + rand(-cluster.spread, cluster.spread);
        speed = rand(460, isMobile ? 1260 : 1460) * heightScale;
        delaySec = cluster.delay + rand(0, 0.065);
      } else if (r < 0.86) {
        // Secondary wide radial burst covering mid & lower screen
        originX = width * rand(0.12, 0.88);
        originY = height * rand(0.28, 0.64);
        angle = -Math.PI / 2 + rand(-1.48, 1.48);
        speed = rand(380, 1080) * heightScale;
        delaySec = rand(0.02, 0.14);
      } else {
        // Upper floating canopy wave for full-viewport coverage
        originX = width * rand(0.03, 0.97);
        originY = rand(-32, height * 0.14);
        angle = Math.PI / 2 + rand(-0.48, 0.48);
        speed = rand(210, 480) * heightScale;
        delaySec = rand(0.04, 0.28);
      }

      // 3D depth coordinate (0.28 far background -> 1.42 close foreground)
      const depthRand = Math.random();
      const z =
        depthRand < 0.18
          ? rand(1.12, 1.42) // Foreground bokeh-like close particles
          : depthRand < 0.68
            ? rand(0.68, 1.12) // Mid-plane primary cluster
            : rand(0.32, 0.68); // Deep background micro-particles

      const perspectiveScale = 0.54 + z * 0.58;

      // Particle geometry mix:
      // ~52% small rectangular 3D confetti, ~28% fine curved 3D ribbons, ~20% micro cluster flakes
      const kindRoll = Math.random();
      const kind: ParticleKind =
        kindRoll < 0.52 ? 0 : kindRoll < 0.80 ? 1 : 2;

      let w: number;
      let h: number;
      if (kind === 1) {
        // Fine curved 3D ribbon (slender, elongated)
        w = rand(12.5, 22.0) * perspectiveScale;
        h = rand(2.1, 3.6) * perspectiveScale;
      } else if (kind === 0) {
        // Small rectangular 3D confetti
        w = rand(5.2, 9.2) * perspectiveScale;
        h = rand(3.4, 6.2) * perspectiveScale;
      } else {
        // Grouped micro confetti shard
        w = rand(3.4, 5.4) * perspectiveScale;
        h = rand(2.4, 4.0) * perspectiveScale;
      }

      // Predominantly white (62%) and metallic silver (38%)
      const matRoll = Math.random();
      const materialIdx: 0 | 1 | 2 | 3 =
        matRoll < 0.36
          ? 0 // Pure Satin White
          : matRoll < 0.62
            ? 1 // Cool Pearl White
            : matRoll < 0.84
              ? 2 // Brushed Metallic Silver
              : 3; // Specular Chrome Silver

      particles[i] = {
        kind,
        x: originX,
        y: originY,
        z,
        vx: Math.cos(angle) * speed * (0.72 + z * 0.32),
        vy: Math.sin(angle) * speed * (0.72 + z * 0.32),
        vz: rand(-0.28, 0.28),
        w,
        h,
        yaw: rand(0, Math.PI * 2),
        yawSpeed: rand(-7.5, 7.5),
        pitch: rand(0, Math.PI * 2),
        pitchSpeed: rand(7.0, 15.5) * (Math.random() < 0.5 ? 1 : -1),
        roll: rand(0, Math.PI * 2),
        rollSpeed: rand(5.5, 13.0) * (Math.random() < 0.5 ? 1 : -1),
        swayPhase: rand(0, Math.PI * 2),
        swayFreq: rand(2.3, 5.1),
        swayAmp: rand(32, 86) * perspectiveScale,
        ribbonCurveAmp: rand(2.4, 5.6) * perspectiveScale,
        ribbonCurvePhase: rand(0, Math.PI * 2),
        ribbonCurveSpeed: rand(6.5, 12.5),
        gravity: (prefersReducedMotion ? rand(130, 195) : rand(580, 880)) * (0.75 + z * 0.28),
        drag: rand(0.952, 0.975),
        terminalVy: (prefersReducedMotion ? rand(110, 160) : rand(195, 345)) * (0.76 + z * 0.28),
        baseAlpha: z < 0.45 ? rand(0.76, 0.9) : rand(0.92, 1.0),
        materialIdx,
        delaySec,
      };
    }

    // Sort once back-to-front by initial Z depth for natural 3D painter's order
    particles.sort((a, b) => a.z - b.z);

    let animationFrameId = 0;
    let isDisposed = false;
    const startTime = performance.now();
    let lastTime = startTime;
    const totalDurationSec = prefersReducedMotion ? 1.9 : 4.9;
    const fadeStartSec = prefersReducedMotion ? 1.15 : 3.45;

    const frame = (now: number) => {
      if (isDisposed) return;

      const elapsedSec = (now - startTime) / 1000;
      // High-precision delta time supporting 60Hz, 90Hz, 120Hz ProMotion and 144Hz displays
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.032);
      lastTime = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Smooth cubic ease-out global fade at the end of the animation
      let globalFade = 1;
      if (elapsedSec > fadeStartSec) {
        const t = Math.min(1, (elapsedSec - fadeStartSec) / (totalDurationSec - fadeStartSec));
        globalFade = (1 - t) * (1 - t);
      }

      const frameDragExponent = dt * 60;
      let activeVisibleCount = 0;

      for (let i = 0; i < totalCount; i++) {
        const p = particles[i];
        if (elapsedSec < p.delaySec) {
          activeVisibleCount++;
          continue;
        }

        // Exponential aerodynamic drag + gravity clamped to paper terminal velocity
        const damping = Math.pow(p.drag, frameDragExponent);
        p.vx *= damping;
        p.vy = Math.min(p.vy * damping + p.gravity * dt, p.terminalVy);
        p.vz *= damping;

        p.z = Math.max(0.25, Math.min(1.48, p.z + p.vz * dt));
        p.swayPhase += p.swayFreq * dt;

        // Natural paper flutter when descending
        const descentFactor = p.vy > 0 ? Math.min(1, p.vy / 160) : 0.25;
        const flutterVx = Math.sin(p.swayPhase) * p.swayAmp * descentFactor;
        const flutterVy = Math.cos(p.swayPhase * 1.3) * 14 * descentFactor;

        p.x += (p.vx + flutterVx) * dt;
        p.y += (p.vy + flutterVy) * dt;

        p.yaw += p.yawSpeed * dt;
        p.pitch += p.pitchSpeed * dt;
        p.roll += p.rollSpeed * dt;

        const bottomFade =
          p.y > height - 95 ? Math.max(0, 1 - (p.y - (height - 95)) / 115) : 1;
        const alpha = p.baseAlpha * globalFade * bottomFade;

        if (alpha <= 0.01 || p.y > height + 40 || p.x < -70 || p.x > width + 70) {
          continue;
        }

        activeVisibleCount++;

        // Compute 3D surface normal & foreshortening from pitch and roll
        const cosPitch = Math.cos(p.pitch);
        const sinPitch = Math.sin(p.pitch);
        const cosRoll = Math.cos(p.roll);
        const sinRoll = Math.sin(p.roll);

        const nx = sinPitch * cosRoll;
        const ny = sinRoll;
        const nz = cosPitch * cosRoll;

        // Directional illumination + metallic specular reflection
        const rawDot = nx * LIGHT_X + ny * LIGHT_Y + nz * LIGHT_Z;
        const absNormalZ = Math.abs(nz);
        const diffuse = Math.max(0, Math.abs(rawDot));
        const specular = Math.pow(diffuse, 9);

        // Map lighting to 0..9 LUT index
        const isBackFace = nz < 0;
        const baseShade = isBackFace ? diffuse * 5.2 : 3.2 + diffuse * 4.6;
        const lutIdx = Math.min(
          9,
          Math.max(0, Math.floor(baseShade + (specular > 0.52 ? 2.4 : 0)))
        );
        const fillStyle = MATERIAL_SHADE_LUTS[p.materialIdx][lutIdx];

        const cosYaw = Math.cos(p.yaw);
        const sinYaw = Math.sin(p.yaw);

        // 3D depth shadow offset (particles closer to viewer cast a slightly wider floating shadow)
        const shadowOffsetX = (0.7 + p.z * 1.15) * dpr;
        const shadowOffsetY = (1.3 + p.z * 1.85) * dpr;

        if (p.kind === 1) {
          // ==================================================================
          // CURVED 3D RIBBON (Sinusoidal 3D ribbon with twist, highlight & shadow)
          // ==================================================================
          p.ribbonCurvePhase += p.ribbonCurveSpeed * dt;
          const scaleX = Math.max(0.28, Math.abs(cosRoll));
          const scaleY = Math.max(0.22, Math.abs(cosPitch));

          const a = cosYaw * scaleX * dpr;
          const b = sinYaw * scaleX * dpr;
          const c = -sinYaw * scaleY * dpr;
          const d = cosYaw * scaleY * dpr;

          const halfLen = p.w * 0.5;
          const arch1 = Math.sin(p.ribbonCurvePhase) * p.ribbonCurveAmp;
          const arch2 = -Math.cos(p.ribbonCurvePhase * 0.9) * p.ribbonCurveAmp * 0.85;
          const ribbonThickness = Math.max(1.25, p.h * (0.45 + absNormalZ * 0.65));

          // 1. Soft floating 3D shadow
          ctx.setTransform(a, b, c, d, p.x * dpr + shadowOffsetX, p.y * dpr + shadowOffsetY);
          ctx.globalAlpha = alpha * 0.15;
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = ribbonThickness + 0.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-halfLen, 0);
          ctx.bezierCurveTo(
            -halfLen * 0.35,
            arch1,
            halfLen * 0.35,
            arch2,
            halfLen,
            arch1 * 0.35
          );
          ctx.stroke();

          // 2. Main 3D Ribbon Body (White / Metallic Silver shaded)
          ctx.setTransform(a, b, c, d, p.x * dpr, p.y * dpr);
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fillStyle;
          ctx.lineWidth = ribbonThickness;
          ctx.beginPath();
          ctx.moveTo(-halfLen, 0);
          ctx.bezierCurveTo(
            -halfLen * 0.35,
            arch1,
            halfLen * 0.35,
            arch2,
            halfLen,
            arch1 * 0.35
          );
          ctx.stroke();

          // 3. Specular 3D Highlight Sheen on the ribbon crest
          if (diffuse > 0.58) {
            ctx.globalAlpha = alpha * 0.85;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = Math.max(0.7, ribbonThickness * 0.38);
            ctx.beginPath();
            ctx.moveTo(-halfLen * 0.45, arch1 * 0.35);
            ctx.quadraticCurveTo(0, (arch1 + arch2) * 0.45, halfLen * 0.45, arch2 * 0.35);
            ctx.stroke();
          }
        } else {
          // ==================================================================
          // 3D RECTANGULAR & MICRO CONFETTI FLAKE (3-axis foreshortened + specular glint)
          // ==================================================================
          const scaleX = Math.max(0.16, Math.abs(cosRoll));
          const scaleY = Math.max(0.14, Math.abs(cosPitch));

          const a = cosYaw * scaleX * dpr;
          const b = sinYaw * scaleX * dpr;
          const c = -sinYaw * scaleY * dpr;
          const d = cosYaw * scaleY * dpr;

          const hw = p.w * 0.5;
          const hh = p.h * 0.5;

          // 1. Soft 3D elevation shadow
          ctx.setTransform(a, b, c, d, p.x * dpr + shadowOffsetX, p.y * dpr + shadowOffsetY);
          ctx.globalAlpha = alpha * 0.16;
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(-hw, -hh, p.w, p.h);

          // 2. Lit 3D Confetti Surface (Satin White / Pearl / Silver)
          ctx.setTransform(a, b, c, d, p.x * dpr, p.y * dpr);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = fillStyle;
          ctx.fillRect(-hw, -hh, p.w, p.h);

          // 3. Specular Metallic/Pearl Edge Glint when catching the key light
          if (specular > 0.48) {
            ctx.globalAlpha = alpha * Math.min(1, specular * 1.15);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-hw * 0.75, -hh * 0.75, p.w * 0.55, p.h * 0.42);
          }
        }
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
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      } catch {}
    };
  }, [triggerKey]);

  if (!triggerKey || triggerKey <= 0) return null;

  return (
    <div
      id="monvian-3d-confetti-layer"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[260] overflow-hidden select-none"
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        contain: 'strict',
      }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none block w-full h-full"
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
        }}
      />
    </div>
  );
};

export default WhiteConfettiOverlay;
