export type GlassStyle = 'regular' | 'clear' | 'none' | 'liquid26';
export type GlassVariant = 'bar' | 'button' | 'pill';
export type GlassColorScheme = 'auto' | 'light' | 'dark';

export interface GlassClassOptions {
  glassEffectStyle?: GlassStyle;
  variant?: GlassVariant;
  isInteractive?: boolean;
  colorScheme?: GlassColorScheme;
  className?: string;
}

export function resolveGlassSurfaceClasses({
  glassEffectStyle = 'regular',
  variant = 'bar',
  isInteractive = false,
  colorScheme = 'auto',
  className = '',
}: GlassClassOptions): string {
  if (glassEffectStyle === 'none') {
    return className.trim();
  }

  const isLiquid26 = glassEffectStyle === 'liquid26';
  const variantClass = isLiquid26
    ? variant === 'button'
      ? 'ios26-liquid-glass'
      : variant === 'pill'
        ? 'ios26-liquid-glass-pill'
        : 'ios26-liquid-glass-nav'
    : variant === 'button'
      ? 'expo-liquid-glass-btn'
      : variant === 'pill'
        ? 'expo-liquid-glass-pill'
        : 'expo-liquid-glass-bar';

  const styleVariantClass =
    glassEffectStyle === 'clear' ? 'expo-liquid-glass-clear' : '';

  const interactiveClass = isInteractive ? 'expo-liquid-glass-interactive' : '';
  const schemeClass =
    colorScheme === 'dark'
      ? 'expo-glass-scheme-dark'
      : colorScheme === 'light'
        ? 'expo-glass-scheme-light'
        : '';

  return [
    variantClass,
    styleVariantClass,
    interactiveClass,
    schemeClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
