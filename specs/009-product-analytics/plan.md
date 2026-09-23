# Implementation Plan: Product Analytics

**Branch**: `feat/product-analytics` | **Date**: 2026-09-23
**Input**: Product-manager requirements + product-analyst event taxonomy (summarised below).

## Summary

Instrument Goalify with **PostHog Cloud EU** through one typed wrapper (`lib/analytics.ts`) so we can answer
four launch questions: where new users drop out (activation), what predicts week-4 retention, which paywall
moment sells (monetization by `source`), and whether the AI features earn their cost. Tracking is
**opt-in** (§25 TDDDG / GDPR): nothing leaves the device until the user says yes, and no free text is ever sent.

## Business questions (first 90 days)

| # | Question | Answered by |
|---|---|---|
| Q1 | Where do new users drop between sign-up → onboarding → first goal → first completion? | Acquisition funnel |
| Q2 | What share of activated users are active in week 1 / week 4, and which behaviour predicts it (rituals, habits, journal, widget, circles)? | Retention + cohort breakdowns |
| Q3 | Paywall view → purchase conversion by source (`chat_limit`, `vision_limit`, `insights`, `welcome`, `trial_ended`, …); trial → paid | Monetization funnel + server subscription events |
| Q4 | Do coach/vision users retain and convert better; how often do free users hit AI limits? | `coach_*`, `vision_*`, `*_limit_hit` + cohorts. AI **cost** stays in the `ai_usage` table (SQL) |

## Metrics

- **North star — Weekly Committed Users (WCU)**: users with a *commitment action* on ≥3 distinct days in a rolling
  7-day window. Commitment actions: `habit_checked(done)`, `subtask_toggled(done)`, `task_toggled(done)`,
  `journal_entry_created`, `ritual_morning_completed`, `ritual_evening_completed`.
- **Activated**: within 7 days of sign-up: `onboarding_completed` AND `goal_created` AND ≥1 commitment action on a
  day other than the sign-up day. Target to validate: ≥40%.
- **Retention**: D1/D7/D30 unbounded retention, where the returning event is a commitment action or `coach_message_sent`. App open alone does not count.
- **Monetization**: `paywall_viewed` → `purchase_started` → `purchase_completed` by `source`. Trial → paid comes from the server
  `subscription_renewed{is_trial_conversion}`. Revenue/MRR truth stays in RevenueCat.
- **Guardrails**: `analytics_consent_changed`, `notification_permission_result`, `account_deleted`.

Revisit the 40% activation target and the 3-of-7 WCU threshold after 4 weeks of cohort data.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Vendor | PostHog Cloud **EU** (`posthog-react-native`) | 1M free events/mo; funnels/retention without SQL; EU hosting + DPA; flags/surveys later; HTTP capture for Deno |
| Web | Same wrapper; `@vercel/analytics` stays for web page views | One taxonomy everywhere |
| No key configured | Wrapper is a no-op | Same pattern as RevenueCat (`REVENUECAT_*` empty = billing off) |
| Consent | Opt-in modal (`/analytics-consent`) shown once after sign-in; toggle in Profile. Choice persisted per device | §25 TDDDG requires opt-in for client analytics |
| Pre-consent events | Buffered **in memory** (cap 100) and flushed on "Allow", dropped on "No thanks". The PostHog client is only created after consent | Keeps the sign-up/onboarding funnel intact without sending or storing anything first |
| Server events | RevenueCat webhook → PostHog capture, **only if** the RC subscriber attribute `analytics_consent = granted` (the app sets it) | Covers renewals/cancellations the app never sees, while respecting consent without a DB migration |
| AI cost | Not sent to PostHog; `ai_usage` table (migration 0016) already has per-call usage | Avoid duplicating a source of truth |
| Session replay / autocapture of touches | Off | Users type journal/goal text on screen |
| GeoIP | `disableGeoip: true`; also enable "Discard client IP data" in the PostHog project | Data minimisation |
| Account deletion | `delete-account` asks PostHog to delete the person (if `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` set) | GDPR Art. 17 |

## Privacy rules (enforced in `lib/analytics.ts`)

Never sent: goal/subtask/habit/task titles, journal text, future letters, coach prompts/replies, vision prompts/URLs,
circle names/invite codes, display name, pronouns, email, raw error messages, route params.

