import React, { useId } from 'react';

interface Weather3DIconProps {
  weatherCode?: number;
  isDay?: boolean;
  className?: string;
}

export const Weather3DIcon: React.FC<Weather3DIconProps> = ({
  weatherCode = 1,
  isDay = true,
  className = 'w-12 h-12',
}) => {
  const uid = useId().replace(/:/g, '');

  // 1. Clear Sky (Sol / Lua Limpo)
  if (weatherCode === 0) {
    if (isDay) {
      return (
        <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full filter drop-shadow-[0_10px_22px_rgba(245,158,11,0.42)]"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id={`${uid}-sunGlow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF7B2" stopOpacity="0.68" />
                <stop offset="60%" stopColor="#FBBF24" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`${uid}-sunCore`} cx="35%" cy="28%" r="70%">
                <stop offset="0%" stopColor="#FFFDE4" />
                <stop offset="28%" stopColor="#FDE047" />
                <stop offset="72%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97706" />
              </radialGradient>
              <linearGradient id={`${uid}-rayGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>

            <circle cx="60" cy="60" r="54" fill={`url(#${uid}-sunGlow)`} />
            {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg) => (
              <rect
                key={deg}
                x="56.5"
                y="11"
                width="7"
                height="16"
                rx="3.5"
                fill={`url(#${uid}-rayGrad)`}
                transform={`rotate(${deg} 60 60)`}
              />
            ))}
            <circle cx="60" cy="60" r="29" fill={`url(#${uid}-sunCore)`} />
            <ellipse
              cx="50"
              cy="46"
              rx="13"
              ry="7.5"
              fill="#FFFFFF"
              opacity="0.58"
              transform="rotate(-24 50 46)"
            />
          </svg>
        </div>
      );
    }

    // Clear Night Moon
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full filter drop-shadow-[0_10px_22px_rgba(125,211,252,0.34)]"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`${uid}-moonGlow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}-moonCore`} x1="15%" y1="10%" x2="90%" y2="95%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="42%" stopColor="#E2E8F0" />
              <stop offset="85%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill={`url(#${uid}-moonGlow)`} />
          <path
            d="M68 20C46 20 29 37 29 59C29 81 46 98 68 98C78 98 87 94 94 87C77 88 62 74 62 57C62 40 77 27 94 28C87 23 78 20 68 20Z"
            fill={`url(#${uid}-moonCore)`}
          />
          <circle cx="48" cy="49" r="5" fill="#64748B" opacity="0.22" />
          <circle cx="56" cy="70" r="6" fill="#64748B" opacity="0.18" />
          <circle cx="41" cy="65" r="3.5" fill="#64748B" opacity="0.18" />
          <path d="M92 34L94.5 39L99.5 41.5L94.5 44L92 49L89.5 44L84.5 41.5L89.5 39Z" fill="#FEF08A" opacity="0.92" />
          <path d="M26 30L27.8 33.8L31.6 35.6L27.8 37.4L26 41.2L24.2 37.4L20.4 35.6L24.2 33.8Z" fill="#FEF08A" opacity="0.82" />
        </svg>
      </div>
    );
  }

  // 2. Rain / Garoa / Drizzle / Chuva (codes 50 to 67 and 80 to 82)
  if ((weatherCode >= 50 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full filter drop-shadow-[0_10px_20px_rgba(14,165,233,0.34)]"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`${uid}-rainCloud`} cx="45%" cy="22%" r="78%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="52%" stopColor="#E2E8F0" />
              <stop offset="86%" stopColor="#B8C4D4" />
              <stop offset="100%" stopColor="#8A99AE" />
            </radialGradient>
            <linearGradient id={`${uid}-dropGrad`} x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#7DD3FC" />
              <stop offset="55%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
            <filter id={`${uid}-cloudShadow`} x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.28" />
            </filter>
          </defs>

          {/* 3D Glossy Raindrops */}
          <g>
            <g className="animate-pulse" style={{ animationDuration: '1.9s' }}>
              <path
                d="M35 76 C35 76 28 88 28 93 C28 97.5 31.2 101 35 101 C38.8 101 42 97.5 42 93 C42 88 35 76 35 76 Z"
                fill={`url(#${uid}-dropGrad)`}
              />
              <ellipse cx="32.5" cy="91.5" rx="1.7" ry="3.6" fill="#FFFFFF" opacity="0.78" />
            </g>
            <g className="animate-pulse" style={{ animationDuration: '1.6s', animationDelay: '0.28s' }}>
              <path
                d="M60 80 C60 80 53 92 53 97 C53 101.5 56.2 105 60 105 C63.8 105 67 101.5 67 97 C67 92 60 80 60 80 Z"
                fill={`url(#${uid}-dropGrad)`}
              />
              <ellipse cx="57.5" cy="95.5" rx="1.7" ry="3.6" fill="#FFFFFF" opacity="0.78" />
            </g>
            <g className="animate-pulse" style={{ animationDuration: '2.1s', animationDelay: '0.55s' }}>
              <path
                d="M85 76 C85 76 78 88 78 93 C78 97.5 81.2 101 85 101 C88.8 101 92 97.5 92 93 C92 88 85 76 85 76 Z"
                fill={`url(#${uid}-dropGrad)`}
              />
              <ellipse cx="82.5" cy="91.5" rx="1.7" ry="3.6" fill="#FFFFFF" opacity="0.78" />
            </g>
          </g>

          {/* Volumetric Sculpted 3D Cloud */}
          <g filter={`url(#${uid}-cloudShadow)`}>
            <path
              d="M36 72 H86 C97 72 106 63.5 106 52.5 C106 42 97.5 33.5 87 33.5 C85.5 24 77 16 66 16 C54 16 44.5 24 42.5 35 C39 32.5 35 31.5 30.5 31.5 C19.5 31.5 11 40 11 51.5 C11 63 20 72 36 72 Z"
              fill={`url(#${uid}-rainCloud)`}
            />
            <ellipse cx="64" cy="28" rx="18" ry="8" fill="#FFFFFF" opacity="0.7" />
            <ellipse cx="32" cy="43" rx="12" ry="6" fill="#FFFFFF" opacity="0.55" />
          </g>
        </svg>
      </div>
    );
  }

  // 3. Thunderstorm & Lightning / Raios e Tempestade (codes 95 to 99)
  if (weatherCode >= 90) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full filter drop-shadow-[0_10px_22px_rgba(234,179,8,0.42)]"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`${uid}-thunderCloud`} cx="45%" cy="22%" r="80%">
              <stop offset="0%" stopColor="#F1F5F9" />
              <stop offset="48%" stopColor="#94A3B8" />
              <stop offset="85%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1E293B" />
            </radialGradient>
            <linearGradient id={`${uid}-boltGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="28%" stopColor="#FEF08A" />
              <stop offset="72%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <filter id={`${uid}-boltGlow`} x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#FACC15" floodOpacity="0.85" />
            </filter>
          </defs>

          <path
            d="M36 69 H86 C97 69 106 60.5 106 49.5 C106 39 97.5 30.5 87 30.5 C85.5 21 77 13 66 13 C54 13 44.5 21 42.5 32 C39 29.5 35 28.5 30.5 28.5 C19.5 28.5 11 37 11 48.5 C11 60 20 69 36 69 Z"
            fill={`url(#${uid}-thunderCloud)`}
          />
          <ellipse cx="64" cy="25" rx="17" ry="7" fill="#FFFFFF" opacity="0.45" />

          <g filter={`url(#${uid}-boltGlow)`}>
            <polygon
              points="62,54 45,76 57,76 50,108 77,73 63,73 72,54"
              fill={`url(#${uid}-boltGrad)`}
            />
            <polygon
              points="61,57 48,74 57,74 52,102 73,74 63,74 70,57"
              fill="#FFFFFF"
              opacity="0.65"
            />
          </g>

          <path d="M31 80 C31 80 26 90 26 94 C26 97.5 28.5 100 31 100 C33.5 100 36 97.5 36 94 Z" fill="#38BDF8" opacity="0.85" />
          <path d="M88 80 C88 80 83 90 83 94 C83 97.5 85.5 100 88 100 C90.5 100 93 97.5 93 94 Z" fill="#38BDF8" opacity="0.85" />
        </svg>
      </div>
    );
  }

  // 4. Snow / Neve / Geada (codes 70 to 77)
  if (weatherCode >= 70 && weatherCode <= 77) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full filter drop-shadow-[0_10px_22px_rgba(186,230,253,0.48)]"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`${uid}-snowCloud`} cx="45%" cy="22%" r="78%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="58%" stopColor="#E0F2FE" />
              <stop offset="100%" stopColor="#94A3B8" />
            </radialGradient>
            <radialGradient id={`${uid}-flakeGrad`} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#7DD3FC" />
            </radialGradient>
          </defs>

          <path
            d="M36 68 H86 C97 68 106 59.5 106 48.5 C106 38 97.5 29.5 87 29.5 C85.5 20 77 12 66 12 C54 12 44.5 20 42.5 31 C39 28.5 35 27.5 30.5 27.5 C19.5 27.5 11 36 11 47.5 C11 59 20 68 36 68 Z"
            fill={`url(#${uid}-snowCloud)`}
          />
          <ellipse cx="64" cy="24" rx="17" ry="7" fill="#FFFFFF" opacity="0.72" />

          {[
            { x: 34, y: 86 },
            { x: 60, y: 94 },
            { x: 86, y: 86 },
          ].map((sf, idx) => (
            <g key={idx} transform={`translate(${sf.x}, ${sf.y})`}>
              <circle cx="0" cy="0" r="6" fill={`url(#${uid}-flakeGrad)`} />
              <path
                d="M-7 0 H7 M0 -7 V7 M-5 -5 L5 5 M-5 5 L5 -5"
                stroke="#FFFFFF"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // 5. Partly Cloudy / Sol com Nuvens (codes 1, 2, 3)
  if (weatherCode <= 3) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full filter drop-shadow-[0_12px_22px_rgba(15,23,42,0.22)]"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`${uid}-partSunGlow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.65" />
              <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}-partSun`} cx="34%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#FFFDE4" />
              <stop offset="30%" stopColor="#FDE047" />
              <stop offset="72%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EA580C" />
            </radialGradient>
            <linearGradient id={`${uid}-rayGradPart`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <radialGradient id={`${uid}-cloudPartBody`} cx="45%" cy="20%" r="82%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="56%" stopColor="#F3F6FB" />
              <stop offset="86%" stopColor="#D7E0EC" />
              <stop offset="100%" stopColor="#B4C2D6" />
            </radialGradient>
            <radialGradient id={`${uid}-cloudWarmBounce`} cx="35%" cy="35%" r="55%">
              <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${uid}-partMoonGlow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.48" />
              <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}-partMoonGrad`} x1="15%" y1="10%" x2="88%" y2="92%">
              <stop offset="0%" stopColor="#FFFBEB" />
              <stop offset="32%" stopColor="#FDE68A" />
              <stop offset="72%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <filter id={`${uid}-cloudShadowPart`} x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="5.5" floodColor="#0F172A" floodOpacity="0.24" />
            </filter>
          </defs>

          {/* Peeking Plush 3D Sun (or Volumetric 3D Moon at night) */}
          {isDay ? (
            <g transform="translate(8, 6)">
              <circle cx="42" cy="42" r="38" fill={`url(#${uid}-partSunGlow)`} />
              {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg) => (
                <rect
                  key={deg}
                  x="39"
                  y="4"
                  width="6"
                  height="11"
                  rx="3"
                  fill={`url(#${uid}-rayGradPart)`}
                  transform={`rotate(${deg} 42 42)`}
                />
              ))}
              <circle cx="42" cy="42" r="24" fill={`url(#${uid}-partSun)`} />
              <ellipse
                cx="34"
                cy="31"
                rx="10"
                ry="5.5"
                fill="#FFFFFF"
                opacity="0.58"
                transform="rotate(-24 34 31)"
              />
            </g>
          ) : (
            <g transform="translate(6, 4)">
              <circle cx="44" cy="40" r="34" fill={`url(#${uid}-partMoonGlow)`} />
              <path
                d="M46 10C29 10 16 23 16 40C16 57 29 70 46 70C54 70 61 67 66 61C53 61 42 51 42 38C42 25 53 16 66 16C60 12 53 10 46 10Z"
                fill={`url(#${uid}-partMoonGrad)`}
              />
              <ellipse
                cx="30"
                cy="27"
                rx="7"
                ry="3.6"
                fill="#FFFFFF"
                opacity="0.6"
                transform="rotate(-32 30 27)"
              />
              <path
                d="M72 18L73.6 21.4L77 23L73.6 24.6L72 28L70.4 24.6L67 23L70.4 21.4Z"
                fill="#FEF08A"
                opacity="0.9"
              />
            </g>
          )}

          {/* Foreground Pillowy Sculpted 3D Cloud */}
          <g filter={`url(#${uid}-cloudShadowPart)`}>
            <path
              d="M36 96 H89 C101 96 110 86.5 110 75 C110 64 101.5 55 90.5 54.5 C88.5 41.5 77.5 32 64.5 32 C51 32 40 41.5 37.5 54.5 C34.5 52.5 30.8 51.5 26.8 51.5 C15.8 51.5 7 60.5 7 72 C7 85.5 18 96 36 96 Z"
              fill={`url(#${uid}-cloudPartBody)`}
            />
            {isDay && (
              <ellipse cx="44" cy="60" rx="22" ry="15" fill={`url(#${uid}-cloudWarmBounce)`} />
            )}
            <ellipse cx="64" cy="45" rx="19" ry="8.5" fill="#FFFFFF" opacity="0.82" />
            <ellipse cx="29" cy="63" rx="12" ry="6" fill="#FFFFFF" opacity="0.65" />
          </g>
        </svg>
      </div>
    );
  }

  // 6. Default Overcast / Fog / Nublado (codes 45, 48 or other)
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full filter drop-shadow-[0_10px_20px_rgba(15,23,42,0.22)]"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`${uid}-cloudMain`} cx="45%" cy="20%" r="82%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="56%" stopColor="#EBF0F7" />
            <stop offset="100%" stopColor="#AEBCCD" />
          </radialGradient>
          <radialGradient id={`${uid}-cloudBack`} cx="45%" cy="20%" r="80%">
            <stop offset="0%" stopColor="#DCE4EE" />
            <stop offset="100%" stopColor="#7C8EA3" />
          </radialGradient>
        </defs>

        <path
          d="M32 68 H78 C87 68 94 61 94 52 C94 43 87 36 78 36 C76.5 28 70 21 61 21 C51.5 21 44 27.5 42 36.5 C39 34.5 35.5 33.5 31.5 33.5 C22 33.5 15 41 15 50.5 C15 60 22.5 68 32 68 Z"
          fill={`url(#${uid}-cloudBack)`}
          opacity="0.85"
        />
        <path
          d="M38 92 H92 C103 92 111 83.5 111 73 C111 62.5 103 54 92 54 C90 43 80.5 35 69 35 C57 35 47 43 44.5 54.5 C41.5 52.5 37.5 51.5 33.5 51.5 C23 51.5 15 59.5 15 70.5 C15 82.5 24.5 92 38 92 Z"
          fill={`url(#${uid}-cloudMain)`}
        />
        <ellipse cx="68" cy="48" rx="18" ry="8" fill="#FFFFFF" opacity="0.8" />
      </svg>
    </div>
  );
};

