# Implementation Plan: The Daily Ritual Engine

**Branch**: `005-daily-ritual-engine` | **Date**: 2026-05-10  
**Priority**: Must Build | **Difficulty**: MVP medium, Scaling low

## Summary

Add a morning + evening ritual bookend to Goalify that transforms the Today tab from a passive list into an active daily ceremony. Users lock their day at 6 AM (pick one focus sphere, select 1 must-do + 2 also-dos from coach-proposed actions) and close it at 9:30 PM (review completions, write a one-line journal, pick tomorrow's sphere, receive a streak animation). Push notifications drive both; a shareable card closes the loop socially. A new Supabase table persists daily state. The existing store reducer and Today tab remain largely intact — ritual flows live in standalone full-screen modals.

---

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81  
**Primary Dependencies (existing)**: Expo SDK 54, expo-router 6, `@supabase/supabase-js` v2, `react-native-reanimated` 3, `react-native-gesture-handler`  
**New Dependency**: `expo-notifications` ~0.30 (local scheduled push)  
**Storage**: Supabase Postgres — one new table `daily_intentions`. RLS enforced.  
**Testing**: jest + jest-expo. Reducer unit tests for ritual state machine; integration tests against local Supabase for DB writes.  
**Target Platform**: iOS 15+, Android 7+. Notifications require permission grant (handled in onboarding or first-launch prompt).  
**Performance Goals**: Morning modal interactive ≤ 300ms from notification tap. Evening close animation ≤ 16ms/frame.  
**Constraints**: Notifications must never fire if user already completed the ritual for that day. Snooze must be one tap, max 1 re-send per window. Shareable card must render offscreen (no library) using a plain `View` captured via `react-native-view-shot` (add) or a Canva export (skip for MVP — generate a static card image instead).

---

## Project Structure

### Documentation (this feature)

```text
specs/005-daily-ritual-engine/
├── plan.md              # This file
└── data-model.md        # Phase 1 output (DB schema + types)
```

### Source Code

```text
app/
├── ritual/
│   ├── _layout.tsx          # NEW — Stack, no header, full-screen modal presentation
│   ├── morning.tsx          # NEW — 3-step morning lock flow
│   └── evening.tsx          # NEW — 4-screen evening close flow
├── (tabs)/
│   └── index.tsx            # EDIT — add ritual CTA banner + must-do highlight

store/
└── daily-ritual.tsx         # NEW — useDailyRitual() hook, Supabase read/write

lib/
├── notifications.ts         # NEW — schedule/cancel push notifications
└── ritual-coach.ts          # NEW — propose morning actions (stub → AI)

supabase/migrations/
└── 0004_daily_intentions.sql  # NEW

components/
└── ritual/
    ├── SphereSelectStep.tsx    # NEW — animated sphere-card picker
    ├── ActionPickStep.tsx      # NEW — 3-action list with must-do toggle
    ├── LockConfirmStep.tsx     # NEW — locked state + haptic
    ├── DoneReviewStep.tsx      # NEW — evening: action checklist replay
    ├── JournalLineStep.tsx     # NEW — single-line journal input
    ├── TomorrowPickStep.tsx    # NEW — sphere picker for next day
    └── CloseCelebrationStep.tsx # NEW — streak animation + shareable card

__tests__/
├── daily-ritual.test.ts        # NEW — store hook, reducer logic
└── ritual-coach.test.ts        # NEW — action proposal determinism
```

---

## Phase 0 — Prerequisites

### 0.1 Add expo-notifications

```bash
npx expo install expo-notifications
```

Add to `app.config.js`:
```js
plugins: [
  ['expo-notifications', {
    icon: './assets/notification-icon.png',
    color: '#1F1B17',
    sounds: [],
  }]
]
```

### 0.2 Notification Permission Helper

`lib/notifications.ts` must request permission on first call and gracefully degrade (no permission = no push, ritual still works via in-app CTA).

---

## Phase 1 — Data Layer

### 1.1 Migration: `daily_intentions`

**File**: `supabase/migrations/0004_daily_intentions.sql`

```sql
-- Daily ritual: one row per user per calendar date (user's local date).
CREATE TABLE IF NOT EXISTS public.daily_intentions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          date        NOT NULL,
  focus_sphere  text        NOT NULL
                            CHECK (focus_sphere IN ('finance','health','career','relationships')),
  actions       jsonb       NOT NULL DEFAULT '[]',
  -- actions element shape:
  --   { "id": uuid, "text": string, "sphere": SphereId,
  --     "is_must_do": boolean, "done": boolean, "source": "goal_subtask"|"habit"|"free" }
  must_do_done  boolean     NOT NULL DEFAULT false,
  journal_line  text        CHECK (length(journal_line) <= 280),
  next_sphere   text        CHECK (next_sphere IN ('finance','health','career','relationships')),
  closed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_intentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_intentions_select_own"
  ON public.daily_intentions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "daily_intentions_insert_own"
  ON public.daily_intentions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_intentions_update_own"
  ON public.daily_intentions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Design notes**:
- `actions` is jsonb so the schema can evolve without migrations (add `goal_id`, `ai_suggested`, etc.)
- `UNIQUE(user_id, date)` enforces one intention per day server-side
- `next_sphere` is set during the evening close and read the following morning to pre-select the sphere

### 1.2 TypeScript Types

```typescript
// store/daily-ritual.tsx — top-level types

export type RitualAction = {
  id: string;
  text: string;
  sphere: SphereId;
  is_must_do: boolean;
  done: boolean;
  source: 'goal_subtask' | 'habit' | 'free';
};

export type DailyIntention = {
  id: string;
  user_id: string;
  date: string;            // 'YYYY-MM-DD'
  focus_sphere: SphereId;
  actions: RitualAction[];
  must_do_done: boolean;
  journal_line: string | null;
  next_sphere: SphereId | null;
  closed_at: string | null;
  created_at: string;
};
```

### 1.3 Store Hook: `useDailyRitual()`

```typescript
// store/daily-ritual.tsx

type RitualState = {
  intention: DailyIntention | null;
  isLoading: boolean;
  error: string | null;
};

// Derived helpers (computed, not stored):
//   isMorningDone  = intention !== null
//   isEveningDone  = intention?.closed_at !== null
//   todayDate      = new Date().toISOString().slice(0, 10)

// Actions:
//   fetchToday()             — SELECT where date = today, upsert nothing
//   lockMorning(sphere, actions[])  — INSERT row
//   toggleRitualAction(id)   — UPDATE actions jsonb in place
//   closeEvening(journalLine, nextSphere) — UPDATE closed_at, journal_line, next_sphere
```

**Implementation pattern**: follows existing `store/future-self.tsx` pattern (Supabase client calls inside hook, local state via `useState`/`useReducer`). No global context needed — component mounts fetch today's row.

---

## Phase 2 — Morning Ritual Flow

### 2.1 Route Setup

`app/ritual/_layout.tsx`: Stack navigator with `presentation: 'fullScreenModal'`, no header, background `COLORS.paper`.

Entry points:
1. Notification deep-link: `goalify://ritual/morning`
2. In-app CTA banner on Today tab (if `!isMorningDone`)

### 2.2 `app/ritual/morning.tsx`

Three-step wizard managed by local `step` state (0 → 1 → 2). No back navigation between steps (ceremony, not form). Each step fills the screen.

**Step 0 — SphereSelect** (`components/ritual/SphereSelectStep.tsx`):
- Full-screen. Display date as mono label at top.
- Heading: *"What's your One today?"* in displayItalic, 36px.
- 4 sphere cards in 2×2 grid. Each card: sphere glyph large (48px), sphere label, soft background from `SPHERE_COLORS[id].soft`. 
- Selected card scales to 1.04 with `Animated.spring`, border in `accent` color.
- If `next_sphere` from yesterday's intention exists, pre-select it (user still must tap Continue).
- CTA button at bottom: "Set my focus →" — disabled until selection made.

**Step 1 — ActionPick** (`components/ritual/ActionPickStep.tsx`):
- Heading: *"Today's three."* + subheading: focus sphere chip.
- List of exactly 3 proposed actions from `proposeMorningActions()` (see Phase 5).
- Each action row:
  - Left: `○` / `●` toggle for must-do (only one can be must-do — tapping another moves the star)
  - Center: action text, sphere chip below
  - Right: swap icon (re-rolls this one action from the fallback pool)
- Must-do row gets a subtle left border in `SPHERE_COLORS[sphere].accent`.
- CTA: "Lock the day →" — disabled until must-do is selected.

**Step 2 — LockConfirm** (`components/ritual/LockConfirmStep.tsx`):
- Calls `lockMorning(sphere, actions)` on mount (show spinner, then success).
- Success state: full-screen ink1 background, large checkmark animated in with `Animated.spring` (scale 0 → 1), sphere glyph, text: *"Locked. Make it count."*
- Haptic: `Haptics.notificationAsync(NotificationFeedbackType.Success)` (add `expo-haptics` — already listed as expo-notifications peer).
- Auto-dismisses after 1.4 s → navigate to `/(tabs)/` (router.replace).

### 2.3 Transition Animation

Between steps: horizontal slide using `Animated.timing` (300ms, easing `Easing.out(Easing.cubic)`). No library needed — translate X from +width to 0, exit translates to -width.

---

## Phase 3 — Today Tab Integration

### 3.1 Morning Ritual CTA Banner

In `app/(tabs)/index.tsx`, immediately below the greeting block:

```tsx
{!isMorningDone && (
  <TouchableOpacity onPress={() => router.push('/ritual/morning')}>
    <View style={ritualBannerStyle}>
      <Text>☀ Pick today's One →</Text>
    </View>
  </TouchableOpacity>
)}
```

Styled as a warm terracotta (`COLORS.accentWarm`) full-width strip with rounded bottom corners, 12px padding.

### 3.2 Must-do Highlight

When `isMorningDone`, the Today's Actions list finds the must-do action (matched by id from `intention.actions`) and renders it with:
- Left border 3px in `SPHERE_COLORS[sphere].accent`
- Small "★ must-do" mono label below the action text

Actions from the ritual intention appear first in the list (insertion order from `lockMorning`), above any free-added actions.

### 3.3 Evening Close CTA

At the bottom of Today tab (inside the ScrollView, after habits ribbon), if `isMorningDone && !isEveningDone`:

```tsx
<TouchableOpacity onPress={() => router.push('/ritual/evening')}>
  <Card style={eveningCtaStyle}>
    <Text>☾ Close the day</Text>
    <Text style={subStyle}>Take 60 seconds to reflect</Text>
  </Card>
</TouchableOpacity>
```

---

## Phase 4 — Evening Close Flow

### 4.1 `app/ritual/evening.tsx`

Four-screen paginator (horizontal scroll locked, controlled index). Each screen fills the viewport.

**Screen 0 — DoneReview** (`components/ritual/DoneReviewStep.tsx`):
- Heading: *"Here's what you did."*
- Renders all `intention.actions` as a static checklist (checkmark style matching Today tab). Done items shown with strikethrough + sphere color. Undone shown in ink4.
- Must-do shown first with ★ label.
- User can toggle completions here → dispatches `toggleRitualAction()` → patches Supabase.
- CTA: "Next →"

**Screen 1 — JournalLine** (`components/ritual/JournalLineStep.tsx`):
- Heading: *"One line. How was today?"*
- Single `TextInput`, large font (displayItalic 24px), centered, max 280 chars.
- Placeholder: AI-generated suggestion (see Phase 5) or static fallback: *"Today I chose..."*
- Char count mono label bottom-right.
- CTA: "Next →" (journal line is optional — can skip)

**Screen 2 — TomorrowPick** (`components/ritual/TomorrowPickStep.tsx`):
- Same SphereSelectStep UI, different heading: *"Tomorrow's One."*
- Pre-selects the sphere with the lowest score from `SPHERE_SCORES` (nudge toward balance).
- CTA: "Close the day →"

**Screen 3 — CloseCelebration** (`components/ritual/CloseCelebrationStep.tsx`):
- Calls `closeEvening(journalLine, nextSphere)` on mount.
- **Streak animation**: large number counts up from `USER.streak` to `USER.streak + 1` using `Animated.timing` on an interpolated value (0 → 1 over 800ms, then display `Math.round(interpolated * targetStreak)`).
- **Sphere score delta**: show `▲ +N` beside the focus sphere's score (computed client-side: `doneFraction * 5` points, capped at 5).
- **Shareable card**: a plain `View` rendered at fixed 375×200px, positioned offscreen (absolute, left: -1000), containing: Goalify wordmark, date, focus sphere, streak count, one-line journal excerpt. Button "Share" → `Share.share({ message: cardText })` for MVP (native share sheet with text). Full image share deferred to v2.
- Haptic: `Haptics.notificationAsync(NotificationFeedbackType.Success)`
- CTA: "Done" → `router.replace('/(tabs)/')`

---

## Phase 5 — Action Proposal (AI Stub)

### 5.1 `lib/ritual-coach.ts`

```typescript
export function proposeMorningActions(
  sphere: SphereId,
  goals: Goal[],
  habits: HabitItem[],
): RitualAction[]
```

**MVP logic** (deterministic, no API call):
1. Collect all incomplete subtasks from goals where `goal.sphere === sphere`. Take top 2.
2. Collect habits where `habit.sphere === sphere && !habit.doneToday`. Take top 1.
3. If fewer than 3, fill with sphere-generic fallbacks from a static lookup table per sphere.
4. Return exactly 3, shuffled (Fisher-Yates on the array before returning).

**Pro placeholder** (guarded by feature flag in `constants/flags.ts`):
```typescript
// When PRO_RITUAL_AI === true, call Supabase Edge Function
// that calls Claude API with goals/habits/journal context.
```

### 5.2 Evening Journal Suggestion

```typescript
export function suggestJournalLine(
  sphere: SphereId,
  mustDoDone: boolean,
): string
```

Static lookup: 3 templates per sphere × done/not-done = 24 strings. Randomly selected. No API call in MVP.

---

## Phase 6 — Notifications

### 6.1 `lib/notifications.ts` API surface

```typescript
// Call once after morning ritual is locked — cancels morning, schedules lunch + evening.
scheduleRitualNotifications(userId: string, mustDoDone: boolean): Promise<void>

// Call at app launch — reschedules any notifications that may have lapsed.
ensureNotificationsScheduled(intention: DailyIntention | null): Promise<void>

// Call when evening close completes — cancels tonight's remaining notifications.
cancelTodayNotifications(): Promise<void>
```

### 6.2 Notification Schedule Logic

All times are **local device time** via `expo-notifications` calendar triggers.

| Notification | Time | Condition | Body |
|---|---|---|---|
| Morning ritual | 6:00 AM | Always (if no intention exists for today) | "Pick today's One. 30 seconds, then you're set." |
| Lunch nudge | 12:30 PM | `must_do_done === false` at time of scheduling (morning lock) | "Your One still needs you. Quick check-in?" |
| Evening close | 9:30 PM | `closed_at === null` | "Close the day. See your streak." |

**Snooze**: Not a separate notification — the morning notification fires once. If user taps "Later" in the in-app banner, set a local flag `ritualSnoozedAt` and re-show the banner 2 hours later (no second push; purely in-app logic via a stored timestamp in `AsyncStorage`).

**Permission request**: Prompt at morning ritual first entry via `Notifications.requestPermissionsAsync()`. If denied, ritual works identically without push (CTA banner on app open covers the use case).

### 6.3 Deep Link Routing

`app.config.js` scheme: `goalify` (assumed already set for OAuth).

In `app/_layout.tsx`, add:
```typescript
Notifications.addNotificationResponseReceivedListener(response => {
  const screen = response.notification.request.content.data?.screen;
  if (screen === 'morning') router.push('/ritual/morning');
  if (screen === 'evening') router.push('/ritual/evening');
});
```

---

## Phase 7 — Testing

### 7.1 Unit Tests (`__tests__/daily-ritual.test.ts`)

- `lockMorning` inserts row and sets `isMorningDone = true`
- `toggleRitualAction` flips done flag and recomputes `must_do_done`
- `closeEvening` sets `closed_at` and `journal_line`
- Already-closed day: `closeEvening` is a no-op
- `proposeMorningActions`: returns exactly 3 items, must-do defaults to false, all items belong to the sphere or are fallbacks

### 7.2 Integration Tests (`__tests__/daily-ritual.integration.test.ts`)

Against local Supabase (`supabase start`):
- `UNIQUE(user_id, date)` constraint rejects duplicate insert
- RLS: user A cannot read user B's row
- `closed_at` update requires owning row (RLS update policy)

---

## Implementation Order

| # | Task | File(s) | Notes |
|---|---|---|---|
| 1 | Install `expo-notifications` | `package.json`, `app.config.js` | Gate on this before any notification code |
| 2 | Write migration | `supabase/migrations/0004_daily_intentions.sql` | Run `supabase db push` locally |
| 3 | Types + store hook | `store/daily-ritual.tsx` | No UI dependency |
| 4 | Action proposal stub | `lib/ritual-coach.ts` | No UI dependency |
| 5 | Notification helper | `lib/notifications.ts` | No UI dependency |
| 6 | Ritual route layout | `app/ritual/_layout.tsx` | |
| 7 | Morning flow screens | `components/ritual/Sphere*, ActionPick*, LockConfirm*` + `app/ritual/morning.tsx` | Can mock `useDailyRitual` |
| 8 | Today tab integration | `app/(tabs)/index.tsx` | Morning CTA + must-do highlight + evening CTA |
| 9 | Evening flow screens | `components/ritual/Done*, JournalLine*, TomorrowPick*, CloseCelebration*` + `app/ritual/evening.tsx` | |
| 10 | Wire notifications | `app/_layout.tsx` | Listener + permission request in morning flow |
| 11 | Unit + integration tests | `__tests__/daily-ritual.*` | |

---

## Complexity Tracking

| Risk | Mitigation |
|---|---|
| Notification permission denied | Banner-only fallback; no hard fail |
| Duplicate notification sends | `expo-notifications` identifier-based cancellation before re-schedule |
| `UNIQUE(user_id, date)` race (double-tap Lock) | `upsert` with `ignoreDuplicates: true` on client; UI disables button after first tap |
| Streak increment correctness | Streak is still in `USER` constant (mock data). Real streak lives in `profiles` table. Animate optimistically; backend reconciles on next session. For MVP, increment local only. |
| Action proposal mismatch (wrong sphere) | `proposeMorningActions` validates sphere on every returned item; falls back to static pool |
| Shareable card image (deferred) | MVP uses native text share; v2 uses `react-native-view-shot` |

---

## Monetization Gate

```typescript
// constants/flags.ts
export const PRO_RITUAL_AI = false;       // AI-curated morning actions
export const PRO_RITUAL_SOUND = false;    // Ambient sound on close
```

Free tier: full morning/evening ritual, streak, static card.  
Pro tier (future): AI-curated actions from Claude, ambient sound, image share card with Goalify branding.
