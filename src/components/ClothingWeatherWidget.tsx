import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { useLanguage, AppLanguage } from '../contexts/LanguageContext';
import {
  Weather3DIcon,
  ThermometerMin3DIcon,
  ThermometerMax3DIcon,
  HumidityDrop3DIcon,
  WindFlow3DIcon,
} from './Weather3DIcon';
import { triggerHapticFeedback } from '../utils/haptics';

import weatherOutfitCold from '../assets/images/weather_outfit_cold.png';
import weatherOutfitLayers from '../assets/images/weather_outfit_layers.png';
import weatherOutfitRain from '../assets/images/weather_outfit_rain.png';
import weatherOutfitMild from '../assets/images/weather_outfit_mild.png';

export interface RealWeatherSnapshot {
  temperature: number;
  feelsLike?: number;
  minTemp?: number;
  maxTemp?: number;
  humidity?: number;
  windSpeed?: number;
  condition: string;
  isDay: boolean;
  weatherCode: number;
  isRaining: boolean;
  rainIntensity?: 'none' | 'fraca' | 'moderada' | 'forte';
  hasLightning?: boolean;
  precipitationMm?: number;
}

type OutfitCategory = 'cold' | 'layers' | 'rain' | 'mild';

interface WeatherClothingPresentation {
  category: OutfitCategory;
  image: string;
  pillLabel: string;
  title: string;
  subtitle: string;
  feelsLikeLabel: string;
  minLabel: string;
  maxLabel: string;
  humidityLabel: string;
  windLabel: string;
  ariaLabel: string;
}

const OUTFIT_IMAGE_MAP: Record<OutfitCategory, string> = {
  cold: weatherOutfitCold,
  layers: weatherOutfitLayers,
  rain: weatherOutfitRain,
  mild: weatherOutfitMild,
};

