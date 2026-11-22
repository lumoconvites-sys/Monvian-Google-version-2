import React, { useId } from 'react';
import { AppLanguage } from '../../contexts/LanguageContext';

export interface LanguageOptionItem {
  code: AppLanguage;
  label: string;
}

export const MONVIAN_LANGUAGE_OPTIONS: readonly LanguageOptionItem[] = [
  { code: 'pt', label: 'Português (Brasil)' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'es', label: 'Español' },
] as const;

export function getLanguageOptionByCode(code: AppLanguage): LanguageOptionItem {
  return (
    MONVIAN_LANGUAGE_OPTIONS.find((item) => item.code === code) ||
    MONVIAN_LANGUAGE_OPTIONS[0]
  );
}

const BrazilCircularFlag: React.FC<{ clipId: string }> = ({ clipId }) => (
  <svg viewBox="0 0 36 36" className="w-full h-full block" aria-hidden="true">
    <defs>
      <clipPath id={clipId}>
        <circle cx="18" cy="18" r="18" />
      </clipPath>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <rect width="36" height="36" fill="#009B3A" />
      <path d="M18 5.2L31.4 18L18 30.8L4.6 18Z" fill="#FEDF00" />
      <circle cx="18" cy="18" r="6.4" fill="#002776" />
      <path
        d="M11.8 16.7C15.6 15.2 20.3 15.8 24.1 18.9"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </g>
  </svg>
);

const UsaCircularFlag: React.FC<{ clipId: string }> = ({ clipId }) => (
  <svg viewBox="0 0 36 36" className="w-full h-full block" aria-hidden="true">
    <defs>
      <clipPath id={clipId}>
        <circle cx="18" cy="18" r="18" />
      </clipPath>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <rect width="36" height="36" fill="#FFFFFF" />
      <rect y="0" width="36" height="2.77" fill="#B22234" />
      <rect y="5.54" width="36" height="2.77" fill="#B22234" />
      <rect y="11.08" width="36" height="2.77" fill="#B22234" />
      <rect y="16.62" width="36" height="2.77" fill="#B22234" />
      <rect y="22.15" width="36" height="2.77" fill="#B22234" />
      <rect y="27.69" width="36" height="2.77" fill="#B22234" />
      <rect y="33.23" width="36" height="2.77" fill="#B22234" />
      <rect x="0" y="0" width="18.5" height="19.4" fill="#3C3B6E" />
      <g fill="#FFFFFF">
        <circle cx="4.2" cy="4.2" r="0.9" />
        <circle cx="8.2" cy="4.2" r="0.9" />
        <circle cx="12.2" cy="4.2" r="0.9" />
        <circle cx="16.2" cy="4.2" r="0.9" />
        <circle cx="6.2" cy="7.2" r="0.9" />
        <circle cx="10.2" cy="7.2" r="0.9" />
        <circle cx="14.2" cy="7.2" r="0.9" />
        <circle cx="4.2" cy="10.2" r="0.9" />
        <circle cx="8.2" cy="10.2" r="0.9" />
        <circle cx="12.2" cy="10.2" r="0.9" />
        <circle cx="16.2" cy="10.2" r="0.9" />
        <circle cx="6.2" cy="13.2" r="0.9" />
        <circle cx="10.2" cy="13.2" r="0.9" />
        <circle cx="14.2" cy="13.2" r="0.9" />
        <circle cx="4.2" cy="16.2" r="0.9" />
        <circle cx="8.2" cy="16.2" r="0.9" />
        <circle cx="12.2" cy="16.2" r="0.9" />
        <circle cx="16.2" cy="16.2" r="0.9" />
      </g>
    </g>
  </svg>
);

const JapanCircularFlag: React.FC<{ clipId: string }> = ({ clipId }) => (
  <svg viewBox="0 0 36 36" className="w-full h-full block" aria-hidden="true">
    <defs>
      <clipPath id={clipId}>
        <circle cx="18" cy="18" r="18" />
      </clipPath>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <rect width="36" height="36" fill="#FFFFFF" />
      <circle cx="18" cy="18" r="8.2" fill="#BC002D" />
    </g>
  </svg>
);

const SpainCircularFlag: React.FC<{ clipId: string }> = ({ clipId }) => (
  <svg viewBox="0 0 36 36" className="w-full h-full block" aria-hidden="true">
    <defs>
      <clipPath id={clipId}>
        <circle cx="18" cy="18" r="18" />
      </clipPath>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <rect width="36" height="36" fill="#AA151B" />
      <rect y="9" width="36" height="18" fill="#F1BF00" />
      {/* Simplified Coat of Arms */}
      <g transform="translate(7.5, 12.2)">
        <rect x="0" y="1.8" width="1.1" height="7.8" rx="0.4" fill="#D4AF37" />
        <rect x="6.5" y="1.8" width="1.1" height="7.8" rx="0.4" fill="#D4AF37" />
        <rect x="1.5" y="2.2" width="4.6" height="6.8" rx="1.6" fill="#AA151B" />
        <rect x="1.5" y="2.2" width="2.3" height="3.4" fill="#C60B1E" />
        <rect x="3.8" y="2.2" width="2.3" height="3.4" fill="#D4AF37" />
        <rect x="1.5" y="5.6" width="2.3" height="3.4" fill="#D4AF37" />
        <rect x="3.8" y="5.6" width="2.3" height="3.4" fill="#C60B1E" />
        <path d="M2.1 1.6C2.6 0.5 5.0 0.5 5.5 1.6Z" fill="#C60B1E" />
        <circle cx="3.8" cy="5.6" r="1.05" fill="#0039A6" />
      </g>
    </g>
  </svg>
);

export const CircularLanguageFlag: React.FC<{
  lang: AppLanguage;
  className?: string;
}> = ({ lang, className = 'w-6 h-6' }) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `monvian-flag-clip-${lang}-${uid}`;

  return (
    <div
      className={`rounded-full overflow-hidden shrink-0 select-none ${className}`}
    >
      {lang === 'en' ? (
        <UsaCircularFlag clipId={clipId} />
      ) : lang === 'ja' ? (
        <JapanCircularFlag clipId={clipId} />
      ) : lang === 'es' ? (
        <SpainCircularFlag clipId={clipId} />
      ) : (
        <BrazilCircularFlag clipId={clipId} />
      )}
    </div>
  );
};

export default CircularLanguageFlag;
