// Reads env at build time and surfaces them via Constants.expoConfig.extra.
// .env is gitignored; .env.example is the template.
require('dotenv/config');

module.exports = {
  expo: {
    name: 'Goalify',
    slug: 'goalify',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    scheme: 'goalify',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F4EFE6',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.goalifylife.app',
      usesAppleSignIn: true,
      infoPlist: {
        NSCalendarsUsageDescription: 'Goalify adds your habits as recurring events so you can see them in your calendar.',
        NSCalendarsWriteOnlyAccessUsageDescription: 'Goalify adds your habits as recurring events so you can see them in your calendar.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F4EFE6',
      },
      edgeToEdgeEnabled: true,
      package: 'com.goalifylife.app',
      permissions: ['android.permission.READ_CALENDAR', 'android.permission.WRITE_CALENDAR'],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-secure-store',
      'expo-web-browser',
      'expo-apple-authentication',
      'expo-calendar',
      ['expo-notifications', {
        icon: './assets/icon.png',
        color: '#1F1B17',
        sounds: [],
      }],
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
      googleOAuthIosClientId: process.env.GOOGLE_OAUTH_IOS_CLIENT_ID ?? '',
      googleOAuthAndroidClientId: process.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID ?? '',
      googleOAuthWebClientId: process.env.GOOGLE_OAUTH_WEB_CLIENT_ID ?? '',
    },
  },
};
