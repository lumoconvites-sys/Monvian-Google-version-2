import React, { forwardRef } from 'react';

export type GlassStyle = 'regular' | 'clear';

export interface GlassViewProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The style of the liquid glass effect.
   * @default 'regular'
   */
  glassEffectStyle?: GlassStyle;
  /**
   * Whether the glass view should react to interactive touch/pointer states.
   * @default false
   */
  isInteractive?: boolean;
  /**
   * Optional tint color overlay applied to the glass surface.
   */
  tintColor?: string;
  /**
   * Surface preset for MOVEA bars, buttons, or pills.
   * @default 'bar'
   */
  variant?: 'bar' | 'button' | 'pill';
  /**
   * Element tag to render.
   * @default 'div'
   */
  as?: 'div' | 'nav' | 'header' | 'button' | 'span';
}

export interface GlassContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Spacing threshold at which neighboring glass views merge in iOS Liquid Glass.
   */
  spacing?: number;
}

/**
 * Checks whether Liquid Glass rendering is supported in the current runtime.
 */
export function isLiquidGlassAvailable(): boolean {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') {
    return true;
  }
  return (
    CSS.supports('backdrop-filter', 'blur(22px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(22px)')
  );
}

/**
 * Web-native implementation of `expo-glass-effect`'s `GlassView` component
 * calibrated for iOS Liquid Glass aesthetics (soft blur + subtle specular reflective rim).
 */
export const GlassView = forwardRef<HTMLElement, GlassViewProps>(
  (
    {
      glassEffectStyle = 'regular',
      isInteractive = false,
      tintColor,
      variant = 'bar',
      as: Component = 'div',
      className = '',
      style,
      children,
      ...rest
    },
    ref
  ) => {
    const variantClass =
      variant === 'button'
        ? 'expo-liquid-glass-btn'
        : variant === 'pill'
          ? 'expo-liquid-glass-pill'
          : 'expo-liquid-glass-bar';

    const styleVariantClass =
      glassEffectStyle === 'clear' ? 'expo-liquid-glass-clear' : '';

    const interactiveClass = isInteractive ? 'expo-liquid-glass-interactive' : '';

    const combinedClassName = [
      variantClass,
      styleVariantClass,
      interactiveClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const mergedStyle: React.CSSProperties = tintColor
      ? {
          ...style,
          '--expo-glass-tint': tintColor,
        } as React.CSSProperties
      : { ...style };

    const Tag = Component as any;

    return (
      <Tag ref={ref} className={combinedClassName} style={mergedStyle} {...rest}>
        {children}
      </Tag>
    );
  }
);

GlassView.displayName = 'GlassView';

/**
 * Web-native implementation of `expo-glass-effect`'s `GlassContainer` component.
 */
export const GlassContainer = forwardRef<HTMLDivElement, GlassContainerProps>(
  ({ spacing, className = '', style, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={`expo-liquid-glass-container ${className}`.trim()}
        style={
          spacing !== undefined
            ? ({ ...style, gap: `${spacing}px` } as React.CSSProperties)
            : style
        }
        {...rest}
      >
        {children}
      </div>
    );
  }
);

GlassContainer.displayName = 'GlassContainer';

export default {
  GlassView,
  GlassContainer,
  isLiquidGlassAvailable,
};
