import { Platform } from 'react-native';

// Registers the Android home-screen widget handler. Imported for its side
// effect before expo-router/entry. Guarded: the native module only exists in an
// Android dev/prod build (not Expo Go, not iOS, not web), so a missing module
// degrades to a no-op.
if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('./widget-task-handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // react-native-android-widget not present in this build — skip.
  }
}
