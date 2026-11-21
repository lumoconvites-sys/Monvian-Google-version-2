/**
 * Utility to adapt the mobile browser / system status bar and theme-color
 * dynamically to match whichever screen, modal, or theme is currently active.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export function resolveThemeFromMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function getSavedThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const savedMode = localStorage.getItem('monvian_theme_mode');
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
      return savedMode;
    }
    const savedTheme = localStorage.getItem('monvian_theme');
    if (savedTheme === 'dark') return 'dark';
  } catch {}
  return 'light';
}

export interface SystemThemeParams {
  theme: 'dark' | 'light';
  activeTab: 'explorar' | 'buscar' | 'roteiros' | 'salvos' | 'chat' | 'perfil';
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

  if (theme === 'dark') {
    return '#000000';
  }

  // Splash or Auth Screen in Light Mode
  if (isAuthenticated === null || isAuthenticated === false) {
    return '#ffffff';
  }

  if (isAdminOpen) {
    return '#ffffff';
  }

  // 1. Modals with full/dimmed overlays take precedence:
  if (isWeatherModalOpen) {
    return '#18181b';
  }

  if (isDetailOpen) {
    return '#ffffff';
  }

  if (isCategoryCardOpen) {
    return '#ffffff';
  }

  // 2. Tab-specific top background colors:
  if (activeTab === 'salvos' || activeTab === 'chat' || activeTab === 'roteiros') {
    return '#ffffff';
  }

  if (activeTab === 'buscar' || activeTab === 'perfil') {
    return '#ffffff';
  }

  // 3. Tab is 'explorar' (main map) in Light Mode:
  if (mapStyle === 'satelite') {
    return '#111827';
  }

  return '#f4f4f5';
}

export function applySystemThemeColor(color: string) {
  if (typeof document === 'undefined') return;

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

  // 2. Keep apple-mobile-web-app-status-bar-style as black-translucent for edge-to-edge status bar
  let statusMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  ) as HTMLMetaElement | null;
  if (!statusMeta) {
    statusMeta = document.createElement('meta');
    statusMeta.name = 'apple-mobile-web-app-status-bar-style';
    document.head.appendChild(statusMeta);
  }
  statusMeta.setAttribute('content', 'black-translucent');

  // 3. Update document and root background styles so Safari's overscroll, notch and safe areas match seamlessly
  const isDarkDom = document.documentElement.classList.contains('dark');
  const effectiveBg = isDarkDom ? '#000000' : color;

  document.documentElement.style.backgroundColor = effectiveBg;
  document.body.style.backgroundColor = effectiveBg;

  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.style.backgroundColor = effectiveBg;
  }

  const appShell = document.getElementById('monvian-main-app') || document.getElementById('app-root-shell');
  if (appShell) {
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px) and (min-height: 540px)').matches;
    appShell.style.backgroundColor = isDarkDom ? '#000000' : isDesktop ? '#ffffff' : color;
  }
}
