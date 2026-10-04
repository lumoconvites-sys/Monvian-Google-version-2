import React from 'react';

interface IOSSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Authentic Apple iOS UISwitch component.
 * Features exact proportions (51x31pt with 27pt thumb), spring motion,
 * native #34C759 green on active state, and subtle iOS depth shadow.
 */
export const IOSSwitch: React.FC<IOSSwitchProps> = ({
  checked,
  onChange,
  id,
  ariaLabel,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none select-none active:scale-[0.97] ${
        checked ? 'bg-[#34C759]' : 'bg-[#e9e9ea] dark:bg-[#39393d]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.22)] transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
};
