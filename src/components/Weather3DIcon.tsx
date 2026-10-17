import React from 'react';

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
  // 1. Clear Sky (Sol / Lua Limpo)
  if (weatherCode === 0) {
    if (isDay) {
      return (
        <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
          <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_6px_16px_rgba(251,191,36,0.55)]">
            <defs>
              <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF59D" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="sunCore" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="20%" stopColor="#FEF08A" />
                <stop offset="60%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </radialGradient>
              <linearGradient id="rayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            {/* Outer Glow */}
            <circle cx="50" cy="50" r="44" fill="url(#sunGlow)" />
            {/* 3D Beveled Sun Rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <rect
                key={deg}
                x="47"
                y="10"
                width="6"
                height="16"
                rx="3"
                fill="url(#rayGrad)"
                transform={`rotate(${deg} 50 50)`}
                className="origin-center"
              />
            ))}
            {/* 3D Sun Center Sphere */}
            <circle cx="50" cy="50" r="24" fill="url(#sunCore)" />
            {/* Glossy Top Specular Highlight */}
            <ellipse cx="43" cy="38" rx="10" ry="6" fill="#FFFFFF" opacity="0.65" transform="rotate(-20 43 38)" />
          </svg>
        </div>
      );
    }

    // Clear Night Moon
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_6px_18px_rgba(165,243,252,0.4)]">
          <defs>
            <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="moonCore" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#E2E8F0" />
              <stop offset="85%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="42" fill="url(#moonGlow)" />
          {/* 3D Crescent Moon */}
          <path
            d="M58 18C40 18 26 32 26 50C26 68 40 82 58 82C66 82 73 79 78 74C64 74 52 63 52 49C52 35 64 24 78 24C73 20 66 18 58 18Z"
            fill="url(#moonCore)"
          />
          {/* Subtle Craters */}
          <circle cx="42" cy="42" r="4" fill="#64748B" opacity="0.25" />
          <circle cx="48" cy="58" r="5" fill="#64748B" opacity="0.22" />
          <circle cx="36" cy="54" r="3" fill="#64748B" opacity="0.2" />
          {/* Little Stars */}
          <path d="M78 28L80 32L84 34L80 36L78 40L76 36L72 34L76 32Z" fill="#FDE047" opacity="0.9" />
          <path d="M22 26L23.5 29L26.5 30.5L23.5 32L22 35L20.5 32L17.5 30.5L20.5 29Z" fill="#FDE047" opacity="0.8" />
        </svg>
      </div>
    );
  }

  // 2. Rain / Garoa / Drizzle / Chuva (codes 50 to 67 and 80 to 82)
  if ((weatherCode >= 50 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_8px_20px_rgba(14,165,233,0.45)]">
          <defs>
            {/* Dark 3D Raincloud Gradient */}
            <linearGradient id="rainCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#CBD5E1" />
              <stop offset="70%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            {/* 3D Translucent Teardrop Raindrop Gradient */}
            <linearGradient id="dropGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="60%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
            <filter id="cloudShadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* 3D Rain Drops descending from cloud */}
          <g transform="translate(0, 4)">
            {/* Drop 1 */}
            <g className="animate-pulse" style={{ animationDuration: '1.8s' }}>
              <path d="M28 64 C28 64 22 74 22 78 C22 82 25 85 28 85 C31 85 34 82 34 78 C34 74 28 64 28 64 Z" fill="url(#dropGrad)" />
              <ellipse cx="26" cy="77" rx="1.5" ry="3" fill="#FFFFFF" opacity="0.8" />
            </g>
            {/* Drop 2 */}
            <g className="animate-pulse" style={{ animationDuration: '1.4s', animationDelay: '0.3s' }}>
              <path d="M50 68 C50 68 44 78 44 82 C44 86 47 89 50 89 C53 89 56 86 56 82 C56 78 50 68 50 68 Z" fill="url(#dropGrad)" />
              <ellipse cx="48" cy="81" rx="1.5" ry="3" fill="#FFFFFF" opacity="0.8" />
            </g>
            {/* Drop 3 */}
            <g className="animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.6s' }}>
              <path d="M72 64 C72 64 66 74 66 78 C66 82 69 85 72 85 C75 85 78 82 78 78 C78 74 72 64 72 64 Z" fill="url(#dropGrad)" />
              <ellipse cx="70" cy="77" rx="1.5" ry="3" fill="#FFFFFF" opacity="0.8" />
            </g>
          </g>

          {/* Volumetric 3D Cloud Body */}
          <g filter="url(#cloudShadow)">
            <path
              d="M32 58 H72 C81 58 88 51 88 42 C88 33 81 26 72 26 C71 20 65 14 57 14 C48 14 41 20 39 28 C36 26 32 25 28 25 C19 25 12 32 12 41 C12 50 19 58 32 58 Z"
              fill="url(#rainCloudGrad)"
            />
            {/* Specular White Top Edges */}
            <path
              d="M30 27 C34 26 37 28 39 30 C41 21 48 16 57 16 C64 16 70 21 71 28 C73 28 75 27 77 28 C72 23 65 14 57 14 C48 14 41 20 39 28 C36 26 32 25 28 25 C23 25 18 28 15 33 C18 29 23 27 30 27 Z"
              fill="#FFFFFF"
              opacity="0.85"
            />
          </g>
        </svg>
      </div>
    );
  }

  // 3. Thunderstorm & Lightning / Raios e Tempestade (codes 95 to 99)
  if (weatherCode >= 90) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_8px_22px_rgba(234,179,8,0.6)]">
          <defs>
            <linearGradient id="thunderCloud" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="30%" stopColor="#64748B" />
              <stop offset="75%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#FEF08A" />
              <stop offset="70%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <filter id="boltGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#FACC15" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* 3D Thundercloud Body */}
          <path
            d="M32 56 H72 C81 56 88 49 88 40 C88 31 81 24 72 24 C71 18 65 12 57 12 C48 12 41 18 39 26 C36 24 32 23 28 23 C19 23 12 30 12 39 C12 48 19 56 32 56 Z"
            fill="url(#thunderCloud)"
          />

          {/* 3D Extruded Glowing Lightning Bolt */}
          <g filter="url(#boltGlow)">
            <polygon
              points="52,44 38,62 48,62 42,88 64,60 52,60 60,44"
              fill="url(#boltGrad)"
            />
            {/* White Core Edge */}
            <polygon
              points="51,46 40,61 48,61 43,84 61,60 52,60 59,46"
              fill="#FFFFFF"
              opacity="0.75"
            />
          </g>

          {/* Rain Drops */}
          <path d="M26 66 C26 66 22 74 22 77 C22 80 24 82 26 82 C28 82 30 80 30 77 Z" fill="#38BDF8" opacity="0.85" />
          <path d="M72 66 C72 66 68 74 68 77 C68 80 70 82 72 82 C74 82 76 80 76 77 Z" fill="#38BDF8" opacity="0.85" />
        </svg>
      </div>
    );
  }

  // 4. Snow / Neve (codes 70 to 77)
  if (weatherCode >= 70 && weatherCode <= 77) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_8px_20px_rgba(186,230,253,0.6)]">
          <defs>
            <linearGradient id="snowCloud" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#E0F2FE" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
            <radialGradient id="flakeGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#7DD3FC" />
            </radialGradient>
          </defs>

          <path
            d="M32 54 H72 C81 54 88 47 88 38 C88 29 81 22 72 22 C71 16 65 10 57 10 C48 10 41 16 39 24 C36 22 32 21 28 21 C19 21 12 28 12 37 C12 46 19 54 32 54 Z"
            fill="url(#snowCloud)"
          />

          {/* 3D Snowflakes */}
          {[
            { x: 28, y: 70 },
            { x: 50, y: 76 },
            { x: 72, y: 70 },
          ].map((sf, idx) => (
            <g key={idx} transform={`translate(${sf.x}, ${sf.y})`}>
              <circle cx="0" cy="0" r="5" fill="url(#flakeGrad)" />
              <path d="M-6 0 H6 M0 -6 V6 M-4 -4 L4 4 M-4 4 L4 -4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
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
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_8px_20px_rgba(251,191,36,0.45)]">
          <defs>
            <radialGradient id="partSun" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#FEF08A" />
              <stop offset="70%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </radialGradient>
            <linearGradient id="cloudGradPart" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#F1F5F9" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
            <filter id="cloudShadowPart" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="5" stdDeviation="3.5" floodColor="#1E293B" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Peeking 3D Sun in background */}
          <g transform="translate(18, 12)">
            <circle cx="36" cy="36" r="22" fill="url(#partSun)" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <rect
                key={deg}
                x="33"
                y="2"
                width="6"
                height="10"
                rx="3"
                fill="#F59E0B"
                transform={`rotate(${deg} 36 36)`}
              />
            ))}
          </g>

          {/* Foreground 3D Fluffy Cloud */}
          <g filter="url(#cloudShadowPart)">
            <path
              d="M34 66 H74 C82 66 88 59 88 51 C88 43 82 36 74 36 C73 30 67 24 59 24 C51 24 44 29 42 37 C39 35 35 34 31 34 C22 34 16 41 16 50 C16 59 22 66 34 66 Z"
              fill="url(#cloudGradPart)"
            />
            {/* Top Specular Rim */}
            <path
              d="M33 36 C37 35 40 37 42 39 C44 30 51 25 59 25 C66 25 72 30 73 37 C75 37 77 36 79 37 C74 32 67 24 59 24 C51 24 44 29 42 37 C39 35 35 34 31 34 C26 34 21 37 18 42 C21 38 26 36 33 36 Z"
              fill="#FFFFFF"
              opacity="0.9"
            />
          </g>
        </svg>
      </div>
    );
  }

  // 6. Default Overcast / Nublado (codes 45, 48 or other)
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_8px_18px_rgba(203,213,225,0.4)]">
        <defs>
          <linearGradient id="cloudGradMain" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <linearGradient id="cloudGradBack" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>
        </defs>

        {/* Rear darker 3D cloud */}
        <path
          d="M26 52 H62 C69 52 74 46 74 39 C74 32 69 26 62 26 C61 21 56 16 49 16 C42 16 36 21 35 27 C32 25 29 24 26 24 C18 24 13 30 13 38 C13 46 18 52 26 52 Z"
          fill="url(#cloudGradBack)"
          opacity="0.8"
        />

        {/* Front volumetric 3D cloud */}
        <path
          d="M34 68 H76 C84 68 90 61 90 53 C90 45 84 38 76 38 C75 32 69 26 61 26 C53 26 46 31 44 39 C41 37 37 36 33 36 C24 36 18 43 18 52 C18 61 24 68 34 68 Z"
          fill="url(#cloudGradMain)"
        />
        <path
          d="M33 38 C37 37 40 39 42 41 C44 32 51 27 61 27 C68 27 74 32 75 39 C77 39 79 38 81 39 C76 34 69 26 61 26 C53 26 46 31 44 39 C41 37 37 36 33 36 C28 36 23 39 20 44 C23 40 28 38 33 38 Z"
          fill="#FFFFFF"
          opacity="0.9"
        />
      </svg>
    </div>
  );
};

export default Weather3DIcon;
