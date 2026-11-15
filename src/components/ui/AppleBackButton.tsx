import React from 'react';
import { ChevronLeft } from 'lucide-react';

export interface AppleBackButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  theme?: 'light' | 'dark' | 'auto' | 'overlay' | 'glass';
  size?: 'default' | 'lg';
}

export const AppleBackButton: React.FC<AppleBackButtonProps> = ({
  theme = 'auto',
  size = 'default',
  className = '',
  type = 'button',
  title = 'Voltar',
  'aria-label': ariaLabel = 'Voltar',
  ...props
}) => {
  const themeClass =
    theme === 'glass'
      ? 'ios26-liquid-glass text-black'
      : theme === 'light'
      ? 'apple-back-btn apple-back-btn-light'
      : theme === 'dark'
      ? 'apple-back-btn apple-back-btn-dark'
      : theme === 'overlay'
      ? 'apple-back-btn apple-back-btn-overlay'
      : 'apple-back-btn apple-back-btn-auto';

  const sizeClass = size === 'lg' ? 'w-12 h-12' : 'w-11 h-11';

  return (
    <button
      type={type}
      title={title}
      aria-label={ariaLabel}
      className={`${themeClass} ${sizeClass} rounded-full flex items-center justify-center shrink-0 select-none cursor-pointer transition-transform duration-150 active:scale-[0.91] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      <ChevronLeft
        className="relative z-10 w-[24px] h-[24px] -translate-x-[1px] pointer-events-none"
        strokeWidth={2.5}
      />
    </button>
  );
};

export default AppleBackButton;
