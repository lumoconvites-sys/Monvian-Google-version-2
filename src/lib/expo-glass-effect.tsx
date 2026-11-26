import React, { forwardRef, useCallback } from 'react';
import {
  resolveGlassSurfaceClasses,
  type GlassStyle,
  type GlassVariant,
  type GlassColorScheme,
} from './glassEffectUtils';

export type { GlassStyle, GlassVariant, GlassColorScheme };

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
   * Explicit color scheme override matching expo-glass-effect API.
   * @default 'auto'
   */
  colorScheme?: GlassColorScheme;
  /**
   * Surface preset for Monvian bars, buttons, or pills.
   * @default 'bar'
   */
  variant?: GlassVariant;
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
 * Alias matching official expo-glass-effect API.
 */
export function isGlassEffectAPIAvailable(): boolean {
  return isLiquidGlassAvailable();
}

/**
 * Web & Capacitor-native implementation of `expo-glass-effect`'s `GlassView` component,
 * calibrated for Apple iOS 26 Liquid Glass (real optical backdrop blur, saturation boost,
 * specular refractive rim, and interactive pointer sheen).
 */
export const GlassView = forwardRef<HTMLElement, GlassViewProps>(
  (
    {
      glassEffectStyle = 'regular',
      isInteractive = false,
      tintColor,
      colorScheme = 'auto',
      variant = 'bar',
      as: Component = 'div',
      className = '',
      style,
      onPointerMove,
      onPointerLeave,
      children,
      ...rest
    },
    ref
  ) => {
    const combinedClassName = resolveGlassSurfaceClasses({
      glassEffectStyle,
      variant,
      isInteractive,
      colorScheme,
      className,
    });

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        onPointerMove?.(e);
      },
      [onPointerMove]
    );

    const handlePointerLeave = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        onPointerLeave?.(e);
      },
      [onPointerLeave]
    );

    const mergedStyle: React.CSSProperties = tintColor
      ? ({
          ...style,
          '--expo-glass-tint': tintColor,
        } as React.CSSProperties)
      : { ...style };

    const Tag = Component as any;

    return (
      <Tag
        ref={ref}
        data-glass-style={glassEffectStyle}
        data-glass-interactive={isInteractive ? 'true' : 'false'}
        className={combinedClassName}
        style={mergedStyle}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        {...rest}
      >
        {children}
      </Tag>
    );
  }
);

GlassView.displayName = 'GlassView';

/**
 * Web & Capacitor-native implementation of `expo-glass-effect`'s `GlassContainer` component.
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
  isGlassEffectAPIAvailable,
};
