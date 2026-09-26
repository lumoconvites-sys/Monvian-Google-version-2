import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import { FERRIS_WHEEL_CONFIG, FerrisWheelConfig } from '../config/ferrisWheelConfig';

/**
 * Camada 3D nativa para MapLibre GL com Three.js
 * Renderiza uma Roda Gigante 3D real de 30m no Parque Capivari (Campos do Jordão)
 * 
 * - Integrada ao espaço geográfico (Mercator) e matriz de projeção do mapa
 * - Acompanha inclinação (pitch), rotação (bearing) e zoom do mapa de forma contínua
 * - 100% estática (sem animações ou consumo ocioso de bateria)
 * - Geometrias e materiais compartilhados e altamente otimizados para dispositivos móveis
 */
export class FerrisWheel3DLayer implements maplibregl.CustomLayerInterface {
  id: string;
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map: maplibregl.Map | null = null;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer | null = null;
  private config: FerrisWheelConfig;
  private rootGroup: THREE.Group;
  private isDarkTheme: boolean = true;
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  constructor(config: FerrisWheelConfig = FERRIS_WHEEL_CONFIG, isDark: boolean = true) {
    this.config = config;
    this.id = config.layerId;
    this.isDarkTheme = isDark;
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);
  }

  public setTheme(isDark: boolean) {
    this.isDarkTheme = isDark;
    this.updateLighting();
  }

  onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext) {
    this.map = map;

    // Criar renderizador Three.js acoplado ao contexto WebGL do MapLibre
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.autoClear = false;

    // Construir o modelo 3D da Roda Gigante
    this.buildModel();

    // Configurar iluminação ambiental e solar
    this.setupLighting();
  }

  private setupLighting() {
    // Luz ambiente suave
    const ambientLight = new THREE.AmbientLight(0xffffff, this.isDarkTheme ? 0.9 : 1.3);
    ambientLight.name = 'ambientLight';
    this.scene.add(ambientLight);

    // Luz solar direta com ângulo natural para dar relevo 3D às formas
    const sunLight = new THREE.DirectionalLight(0xfff6e5, this.isDarkTheme ? 1.6 : 2.0);
    sunLight.position.set(60, 140, 80);
    sunLight.name = 'sunLight';
    this.scene.add(sunLight);

    // Luz de preenchimento azulada para atmosfera de montanha
    const skyFillLight = new THREE.DirectionalLight(0x88c4ff, this.isDarkTheme ? 0.8 : 1.0);
    skyFillLight.position.set(-60, 40, -50);
    skyFillLight.name = 'skyFillLight';
    this.scene.add(skyFillLight);

    // Luz suave vinda do chão
    const groundLight = new THREE.HemisphereLight(0x99ccff, 0x1a2634, 0.6);
    groundLight.name = 'groundLight';
    this.scene.add(groundLight);
  }

  private updateLighting() {
    const ambient = this.scene.getObjectByName('ambientLight') as THREE.AmbientLight;
    if (ambient) ambient.intensity = this.isDarkTheme ? 0.9 : 1.3;

    const sun = this.scene.getObjectByName('sunLight') as THREE.DirectionalLight;
    if (sun) sun.intensity = this.isDarkTheme ? 1.6 : 2.0;
  }

  /**
   * Constrói o modelo 3D detalhado da Roda Gigante do Parque Capivari
   */
  private buildModel() {
    const { colors, wheelRadiusMeters, hubHeightMeters, wheelWidthMeters, numberOfGondolas } = this.config;
    const halfWidth = wheelWidthMeters / 2;

    // -------------------------------------------------------------
    // MATERIAIS OTIMIZADOS COMPARTILHADOS
    // -------------------------------------------------------------
    const primaryBlueMat = new THREE.MeshStandardMaterial({
      color: colors.primaryBlue,
      roughness: 0.35,
      metalness: 0.65,
    });
    this.disposables.push(primaryBlueMat);

    const supportBlueMat = new THREE.MeshStandardMaterial({
      color: colors.supportBlue,
      roughness: 0.4,
      metalness: 0.7,
    });
    this.disposables.push(supportBlueMat);

    const trussMat = new THREE.MeshStandardMaterial({
      color: colors.metallicTruss,
      roughness: 0.45,
      metalness: 0.6,
    });
    this.disposables.push(trussMat);

    const spokesMat = new THREE.MeshStandardMaterial({
      color: colors.spokesBlue,
      roughness: 0.3,
      metalness: 0.75,
    });
    this.disposables.push(spokesMat);

    const axleMat = new THREE.MeshStandardMaterial({
      color: colors.hubAxle,
      roughness: 0.25,
      metalness: 0.85,
    });
    this.disposables.push(axleMat);

    const gondolaHullMat = new THREE.MeshStandardMaterial({
      color: colors.gondolaHull,
      roughness: 0.3,
      metalness: 0.5,
    });
    this.disposables.push(gondolaHullMat);

    const gondolaRoofMat = new THREE.MeshStandardMaterial({
      color: colors.gondolaRoof,
      roughness: 0.35,
      metalness: 0.5,
    });
    this.disposables.push(gondolaRoofMat);

    const gondolaGlassMat = new THREE.MeshStandardMaterial({
      color: colors.gondolaGlass,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.65,
    });
    this.disposables.push(gondolaGlassMat);

    const platformMat = new THREE.MeshStandardMaterial({
      color: colors.basePlatform,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.disposables.push(platformMat);

    const ledMat = new THREE.MeshBasicMaterial({
      color: colors.ledAccents,
    });
    this.disposables.push(ledMat);

    // -------------------------------------------------------------
    // 1. BASE / PLATAFORMA DE EMBARQUE TÉRREA
    // -------------------------------------------------------------
    const baseGeo = new THREE.BoxGeometry(22, 0.8, 14);
    this.disposables.push(baseGeo);
    const baseMesh = new THREE.Mesh(baseGeo, platformMat);
    baseMesh.position.set(0, 0.4, 0);
    this.rootGroup.add(baseMesh);

    // Deck de embarque com piso elevado
    const deckGeo = new THREE.BoxGeometry(16, 0.5, 8);
    this.disposables.push(deckGeo);
    const deckMesh = new THREE.Mesh(deckGeo, supportBlueMat);
    deckMesh.position.set(0, 0.9, 0);
    this.rootGroup.add(deckMesh);

    // 4 Sapatas de concreto/aço nos pontos dos pés de suporte
    const footingGeo = new THREE.CylinderGeometry(0.85, 1.1, 1.2, 8);
    this.disposables.push(footingGeo);
    const legX = 5.2;
    const legZ = halfWidth + 0.3;
    const footingsPos = [
      [-legX, 0.6, legZ],
      [legX, 0.6, legZ],
      [-legX, 0.6, -legZ],
      [legX, 0.6, -legZ],
    ];
    footingsPos.forEach(([fx, fy, fz]) => {
      const footing = new THREE.Mesh(footingGeo, axleMat);
      footing.position.set(fx, fy, fz);
      this.rootGroup.add(footing);
    });

    // -------------------------------------------------------------
    // 2. ESTRUTURA DE SUPORTE EM "A" (A-FRAME PYLONS)
    // -------------------------------------------------------------
    const pylonRadiusTop = 0.32;
    const pylonRadiusBottom = 0.48;
    const pylonHeight = Math.sqrt(Math.pow(legX, 2) + Math.pow(hubHeightMeters - 1.0, 2));

    const pylonGeo = new THREE.CylinderGeometry(pylonRadiusTop, pylonRadiusBottom, pylonHeight, 16);
    this.disposables.push(pylonGeo);

    const anglePylon = Math.atan2(legX, hubHeightMeters - 1.0);

    // Pernas frontais (Z = +halfWidth + 0.3)
    const pylonFL = new THREE.Mesh(pylonGeo, supportBlueMat);
    pylonFL.position.set(-legX / 2, (hubHeightMeters + 1.0) / 2, legZ);
    pylonFL.rotation.z = -anglePylon;
    this.rootGroup.add(pylonFL);

    const pylonFR = new THREE.Mesh(pylonGeo, supportBlueMat);
    pylonFR.position.set(legX / 2, (hubHeightMeters + 1.0) / 2, legZ);
    pylonFR.rotation.z = anglePylon;
    this.rootGroup.add(pylonFR);

    // Pernas traseiras (Z = -halfWidth - 0.3)
    const pylonBL = new THREE.Mesh(pylonGeo, supportBlueMat);
    pylonBL.position.set(-legX / 2, (hubHeightMeters + 1.0) / 2, -legZ);
    pylonBL.rotation.z = -anglePylon;
    this.rootGroup.add(pylonBL);

    const pylonBR = new THREE.Mesh(pylonGeo, supportBlueMat);
    pylonBR.position.set(legX / 2, (hubHeightMeters + 1.0) / 2, -legZ);
    pylonBR.rotation.z = anglePylon;
    this.rootGroup.add(pylonBR);

    // Travessas horizontais intermediárias nos suportes
    const tieGeo = new THREE.CylinderGeometry(0.2, 0.2, 5.8, 12);
    this.disposables.push(tieGeo);

    const tieF = new THREE.Mesh(tieGeo, supportBlueMat);
    tieF.position.set(0, 7.5, legZ);
    tieF.rotation.z = Math.PI / 2;
    this.rootGroup.add(tieF);

    const tieB = new THREE.Mesh(tieGeo, supportBlueMat);
    tieB.position.set(0, 7.5, -legZ);
    tieB.rotation.z = Math.PI / 2;
    this.rootGroup.add(tieB);

    // Travessas laterais conectando a perna frontal à traseira
    const crossTieGeo = new THREE.CylinderGeometry(0.2, 0.2, wheelWidthMeters + 0.6, 12);
    this.disposables.push(crossTieGeo);

    const crossTieL = new THREE.Mesh(crossTieGeo, supportBlueMat);
    crossTieL.position.set(-2.8, 7.5, 0);
    crossTieL.rotation.x = Math.PI / 2;
    this.rootGroup.add(crossTieL);

    const crossTieR = new THREE.Mesh(crossTieGeo, supportBlueMat);
    crossTieR.position.set(2.8, 7.5, 0);
    crossTieR.rotation.x = Math.PI / 2;
    this.rootGroup.add(crossTieR);

    // -------------------------------------------------------------
    // 3. EIXO CENTRAL E CUBOS (HUB & MAIN AXLE)
    // -------------------------------------------------------------
    const axleGeo = new THREE.CylinderGeometry(0.55, 0.55, wheelWidthMeters + 1.6, 20);
    this.disposables.push(axleGeo);
    const mainAxle = new THREE.Mesh(axleGeo, axleMat);
    mainAxle.position.set(0, hubHeightMeters, 0);
    mainAxle.rotation.x = Math.PI / 2;
    this.rootGroup.add(mainAxle);

    // Discos dos cubos dianteiro e traseiro
    const hubDiscGeo = new THREE.CylinderGeometry(1.65, 1.65, 0.45, 24);
    this.disposables.push(hubDiscGeo);

    const hubDiscF = new THREE.Mesh(hubDiscGeo, primaryBlueMat);
    hubDiscF.position.set(0, hubHeightMeters, halfWidth);
    hubDiscF.rotation.x = Math.PI / 2;
    this.rootGroup.add(hubDiscF);

    const hubDiscB = new THREE.Mesh(hubDiscGeo, primaryBlueMat);
    hubDiscB.position.set(0, hubHeightMeters, -halfWidth);
    hubDiscB.rotation.x = Math.PI / 2;
    this.rootGroup.add(hubDiscB);

    // -------------------------------------------------------------
    // 4. AROS CIRCULARES DUPLOS (EXTERNO E INTERNO)
    // -------------------------------------------------------------
    const outerRingRadius = wheelRadiusMeters;
    const innerRingRadius = wheelRadiusMeters * 0.76; // ~9.9 metros

    const outerRingGeo = new THREE.TorusGeometry(outerRingRadius, 0.22, 12, 48);
    this.disposables.push(outerRingGeo);
    const innerRingGeo = new THREE.TorusGeometry(innerRingRadius, 0.15, 10, 48);
    this.disposables.push(innerRingGeo);

    // Aro frontal
    const outerRingF = new THREE.Mesh(outerRingGeo, primaryBlueMat);
    outerRingF.position.set(0, hubHeightMeters, halfWidth);
    this.rootGroup.add(outerRingF);

    const innerRingF = new THREE.Mesh(innerRingGeo, trussMat);
    innerRingF.position.set(0, hubHeightMeters, halfWidth);
    this.rootGroup.add(innerRingF);

    // Aro traseiro
    const outerRingB = new THREE.Mesh(outerRingGeo, primaryBlueMat);
    outerRingB.position.set(0, hubHeightMeters, -halfWidth);
    this.rootGroup.add(outerRingB);

    const innerRingB = new THREE.Mesh(innerRingGeo, trussMat);
    innerRingB.position.set(0, hubHeightMeters, -halfWidth);
    this.rootGroup.add(innerRingB);

    // -------------------------------------------------------------
    // 5. 16 RAIOS E TRELIÇAS ESTRUTURAIS (16 SPOKES & TRUSSES)
    // -------------------------------------------------------------
    const spokeLength = outerRingRadius - 1.2;
    const spokeGeo = new THREE.CylinderGeometry(0.08, 0.12, spokeLength, 8);
    this.disposables.push(spokeGeo);

    const crossTrussGeo = new THREE.CylinderGeometry(0.07, 0.07, wheelWidthMeters, 6);
    this.disposables.push(crossTrussGeo);

    const zigZagGeo = new THREE.CylinderGeometry(
      0.06,
      0.06,
      Math.sqrt(Math.pow(wheelWidthMeters, 2) + Math.pow((2 * Math.PI * outerRingRadius) / numberOfGondolas, 2) / 4),
      6
    );
    this.disposables.push(zigZagGeo);

    for (let i = 0; i < numberOfGondolas; i++) {
      const angle = (i * 2 * Math.PI) / numberOfGondolas;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Ponto médio do raio
      const spokeMidX = (spokeLength / 2 + 1.2) * cosA;
      const spokeMidY = hubHeightMeters + (spokeLength / 2 + 1.2) * sinA;

      // Raio frontal
      const spokeF = new THREE.Mesh(spokeGeo, spokesMat);
      spokeF.position.set(spokeMidX, spokeMidY, halfWidth);
      spokeF.rotation.z = angle - Math.PI / 2;
      this.rootGroup.add(spokeF);

      // Raio traseiro
      const spokeB = new THREE.Mesh(spokeGeo, spokesMat);
      spokeB.position.set(spokeMidX, spokeMidY, -halfWidth);
      spokeB.rotation.z = angle - Math.PI / 2;
      this.rootGroup.add(spokeB);

      // Barra transversal de união dos aros no ponto de cada gôndola
      const rimPointX = outerRingRadius * cosA;
      const rimPointY = hubHeightMeters + outerRingRadius * sinA;

      const crossBar = new THREE.Mesh(crossTrussGeo, supportBlueMat);
      crossBar.position.set(rimPointX, rimPointY, 0);
      crossBar.rotation.x = Math.PI / 2;
      this.rootGroup.add(crossBar);

      // Pontos de luz sutil estilo LED no aro frontal e traseiro
      const ledDotGeo = new THREE.SphereGeometry(0.12, 6, 6);
      this.disposables.push(ledDotGeo);
      const ledF = new THREE.Mesh(ledDotGeo, ledMat);
      ledF.position.set(rimPointX, rimPointY, halfWidth + 0.15);
      this.rootGroup.add(ledF);

      // Treliça zig-zag entre aro frontal e traseiro
      const nextAngle = ((i + 1) * 2 * Math.PI) / numberOfGondolas;
      const nextRimPointX = outerRingRadius * Math.cos(nextAngle);
      const nextRimPointY = hubHeightMeters + outerRingRadius * Math.sin(nextAngle);

      const midLatticeX = (rimPointX + nextRimPointX) / 2;
      const midLatticeY = (rimPointY + nextRimPointY) / 2;

      const zigZagMesh = new THREE.Mesh(zigZagGeo, trussMat);
      zigZagMesh.position.set(midLatticeX, midLatticeY, 0);
      zigZagMesh.lookAt(nextRimPointX, nextRimPointY, -halfWidth);
      this.rootGroup.add(zigZagMesh);
    }

    // -------------------------------------------------------------
    // 6. 16 GÔNDOLAS PANORÂMICAS SUSPENSAS (STATIC VERTICAL GONDOLAS)
    // -------------------------------------------------------------
    const hangerArmGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
    this.disposables.push(hangerArmGeo);

    // Corpo da cabine
    const cabinBodyGeo = new THREE.BoxGeometry(1.6, 0.7, 1.3);
    this.disposables.push(cabinBodyGeo);

    // Vidro panorâmico
    const cabinGlassGeo = new THREE.BoxGeometry(1.54, 0.85, 1.24);
    this.disposables.push(cabinGlassGeo);

    // Teto aerodinâmico
    const cabinRoofGeo = new THREE.BoxGeometry(1.65, 0.25, 1.35);
    this.disposables.push(cabinRoofGeo);

    for (let i = 0; i < numberOfGondolas; i++) {
      const angle = (i * 2 * Math.PI) / numberOfGondolas;
      const pivotX = outerRingRadius * Math.cos(angle);
      const pivotY = hubHeightMeters + outerRingRadius * Math.sin(angle);

      const gondolaGroup = new THREE.Group();
      gondolaGroup.position.set(pivotX, pivotY, 0);

      // Braço de suspensão (Hanger) descendo 0.9m do pivô
      const hangerL = new THREE.Mesh(hangerArmGeo, supportBlueMat);
      hangerL.position.set(0, -0.9, halfWidth * 0.6);
      gondolaGroup.add(hangerL);

      const hangerR = new THREE.Mesh(hangerArmGeo, supportBlueMat);
      hangerR.position.set(0, -0.9, -halfWidth * 0.6);
      gondolaGroup.add(hangerR);

      // Cabine propriamente dita pendurada verticalmente
      const cabinCenterY = -2.1;

      // Base da cabine
      const cabinBase = new THREE.Mesh(cabinBodyGeo, gondolaHullMat);
      cabinBase.position.set(0, cabinCenterY - 0.35, 0);
      gondolaGroup.add(cabinBase);

      // Janelas envidraçadas panorâmicas
      const cabinGlass = new THREE.Mesh(cabinGlassGeo, gondolaGlassMat);
      cabinGlass.position.set(0, cabinCenterY + 0.2, 0);
      gondolaGroup.add(cabinGlass);

      // Teto da cabine
      const cabinRoof = new THREE.Mesh(cabinRoofGeo, gondolaRoofMat);
      cabinRoof.position.set(0, cabinCenterY + 0.7, 0);
      gondolaGroup.add(cabinRoof);

      // A gôndola é adicionada ao grupo estático mantendo sua orientação gravitacional perfeitamente vertical
      this.rootGroup.add(gondolaGroup);
    }
  }

  /**
   * Renderização chamada pelo MapLibre no pipeline WebGL sincronizado
   */
  render(_gl: WebGL2RenderingContext, options: maplibregl.CustomRenderMethodInput) {
    if (!this.map || !this.renderer) return;

    const currentZoom = this.map.getZoom();

    // Verificação de visibilidade por zoom para máxima performance
    if (currentZoom < this.config.minZoom || currentZoom > this.config.maxZoom) {
      return;
    }

    // Obter matriz de projeção/visualização da câmera do MapLibre
    const rawMatrix = options?.modelViewProjectionMatrix || (options as any)?.matrix || options;
    if (!rawMatrix) return;

    // Calcular coordenadas Mercator exatas da posição no mapa
    const mercatorCoord = maplibregl.MercatorCoordinate.fromLngLat(
      [this.config.longitude, this.config.latitude],
      this.config.altitude
    );

    const meterScale = mercatorCoord.meterInMercatorCoordinateUnits();

    // Matriz de projeção da câmera do MapLibre
    const m = new THREE.Matrix4().fromArray(rawMatrix as ArrayLike<number>);

    // Orientação azimutal em radianos
    const rotationRad = (this.config.orientationDegrees * Math.PI) / 180;

    // Matriz de transformação do modelo no espaço Mercator:
    // 1. Translação para as coordenadas do Parque Capivari
    // 2. Escala proporcional de 1 metro real para unidades Mercator (e inversão do Y)
    // 3. Rotação de 90° em X para elevar o modelo no eixo Z do terreno (altura)
    // 4. Rotação azimutal em Y para alinhamento cênico com o parque
    const modelTransform = new THREE.Matrix4()
      .makeTranslation(mercatorCoord.x, mercatorCoord.y, mercatorCoord.z)
      .scale(new THREE.Vector3(meterScale, -meterScale, meterScale))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationY(rotationRad));

    this.camera.projectionMatrix = m.multiply(modelTransform);

    // Resetar o estado WebGL para o Three.js e renderizar a cena
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Liberação de recursos ao descarregar a camada
   */
  onRemove(_map: maplibregl.Map, _gl: WebGL2RenderingContext) {
    this.dispose();
  }

  private dispose() {
    this.disposables.forEach(item => {
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    });
    this.disposables = [];

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.map = null;
  }
}

/**
 * Função utilitária para adicionar com segurança a camada 3D da Roda Gigante ao MapLibre
 */
export function setupFerrisWheel3D(
  map: maplibregl.Map,
  isDark: boolean = true,
  config: FerrisWheelConfig = FERRIS_WHEEL_CONFIG
): FerrisWheel3DLayer | null {
  try {
    if (map.getLayer(config.layerId)) {
      return null;
    }

    const ferrisWheelLayer = new FerrisWheel3DLayer(config, isDark);
    map.addLayer(ferrisWheelLayer);
    return ferrisWheelLayer;
  } catch (error) {
    console.warn('[FerrisWheel3D] Erro ao carregar camada 3D da Roda Gigante:', error);
    return null;
  }
}

/**
 * Função utilitária para remover a camada 3D da Roda Gigante do mapa
 */
export function removeFerrisWheel3D(map: maplibregl.Map, layerId: string = FERRIS_WHEEL_CONFIG.layerId) {
  try {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  } catch (error) {
    console.warn('[FerrisWheel3D] Erro ao remover camada 3D da Roda Gigante:', error);
  }
}
