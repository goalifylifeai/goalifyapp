// Reads env at build time and surfaces them via Constants.expoConfig.extra.
// .env is gitignored; .env.example is the template.
require('dotenv/config');

module.exports = {
  expo: {
    name: 'Goalify',
    slug: 'goalify',
    owner: 'goalifyais-organization',
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
      icon: {
        light: './assets/icon.png',
        dark: './assets/icon-dark.png',
      },
      infoPlist: {
        NSCalendarsUsageDescription: 'Goalify adds your habits as recurring events so you can see them in your calendar.',
        NSCalendarsWriteOnlyAccessUsageDescription: 'Goalify adds your habits as recurring events so you can see them in your calendar.',
      },
      // Shared container the WidgetKit extension reads (see targets/widget + lib/widget-bridge.ts).
      entitlements: {
        'com.apple.security.application-groups': ['group.com.goalifylife.app'],
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
      // iOS home-screen widget (WidgetKit). Reads targets/widget/*.
      // Set appleTeamId or pass APPLE_TEAM_ID in the build environment.
      ['@bacons/apple-targets', {
        appleTeamId: process.env.APPLE_TEAM_ID ?? 'XXXXXXXXXX',
      }],
      // Android home-screen widget. Renders widgets/GoalifyMediumWidget.tsx.
      ['react-native-android-widget', {
        widgets: [{
          name: 'GoalifyMedium',
          label: "Today's One",
          description: 'Your focus action and streak.',
          minWidth: '250dp',
          minHeight: '110dp',
          targetCellWidth: 4,
          targetCellHeight: 2,
          resizeMode: 'horizontal|vertical',
          previewImage: './assets/icon.png',
        }],
      }],
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
      googleOAuthIosClientId: process.env.GOOGLE_OAUTH_IOS_CLIENT_ID ?? '',
      googleOAuthAndroidClientId: process.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID ?? '',
      googleOAuthWebClientId: process.env.GOOGLE_OAUTH_WEB_CLIENT_ID ?? '',
      eas: {
        projectId: '688a053f-42b8-4e44-b220-7aa3c03b15ba',
      },
    },
  },
};