- The event map is a TypeScript type, so an unlisted event or property fails the build.
- At runtime, only numbers, booleans, and lowercase strings of ≤40 chars matching `^[a-z0-9_:/\[\]$.-]+$` survive
  `sanitize()` (enum-like values only). Anything else is dropped. Screen names are lowercased (`vision/[goalid]`).
- `before_send` strips URL properties (`url`, `$current_url`, …) that the SDK adds to its own lifecycle events.
- Distinct id = Supabase user UUID (pseudonymous). Same id as RevenueCat, so client + server events join.

## Event taxonomy

Naming: `object_action`, snake_case, past tense. Super properties on every event: `plan`, `is_trial`.
PostHog adds `$os`, `$app_version` and lifecycle events (`Application Opened/Installed/Updated/Backgrounded`).

| Area | Event | Properties | Fires at |
|---|---|---|---|
| Screens | `$screen` | route template, groups stripped, lowercased: `vision/[goalid]` (paywall source is on `paywall_viewed`) | `components/analytics/AnalyticsBridge.tsx` (useSegments) |
| Auth | `signed_up` | `method: email` | `app/(auth)/sign-up.tsx` onSubmit |
| | `signed_in` | `method: email\|google\|apple` | `sign-in.tsx`, `(auth)/index.tsx` |
| | `auth_failed` | `method`, `stage: sign_up\|sign_in` | same handlers (OAuth cancel excluded) |
| | `signed_out` | – | `app/profile.tsx` onSignOut |
| | `account_deleted` | – | `app/profile.tsx` onDelete success |
| Onboarding | `onboarding_step_completed` | `step`, `spheres_count?`, `tone?` | `store/onboarding.tsx` advance() (only while not complete) |
| | `onboarding_completed` | `letter_written` | `app/(onboarding)/future-letter.tsx` save() |
| Welcome | `welcome_goal_step` | `action: saved\|skipped`, `sphere?` | `app/(welcome)/add-goal.tsx` |
| | `welcome_task_step` | `action: saved\|skipped`, `task_count` | `app/(welcome)/add-task.tsx` |
| | `welcome_completed` | `trial_offer_shown` | `lib/paywall.ts` finishWelcome |
| Core loop (derived from actions) | `goal_created` | `sphere`, `has_due_date`, `subtask_count` | `store/sync.ts` dispatch → `lib/analytics-events.ts` |
| | `goal_updated` / `goal_deleted` | `fields_changed` / `subtask_count`, `progress_pct` | same |
| | `subtask_added` / `subtask_toggled` | `done`, `goal_progress_pct`, `goal_completed` | same |
| | `habit_created` / `habit_checked` | `sphere`, `linked_to_goal` / `done`, `streak`, `sphere` | same |
| | `habit_reminder_set` | `enabled`, `hour` | same |
| | `task_created` / `task_toggled` | `sphere` / `done` | same |
| | `journal_entry_created` | `sentiment`, `word_count_bucket` | same |

