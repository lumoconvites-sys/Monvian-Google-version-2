import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Thermometer, Wind, CloudRain, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { useLanguage, AppLanguage } from '../contexts/LanguageContext';
import { Weather3DIcon } from './Weather3DIcon';
import { triggerHapticFeedback } from '../utils/haptics';

export interface RealWeatherSnapshot {
  temperature: number;
  condition: string;
  isDay: boolean;
  weatherCode: number;
  isRaining: boolean;
  rainIntensity?: 'none' | 'fraca' | 'moderada' | 'forte';
  hasLightning?: boolean;
  precipitationMm?: number;
}

interface ClothingRecommendation {
  pillLabel: string;
  headline: string;
  thermalDelta: number;
  summary: string;
  layersLabel: string;
  layersValue: string;
  accessoriesLabel: string;
  accessoriesValue: string;
  footwearLabel: string;
  footwearValue: string;
  altitudeTipLabel: string;
  altitudeTipValue: string;
  rainAlert: string;
  modalTitle: string;
  altitudeSubtitle: string;
  feelsLikeLabel: string;
  understandBtn: string;
}

function getClothingRecommendation(
  temp: number,
  lang: AppLanguage
): ClothingRecommendation {
  // Tier 1: <= 8°C (Intense mountain cold / frost)
  if (temp <= 8) {
    const content: Record<AppLanguage, ClothingRecommendation> = {
      pt: {
        pillLabel: 'Casaco térmico e luvas',
        headline: 'Frio intenso na serra',
        thermalDelta: -3,
        summary:
          'Temperatura rigorosa de inverno na montanha. Vista-se em três camadas térmicas para reter o calor corporal.',
        layersLabel: 'Camadas principais',
        layersValue: 'Segunda pele térmica, suéter de lã e sobretudo ou jaqueta puffer pesada',
        accessoriesLabel: 'Acessórios essenciais',
        accessoriesValue: 'Gorro, luvas térmicas e cachecol fechado no pescoço',
        footwearLabel: 'Calçado recomendado',
        footwearValue: 'Bota forrada ou calçado fechado impermeável com meias térmicas',
        altitudeTipLabel: 'Dica de altitude · 1.628m',
        altitudeTipValue:
          'O vento de serra reduz a sensação térmica rapidamente ao ar livre. Mantenha extremidades protegidas.',
        rainAlert: 'Umidade e garoa fria: priorize casaco externo impermeável.',
        modalTitle: 'Guia de Vestuário',
        altitudeSubtitle: 'Campos do Jordão · 1.628m de altitude',
        feelsLikeLabel: 'Sensação',
        understandBtn: 'Fechar guia',
      },
      en: {
        pillLabel: 'Thermal coat & gloves',
        headline: 'Freezing mountain weather',
        thermalDelta: -3,
        summary:
          'Rigorous mountain cold. Dress in three thermal layers to retain body heat comfortably.',
        layersLabel: 'Core layers',
        layersValue: 'Thermal base layer, wool sweater, and a heavy overcoat or puffer jacket',
        accessoriesLabel: 'Essential accessories',
        accessoriesValue: 'Beanie, thermal gloves, and a warm scarf around the neck',
        footwearLabel: 'Recommended footwear',
        footwearValue: 'Lined boots or waterproof closed shoes with thermal socks',
        altitudeTipLabel: 'Altitude note · 1,628m',
        altitudeTipValue:
          'Mountain winds lower the wind-chill quickly outdoors. Keep hands, ears, and neck covered.',
        rainAlert: 'Cold mist or rain: wear a waterproof outer shell.',
        modalTitle: 'Clothing Guide',
        altitudeSubtitle: 'Campos do Jordão · 1,628m elevation',
        feelsLikeLabel: 'Feels like',
        understandBtn: 'Close guide',
      },
      es: {
        pillLabel: 'Abrigo térmico y guantes',
        headline: 'Frío intenso en la sierra',
        thermalDelta: -3,
        summary:
          'Temperatura rigurosa de montaña. Vístete con tres capas térmicas para conservar el calor corporal.',
        layersLabel: 'Capas principales',
        layersValue: 'Primera piel térmica, suéter de lana y abrigo pesado o chaqueta acolchada',
        accessoriesLabel: 'Accesorios esenciales',
        accessoriesValue: 'Gorro, guantes térmicos y bufanda cerrada al cuello',
        footwearLabel: 'Calzado recomendado',
        footwearValue: 'Botas forradas o calzado cerrado impermeable con medias térmicas',
        altitudeTipLabel: 'Consejo de altitud · 1.628m',
        altitudeTipValue:
          'El viento de la sierra reduce la sensación térmica rápidamente al aire libre. Protege las extremidades.',
        rainAlert: 'Llovizna fría en la sierra: prioriza una capa exterior impermeable.',
        modalTitle: 'Guía de Vestimenta',
        altitudeSubtitle: 'Campos do Jordão · 1.628m de altitud',
        feelsLikeLabel: 'Sensación',
        understandBtn: 'Cerrar guía',
      },
      ja: {
        pillLabel: '防寒コートと手袋',
        headline: '高原の厳しい寒さ',
        thermalDelta: -3,
        summary:
          '山岳地帯ならではの強い冷え込みです。体温を逃さないよう3層の防寒レイヤーを着用してください。',
        layersLabel: '基本の重ね着',
        layersValue: 'サーマルインナー＋ウールセーター＋厚手のコートまたはダウンジャケット',
        accessoriesLabel: '必須アクセサリー',
        accessoriesValue: 'ニット帽、防寒手袋、首元を覆うマフラー',
        footwearLabel: 'おすすめの靴',
        footwearValue: '裏起毛ブーツまたは厚手の靴下を合わせた防水シューズ',
        altitudeTipLabel: '標高アドバイス・1,628m',
        altitudeTipValue:
          '高原の風により体感温度がさらに下がります。手先や首元をしっかり保温してください。',
        rainAlert: '冷たい雨や霧：防水性のあるアウターを着用してください。',
        modalTitle: '服装ガイド',
        altitudeSubtitle: 'カンポス・ド・ジョルドン・標高1,628m',
        feelsLikeLabel: '体感温度',
        understandBtn: '閉じる',
      },
    };
    return content[lang] || content.pt;
  }

  // Tier 2: 9°C to 14°C (Classic Campos do Jordão chilly weather)
  if (temp <= 14) {
    const content: Record<AppLanguage, ClothingRecommendation> = {
      pt: {
        pillLabel: 'Casaco de lã e cachecol',
        headline: 'Clima frio de montanha',
        thermalDelta: -2,
        summary:
          'Clima clássico de Campos do Jordão. Aposte em tricô e um bom casaco estruturado para passear com conforto.',
        layersLabel: 'Camadas principais',
        layersValue: 'Tricô ou fleece combinado com casaco de lã ou jaqueta acolchoada',
        accessoriesLabel: 'Acessórios essenciais',
        accessoriesValue: 'Cachecol e proteção leve para a brisa fria da serra',
        footwearLabel: 'Calçado recomendado',
        footwearValue: 'Bota de couro ou tênis estruturado com meia grossa',
        altitudeTipLabel: 'Dica de altitude · 1.628m',
        altitudeTipValue:
          'Ao entardecer a temperatura cai rapidamente. Mantenha o casaco principal mesmo se o sol aparecer.',
        rainAlert: 'Previsão de chuva: leve guarda-chuva compacto ou casaco impermeável.',
        modalTitle: 'Guia de Vestuário',
        altitudeSubtitle: 'Campos do Jordão · 1.628m de altitude',
        feelsLikeLabel: 'Sensação',
        understandBtn: 'Fechar guia',
      },
      en: {
        pillLabel: 'Wool coat & scarf',
        headline: 'Crisp mountain chill',
        thermalDelta: -2,
        summary:
          'Signature Campos do Jordão weather. Pair knitwear with a structured coat for comfortable sightseeing.',
        layersLabel: 'Core layers',
        layersValue: 'Knit sweater or fleece paired with a wool coat or quilted jacket',
        accessoriesLabel: 'Essential accessories',
        accessoriesValue: 'Scarf and light wind protection for the mountain breeze',
        footwearLabel: 'Recommended footwear',
        footwearValue: 'Leather boots or structured sneakers with warm socks',
        altitudeTipLabel: 'Altitude note · 1,628m',
        altitudeTipValue:
          'Temperatures drop quickly around sunset. Keep your main coat handy even on sunny afternoons.',
        rainAlert: 'Rain detected: bring a compact umbrella or water-resistant jacket.',
        modalTitle: 'Clothing Guide',
        altitudeSubtitle: 'Campos do Jordão · 1,628m elevation',
        feelsLikeLabel: 'Feels like',
        understandBtn: 'Close guide',
      },
      es: {
        pillLabel: 'Abrigo de lana y bufanda',
        headline: 'Clima frío de montaña',
        thermalDelta: -2,
        summary:
          'Clima clásico de Campos do Jordão. Combina tejido de punto con un buen abrigo estructurado.',
        layersLabel: 'Capas principales',
        layersValue: 'Suéter de punto o polar combinado con abrigo de lana o chaqueta acolchada',
        accessoriesLabel: 'Accesorios esenciales',
        accessoriesValue: 'Bufanda y protección ligera contra la brisa fría de la sierra',
        footwearLabel: 'Calzado recomendado',
        footwearValue: 'Botas de cuero o zapatillas estructuradas con medias gruesas',
        altitudeTipLabel: 'Consejo de altitud · 1.628m',
        altitudeTipValue:
          'Al atardecer la temperatura baja rápidamente. Lleva tu abrigo principal incluso si hay sol.',
        rainAlert: 'Lluvia en la zona: incluye paraguas compacto o chaqueta impermeable.',
        modalTitle: 'Guía de Vestimenta',
        altitudeSubtitle: 'Campos do Jordão · 1.628m de altitud',
        feelsLikeLabel: 'Sensación',
        understandBtn: 'Cerrar guía',
      },
      ja: {
        pillLabel: 'ウールコートとマフラー',
        headline: '爽やかな高原の冷涼気候',
        thermalDelta: -2,
        summary:
          'カンポス・ド・ジョルドンらしい涼しい気候です。ニットとしっかりしたコートの組み合わせが最適です。',
        layersLabel: '基本の重ね着',
        layersValue: 'ニットまたはフリース＋ウールコートやキルティングジャケット',
        accessoriesLabel: '必須アクセサリー',
        accessoriesValue: 'マフラーと高原の冷たい風を防ぐアイテム',
        footwearLabel: 'おすすめの靴',
        footwearValue: 'レザーブーツまたは厚手の靴下を合わせたスニーカー',
        altitudeTipLabel: '標高アドバイス・1,628m',
        altitudeTipValue:
          '夕暮れ以降は急激に冷え込みます。日中に日差しがあってもコートを携帯してください。',
        rainAlert: '雨模様：折りたたみ傘や撥水ジャケットをご用意ください。',
        modalTitle: '服装ガイド',
        altitudeSubtitle: 'カンポス・ド・ジョルドン・標高1,628m',
        feelsLikeLabel: '体感温度',
        understandBtn: '閉じる',
      },
    };
    return content[lang] || content.pt;
  }

  // Tier 3: 15°C to 19°C (Mild mountain day, chilly shadows & evening)
  if (temp <= 19) {
    const content: Record<AppLanguage, ClothingRecommendation> = {
      pt: {
        pillLabel: 'Suéter ou jaqueta leve',
        headline: 'Ameno ao sol, frio à noite',
        thermalDelta: -1,
        summary:
          'Temperatura agradável para caminhar durante o dia, mas fria na sombra e ao anoitecer.',
        layersLabel: 'Camadas principais',
        layersValue: 'Camisa de manga longa com tricô leve, cardigã ou jaqueta corta-vento',
        accessoriesLabel: 'Acessórios essenciais',
        accessoriesValue: 'Óculos de sol para o dia e echarpe ou cachecol leve para o fim de tarde',
        footwearLabel: 'Calçado recomendado',
        footwearValue: 'Tênis confortável ou bota casual para caminhadas',
        altitudeTipLabel: 'Dica de altitude · 1.628m',
        altitudeTipValue:
          'Após as 17h os termômetros costumam cair até 6°C. Tenha sempre um agasalho extra por perto.',
        rainAlert: 'Tempo úmido: prefira jaqueta impermeável leve com capuz.',
        modalTitle: 'Guia de Vestuário',
        altitudeSubtitle: 'Campos do Jordão · 1.628m de altitude',
        feelsLikeLabel: 'Sensação',
        understandBtn: 'Fechar guia',
      },
      en: {
        pillLabel: 'Sweater or light jacket',
        headline: 'Mild sun, chilly evening',
        thermalDelta: -1,
        summary:
          'Pleasant temperature for daytime walks, turning cool in the shade and after sunset.',
        layersLabel: 'Core layers',
        layersValue: 'Long-sleeve shirt with a light knit, cardigan, or windbreaker jacket',
        accessoriesLabel: 'Essential accessories',
        accessoriesValue: 'Sunglasses for daytime and a light scarf for late afternoon',
        footwearLabel: 'Recommended footwear',
        footwearValue: 'Comfortable walking sneakers or casual ankle boots',
        altitudeTipLabel: 'Altitude note · 1,628m',
        altitudeTipValue:
          'After 5 PM temperatures often drop by up to 6°C. Always keep an extra layer nearby.',
        rainAlert: 'Wet conditions: opt for a lightweight waterproof jacket.',
        modalTitle: 'Clothing Guide',
        altitudeSubtitle: 'Campos do Jordão · 1,628m elevation',
        feelsLikeLabel: 'Feels like',
        understandBtn: 'Close guide',
      },
      es: {
        pillLabel: 'Suéter o chaqueta ligera',
        headline: 'Templado al sol, fresco de noche',
        thermalDelta: -1,
        summary:
          'Temperatura agradable para pasear de día, pero fresca a la sombra y al anochecer.',
        layersLabel: 'Capas principales',
        layersValue: 'Camisa de manga larga con tejido ligero, cárdigan o cortavientos',
        accessoriesLabel: 'Accesorios esenciales',
        accessoriesValue: 'Gafas de sol para el día y pañuelo o bufanda ligera para la tarde',
        footwearLabel: 'Calzado recomendado',
        footwearValue: 'Zapatillas cómodas o botas casuales para caminar',
        altitudeTipLabel: 'Consejo de altitud · 1.628m',
        altitudeTipValue:
          'Después de las 17h la temperatura suele bajar hasta 6°C. Ten siempre un abrigo a mano.',
        rainAlert: 'Clima húmedo: prefiere una chaqueta impermeable ligera.',
        modalTitle: 'Guía de Vestimenta',
        altitudeSubtitle: 'Campos do Jordão · 1.628m de altitud',
        feelsLikeLabel: 'Sensación',
        understandBtn: 'Cerrar guía',
      },
      ja: {
        pillLabel: 'セーターまたは薄手のジャケット',
        headline: '日中は快適・夜は冷え込み',
        thermalDelta: -1,
        summary:
          '日中の散策には心地よい気温ですが、日陰や夕方以降は肌寒くなります。',
        layersLabel: '基本の重ね着',
        layersValue: '長袖シャツ＋薄手のニット、カーディガン、またはウィンドブレーカー',
        accessoriesLabel: '必須アクセサリー',
        accessoriesValue: '日中のサングラスと、夕方用の薄手のストール',
        footwearLabel: 'おすすめの靴',
        footwearValue: '歩きやすいスニーカーまたはカジュアルブーツ',
        altitudeTipLabel: '標高アドバイス・1,628m',
        altitudeTipValue:
          '17時以降は気温が最大6°Cほど下がります。羽織れる上着を必ずお持ちください。',
        rainAlert: '雨への備え：軽量な撥水ジャケットがおすすめです。',
        modalTitle: '服装ガイド',
        altitudeSubtitle: 'カンポス・ド・ジョルドン・標高1,628m',
        feelsLikeLabel: '体感温度',
        understandBtn: '閉じる',
      },
    };
    return content[lang] || content.pt;
  }

  // Tier 4: >= 20°C (Pleasant mountain day, cool night)
  const content: Record<AppLanguage, ClothingRecommendation> = {
    pt: {
      pillLabel: 'Roupa leve + casaco p/ noite',
      headline: 'Dia agradável na serra',
      thermalDelta: 0,
      summary:
        'Dia suave e ensolarado nos parques e mirantes. Ainda assim, o ar de montanha esfria à noite.',
      layersLabel: 'Camadas principais',
      layersValue: 'Camiseta ou camisa leve durante o dia e jaqueta leve para a noite',
      accessoriesLabel: 'Acessórios essenciais',
      accessoriesValue: 'Óculos de sol, protetor solar e hidratante labial',
      footwearLabel: 'Calçado recomendado',
      footwearValue: 'Tênis leve e confortável para explorar trilhas e o Capivari',
      altitudeTipLabel: 'Dica de altitude · 1.628m',
      altitudeTipValue:
        'Mesmo em dias mais quentes, as noites na serra pedem um agasalho leve para jantar fora.',
      rainAlert: 'Pancadas na serra: leve capa de chuva ou guarda-chuva compacto.',
      modalTitle: 'Guia de Vestuário',
      altitudeSubtitle: 'Campos do Jordão · 1.628m de altitude',
      feelsLikeLabel: 'Sensação',
      understandBtn: 'Fechar guia',
    },
    en: {
      pillLabel: 'Light wear + evening jacket',
      headline: 'Pleasant mountain day',
      thermalDelta: 0,
      summary:
        'Mild and comfortable for parks and viewpoints, though mountain air still cools down at night.',
      layersLabel: 'Core layers',
      layersValue: 'Breathable shirt or tee by day, plus a light jacket for the evening',
      accessoriesLabel: 'Essential accessories',
      accessoriesValue: 'Sunglasses, sunscreen, and lip balm for the dry mountain air',
      footwearLabel: 'Recommended footwear',
      footwearValue: 'Light, comfortable sneakers for exploring trails and Capivari',
      altitudeTipLabel: 'Altitude note · 1,628m',
      altitudeTipValue:
        'Even on warmer days, mountain evenings call for a light sweater or jacket when dining out.',
      rainAlert: 'Mountain showers: carry a compact umbrella or light rain shell.',
      modalTitle: 'Clothing Guide',
      altitudeSubtitle: 'Campos do Jordão · 1,628m elevation',
      feelsLikeLabel: 'Feels like',
      understandBtn: 'Close guide',
    },
    es: {
      pillLabel: 'Ropa ligera + chaqueta nocturna',
      headline: 'Día agradable en la sierra',
      thermalDelta: 0,
      summary:
        'Día suave para parques y miradores, aunque el aire de montaña siempre refresca por la noche.',
      layersLabel: 'Capas principales',
      layersValue: 'Camiseta o camisa ligera de día y chaqueta suave para la noche',
      accessoriesLabel: 'Accesorios esenciales',
      accessoriesValue: 'Gafas de sol, protector solar y bálsamo labial',
      footwearLabel: 'Calzado recomendado',
      footwearValue: 'Zapatillas ligeras y cómodas para recorrer senderos y Capivari',
      altitudeTipLabel: 'Consejo de altitud · 1.628m',
      altitudeTipValue:
        'Incluso en días cálidos, las noches en la sierra requieren un abrigo ligero al salir.',
      rainAlert: 'Lluvias de montaña: lleva paraguas compacto o impermeable ligero.',
      modalTitle: 'Guía de Vestimenta',
      altitudeSubtitle: 'Campos do Jordão · 1.628m de altitud',
      feelsLikeLabel: 'Sensación',
      understandBtn: 'Cerrar guía',
    },
    ja: {
      pillLabel: '軽装＋夜用ジャケット',
      headline: '過ごしやすい高原の陽気',
      thermalDelta: 0,
      summary:
        '公園や展望台巡りに最適な穏やかな気候ですが、夜間は高原特有の涼しさになります。',
      layersLabel: '基本の重ね着',
      layersValue: '日中は軽やかなシャツやTシャツ＋夜用の薄手ジャケット',
      accessoriesLabel: '必須アクセサリー',
      accessoriesValue: 'サングラス、日焼け止め、乾燥対策のリップクリーム',
      footwearLabel: 'おすすめの靴',
      footwearValue: 'カピヴァリ散策やトレイルに適した軽量スニーカー',
      altitudeTipLabel: '標高アドバイス・1,628m',
      altitudeTipValue:
        '暖かい日でも、夜の外出やディナーには薄手の羽織りものが必要です。',
      rainAlert: '山の天気：折りたたみ傘やレインジャケットがあると安心です。',
      modalTitle: '服装ガイド',
      altitudeSubtitle: 'カンポス・ド・ジョルドン・標高1,628m',
      feelsLikeLabel: '体感温度',
      understandBtn: '閉じる',
    },
  };
  return content[lang] || content.pt;
}

