// Writes the widget snapshot to the OS-level shared container that the native
// home-screen widgets read:
//   • iOS     → App Group UserDefaults (via @bacons/apple-targets ExtensionStorage)
//   • Android → react-native-android-widget's data store + a widget refresh
//
// This module is intentionally defensive: the native modules only exist in an
// EAS development/production build, NOT in Expo Go or on web. Every native call
// is feature-detected and wrapped so a missing module degrades to a no-op
// instead of crashing the app. It also mirrors the snapshot into AsyncStorage so
// it is observable from JS/tests.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetSnapshot } from './widget-snapshot';

export const WIDGET_SNAPSHOT_KEY = '@goalify/widget_snapshot';
// Must match the App Group id in app.config.js and the iOS widget target.
export const APP_GROUP = 'group.com.goalifylife.app';
export const ANDROID_WIDGET_NAME = 'GoalifyMedium';

async function writeIOS(json: string): Promise<void> {
  // @bacons/apple-targets exposes ExtensionStorage for App Group UserDefaults.
  const mod = require('@bacons/apple-targets');
  const ExtensionStorage = mod?.ExtensionStorage;
  if (!ExtensionStorage) return;
  const storage = new ExtensionStorage(APP_GROUP);
  await storage.set(WIDGET_SNAPSHOT_KEY, json);
  // Nudge WidgetKit to reload timelines.
  ExtensionStorage.reloadWidget?.();
}

async function writeAndroid(snapshot: WidgetSnapshot): Promise<void> {
  // Defer to the JSX renderer (kept out of this .ts module). Dynamic require so
  // the native lib is only touched when present (dev/prod build, not Expo Go).
  const { updateAndroidWidget } = require('../widgets/update-android');
  await updateAndroidWidget(snapshot);
}

export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  const json = JSON.stringify(snapshot);

  // Canonical, JS-readable copy (debuggable, also read by the Android renderer).
  try {
    await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, json);
  } catch {
    // non-fatal
  }

  if (Platform.OS === 'web') return;

  try {
    if (Platform.OS === 'ios') await writeIOS(json);
    else if (Platform.OS === 'android') await writeAndroid(snapshot);
  } catch {
    // Native widget module not present in this build — safe no-op.
  }
}
