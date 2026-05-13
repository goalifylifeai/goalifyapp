import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const SUPABASE_URL = extra.supabaseUrl ?? '';
const SUPABASE_ANON_KEY = extra.supabaseAnonKey ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surface clearly in dev; don't crash so the bundler can still serve a friendly screen.
  console.warn(
    '[supabase] Missing SUPABASE_URL / SUPABASE_ANON_KEY. Copy .env.example to .env and fill values.',
  );
}

// expo-secure-store is unavailable on web — fall back to localStorage there.
// Guard with typeof window check to avoid SSR environments where localStorage exists
// as a broken stub (not a real Storage object).
const webStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function'
    ? window.localStorage
    : null;

const SecureStoreAdapter = {
  getItem: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(webStorage()?.getItem(key) ?? null)
      : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(webStorage()?.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(webStorage()?.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};

// ── Database row types ─────────────────────────────────────────────
export type GoalRow = {
  id: string;
  user_id: string;
  sphere: 'finance' | 'health' | 'career' | 'relationships';
  title: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalSubtaskRow = {
  id: string;
  goal_id: string;
  user_id: string;
  text: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type HabitRow = {
  id: string;
  user_id: string;
  label: string;
  icon: string;
  sphere: 'finance' | 'health' | 'career' | 'relationships';
  target_description: string;
  created_at: string;
  updated_at: string;
};

export type HabitLogRow = {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  done: boolean;
  created_at: string;
};

export type JournalEntryRow = {
  id: string;
  user_id: string;
  date: string;
  sphere: 'finance' | 'health' | 'career' | 'relationships';
  sentiment: number;
  excerpt: string;
  created_at: string;
  updated_at: string;
};

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
