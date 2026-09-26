/**
 * Utility to adapt the mobile browser / system status bar and theme-color
 * dynamically to match whichever screen, modal, or theme is currently active.
 */

export interface SystemThemeParams {
  theme: 'dark' | 'light';
  activeTab: 'explorar' | 'buscar' | 'roteiros' | 'chat' | 'perfil';
  isAuthenticated?: boolean | null;
  mapStyle?: string;
  isDetailOpen?: boolean;
  isWeatherModalOpen?: boolean;
  isAdminOpen?: boolean;
  isCategoryCardOpen?: boolean;
  isSearchOpen?: boolean;
}

export function computeAdaptiveThemeColor(params: SystemThemeParams): string {
  const {
    theme,
    activeTab,
    isAuthenticated,
    mapStyle,
    isDetailOpen,
    isWeatherModalOpen,
    isAdminOpen,
    isCategoryCardOpen,
  } = params;

  // Splash or Auth Screen
  if (isAuthenticated === null || isAuthenticated === false) {
    return '#000000';
  }

  if (isAdminOpen) {
    return '#09090b';
  }

  // 1. Modals with full/dimmed overlays take precedence:
  if (isWeatherModalOpen) {
    return theme === 'dark' ? '#09090b' : '#18181b';
  }

  if (isDetailOpen) {
    return theme === 'dark' ? '#121214' : '#ffffff';
  }

  if (isCategoryCardOpen) {
    return theme === 'dark' ? '#1c1c1e' : '#ffffff';
  }

  // 2. Tab-specific top background colors:
  if (activeTab === 'chat') {
    return '#000000';
  }

  if (activeTab === 'roteiros') {
    return theme === 'dark' ? '#111315' : '#F4F4F6';
  }

  if (activeTab === 'buscar') {
    return theme === 'dark' ? '#000000' : '#fafafa';
  }

  if (activeTab === 'perfil') {
    return theme === 'dark' ? '#000000' : '#fafafa';
  }

  // 3. Tab is 'explorar' (main map):
  if (theme === 'dark') {
    return '#000000';
  }

  // In light theme:
  if (mapStyle === 'satelite') {
    return '#111827';
  }

  // Standard light animated map / explore
  return '#f4f4f5';
}

export function applySystemThemeColor(color: string) {
  if (typeof document === 'undefined') return;

  // Determine if the color is perceptually dark or light
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const isDark = brightness < 145;

  // 1. Update all <meta name="theme-color"> tags so Safari in any color scheme matches
  const themeMetas = document.querySelectorAll('meta[name="theme-color"]');
  if (themeMetas.length > 0) {
    themeMetas.forEach((meta) => {
      meta.setAttribute('content', color);
    });
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  }

  // 2. Update apple-mobile-web-app-status-bar-style:
  // 'default' = dark text/icons on light background
  // 'black-translucent' = white text/icons on dark background
  let statusMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  ) as HTMLMetaElement | null;
  if (!statusMeta) {
    statusMeta = document.createElement('meta');
    statusMeta.name = 'apple-mobile-web-app-status-bar-style';
    document.head.appendChild(statusMeta);
  }
  statusMeta.setAttribute('content', isDark ? 'black-translucent' : 'default');

  // 3. Update document and root background styles so Safari's overscroll, notch and safe areas match seamlessly
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;

  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.style.backgroundColor = color;
  }

  const appShell = document.getElementById('app-root-shell');
  if (appShell) {
    appShell.style.backgroundColor = color;
  }
}
