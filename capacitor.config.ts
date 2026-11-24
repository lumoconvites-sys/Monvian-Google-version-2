import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.monvian.app',
  appName: 'Monvian',
  webDir: 'dist',
  loggingBehavior: 'debug',
  server: {
    iosScheme: 'capacitor',
    androidScheme: 'https',
  },
  ios: {
    scheme: 'Monvian',
    contentInset: 'never',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