function resolveClothingPresentation(
  weather: RealWeatherSnapshot,
  lang: AppLanguage
): WeatherClothingPresentation {
  const temp = Math.round(weather.temperature);
  const minTemp =
    typeof weather.minTemp === 'number' ? Math.round(weather.minTemp) : temp - 5;
  const maxTemp =
    typeof weather.maxTemp === 'number' ? Math.round(weather.maxTemp) : temp + 3;
  const dailySpread = Math.max(0, maxTemp - minTemp);

  const labels: Record<
    AppLanguage,
    {
      feelsLikeLabel: string;
      minLabel: string;
      maxLabel: string;
      humidityLabel: string;
      windLabel: string;
      ariaLabel: string;
    }
  > = {
    pt: {
      feelsLikeLabel: 'Sensação térmica',
      minLabel: 'Mínima',
      maxLabel: 'Máxima',
      humidityLabel: 'Umidade',
      windLabel: 'Vento',
      ariaLabel: 'Clima em Campos do Jordão',
    },
    en: {
      feelsLikeLabel: 'Feels like',
      minLabel: 'Low',
      maxLabel: 'High',
      humidityLabel: 'Humidity',
      windLabel: 'Wind',
      ariaLabel: 'Weather in Campos do Jordão',
    },
    es: {
      feelsLikeLabel: 'Sensación térmica',
      minLabel: 'Mínima',
      maxLabel: 'Máxima',
      humidityLabel: 'Humedad',
      windLabel: 'Viento',
      ariaLabel: 'Clima en Campos do Jordão',
    },
    ja: {
      feelsLikeLabel: '体感温度',
      minLabel: '最低',
      maxLabel: '最高',
      humidityLabel: '湿度',
      windLabel: '風速',
      ariaLabel: 'カンポス・ド・ジョルドンの天気',
    },
  };

  const l = labels[lang] || labels.pt;

  // 1. Active rain takes top priority
  if (weather.isRaining) {
    const copy: Record<AppLanguage, { pill: string; title: string; sub: string }> = {
      pt: {
        pill: 'Proteja-se da chuva',
        title: 'Proteja-se da chuva',
        sub:
          temp <= 15
            ? 'Casaco impermeável quente e guarda-chuva compacto.'
            : 'Leve jaqueta impermeável leve e guarda-chuva.',
      },
      en: {
        pill: 'Rain protection',
        title: 'Stay dry in the rain',
        sub:
          temp <= 15
            ? 'Warm waterproof shell and a compact umbrella.'
            : 'Bring a light waterproof jacket and umbrella.',
      },
      es: {
        pill: 'Protección de lluvia',
        title: 'Protégete de la lluvia',
        sub:
          temp <= 15
            ? 'Chaqueta impermeable abrigada y paraguas compacto.'
            : 'Lleva chaqueta impermeable ligera y paraguas.',
      },
      ja: {
        pill: '雨対策アウター',
        title: '雨対策を万全に',
        sub:
          temp <= 15
            ? '暖かい防水ジャケットと折りたたみ傘があると安心です。'
            : '軽量の撥水ジャケットと傘をお持ちください。',
      },
    };
    const c = copy[lang] || copy.pt;
    return {
      category: 'rain',
      image: OUTFIT_IMAGE_MAP.rain,
      pillLabel: c.pill,
      title: c.title,
      subtitle: c.sub,
      ...l,
    };
  }

  // 2. Cold mountain weather (<= 13°C)
  if (temp <= 13) {
    const copy: Record<AppLanguage, { pill: string; title: string; sub: string }> = {
      pt: {
        pill: 'Casaco e cachecol',
        title: temp <= 8 ? 'Agasalho reforçado' : 'Aposte em um bom casaco',
        sub:
          temp <= 8
            ? 'Casaco térmico, cachecol e gorro para o frio intenso.'
            : 'Jaqueta quente, tricô e cachecol para o clima da serra.',
      },
      en: {
        pill: 'Warm coat & scarf',
        title: temp <= 8 ? 'Bundle up warmly' : 'Wear a warm coat',
        sub:
          temp <= 8
            ? 'Heavy insulated jacket, knit scarf, and beanie.'
            : 'Puffer or wool coat with a scarf for crisp mountain air.',
      },
      es: {
        pill: 'Abrigo y bufanda',
        title: temp <= 8 ? 'Abrígate bien' : 'Usa un buen abrigo',
        sub:
          temp <= 8
            ? 'Chaqueta térmica, bufanda y gorro para el frío intenso.'
            : 'Abrigo cálido y bufanda para el aire frío de montaña.',
      },
      ja: {
        pill: '防寒コートとマフラー',
        title: temp <= 8 ? 'しっかり防寒対策を' : '暖かいコートがおすすめ',
        sub:
          temp <= 8
            ? '厚手のダウン、マフラー、ニット帽で暖かく。'
            : '高原の冷え込みに備えてコートとマフラーを。',
      },
    };
    const c = copy[lang] || copy.pt;
    return {
      category: 'cold',
      image: OUTFIT_IMAGE_MAP.cold,
      pillLabel: c.pill,
      title: c.title,
      subtitle: c.sub,
      ...l,
    };
  }

  // 3. Mild / layered mountain weather (14°C – 21°C, or notable daily temperature swing)
  if (temp <= 21 || dailySpread >= 7) {
    const useWarmLayerVisual = temp <= 17;
    const copy: Record<AppLanguage, { pill: string; title: string; sub: string }> = {
      pt: {
        pill: 'Vista-se em camadas',
        title: 'Vista-se em camadas',
        sub:
          dailySpread >= 8
            ? 'Leve uma blusa extra para o frio da serra.'
            : 'Temperaturas agradáveis, com frio à noite.',
      },
      en: {
        pill: 'Dress in layers',
        title: 'Dress in layers',
        sub:
          dailySpread >= 8
            ? 'Bring an extra sweater for the mountain chill.'
            : 'Pleasant temperatures, turning cool at night.',
      },
      es: {
        pill: 'Vístete en capas',
        title: 'Vístete en capas',
        sub:
          dailySpread >= 8
            ? 'Lleva una prenda extra para el frío de la sierra.'
            : 'Temperaturas agradables, con fresco por la noche.',
      },
      ja: {
        pill: '重ね着がおすすめ',
        title: '重ね着がおすすめ',
        sub:
          dailySpread >= 8
            ? '寒暖差に備えて羽織れる上着をお持ちください。'
            : '日中は快適ですが、夜は肌寒くなります。',
      },
    };
    const c = copy[lang] || copy.pt;
    return {
      category: useWarmLayerVisual ? 'cold' : 'layers',
      image: useWarmLayerVisual ? OUTFIT_IMAGE_MAP.cold : OUTFIT_IMAGE_MAP.layers,
      pillLabel: c.pill,
      title: c.title,
      subtitle: c.sub,
      ...l,
    };
  }

  // 4. Warm / sunny mountain day (>= 22°C, small spread, no rain)
  const copy: Record<AppLanguage, { pill: string; title: string; sub: string }> = {
    pt: {
      pill: 'Roupas leves',
      title: 'Roupas leves',
      sub: 'Peças frescas durante o dia e malha leve ao anoitecer.',
    },
    en: {
      pill: 'Light attire',
      title: 'Wear light clothing',
      sub: 'Breathable pieces by day and a light layer for evening.',
    },
    es: {
      pill: 'Ropa ligera',
      title: 'Usa ropa ligera',
      sub: 'Prendas frescas de día y una capa suave por la noche.',
    },
    ja: {
      pill: '軽やかな服装',
      title: '軽やかな服装で快適に',
      sub: '日中は涼しく、夜用に薄手の羽織りがあると安心です。',
    },
  };
  const c = copy[lang] || copy.pt;
  return {
    category: 'mild',
    image: OUTFIT_IMAGE_MAP.mild,
    pillLabel: c.pill,
    title: c.title,
    subtitle: c.sub,
    ...l,
  };
}