/**
 * Minimalist linear coat/jacket SVG icon following Apple SF Symbols stroke aesthetics.
 */
const CoatLinearIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M9 3 4 6.5 6 11l2-1v10h8V10l2 1 2-4.5L15 3" />
    <path d="M9 3c1 1.5 2 2.2 3 2.2S14 4.5 15 3" />
    <path d="M12 5.2V20" />
  </svg>
);

interface MobileClothingPillProps {
  weather: RealWeatherSnapshot;
  onOpenGuide: () => void;
  isSatellite?: boolean;
  isAnimado?: boolean;
  theme?: 'dark' | 'light';
}

export const MobileExploreClothingPill: React.FC<MobileClothingPillProps> = ({
  weather,
  onOpenGuide,
  isSatellite = false,
  theme = 'dark',
}) => {
  const { language } = useLanguage();
  const rec = getClothingRecommendation(weather.temperature, language);
  const isLightMapText = !isSatellite && theme === 'light';

  return (
    <button
      id="explore-clothing-widget-pill"
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        try {
          triggerHapticFeedback(10);
        } catch {}
        onOpenGuide();
      }}
      aria-label={`${rec.modalTitle}: ${rec.pillLabel}`}
      className={`mt-2 group flex items-center gap-2 px-3 py-1.5 rounded-full ios26-liquid-glass transition-all duration-200 active:scale-95 cursor-pointer select-none max-w-[235px] sm:max-w-[265px] ${
        isLightMapText ? 'text-zinc-900' : 'text-white'
      }`}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
      }}
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
          isLightMapText
            ? 'bg-black/[0.07] text-[#007AFF]'
            : 'bg-white/[0.14] text-[#4DA3FF]'
        }`}
      >
        <CoatLinearIcon className="w-3.5 h-3.5" />
      </span>

      <span
        className={`text-[12px] sm:text-[12.5px] font-semibold tracking-[-0.01em] truncate ${
          isLightMapText ? 'text-zinc-900' : 'text-white'
        }`}
      >
        {rec.pillLabel}
      </span>

      <ChevronRight
        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
          isLightMapText ? 'text-zinc-500' : 'text-white/70'
        }`}
      />
    </button>
  );
};

