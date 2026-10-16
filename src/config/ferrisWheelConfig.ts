/**
 * Configuração da Roda Gigante 3D no Mapa de Campos do Jordão (Parque Capivari)
 * 
 * Este arquivo centraliza todas as coordenadas geográficas, dimensões físicas,
 * cores e parâmetros da Roda Gigante 3D para fácil ajuste sem necessidade de alterar o código Three.js.
 */

export interface FerrisWheelConfig {
  /**
   * Identificador único da camada 3D no MapLibre GL
   */
  layerId: string;

  /**
   * Coordenadas geográficas exatas do ponto físico da Roda Gigante no Parque Capivari
   * Endereço: Rua Eng. Diogo José de Carvalho, 1291, Capivari, Campos do Jordão - SP
   */
  latitude: number;
  longitude: number;
  altitude: number; // Metros acima do solo (0 = apoiada na superfície do terreno)

  /**
   * Dimensões físicas e escala (em metros reais)
   */
  heightMeters: number; // Altura total física (~30 metros)
  wheelRadiusMeters: number; // Raio da roda (~13 metros)
  hubHeightMeters: number; // Altura do eixo central em relação ao chão (~16.5 metros)
  wheelWidthMeters: number; // Largura entre os aros frontal e traseiro (~3.2 metros)
  numberOfGondolas: number; // 16 gôndolas distribuídas perfeitamente ao redor da roda

  /**
   * Orientação no plano horizontal (graus de rotação azimutal)
   * 0° = virada para o Leste/Oeste, 35° = alinhada com o calçadão/lago do Parque Capivari
   */
  orientationDegrees: number;

  /**
   * Cores e paleta visual premium (Azul icônico do Parque Capivari + Aço + Vidro)
   */
  colors: {
    primaryBlue: number; // Azul royal vibrante da estrutura principal
    supportBlue: number; // Azul metálico dos suportes A-frame
    metallicTruss: number; // Azul cobalto das treliças e contraventamentos
    spokesBlue: number; // Azul claro dos 16 raios estruturais
    hubAxle: number; // Eixo central metálico
    gondolaHull: number; // Estrutura/corpo das 16 cabines
    gondolaRoof: number; // Teto das cabines
    gondolaGlass: number; // Vidro panorâmico translúcido das cabines
    basePlatform: number; // Base/plataforma de concreto e aço
    ledAccents: number; // Iluminação cênica noturna nos aros
  };

  /**
   * Parâmetros de visibilidade de zoom
   */
  minZoom: number; // Zoom mínimo em que o modelo é visível no mapa
  maxZoom: number; // Zoom máximo
}

export const FERRIS_WHEEL_CONFIG: FerrisWheelConfig = {
  layerId: 'capivari-ferris-wheel-3d',

  // Coordenadas reais da Roda Gigante dentro do Parque Capivari
  latitude: -22.71765614169504,
  longitude: -45.56539140327637,
  altitude: 0,

  // Escala física realista (~30 metros de altura total)
  heightMeters: 30,
  wheelRadiusMeters: 13,
  hubHeightMeters: 16.5,
  wheelWidthMeters: 3.2,
  numberOfGondolas: 16,

  // Ângulo de orientação da roda em relação ao norte
  orientationDegrees: 35,

  // Cores inspiradas na Roda Gigante real do Parque Capivari
  colors: {
    primaryBlue: 0x0066FF, // Azul royal marcante
    supportBlue: 0x004CB8, // Azul estrutural escuro
    metallicTruss: 0x1A75FF, // Treliças azuis
    spokesBlue: 0x388EFF, // Raios azuis
    hubAxle: 0x2A3B50, // Eixo em tom grafite/aço
    gondolaHull: 0x0055DD, // Casco das gôndolas
    gondolaRoof: 0x003D99, // Teto das gôndolas
    gondolaGlass: 0xA0D8FF, // Vidro panorâmico azulado
    basePlatform: 0x1E293B, // Plataforma térrea escura
    ledAccents: 0x60A5FA, // Pontos de luz sutil
  },

  minZoom: 11,
  maxZoom: 22,
};
