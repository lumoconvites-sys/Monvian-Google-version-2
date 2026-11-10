import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface HeroAirplane3DProps {
  onAnimationComplete?: () => void;
}

export const HeroAirplane3D: React.FC<HeroAirplane3DProps> = ({ onAnimationComplete }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasFinished, setHasFinished] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Respect reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setHasFinished(true);
      onAnimationComplete?.();
      return;
    }

    let isMounted = true;
    let animationFrameId: number | null = null;

    // 1. Scene & Transparent Renderer
    const scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 11);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // 100% transparent background
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    container.appendChild(renderer.domElement);

    // 2. High-End Studio & Atmospheric Lighting (Sunlight matching Campos do Jordão)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    // Main Sunlight (from top-left, warm & crisp)
    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.2);
    sunLight.position.set(-6, 9, 7);
    scene.add(sunLight);

    // Fill Sky Light (soft cool blue reflection from the sky and clouds below)
    const skyFillLight = new THREE.DirectionalLight(0xdceeff, 1.1);
    skyFillLight.position.set(5, -4, 4);
    scene.add(skyFillLight);

    // Rim light giving the wings that signature Apple/3D pearlescent rim glow
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.4);
    rimLight.position.set(6, 6, -5);
    scene.add(rimLight);

    // 3. Materials — Pure White Satin Minimalist Commercial Aircraft (IMG_9565 aesthetic)
    const allMaterials: THREE.Material[] = [];

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.04,
      transparent: true,
      opacity: 1,
    });
    allMaterials.push(bodyMaterial);

    const windshieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x141e2c, // Glossy deep midnight glass
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 1,
    });
    allMaterials.push(windshieldMaterial);

    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x223246,
      roughness: 0.18,
      metalness: 0.6,
      transparent: true,
      opacity: 1,
    });
    allMaterials.push(windowMaterial);

    const turbineIntakeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a222e,
      roughness: 0.45,
      metalness: 0.7,
      transparent: true,
      opacity: 1,
    });
    allMaterials.push(turbineIntakeMaterial);

    const spinnerMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9e2ed,
      roughness: 0.15,
      metalness: 0.8,
      transparent: true,
      opacity: 1,
    });
    allMaterials.push(spinnerMaterial);

    // 4. Construct 3D Airplane Mesh Hierarchy
    const airplane = new THREE.Group();

    // A. Aerodynamic Smooth Fuselage using LatheGeometry
    const fuselagePoints: THREE.Vector2[] = [
      new THREE.Vector2(0.001, -2.4),
      new THREE.Vector2(0.24, -2.32),
      new THREE.Vector2(0.52, -2.08),
      new THREE.Vector2(0.72, -1.68),
      new THREE.Vector2(0.82, -1.15),
      new THREE.Vector2(0.85, -0.5),
      new THREE.Vector2(0.85, 0.9),
      new THREE.Vector2(0.81, 1.5),
      new THREE.Vector2(0.68, 2.1),
      new THREE.Vector2(0.48, 2.7),
      new THREE.Vector2(0.25, 3.2),
      new THREE.Vector2(0.06, 3.55),
      new THREE.Vector2(0.001, 3.6),
    ];
    const fuselageGeo = new THREE.LatheGeometry(fuselagePoints, 36);
    // Orient fuselage so nose points forward along -Z and tail at +Z
    const fuselageMesh = new THREE.Mesh(fuselageGeo, bodyMaterial);
    fuselageMesh.rotation.x = Math.PI / 2;
    fuselageMesh.scale.set(1, 1, 1);
    airplane.add(fuselageMesh);

    // B. Cockpit Windshield (Panoramic curved dark visor like IMG_9565)
    const cockpitGeo = new THREE.SphereGeometry(0.86, 24, 16, 0, Math.PI, 0, Math.PI * 0.42);
    const cockpitMesh = new THREE.Mesh(cockpitGeo, windshieldMaterial);
    cockpitMesh.rotation.x = -Math.PI / 2 - 0.28;
    cockpitMesh.position.set(0, 0.22, -1.35);
    cockpitMesh.scale.set(0.68, 0.52, 0.65);
    airplane.add(cockpitMesh);

    // C. Cabin Windows (Discreet passenger windows along both flanks)
    const windowGeo = new THREE.BoxGeometry(0.04, 0.12, 0.14);
    const windowPositions = [-0.65, -0.32, 0.02, 0.36, 0.7, 1.04];
    windowPositions.forEach((zPos) => {
      // Starboard (right side)
      const winRight = new THREE.Mesh(windowGeo, windowMaterial);
      winRight.position.set(0.835, 0.12, zPos);
      winRight.rotation.y = 0.08;
      airplane.add(winRight);

      // Port (left side)
      const winLeft = new THREE.Mesh(windowGeo, windowMaterial);
      winLeft.position.set(-0.835, 0.12, zPos);
      winLeft.rotation.y = -0.08;
      airplane.add(winLeft);
    });

    // D. Main Wings (Sleek swept-back wings with aerodynamic dihedral & winglets)
    const wingShape = new THREE.Shape();
    // Root at fuselage
    wingShape.moveTo(0, -0.7);
    // Leading edge sweeping back out to wingtip
    wingShape.lineTo(4.4, 1.4);
    // Wingtip chord
    wingShape.lineTo(4.35, 1.85);
    // Trailing edge returning to fuselage
    wingShape.lineTo(0, 0.95);
    wingShape.closePath();

    const wingExtrudeSettings = {
      depth: 0.1,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);

    // Right Wing
    const rightWing = new THREE.Mesh(wingGeo, bodyMaterial);
    rightWing.rotation.x = Math.PI / 2;
    rightWing.rotation.z = -0.05; // slight dihedral (upward angle)
    rightWing.position.set(0.6, -0.16, -0.2);
    airplane.add(rightWing);

    // Right Winglet (aerodynamic upturned tip)
    const wingletGeo = new THREE.BoxGeometry(0.08, 0.45, 0.32);
    const rightWinglet = new THREE.Mesh(wingletGeo, bodyMaterial);
    rightWinglet.position.set(4.95, 0.08, 1.4);
    rightWinglet.rotation.z = -0.35;
    airplane.add(rightWinglet);

    // Left Wing (symmetrical)
    const leftWing = new THREE.Mesh(wingGeo, bodyMaterial);
    leftWing.rotation.x = Math.PI / 2;
    leftWing.rotation.y = Math.PI; // Flip for left
    leftWing.rotation.z = 0.05;
    leftWing.position.set(-0.6, -0.16, -0.2);
    airplane.add(leftWing);

    // Left Winglet
    const leftWinglet = new THREE.Mesh(wingletGeo, bodyMaterial);
    leftWinglet.position.set(-4.95, 0.08, 1.4);
    leftWinglet.rotation.z = 0.35;
    airplane.add(leftWinglet);

    // E. Turbofan Engines (Mounted under each wing on aerodynamic pylons)
    const createEngine = (xPos: number) => {
      const engineGroup = new THREE.Group();

      // Pylon
      const pylonGeo = new THREE.BoxGeometry(0.1, 0.35, 0.7);
      const pylon = new THREE.Mesh(pylonGeo, bodyMaterial);
      pylon.position.set(0, 0.22, 0);
      engineGroup.add(pylon);

      // Nacelle Outer Cowling
      const nacelleGeo = new THREE.CylinderGeometry(0.36, 0.32, 1.25, 24);
      nacelleGeo.rotateX(Math.PI / 2);
      const nacelle = new THREE.Mesh(nacelleGeo, bodyMaterial);
      engineGroup.add(nacelle);

      // Intake Fan Face (dark interior)
      const intakeGeo = new THREE.CircleGeometry(0.32, 24);
      intakeGeo.rotateY(Math.PI);
      const intake = new THREE.Mesh(intakeGeo, turbineIntakeMaterial);
      intake.position.set(0, 0, -0.58);
      engineGroup.add(intake);

      // Center Spinner Cone
      const spinnerGeo = new THREE.ConeGeometry(0.1, 0.25, 16);
      spinnerGeo.rotateX(-Math.PI / 2);
      const spinner = new THREE.Mesh(spinnerGeo, spinnerMaterial);
      spinner.position.set(0, 0, -0.52);
      engineGroup.add(spinner);

      engineGroup.position.set(xPos, -0.45, 0.25);
      return engineGroup;
    };

    airplane.add(createEngine(1.85)); // Right Engine
    airplane.add(createEngine(-1.85)); // Left Engine

    // F. Vertical Stabilizer (Tail Fin)
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0, 2.1);
    finShape.lineTo(0.55, 2.1);
    finShape.lineTo(1.6, 0);
    finShape.closePath();

    const finExtrudeSettings = {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    };
    const finGeo = new THREE.ExtrudeGeometry(finShape, finExtrudeSettings);
    const tailFin = new THREE.Mesh(finGeo, bodyMaterial);
    tailFin.rotation.y = Math.PI / 2;
    tailFin.position.set(0.04, 0.5, 3.4);
    tailFin.scale.set(0.85, 0.85, 0.85);
    airplane.add(tailFin);

    // G. Horizontal Stabilizers
    const hStabShape = new THREE.Shape();
    hStabShape.moveTo(0, 0);
    hStabShape.lineTo(1.6, 0.65);
    hStabShape.lineTo(1.5, 1.05);
    hStabShape.lineTo(0, 0.65);
    hStabShape.closePath();

    const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });

    // Right Horizontal Stabilizer
    const rightHStab = new THREE.Mesh(hStabGeo, bodyMaterial);
    rightHStab.rotation.x = Math.PI / 2;
    rightHStab.position.set(0.2, 0.35, 2.6);
    airplane.add(rightHStab);

    // Left Horizontal Stabilizer
    const leftHStab = new THREE.Mesh(hStabGeo, bodyMaterial);
    leftHStab.rotation.x = Math.PI / 2;
    leftHStab.rotation.y = Math.PI;
    leftHStab.position.set(-0.2, 0.35, 2.6);
    airplane.add(leftHStab);

    // Scale whole airplane (+90% increase from previous scale)
    const isMobile = width < 768;
    const baseScale = isMobile ? 0.097 : 0.125;
    airplane.scale.set(baseScale, baseScale, baseScale);

    scene.add(airplane);

    // 5. Cinematic Flight Trajectory & Animation Loop
    // Flight duration: 9.0 seconds for a prompt, smooth & crisp glide across the screen
    const flightDuration = 9000; // ms
    let startTime: number | null = null;

    // Boundary limits in 3D world units based on aspect ratio
    const aspect = width / height;
    const xSpan = Math.max(12, aspect * 7.5);
    const startX = -xSpan - 2.5;
    const endX = xSpan + 2.5;

    const animate = (currentTime: number) => {
      if (!isMounted) return;

      if (startTime === null) {
        startTime = currentTime;
      }

      const elapsed = currentTime - startTime;
      const rawProgress = Math.min(1, Math.max(0, elapsed / flightDuration));

      // Ease in-out cruise motion across the sky
      const progress =
        rawProgress < 0.5
          ? 2 * rawProgress * rawProgress
          : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;

      // X Position: Flies from left to right
      const currentX = startX + (endX - startX) * progress;

      // Y Position: Pass right through the middle height of the shifted 3D floating island
      const currentY =
        (isMobile ? -0.85 : -0.7) +
        Math.sin(rawProgress * Math.PI) * 0.15 +
        Math.sin(elapsed * 0.0022) * 0.02;

      // Z Position: Sits IN FRONT of the 3D Island (foreground layer)
      const currentZ = 1.8;

      airplane.position.set(currentX, currentY, currentZ);

      // Realistic 3D Flight Orientation & Wing Banking:
      const targetYaw = Math.PI * 0.58;
      const currentPitch = 0.08 + Math.sin(rawProgress * Math.PI * 2) * 0.02;
      const bankAngle =
        0.18 * Math.cos(rawProgress * Math.PI * 1.5) +
        Math.sin(elapsed * 0.003) * 0.02;

      airplane.rotation.set(currentPitch, targetYaw, bankAngle);

      // 100% crisp visibility during flight, smooth fade out at very right exit
      let opacity = 1;
      if (rawProgress < 0.04) {
        opacity = rawProgress / 0.04;
      } else if (rawProgress > 0.90) {
        opacity = Math.max(0, (1 - rawProgress) / 0.10);
      }

      allMaterials.forEach((mat) => {
        mat.opacity = opacity;
      });

      renderer.render(scene, camera);

      if (rawProgress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Animation finished — stop loop, preserve memory
        setHasFinished(true);
        onAnimationComplete?.();
      }
    };

    // Start immediately on mount with zero delay
    animationFrameId = requestAnimationFrame(animate);

    // Handle Window Resize
    const handleResize = () => {
      if (!container || !isMounted) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);

      const newIsMobile = newWidth < 768;
      const newScale = newIsMobile ? 0.097 : 0.125;
      airplane.scale.set(newScale, newScale, newScale);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup when component unmounts
    return () => {
      isMounted = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', handleResize);

      // Dispose Three.js GPU resources
      scene.clear();
      fuselageGeo.dispose();
      cockpitGeo.dispose();
      windowGeo.dispose();
      wingGeo.dispose();
      wingletGeo.dispose();
      finGeo.dispose();
      hStabGeo.dispose();
      allMaterials.forEach((mat) => mat.dispose());
      renderer.dispose();

      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [onAnimationComplete]);

  if (hasFinished) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none select-none z-[20] overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
      }}
      aria-hidden="true"
    />
  );
};

export default HeroAirplane3D;
