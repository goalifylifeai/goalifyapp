// The only file that talks to the PostHog SDK (see specs/009-product-analytics/plan.md).
//
// Tracking is opt-in: until the user answers the consent prompt, calls are held
// in memory (never stored or sent); "Allow" replays them, "No thanks" drops them.
// With no POSTHOG_API_KEY every call is a no-op, like billing without RevenueCat.
//
// Privacy: events are typed below, and sanitize() drops any value that isn't a
// number, boolean or short enum-like string, so free text (titles, journal,
// letters, coach messages, names) can't reach PostHog even by mistake.

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type PostHogType from 'posthog-react-native';
import type { SphereId } from '../constants/theme';
import type { PaywallSource } from './plan-state';

type Period = 'monthly' | 'annual';
type AuthMethod = 'email' | 'google' | 'apple';
type Tone = 'warm' | 'direct' | 'playful';

/** Every event the app may send, with its properties. Unlisted events don't compile. */
export type EventMap = {
  signed_up: { method: AuthMethod };
  signed_in: { method: AuthMethod };
  auth_failed: { method: AuthMethod; stage: 'sign_up' | 'sign_in' };
  signed_out: {};
  account_deleted: {};

  onboarding_step_completed: { step: string; spheres_count?: number; tone?: Tone };
  onboarding_completed: { letter_written: boolean };
  welcome_goal_step: { action: 'saved' | 'skipped'; sphere?: SphereId };
  welcome_task_step: { action: 'saved' | 'skipped'; task_count: number };
  welcome_completed: { trial_offer_shown: boolean };

  goal_created: { sphere: SphereId; has_due_date: boolean; subtask_count: number };
  goal_updated: { fields_changed: string[] };
  goal_deleted: { subtask_count: number; progress_pct: number };
  subtask_added: {};
  subtask_toggled: { done: boolean; goal_progress_pct: number; goal_completed: boolean };
  habit_created: { sphere: SphereId; linked_to_goal: boolean };
  habit_checked: { done: boolean; streak: number; sphere: SphereId };
  habit_reminder_set: { enabled: boolean; hour?: number };
  task_created: { sphere: SphereId };
  task_toggled: { done: boolean };
  journal_entry_created: { sentiment: number; word_count_bucket: '1-20' | '21-100' | '100+' };

  ritual_morning_completed: { sphere: SphereId; actions_count: number; must_do: boolean };
  ritual_evening_completed: { wrote_line: boolean; next_sphere: SphereId; actions_done: number; actions_total: number };

  coach_message_sent: {};
  coach_reply_received: { outcome: 'ok' | 'limit' | 'error'; latency_ms: number };
  coach_limit_hit: { upgrade_offered: boolean };
  vision_generation_requested: { outcome: 'ready' | 'image_limit' | 'error' };
  vision_limit_hit: {};
  vision_regen_requested: { outcome: 'ok' | 'error' };

  upgrade_cta_tapped: { source: PaywallSource };
  paywall_viewed: { source: PaywallSource; trial_eligible: boolean; packages_available: boolean };
  paywall_dismissed: { source: PaywallSource };
  purchase_started: { source: PaywallSource; period: Period; trial_eligible: boolean };
  purchase_completed: { source: PaywallSource; period: Period; is_trial: boolean };
  purchase_cancelled: { source: PaywallSource; period: Period };
  purchase_failed: { source: PaywallSource; period: Period };
  restore_completed: { result: 'beyond' | 'none' | 'error' };
  trial_ended_viewed: {};
  trial_ended_action: { action: 'upgrade' | 'dismiss' };

  circle_created: { outcome: 'ok' | 'error' };
  circle_joined: { outcome: 'ok' | 'invalid_code' | 'already_member' | 'error' };
  circle_invite_shared: {};

  notification_permission_result: { granted: boolean };
  notification_opened: { kind: string };

  analytics_consent_changed: { granted: boolean };
};

export type EventName = keyof EventMap;
export type TrackedEvent = { [K in EventName]: { name: K; props: EventMap[K] } }[EventName];

type Value = string | number | boolean | string[];
export type Props = Record<string, Value | undefined>;

const ENUM_LIKE = /^[a-z0-9_:/\[\]$.-]{1,40}$/;

/** Keeps only numbers, booleans and short enum-like strings (or lists of them). */
export function sanitize(props: Record<string, unknown> | undefined): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && ENUM_LIKE.test(v)) out[k] = v;
    else if (Array.isArray(v)) {
      const list = v.filter((x): x is string => typeof x === 'string' && ENUM_LIKE.test(x));
      if (list.length) out[k] = list;
    }
  }
  return out;
}

// ── Consent + client ──────────────────────────────────────────────

export type Consent = 'unknown' | 'unset' | 'granted' | 'denied';

const CONSENT_KEY = '@goalify/analytics-consent';
const MAX_BUFFER = 100;