interface DesktopClothingBannerProps {
  weather: RealWeatherSnapshot;
  onOpenGuide: () => void;
  theme?: 'dark' | 'light';
}

export const DesktopExploreClothingBanner: React.FC<DesktopClothingBannerProps> = ({
  weather,
  onOpenGuide,
  theme = 'dark',
}) => {
  const { language } = useLanguage();
  const rec = getClothingRecommendation(weather.temperature, language);
  const feelsLike = weather.temperature + rec.thermalDelta;
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onOpenGuide}
      className={`w-full text-left rounded-2xl p-3.5 border transition-all duration-200 cursor-pointer group flex items-center justify-between gap-3 ${
        isDark
          ? 'bg-[#121316] border-[#24262B] hover:border-white/25 text-white'
          : 'bg-[#F6F7F9] border-zinc-200/90 hover:border-zinc-300 text-zinc-900'
      }`}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isDark
              ? 'bg-[#1A1D24] border-white/10 text-[#4DA3FF]'
              : 'bg-white border-zinc-200/80 text-[#007AFF]'
          }`}
        >
          <CoatLinearIcon className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
            <span className="tabular-nums font-semibold text-[#007AFF]">
              {weather.temperature}°C
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">
              {rec.feelsLikeLabel} {feelsLike}°C
            </span>
          </div>
          <p
            className={`text-[13px] font-semibold tracking-tight truncate mt-0.5 ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}
          >
            {rec.pillLabel}
          </p>
        </div>
      </div>

      <ChevronRight
        className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      />
    </button>
  );
};

