import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.cstreet',
  appName: 'C-Street',
  webDir: 'dist',
  server: {
    // For live development against the Lovable preview, point this at your preview URL.
    // For a production build, comment `url` out so the app loads the bundled webDir.
    url: 'https://id-preview--dd9b4d69-6c5a-4eea-aa11-928c89b0f5dc.lovable.app',
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