/**
 * Cohesive 3D Metric Icons for the Weather Details Row
 * (Min Temp, Max Temp, Humidity, Wind) — Apple iOS Pro soft-sculpted 3D look
 */
export const ThermometerMin3DIcon: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      className={`shrink-0 filter drop-shadow-[0_4px_10px_rgba(56,189,248,0.38)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="45%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <radialGradient id={`${uid}-bulb`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="48%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </radialGradient>
      </defs>
      {/* Outer 3D glass housing */}
      <path
        d="M32 7C26.8 7 23 11 23 16.2V34.6C19.2 37.2 17 41.4 17 46C17 54.2 23.7 60 32 60C40.3 60 47 54.2 47 46C47 41.4 44.8 37.2 41 34.6V16.2C41 11 37.2 7 32 7Z"
        fill={`url(#${uid}-glass)`}
        opacity="0.92"
      />
      {/* Inner recessed chamber */}
      <rect x="27.5" y="13" width="9" height="27" rx="4.5" fill="#0F172A" opacity="0.22" />
      {/* Cool mercury column & bulb */}
      <rect x="28.5" y="25" width="7" height="19" rx="3.5" fill={`url(#${uid}-bulb)`} />
      <circle cx="32" cy="46" r="10.5" fill={`url(#${uid}-bulb)`} />
      {/* Specular highlights */}
      <rect x="26" y="13" width="2.4" height="19" rx="1.2" fill="#FFFFFF" opacity="0.65" />
      <ellipse cx="28.5" cy="42.5" rx="3.5" ry="2.2" fill="#FFFFFF" opacity="0.65" transform="rotate(-25 28.5 42.5)" />
      {/* Scale ticks */}
      <line x1="42" y1="18" x2="46" y2="18" stroke="#E0F2FE" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
      <line x1="42" y1="24" x2="45" y2="24" stroke="#E0F2FE" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
      <line x1="42" y1="30" x2="46" y2="30" stroke="#E0F2FE" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
};

export const ThermometerMax3DIcon: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      className={`shrink-0 filter drop-shadow-[0_4px_10px_rgba(244,63,94,0.38)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-glassMax`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFE4E6" />
          <stop offset="45%" stopColor="#FDA4AF" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
        <radialGradient id={`${uid}-bulbMax`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="32%" stopColor="#FB7185" />
          <stop offset="72%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </radialGradient>
      </defs>
      <path
        d="M32 7C26.8 7 23 11 23 16.2V34.6C19.2 37.2 17 41.4 17 46C17 54.2 23.7 60 32 60C40.3 60 47 54.2 47 46C47 41.4 44.8 37.2 41 34.6V16.2C41 11 37.2 7 32 7Z"
        fill={`url(#${uid}-glassMax)`}
        opacity="0.94"
      />
      <rect x="27.5" y="13" width="9" height="27" rx="4.5" fill="#0F172A" opacity="0.2" />
      <rect x="28.5" y="16" width="7" height="28" rx="3.5" fill={`url(#${uid}-bulbMax)`} />
      <circle cx="32" cy="46" r="10.5" fill={`url(#${uid}-bulbMax)`} />
      <rect x="26" y="13" width="2.4" height="20" rx="1.2" fill="#FFFFFF" opacity="0.65" />
      <ellipse cx="28.5" cy="42.5" rx="3.5" ry="2.2" fill="#FFFFFF" opacity="0.65" transform="rotate(-25 28.5 42.5)" />
      <line x1="42" y1="18" x2="46" y2="18" stroke="#FFE4E6" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
      <line x1="42" y1="24" x2="45" y2="24" stroke="#FFE4E6" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
      <line x1="42" y1="30" x2="46" y2="30" stroke="#FFE4E6" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
};

export const HumidityDrop3DIcon: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      className={`shrink-0 filter drop-shadow-[0_4px_10px_rgba(14,165,233,0.4)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${uid}-dropBody`} cx="35%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="30%" stopColor="#60A5FA" />
          <stop offset="72%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </radialGradient>
        <radialGradient id={`${uid}-dropInner`} cx="55%" cy="75%" r="48%">
          <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M32 7C32 7 13 28.5 13 40.5C13 51.2 21.5 59 32 59C42.5 59 51 51.2 51 40.5C51 28.5 32 7 32 7Z"
        fill={`url(#${uid}-dropBody)`}
      />
      <circle cx="33" cy="44" r="14" fill={`url(#${uid}-dropInner)`} />
      <ellipse
        cx="24.5"
        cy="36"
        rx="4"
        ry="8.5"
        fill="#FFFFFF"
        opacity="0.68"
        transform="rotate(14 24.5 36)"
      />
      <circle cx="22.5" cy="46.5" r="2.2" fill="#FFFFFF" opacity="0.52" />
    </svg>
  );
};

export const WindFlow3DIcon: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      className={`shrink-0 filter drop-shadow-[0_4px_10px_rgba(56,189,248,0.36)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-wind1`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="55%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={`${uid}-wind2`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="55%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      {/* Top curling wind ribbon */}
      <path
        d="M10 24H37C41.8 24 45.5 20.4 45.5 16C45.5 11.6 41.8 8.5 37.5 8.5C33.8 8.5 31 11 30.5 14"
        fill="none"
        stroke={`url(#${uid}-wind1)`}
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      {/* Main center wind stream */}
      <path
        d="M8 34H47.5C52.5 34 56 30.4 56 26C56 21.6 52.5 18.2 48 18.2"
        fill="none"
        stroke={`url(#${uid}-wind2)`}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* Lower swirling wind ribbon */}
      <path
        d="M14 44H42C46.5 44 50 47.4 50 51.5C50 55.5 46.5 58.5 42.2 58.5C38.5 58.5 35.8 56 35.2 53"
        fill="none"
        stroke={`url(#${uid}-wind1)`}
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      {/* Subtle specular sheen lines */}
      <path d="M12 32.3H45" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
      <path d="M13 22.4H35" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
};

export default Weather3DIcon;