/**
 * Minimalist linear coat SVG icon used only for compact pill/desktop banner callers.
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
  const rec = resolveClothingPresentation(weather, language);
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
      aria-label={`${rec.ariaLabel}: ${rec.pillLabel}`}
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
  const rec = resolveClothingPresentation(weather, language);
  const feelsLike =
    typeof weather.feelsLike === 'number'
      ? Math.round(weather.feelsLike)
      : Math.round(weather.temperature - 1);
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
        <div className="w-11 h-11 shrink-0 flex items-center justify-center">
          <img
            src={rec.image}
            alt={rec.title}
            className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.22)]"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
            <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
              {Math.round(weather.temperature)}°C
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate tabular-nums">
              {rec.feelsLikeLabel} {feelsLike}°C
            </span>
          </div>
          <p
            className={`text-[13px] font-semibold tracking-tight truncate mt-0.5 ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}
          >
            {rec.title}
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
  theme?: 'dark' | 'light';
  isSatellite?: boolean;
}

export const ClothingWeatherModal: React.FC<ClothingWeatherModalProps> = ({
  isOpen,
  onClose,
  weather,
  theme = 'dark',
  isSatellite = false,
}) => {
  const { language } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false);
  const rec = resolveClothingPresentation(weather, language);

  const currentTemp = Math.round(weather.temperature);
  const feelsLike =
    typeof weather.feelsLike === 'number'
      ? Math.round(weather.feelsLike)
      : currentTemp - (currentTemp <= 14 ? 2 : 1);
  const minTemp =
    typeof weather.minTemp === 'number' ? Math.round(weather.minTemp) : currentTemp - 5;
  const maxTemp =
    typeof weather.maxTemp === 'number' ? Math.round(weather.maxTemp) : currentTemp + 3;
  const humidity =
    typeof weather.humidity === 'number' ? Math.round(weather.humidity) : 78;
  const windSpeed =
    typeof weather.windSpeed === 'number' ? Math.round(weather.windSpeed) : 8;

  // Use rich iOS dark frosted glass over satellite / dark map, and luminous frosted glass on light map
  const useDarkGlass = isSatellite || theme === 'dark';

  useEffect(() => {
    setImgFailed(false);
  }, [rec.image]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Luminous silver-slate translucent iOS 26 Liquid Glass over satellite/dark map,
  // and crystal frosted glass over light map.
  const glassCardStyle: React.CSSProperties = useDarkGlass
    ? {
        background:
          'linear-gradient(150deg, rgba(188, 196, 206, 0.34) 0%, rgba(114, 122, 132, 0.28) 48%, rgba(142, 150, 160, 0.34) 100%)',
        backdropFilter: 'blur(26px) saturate(150%) brightness(1.06)',
        WebkitBackdropFilter: 'blur(26px) saturate(150%) brightness(1.06)',
        border: '1px solid rgba(255, 255, 255, 0.34)',
        boxShadow:
          '0 18px 42px rgba(0, 0, 0, 0.16), inset 0 1.5px 1px rgba(255, 255, 255, 0.44), inset 0 -1px 1.5px rgba(255, 255, 255, 0.18), inset 1px 0 1px rgba(255, 255, 255, 0.22)',
      }
    : {
        background:
          'linear-gradient(150deg, rgba(255, 255, 255, 0.64) 0%, rgba(242, 245, 250, 0.52) 50%, rgba(255, 255, 255, 0.62) 100%)',
        backdropFilter: 'blur(26px) saturate(160%) brightness(1.03)',
        WebkitBackdropFilter: 'blur(26px) saturate(160%) brightness(1.03)',
        border: '1px solid rgba(255, 255, 255, 0.80)',
        boxShadow:
          '0 16px 38px rgba(15, 23, 42, 0.11), inset 0 1.5px 1px rgba(255, 255, 255, 0.92), inset 0 -1px 1px rgba(255, 255, 255, 0.48)',
      };

  const primaryTextClass = useDarkGlass ? 'text-white' : 'text-zinc-950';
  const secondaryTextClass = useDarkGlass ? 'text-white/80' : 'text-zinc-600';
  const metricLabelClass = useDarkGlass ? 'text-white/80' : 'text-zinc-600';

  const detailMetrics = [
    {
      id: 'min',
      label: rec.minLabel,
      value: `${minTemp}°C`,
      icon: <ThermometerMin3DIcon className="w-7 h-7 sm:w-8 sm:h-8" />,
    },
    {
      id: 'max',
      label: rec.maxLabel,
      value: `${maxTemp}°C`,
      icon: <ThermometerMax3DIcon className="w-7 h-7 sm:w-8 sm:h-8" />,
    },
    {
      id: 'humidity',
      label: rec.humidityLabel,
      value: `${humidity}%`,
      icon: <HumidityDrop3DIcon className="w-7 h-7 sm:w-8 sm:h-8" />,
    },
    {
      id: 'wind',
      label: rec.windLabel,
      value: `${windSpeed} km/h`,
      icon: <WindFlow3DIcon className="w-7 h-7 sm:w-8 sm:h-8" />,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="clothing-weather-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={rec.ariaLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          className="fixed inset-0 z-[260] flex items-center justify-center px-4 sm:px-6 select-none"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
            backgroundColor: useDarkGlass
              ? 'rgba(14, 18, 24, 0.08)'
              : 'rgba(255, 255, 255, 0.14)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            paddingTop: 'max(24px, calc(env(safe-area-inset-top, 0px) + 20px))',
            paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
          }}
        >
          <motion.div
            id="clothing-weather-modal-sheet"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{
              type: 'spring',
              stiffness: 360,
              damping: 30,
              mass: 0.85,
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[388px] sm:max-w-[436px] flex flex-col gap-3.5 sm:gap-4"
          >
            {/* 1. DOMINANT MAIN WEATHER HERO LIQUID GLASS CARD */}
            <motion.section
              aria-label={`${currentTemp}°C`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={glassCardStyle}
              className={`w-full rounded-[34px] px-6 py-6 sm:px-8 sm:py-7 flex items-center justify-between gap-4 ${primaryTextClass}`}
            >
              {/* Large Volumetric 3D Weather Condition Icon */}
              <div className="flex-1 flex items-center justify-center">
                <Weather3DIcon
                  weatherCode={weather.weatherCode}
                  isDay={weather.isDay}
                  className="w-[128px] h-[128px] sm:w-[144px] sm:h-[144px]"
                />
              </div>

              {/* Dominant Temperature & Secondary Feels-Like */}
              <div className="flex-1 flex flex-col items-start justify-center pl-1 sm:pl-2">
                <span
                  className={`text-[74px] sm:text-[84px] font-bold tracking-[-0.04em] leading-[0.9] tabular-nums drop-shadow-[0_2px_10px_rgba(0,0,0,0.12)] ${primaryTextClass}`}
                >
                  {currentTemp}°
                </span>

                <div className="mt-3 flex flex-col">
                  <span
                    className={`text-[13.5px] sm:text-[14.5px] font-normal tracking-[-0.01em] leading-snug ${secondaryTextClass}`}
                  >
                    {rec.feelsLikeLabel}
                  </span>
                  <span
                    className={`text-[19px] sm:text-[21px] font-semibold tracking-[-0.02em] leading-tight mt-0.5 tabular-nums ${primaryTextClass}`}
                  >
                    {feelsLike}°C
                  </span>
                </div>
              </div>
            </motion.section>

            {/* 2. FOUR BALANCED WEATHER DETAIL METRIC CARDS */}
            <motion.section
              aria-label="Detalhes do clima"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-4 gap-2.5 sm:gap-3 w-full"
            >
              {detailMetrics.map((metric) => (
                <div
                  key={metric.id}
                  style={glassCardStyle}
                  className={`rounded-[24px] py-3.5 px-1.5 sm:py-4 sm:px-2 flex flex-col items-center justify-center text-center gap-1 ${primaryTextClass}`}
                >
                  <div className="flex items-center justify-center mb-0.5">
                    {metric.icon}
                  </div>
                  <span
                    className={`text-[12px] sm:text-[13px] font-normal tracking-[-0.01em] leading-none whitespace-nowrap ${metricLabelClass}`}
                  >
                    {metric.label}
                  </span>
                  <span
                    className={`text-[15px] sm:text-[16.5px] font-bold tracking-[-0.02em] leading-tight tabular-nums whitespace-nowrap mt-0.5 ${primaryTextClass}`}
                  >
                    {metric.value}
                  </span>
                </div>
              ))}
            </motion.section>

            {/* 3. VISUAL DYNAMIC CLOTHING RECOMMENDATION CARD (FLOATING TRANSPARENT CUTOUT) */}
            <motion.section
              aria-label={rec.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              style={glassCardStyle}
              className={`w-full rounded-[34px] px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-4 sm:gap-5 ${primaryTextClass}`}
            >
              {/* Pure Transparent Floating Clothing Cutout — Zero Background Box */}
              <div className="w-[100px] h-[100px] sm:w-[114px] sm:h-[114px] shrink-0 flex items-center justify-center">
                {!imgFailed ? (
                  <img
                    src={rec.image}
                    alt={rec.title}
                    loading="eager"
                    decoding="async"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-contain select-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.32)]"
                  />
                ) : (
                  <CoatLinearIcon className="w-10 h-10 text-white/80" />
                )}
              </div>

              {/* Short, Direct Clothing Recommendation */}
              <div className="flex-1 min-w-0 pr-1">
                <h3
                  className={`text-[17.5px] sm:text-[19px] font-bold tracking-[-0.018em] leading-snug ${primaryTextClass}`}
                >
                  {rec.title}
                </h3>
                <p
                  className={`text-[13.5px] sm:text-[14.5px] font-normal leading-[1.35] mt-1 ${secondaryTextClass}`}
                >
                  {rec.subtitle}
                </p>
              </div>
            </motion.section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
