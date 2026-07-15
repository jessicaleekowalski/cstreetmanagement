import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.cstreet',
  appName: 'C-Street',
  webDir: 'dist',
  server: {
    // Points at the public published URL so the native app loads without a Lovable login.
    url: 'https://cstreetmanagement.lovable.app',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0b1e34',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
