import React from 'react';

interface Weather3DIconProps {
  weatherCode: number;
  isDay: boolean;
  className?: string;
}

/**
 * High-definition, volumetric vector weather icon matching Apple Weather
 * and the user's reference in IMG_7052.jpeg:
 * - Scalloped golden-orange glowing sun
 * - Clean, puffy, volumetric white-to-silver cumulus cloud
 * - 100% crisp vector SVG with zero pixelation or blurry filter artifacts
 */
export const Weather3DIcon: React.FC<Weather3DIconProps> = ({
  weatherCode,
  isDay,
  className = 'w-16 h-16 sm:w-20 sm:h-20',
}) => {
  // Determine weather category based on Open-Meteo WMO weather codes
  const isClear = weatherCode === 0 || weatherCode === 1;
  const isPartlyCloudy = weatherCode === 2;
  const isOvercast = weatherCode === 3 || weatherCode === 45 || weatherCode === 48;
  const isRain =
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82);
  const isSnow =
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 85 && weatherCode <= 86);
  const isThunderstorm = weatherCode >= 95;

  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] overflow-visible"
      >
        <defs>
          {/* Radiant Sun Warm Gradient matching IMG_7052 */}
          <linearGradient id="wSunGradient" x1="20%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#FFAE00" />
            <stop offset="40%" stopColor="#FF9500" />
            <stop offset="75%" stopColor="#FF7000" />
            <stop offset="100%" stopColor="#F04E00" />
          </linearGradient>

          {/* Sun Specular Inner Highlight */}
          <radialGradient id="wSunInnerGlow" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFF280" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#FFA000" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FF6600" stopOpacity="0" />
          </radialGradient>

          {/* Cloud Volumetric Front Body Gradient matching IMG_7052 */}
          <linearGradient id="wCloudFront" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#F8FAFC" />
            <stop offset="85%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          {/* Cloud Specular Top Sheen */}
          <linearGradient id="wCloudHighlight" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Cloud Inner Volumetric Shadow / Belly */}
          <linearGradient id="wCloudBelly" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#DDE5ED" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.9" />
          </linearGradient>

          {/* Cloud Back Layer (for overcast / layered scenes) */}
          <linearGradient id="wCloudBack" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>

          {/* Dark Storm Cloud Gradient */}
          <linearGradient id="wStormCloud" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Crescent Moon Radiant Gradient */}
          <linearGradient id="wMoonGradient" x1="20%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#E0E7FF" />
            <stop offset="80%" stopColor="#C7D2FE" />
            <stop offset="100%" stopColor="#A5B4FC" />
          </linearGradient>

          {/* Raindrop Cyan-Blue Gradient */}
          <linearGradient id="wRainDrop" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          {/* Lightning Bolt Gradient */}
          <linearGradient id="wLightning" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
        </defs>

        {/* ============================================================ */}
        {/* SCENARIO 1: PARTLY CLOUDY DAY (Default & Exact match to IMG_7052) */}
        {/* ============================================================ */}
        {((isDay && isPartlyCloudy) || (!isClear && !isRain && !isSnow && !isThunderstorm && isDay && !isOvercast)) && (
          <g>
            {/* Scalloped Glowing Sun behind the cloud (upper-left) */}
            <g transform="translate(4, 2)">
              {/* Sun Ambient Shadow */}
              <path
                d="M 36 12 
                   C 39 12, 42 14, 44 17 
                   C 46 20, 48 21, 51 22 
                   C 54 23, 56 26, 56 29 
                   C 56 32, 57 35, 59 37 
                   C 60 40, 59 43, 57 45 
                   C 55 47, 54 50, 54 53 
                   C 53 56, 51 58, 48 58 
                   C 45 59, 42 61, 40 63 
                   C 37 64, 34 63, 32 61 
                   C 29 60, 26 60, 24 62 
                   C 21 63, 18 61, 17 58 
                   C 16 55, 13 54, 11 52 
                   C 9 50, 9 47, 10 44 
                   C 12 42, 12 39, 11 36 
                   C 10 33, 12 30, 14 29 
                   C 17 28, 19 25, 20 22 
                   C 21 19, 24 17, 27 17 
                   C 30 16, 33 13, 36 12 Z"
                fill="url(#wSunGradient)"
              />
              {/* Sun Inner Glow Sheen */}
              <path
                d="M 36 12 
                   C 39 12, 42 14, 44 17 
                   C 46 20, 48 21, 51 22 
                   C 54 23, 56 26, 56 29 
                   C 56 32, 57 35, 59 37 
                   C 60 40, 59 43, 57 45 
                   C 55 47, 54 50, 54 53 
                   C 53 56, 51 58, 48 58 
                   C 45 59, 42 61, 40 63 
                   C 37 64, 34 63, 32 61 
                   C 29 60, 26 60, 24 62 
                   C 21 63, 18 61, 17 58 
                   C 16 55, 13 54, 11 52 
                   C 9 50, 9 47, 10 44 
                   C 12 42, 12 39, 11 36 
                   C 10 33, 12 30, 14 29 
                   C 17 28, 19 25, 20 22 
                   C 21 19, 24 17, 27 17 
                   C 30 16, 33 13, 36 12 Z"
                fill="url(#wSunInnerGlow)"
              />
            </g>

            {/* Volumetric Puffy Cumulus Cloud in Front */}
            {/* Soft Ambient Undershadow */}
            <path
              d="M 24 74 
                 C 16 74, 10 68, 10 60 
                 C 10 52, 15 46, 23 45 
                 C 25 32, 36 22, 50 22 
                 C 62 22, 73 30, 76 42 
                 C 84 43, 90 49, 90 57 
                 C 90 66, 83 74, 73 74 
                 Z"
              fill="rgba(0, 0, 0, 0.08)"
              transform="translate(0, 3)"
            />

            {/* Cloud Main Body */}
            <path
              d="M 24 74 
                 C 16 74, 10 68, 10 60 
                 C 10 52, 15 46, 23 45 
                 C 25 32, 36 22, 50 22 
                 C 62 22, 73 30, 76 42 
                 C 84 43, 90 49, 90 57 
                 C 90 66, 83 74, 73 74 
                 Z"
              fill="url(#wCloudFront)"
            />

            {/* Cloud Inner Volumetric Puff Shading (from IMG_7052) */}
            <path
              d="M 23 45 
                 C 25 32, 36 22, 50 22 
                 C 62 22, 73 30, 76 42 
                 C 68 44, 60 50, 58 58 
                 C 49 56, 38 60, 34 68 
                 C 25 66, 18 58, 23 45 Z"
              fill="url(#wCloudHighlight)"
              opacity="0.75"
            />

            {/* Soft Sun Warmth Reflection on Left Puff Edge */}
            <path
              d="M 23 45 
                 C 25 37, 30 31, 38 27 
                 C 32 32, 28 38, 27 46 
                 C 24 46, 22 47, 21 49 
                 C 21 47, 22 46, 23 45 Z"
              fill="#FFAE00"
              opacity="0.35"
            />
          </g>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 2: CLEAR / SUNNY DAY */}
        {/* ============================================================ */}
        {isDay && isClear && (
          <g transform="translate(10, 10) scale(0.8)">
            {/* Radiant Sun Burst with Scalloped Outer Lobes */}
            <path
              d="M 50 14 
                 C 54 14, 58 17, 61 21 
                 C 65 25, 70 27, 75 28 
                 C 80 30, 83 34, 84 39 
                 C 86 44, 89 48, 91 53 
                 C 92 58, 91 63, 87 67 
                 C 84 71, 83 76, 81 81 
                 C 79 86, 75 89, 70 90 
                 C 65 91, 60 94, 56 97 
                 C 51 100, 46 99, 42 96 
                 C 37 93, 32 93, 27 95 
                 C 22 96, 17 93, 15 88 
                 C 13 83, 9 80, 5 76 
                 C 2 72, 2 67, 4 62 
                 C 6 57, 6 52, 4 47 
                 C 3 42, 5 37, 9 34 
                 C 13 31, 16 27, 18 22 
                 C 20 17, 24 14, 29 13 
                 C 34 13, 38 9, 43 7 
                 C 46 6, 48 14, 50 14 Z"
              fill="url(#wSunGradient)"
            />
            {/* Sun Core Highlight Sphere */}
            <circle cx="50" cy="50" r="28" fill="url(#wSunInnerGlow)" />
            <circle cx="42" cy="40" r="10" fill="#FFFFFF" fillOpacity="0.4" />
          </g>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 3: OVERCAST / FULL CLOUD */}
        {/* ============================================================ */}
        {isOvercast && (
          <g>
            {/* Background Cloud */}
            <path
              d="M 36 58 
                 C 30 58, 25 53, 25 47 
                 C 25 41, 29 36, 35 35 
                 C 37 25, 45 17, 57 17 
                 C 67 17, 75 23, 78 33 
                 C 84 34, 89 39, 89 45 
                 C 89 52, 83 58, 75 58 
                 Z"
              fill="url(#wCloudBack)"
              opacity="0.9"
            />
            {/* Foreground Main Cloud */}
            <path
              d="M 24 76 
                 C 16 76, 10 70, 10 62 
                 C 10 54, 15 48, 23 47 
                 C 25 34, 36 24, 50 24 
                 C 62 24, 73 32, 76 44 
                 C 84 45, 90 51, 90 59 
                 C 90 68, 83 76, 73 76 
                 Z"
              fill="url(#wCloudFront)"
            />
            {/* Volumetric Sheen */}
            <path
              d="M 23 47 
                 C 25 34, 36 24, 50 24 
                 C 62 24, 73 32, 76 44 
                 C 68 46, 60 52, 58 60 
                 C 49 58, 38 62, 34 70 
                 C 25 68, 18 60, 23 47 Z"
              fill="url(#wCloudHighlight)"
              opacity="0.6"
            />
          </g>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 4: CLEAR NIGHT */}
        {/* ============================================================ */}
        {!isDay && isClear && (
          <g transform="translate(8, 6)">
            {/* Crescent Moon */}
            <path
              d="M 44 14 
                 C 28 14, 16 26, 16 42 
                 C 16 58, 28 70, 44 70 
                 C 53 70, 61 66, 66 59 
                 C 56 58, 48 50, 48 39 
                 C 48 28, 55 20, 65 18 
                 C 59 15, 52 14, 44 14 Z"
              fill="url(#wMoonGradient)"
            />
            {/* Sparkling Stars */}
            <circle cx="68" cy="22" r="2.5" fill="#FFFFFF" opacity="0.9" />
            <circle cx="78" cy="38" r="2" fill="#C7D2FE" opacity="0.85" />
            <circle cx="62" cy="54" r="1.5" fill="#FFFFFF" opacity="0.75" />
          </g>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 5: PARTLY CLOUDY NIGHT */}
        {/* ============================================================ */}
        {!isDay && (isPartlyCloudy || isOvercast) && !isRain && !isSnow && !isThunderstorm && (
          <g>
            {/* Glowing Crescent Moon in Background */}
            <path
              d="M 46 16 
                 C 32 16, 22 26, 22 40 
                 C 22 54, 32 64, 46 64 
                 C 53 64, 60 61, 65 55 
                 C 56 54, 49 47, 49 37 
                 C 49 27, 55 19, 64 17 
                 C 59 16, 53 16, 46 16 Z"
              fill="url(#wMoonGradient)"
            />
            <circle cx="68" cy="24" r="2" fill="#FFFFFF" opacity="0.9" />

            {/* Cloud in Foreground */}
            <path
              d="M 24 74 
                 C 16 74, 10 68, 10 60 
                 C 10 52, 15 46, 23 45 
                 C 25 32, 36 22, 50 22 
                 C 62 22, 73 30, 76 42 
                 C 84 43, 90 49, 90 57 
                 C 90 66, 83 74, 73 74 
                 Z"
              fill="url(#wCloudFront)"
            />
          </g>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 6: RAIN / SHOWERS */}
        {/* ============================================================ */}
        {isRain && (
          <g>
            {/* Volumetric Cloud */}
            <path
              d="M 24 64 
                 C 16 64, 10 58, 10 50 
                 C 10 42, 15 36, 23 35 
                 C 25 22, 36 12, 50 12 
                 C 62 12, 73 20, 76 32 
                 C 84 33, 90 39, 90 47 
                 C 90 56, 83 64, 73 64 
                 Z"
              fill="url(#wCloudFront)"
            />
            {/* 3 Modern Apple Pill Rain Drops */}
            <rect x="26" y="70" width="5" height="15" rx="2.5" transform="rotate(18 26 70)" fill="url(#wRainDrop)" />
            <rect x="44" y="70" width="5" height="17" rx="2.5" transform="rotate(18 44 70)" fill="url(#wRainDrop)" />
            <rect x="62" y="70" width="5" height="15" rx="2.5" transform="rotate(18 62 70)" fill="url(#wRainDrop)" />
          </g>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 7: THUNDERSTORM */}
        {/* ============================================================ */}
        {isThunderstorm && (
          <g>
            {/* Dark Storm Cloud */}
            <path
              d="M 24 64 
                 C 16 64, 10 58, 10 50 
                 C 10 42, 15 36, 23 35 
                 C 25 22, 36 12, 50 12 
                 C 62 12, 73 20, 76 32 
                 C 84 33, 90 39, 90 47 
                 C 90 56, 83 64, 73 64 
                 Z"
              fill="url(#wStormCloud)"
            />
            {/* Electric Golden Lightning Bolt */}
            <polygon
              points="48,58 36,74 46,74 41,92 62,70 51,70"
              fill="url(#wLightning)"
              filter="drop-shadow(0 0 6px rgba(250, 204, 21, 0.7))"
            />
          </g>
        )}

        {/* ============================================================ */}
        {/* SCENARIO 8: SNOW */}
        {/* ============================================================ */}
        {isSnow && (
          <g>
            <path
              d="M 24 64 
                 C 16 64, 10 58, 10 50 
                 C 10 42, 15 36, 23 35 
                 C 25 22, 36 12, 50 12 
                 C 62 12, 73 20, 76 32 
                 C 84 33, 90 39, 90 47 
                 C 90 56, 83 64, 73 64 
                 Z"
              fill="url(#wCloudFront)"
            />
            {/* Snow Crystals */}
            <g fill="#E0F2FE" opacity="0.95">
              <circle cx="30" cy="76" r="3.5" />
              <circle cx="50" cy="80" r="4" />
              <circle cx="70" cy="76" r="3.5" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