No `is_first` flag: before the cache hydrates the store looks empty, so it would over-count. Use PostHog's "first time for user" matching in funnels instead.
| Rituals | `ritual_morning_completed` | `sphere`, `actions_count`, `must_do` | `store/daily-ritual.tsx` lockMorning |
| | `ritual_evening_completed` | `wrote_line`, `next_sphere`, `actions_done`, `actions_total` | closeEvening |
| AI | `coach_message_sent` | – | `app/(tabs)/coach.tsx` send |
| | `coach_reply_received` | `outcome: ok\|limit\|error`, `latency_ms` | same |
| | `coach_limit_hit` | `upgrade_offered` | same |
| | `vision_generation_requested` | `outcome: ready\|image_limit\|error` | `store/vision.tsx` requestGeneration |
| | `vision_limit_hit` | – | same |
| | `vision_regen_requested` | `outcome: ok\|error` | requestRegen |
| Monetization | `upgrade_cta_tapped` | `source` | `lib/paywall.ts` openPaywall (single place) |
| | `paywall_viewed` | `source`, `trial_eligible`, `packages_available` | `app/paywall.tsx` once loaded |
| | `paywall_dismissed` | `source` | close / swipe-dismiss |
| | `purchase_started` | `source`, `period`, `trial_eligible` | onBuy |
| | `purchase_completed` | `source`, `period`, `is_trial` | `store/plan.tsx` purchase |
| | `purchase_cancelled` / `purchase_failed` | `source`, `period` | plan.tsx / paywall onBuy catch |
| | `restore_completed` | `result: beyond\|none\|error` | onRestore |
| | `trial_ended_viewed` / `trial_ended_action` | `action: upgrade\|dismiss` | `TrialWatcher` / `app/trial-ended.tsx` |
| Social | `circle_created` / `circle_joined` | `outcome: ok\|error` / `outcome: ok\|invalid_code\|already_member\|error` | `app/circles/index.tsx` |
| | `circle_invite_shared` | – | `app/circles/[id].tsx` |
| Notifications | `notification_permission_result` | `granted` | `lib/notifications.ts` |
| | `notification_opened` | `kind: morning\|lunch\|evening\|sentiment\|streak_risk\|habit_reminder\|trial_ending\|other` | `app/_layout.tsx` NotificationListener |
| Consent | `analytics_consent_changed` | `granted: true` (only sendable when granting) | consent screen / profile |
| Server | `subscription_started` / `subscription_renewed` / `subscription_cancelled` / `subscription_uncancelled` / `subscription_expired` / `billing_issue` / `subscription_product_changed` | `period_type`, `store`, `product_id`, `is_trial_conversion`, `price_usd` | `supabase/functions/revenuecat-webhook` |

**Person properties**: `plan`, `is_trial`, `will_renew`, `store` (from `usePlan` when `confirmed`); `onboarding_tone`,
`spheres_count` on onboarding; `goals_count`, `habits_count` after hydrate; `$set_once: signup_date` (from
`user.created_at`).

**Identity**: `identify(user.id)` when a user signs in (incl. cold start with session); `reset()` on sign-out.
Anonymous pre-auth events merge into the identified person on identify (PostHog default).

## Dashboards to build in PostHog (manual, after launch)

1. Acquisition funnel: `signed_up` → `onboarding_step_completed` (by step) → `onboarding_completed` → `welcome_goal_step{saved}` → `goal_created` → first commitment action.
2. Retention: D1/D7/D30 by `signup_date` week, returning event = commitment action.
3. Stickiness / WCU: commitment actions, ≥3 days per week.
4. Monetization: `upgrade_cta_tapped` / `paywall_viewed` → `purchase_started` → `purchase_completed`, broken down by `source`; `subscription_renewed{is_trial_conversion}`.
5. AI: `coach_limit_hit`, `vision_limit_hit` per free WAU, and their paywall conversion.

## Files

```text
lib/analytics.ts                        NEW  wrapper: consent, buffer, sanitize, typed EventMap
lib/analytics-events.ts                 NEW  pure: AppAction + prev/next state → events
lib/analytics-screen.ts                 NEW  pure: segments → screen name; notification id → kind
components/analytics/AnalyticsBridge.tsx NEW identity, person props, plan super-props, screen tracking
app/analytics-consent.tsx               NEW  opt-in modal
supabase/functions/_shared/analytics.ts NEW  pure RC event → PostHog payload + capture()
store/sync.ts, store/onboarding.tsx, store/daily-ritual.tsx, store/vision.tsx, store/plan.tsx   instrumented
app/**, lib/paywall.ts, lib/notifications.ts, lib/purchases.ts, components/TrialWatcher.tsx      instrumented
supabase/functions/revenuecat-webhook, delete-account                                           server events / deletion
__tests__/analytics*.test.ts                                                                     unit tests
docs/analytics.md                       NEW  setup runbook, privacy label / data-safety answers
```

## Rollout / ops (manual, not done by this branch)

1. Create PostHog EU project; enable "Discard client IP data"; sign DPA.
2. `.env`: `POSTHOG_API_KEY`, `POSTHOG_HOST=https://eu.i.posthog.com`. New native deps require a new dev/EAS build.
3. Supabase secrets: `POSTHOG_API_KEY`, optional `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`; redeploy `revenuecat-webhook`, `delete-account` (production project — deploy deliberately).
4. Update privacy policy + App Store privacy label + Play data safety (see `docs/analytics.md`).