const extra = (Constants.expoConfig?.extra ?? {}) as { posthogApiKey?: string; posthogHost?: string };
const apiKey = extra.posthogApiKey ?? '';
const host = extra.posthogHost || 'https://eu.i.posthog.com';

type Op = (c: PostHogType) => void;

let consent: Consent = 'unknown';
let client: PostHogType | null = null;
let buffer: Op[] = [];
let initStarted = false;
const listeners = new Set<() => void>();

/** A PostHog key is configured for this build. Without one there is nothing to consent to. */
export function analyticsAvailable(): boolean {
  return !!apiKey;
}

// The SDK's own events (e.g. "Application Opened") carry the launch/page URL,
// which can hold a resolved path such as /vision/<goal id> or a deep link.
const URL_PROPS = ['url', '$current_url', '$referrer', '$referring_domain', '$pathname'];

export function stripUrls<E extends { properties?: Record<string, unknown> } | null>(event: E): E {
  if (!event?.properties) return event;
  const properties = { ...event.properties };
  for (const k of URL_PROPS) delete properties[k];
  return { ...event, properties };
}

function createClient(): PostHogType {
  // Required lazily so the SDK's native modules load only once the user opted in.
  const { PostHog } = require('posthog-react-native') as typeof import('posthog-react-native');
  return new PostHog(apiKey, {
    host,
    captureAppLifecycleEvents: true,
    disableGeoip: true,
    enableSessionReplay: false,
    disableSurveys: true,
    preloadFeatureFlags: false,
    disableRemoteConfig: true,
    before_send: e => stripUrls(e),
  });
}

function setConsentState(next: Consent) {
  consent = next;
  listeners.forEach(l => l());
}

function run(op: Op) {
  if (!apiKey || consent === 'denied') return;
  if (consent === 'granted') {
    if (!client) client = createClient();
    try { op(client); } catch { /* analytics must never break the app */ }
    return;
  }
  if (buffer.length < MAX_BUFFER) buffer.push(op);
}

/** Reads the stored consent choice. Safe to call repeatedly. */
export async function initAnalytics(): Promise<void> {
  if (initStarted || !apiKey) return;
  initStarted = true;
  let stored: string | null = null;
  try { stored = await AsyncStorage.getItem(CONSENT_KEY); } catch { /* treat as unset */ }
  if (stored === 'granted') {
    setConsentState('granted');
    flushBuffer();
  } else if (stored === 'denied') {
    buffer = [];
    setConsentState('denied');
  } else {
    setConsentState('unset');
  }
}

function flushBuffer() {
  const ops = buffer;
  buffer = [];
  ops.forEach(run);
}

export async function setAnalyticsConsent(granted: boolean): Promise<void> {
  if (!apiKey) return;
  AsyncStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied').catch(() => {});
  if (granted) {
    setConsentState('granted');
    flushBuffer();
    track('analytics_consent_changed', { granted: true });
    return;
  }
  buffer = [];
  if (client) {
    const c = client;
    client = null;
    try { c.reset(); await c.optOut(); } catch { /* ignore */ }
  }
  setConsentState('denied');
}

export function getAnalyticsConsent(): Consent {
  return apiKey ? consent : 'denied';
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useAnalyticsConsent(): Consent {
  return useSyncExternalStore(subscribe, getAnalyticsConsent, getAnalyticsConsent);
}

// ── Public tracking API ───────────────────────────────────────────

export function track<K extends EventName>(name: K, ...props: {} extends EventMap[K] ? [EventMap[K]?] : [EventMap[K]]): void {
  const clean = sanitize(props[0] as Record<string, unknown> | undefined);
  run(c => { c.capture(name, clean); });
}

export function trackAll(events: TrackedEvent[]): void {
  for (const e of events) track(e.name, e.props as never);
}

/** `name` is a lowercased route template such as `vision/[goalid]`, never a resolved path. */
export function screen(name: string, props?: Props): void {
  if (!ENUM_LIKE.test(name)) return;
  const clean = sanitize(props);
  run(c => { c.screen(name, clean); });
}

export function identify(userId: string, set: Props = {}, setOnce: Props = {}): void {
  const s = sanitize(set);
  const so = sanitize(setOnce);
  run(c => { c.identify(userId, { $set: s, $set_once: so }); });
}

/** Person properties for the identified user. */
export function setPersonProps(set: Props): void {
  const s = sanitize(set);
  run(c => { c.capture('$set', { $set: s }); });
}

/** Properties attached to every later event (plan, is_trial). */
export function registerSuperProps(props: Props): void {
  const clean = sanitize(props);
  run(c => { c.register(clean); });
}

export function resetAnalytics(): void {
  run(c => { c.reset(); });
}

/** Test-only: back to a fresh module state. */
export function __resetForTests(): void {
  consent = 'unknown';
  client = null;
  buffer = [];
  initStarted = false;
  listeners.clear();
}