interface ClothingWeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  weather: RealWeatherSnapshot;
}

export const ClothingWeatherModal: React.FC<ClothingWeatherModalProps> = ({
  isOpen,
  onClose,
  weather,
}) => {
  const { language, tr } = useLanguage();
  const rec = getClothingRecommendation(weather.temperature, language);
  const feelsLike = weather.temperature + rec.thermalDelta;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="clothing-weather-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          className="fixed inset-0 z-[85] bg-black/55 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5 select-none"
          style={{ WebkitBackdropFilter: 'blur(14px)' }}
        >
          <motion.div
            id="clothing-weather-modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clothing-weather-modal-title"
            initial={{ opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[400px] rounded-t-[32px] sm:rounded-[32px] bg-[#121316]/95 border-t sm:border border-white/[0.11] text-white px-6 pt-4 pb-7 shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
              paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            }}
          >
            {/* iOS Grabber Handle on mobile */}
            <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-4 sm:hidden" />

            {/* Top Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[#8E939E] tracking-tight">
                  {rec.altitudeSubtitle}
                </p>
                <h2
                  id="clothing-weather-modal-title"
                  className="text-[20px] font-bold tracking-[-0.02em] text-white mt-0.5"
                >
                  {rec.modalTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={rec.understandBtn}
                className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 flex items-center justify-center text-[#A1A1AA] hover:text-white transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Weather & Thermal Summary Hero */}
            <div className="mt-5 pb-5 border-b border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Weather3DIcon
                  weatherCode={weather.weatherCode}
                  isDay={weather.isDay}
                  className="w-14 h-14 -my-1 shrink-0"
                />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[38px] font-bold tracking-tighter leading-none tabular-nums text-white">
                      {weather.temperature}°
                    </span>
                    <span className="text-[13px] font-medium text-[#8E939E] tabular-nums">
                      {rec.feelsLikeLabel} {feelsLike}°C
                    </span>
                  </div>
                  <p className="text-[13px] font-medium text-[#A1A1AA] mt-1">
                    {tr(weather.condition)}
                  </p>
                </div>
              </div>
            </div>

            {/* Recommendation Headline & Summary */}
            <div className="mt-5">
              <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white">
                {rec.headline}
              </h3>
              <p className="text-[13.5px] text-[#9CA3AF] leading-relaxed mt-1">
                {rec.summary}
              </p>
            </div>

            {/* Clean Structured Clothing Rows (Unboxed with subtle hairline dividers) */}
            <div className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {/* 1. Core Layers */}
              <div className="py-3.5 flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-full bg-[#007AFF]/15 text-[#4DA3FF] flex items-center justify-center shrink-0 mt-0.5">
                  <CoatLinearIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[#8E939E]">
                    {rec.layersLabel}
                  </p>
                  <p className="text-[14px] font-medium text-white leading-snug mt-0.5">
                    {rec.layersValue}
                  </p>
                </div>
              </div>

              {/* 2. Accessories */}
              <div className="py-3.5 flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-full bg-[#007AFF]/15 text-[#4DA3FF] flex items-center justify-center shrink-0 mt-0.5">
                  <Wind className="w-4 h-4 stroke-[1.9]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[#8E939E]">
                    {rec.accessoriesLabel}
                  </p>
                  <p className="text-[14px] font-medium text-white leading-snug mt-0.5">
                    {rec.accessoriesValue}
                  </p>
                </div>
              </div>

              {/* 3. Footwear */}
              <div className="py-3.5 flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-full bg-[#007AFF]/15 text-[#4DA3FF] flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 stroke-[1.9]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[#8E939E]">
                    {rec.footwearLabel}
                  </p>
                  <p className="text-[14px] font-medium text-white leading-snug mt-0.5">
                    {rec.footwearValue}
                  </p>
                </div>
              </div>

              {/* Optional Rain Row when raining in Campos do Jordão */}
              {weather.isRaining && (
                <div className="py-3.5 flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#007AFF]/15 text-[#4DA3FF] flex items-center justify-center shrink-0 mt-0.5">
                    <CloudRain className="w-4 h-4 stroke-[1.9]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-white leading-snug">
                      {rec.rainAlert}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mountain Altitude Note */}
            <div className="mt-4 flex items-start gap-2.5 text-[#8E939E]">
              <Thermometer className="w-4 h-4 text-[#4DA3FF] shrink-0 mt-0.5 stroke-[1.9]" />
              <p className="text-[12.5px] leading-relaxed">
                <span className="font-semibold text-white/90">{rec.altitudeTipLabel}: </span>
                {rec.altitudeTipValue}
              </p>
            </div>

            {/* Primary Close Action */}
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full h-[50px] rounded-full bg-[#007AFF] hover:bg-[#0066D6] active:scale-[0.98] text-white text-[15px] font-semibold flex items-center justify-center transition-all cursor-pointer"
            >
              {rec.understandBtn}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
