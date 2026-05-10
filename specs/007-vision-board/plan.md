# Implementation Plan: Vision Board → Living Mood Film

**Branch**: `007-vision-board-living-mood-film` | **Date**: 2026-05-10  
**Priority**: High Impact | **Difficulty**: MVP medium-high, Scaling medium  
**Monetization**: Pro feature — primary upgrade trigger

## Summary

Replace the four hand-coded gradients in the goal cards with a generated 4-image set per goal, each image tied to a progress stage. Tapping the vision banner opens a full-screen "Living Mood Film" modal: one ambient loop, the stage-correct image, and the goal's caption. As subtasks complete and `goal.progress` crosses stage thresholds, the image advances automatically. A generation queue (Supabase Edge Function calling fal.ai) controls cost; free tier gets one generation per goal and one regen per week; Pro gets unlimited regens + the audio loop. Suno API and native widgets are deferred to v2.

---

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81  
**Primary Dependencies (existing)**: Expo SDK 54, expo-router 6, `@supabase/supabase-js` v2, `react-native-reanimated` 3, `expo-haptics`  
**New Dependencies**:
- `expo-image` ~2.0 — disk-cached `Image` component with fade-in
- `expo-av` ~15.0 — audio playback for ambient loops
**Image Generation**: fal.ai REST API (`fal-ai/flux/schnell` for speed, img-to-img for stage continuity)  
**Audio (MVP)**: 4 curated ambient loops bundled in `assets/audio/`, one per sphere  
**Storage**: Supabase Storage bucket `vision-assets`  
**Testing**: jest + jest-expo. Unit tests for stage selector, prompt builder, rate-limit guard.  
**Target Platform**: iOS 15+, Android 7+  
**Performance Goals**: Vision banner image first paint ≤ 200ms (disk cache hit). Film modal open ≤ 300ms.  
**Constraints**: Never block goal card render on image fetch. Gradient fallback must be pixel-identical to current design. Generation must be idempotent (re-requesting an already-generated stage returns cached URL, does not re-bill).

---

## Architecture Decisions

### Image Generation — fal.ai
- Endpoint: `fal-ai/flux/schnell` for fast MVP generation (~1.5 s/image at $0.003)
- Stage 0 is text-to-image; stages 1–3 use image-to-image from the previous stage's output to maintain visual continuity
- Seed per goal: `abs(hashDjb2(goal.id)) % 2_147_483_647` — deterministic, survives regens
- 4 images per goal = $0.012 total generation cost
- Free tier: 1 auto-generation on goal creation, 1 manual regen per 7 days  
- Pro tier: unlimited regens

### Storage — Supabase Storage
- Bucket `vision-assets`, authenticated (not public)
- Path: `{user_id}/{goal_id}/stage_{0-3}.jpg`
- Signed URLs with 2-hour TTL, cached client-side in the store

### Audio (MVP) — Bundled
- 4 loops at `assets/audio/ambient_{sphere}.m4a`, ~6 seconds each, exported at 96 kbps
- Looped via `expo-av` `Audio.Sound` with `isLooping: true`
- Suno API integration deferred to v2 (API not yet stable for production use)

### Generation Queue
- Triggered by: goal creation (auto), manual regen button, future cron
- Idempotency key: `(goal_id, stage, prompt_hash)` — same prompt never re-bills
- Edge Function enforces 7-day cooldown; client also gates the regen button from `vision_assets` metadata

---

## Project Structure

### Documentation (this feature)

```text
specs/007-vision-board/
├── plan.md              # This file
└── data-model.md        # Phase 1 output (DB schema + types)
```

### Source Code

```text
app/
└── vision/
    ├── _layout.tsx          # NEW — Stack, fullScreenModal, no header
    └── [goalId].tsx         # NEW — Living Mood Film fullscreen modal

supabase/
├── functions/
│   └── generate-vision/
│       └── index.ts         # NEW — Edge Function: calls fal.ai, stores to bucket
└── migrations/
    └── 0005_vision_assets.sql  # NEW

store/
└── vision.tsx               # NEW — useVisionAssets() hook, signed URL cache

lib/
├── vision-prompts.ts        # NEW — prompt builder per sphere + progress stage
└── vision-seed.ts           # NEW — deterministic seed from goal.id

components/
└── vision/
    ├── VisionBanner.tsx     # NEW — replaces LinearGradient in goal cards
    └── FilmOverlay.tsx      # NEW — caption + stage pill + regen button

assets/
└── audio/
    ├── ambient_finance.m4a  # NEW — add before ship
    ├── ambient_health.m4a   # NEW
    ├── ambient_career.m4a   # NEW
    └── ambient_relationships.m4a  # NEW

constants/
└── flags.ts                 # EDIT — add PRO_VISION_REGEN, PRO_VISION_AUDIO

__tests__/
├── vision-stage.test.ts     # NEW — stageFromProgress(), prompt builder
└── vision-regen.test.ts     # NEW — rate-limit guard, idempotency key
```

---

## Phase 0 — Prerequisites

### 0.1 Install expo-image and expo-av

```bash
npx expo install expo-image expo-av
```

`expo-image` replaces `<Image>` for all vision imagery — it provides disk caching and the `transition` prop for graceful fade-in without a visible loading state.

### 0.2 Supabase Storage bucket

```sql
-- Run in Supabase dashboard or via migration
INSERT INTO storage.buckets (id, name, public)
VALUES ('vision-assets', 'vision-assets', false);

CREATE POLICY "vision_assets_select_own"
  ON storage.objects FOR SELECT
  USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "vision_assets_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
```

### 0.3 Feature flags

Add to `constants/flags.ts`:

```typescript
export const PRO_VISION_REGEN  = false;  // Unlimited image regeneration
export const PRO_VISION_AUDIO  = false;  // Ambient audio loop in Film modal
```

---

## Phase 1 — Data Layer

### 1.1 Migration: `vision_assets`

**File**: `supabase/migrations/0005_vision_assets.sql`

```sql
CREATE TABLE IF NOT EXISTS public.vision_assets (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id         text        NOT NULL,
  stage           smallint    NOT NULL CHECK (stage BETWEEN 0 AND 3),
  -- 0 = 0-24%, 1 = 25-49%, 2 = 50-74%, 3 = 75-100%
  storage_path    text        NOT NULL,
  prompt_hash     text        NOT NULL,
  seed            bigint      NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','generating','ready','error')),
  error_msg       text,
  generated_at    timestamptz,
  last_regen_at   timestamptz,
  regen_count     int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_id, stage)
);

ALTER TABLE public.vision_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vision_assets_select_own"
  ON public.vision_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "vision_assets_insert_own"
  ON public.vision_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vision_assets_update_own"
  ON public.vision_assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Design notes**:
- `UNIQUE(user_id, goal_id, stage)` — one row per progress stage per goal; upsert-safe
- `prompt_hash` enables idempotency: if the prompt hasn't changed, the Edge Function skips generation and returns the existing `storage_path`
- `status` column drives the client-side loading state (gradient fallback while `pending`/`generating`)
- `goal_id` is text (matches local store IDs like `'g1'`); when Supabase goals table lands it becomes a FK

### 1.2 TypeScript Types

```typescript
// store/vision.tsx — top-level types

export type VisionStage = 0 | 1 | 2 | 3;

export type VisionAsset = {
  id: string;
  goal_id: string;
  stage: VisionStage;
  storage_path: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  last_regen_at: string | null;
  regen_count: number;
  // Client-side only (not in DB):
  signedUrl?: string;
  signedUrlExpiresAt?: number;
};
```

### 1.3 Store Hook: `useVisionAssets(goalId)`

```typescript
// store/vision.tsx

type VisionState = {
  assets: Record<VisionStage, VisionAsset | null>;  // keyed by stage
  currentStage: VisionStage;
  isLoading: boolean;
  error: string | null;
};

// Derived:
//   currentAsset  = assets[currentStage]
//   signedUrl     = currentAsset?.signedUrl (refresh if expiresAt < now + 5m)

// Actions:
//   fetchAssets(goalId)           — SELECT all stages, resolve signed URLs
//   requestGeneration(goalId)     — POST to generate-vision Edge Function
//   requestRegen(goalId, stage)   — POST with regen=true; respects rate limit
//   refreshSignedUrl(goalId, stage) — call supabase.storage.createSignedUrl()
```

**Signed URL caching**: Store `signedUrl` + `signedUrlExpiresAt` in-memory in the hook. Re-fetch when within 5 minutes of expiry. Never store signed URLs in Supabase DB.

### 1.4 Stage Selector

```typescript
// lib/vision-stage.ts

export function stageFromProgress(progress: number): VisionStage {
  if (progress < 0.25) return 0;
  if (progress < 0.50) return 1;
  if (progress < 0.75) return 2;
  return 3;
}
```

---

## Phase 2 — Prompt Builder

**File**: `lib/vision-prompts.ts`

```typescript
export type PromptContext = {
  sphere: SphereId;
  stage: VisionStage;
  goalTitle: string;  // used for light personalization, NOT user PII
};

export function buildPrompt(ctx: PromptContext): string
export function promptHash(prompt: string): string  // SHA-256 hex, first 12 chars
```

### 2.1 Prompt Scaffolding per Sphere × Stage

The prompts use a **scene progression** pattern: same visual world, advancing state. Each sphere has a base scene; stage advances it.

| Sphere | Stage 0 | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|---|
| `finance` | Cluttered kitchen table, unopened envelopes, warm morning light | Kitchen table half-cleared, two open letters, coffee cup | Kitchen table clear, one bill stamped PAID, sun patch | Kitchen window with linen curtain, empty table, quiet confidence |
| `health` | Empty running shoes by a door, first light of dawn | A road at 6 AM, one runner in the distance, early mist | A runner mid-stride, open fields, golden hour | Finish line tape, quiet crowd, arms out |
| `career` | Blank notebook, half-sharpened pencil, grey desk | Notebook with rough sketches, coffee ring, sticky notes | Laptop screen with a working prototype, focused face (back view) | A design review, nodding colleagues, soft applause |
| `relationships` | Empty table set for six, unlit candles | Table with two people talking, warm light | Table full, laughter mid-sentence, wine raised | Same table, close-up of clasped hands, candle burned low |

**Style suffix** (appended to all prompts):  
`"Soft film grain, analog warmth, shallow depth of field, editorial still photography, no text, no logos, no faces (front-on), 4:3 crop"`

### 2.2 Prompt Personalization (Pro, guarded)

When `PRO_VISION_REGEN` is true and the Edge Function has access to the goal title, append:  
`", scene inspired by: [goalTitle]"` — only if goalTitle passes a content-safety length check (≤ 80 chars, no profanity).

---

## Phase 3 — Edge Function: `generate-vision`

**File**: `supabase/functions/generate-vision/index.ts`

### 3.1 Request Schema

```typescript
type GenerateVisionRequest = {
  goal_id: string;
  goal_title: string;
  sphere: SphereId;
  regen?: boolean;             // false = only generate missing stages; true = regen specific stage
  regen_stage?: VisionStage;  // required when regen=true
};
```

### 3.2 Function Logic

```
1. Authenticate caller via Authorization header (Supabase JWT)
2. Load existing vision_assets rows for this goal_id + user_id
3. For each stage 0–3 (or just regen_stage if regen=true):
   a. Build prompt via buildPrompt()
   b. Compute promptHash
   c. If row exists AND status='ready' AND prompt_hash matches → skip (idempotent)
   d. If regen=true AND last_regen_at > now() - 7 days AND !PRO_VISION_REGEN → return 429
   e. Upsert row with status='generating'
   f. Call fal.ai REST API:
      - Stage 0: text-to-image with seed
      - Stages 1–3: image-to-image, passing stage N-1 storage URL as init_image, strength=0.55
   g. Download result image
   h. Upload to Supabase Storage at {user_id}/{goal_id}/stage_{n}.jpg
   i. Update row: status='ready', storage_path, generated_at, prompt_hash
4. Return array of { stage, storage_path, status }
```

### 3.3 Error Handling

- fal.ai timeout (>10s): mark row `status='error'`, return error for that stage only; other stages still proceed
- Storage upload failure: retry once; if fails, mark error
- Client receives partial success gracefully — gradient fallback shown for errored stages

### 3.4 Environment Variables (Edge Function)

```
FAL_API_KEY           # fal.ai API key
SUPABASE_URL          # already available in Edge Function runtime
SUPABASE_SERVICE_ROLE_KEY  # for storage write (bypass RLS)
```

---

## Phase 4 — VisionBanner Component

**File**: `components/vision/VisionBanner.tsx`

This replaces the `<LinearGradient>` block inside goal cards in `app/(tabs)/goals.tsx`.

### 4.1 Props

```typescript
type VisionBannerProps = {
  goalId: string;
  sphere: SphereId;
  progress: number;     // 0–1
  caption: string;
  onPress: () => void;  // opens Film modal
};
```

### 4.2 Render Logic

```
1. Call useVisionAssets(goalId) — loads current stage asset
2. currentStage = stageFromProgress(progress)
3. If asset?.status === 'ready' && asset.signedUrl:
   → render <Image source={{ uri: signedUrl }} ... /> with expo-image
   → transition={{ duration: 300, effect: 'cross-dissolve' }}
4. Else (pending/generating/null):
   → render existing LinearGradient (VISION_TONES fallback) — zero regression
   → if status === 'generating': overlay a subtle pulse shimmer (opacity 0.2→0.5, 1200ms loop)
5. Caption overlay identical to current design
6. "Vision" chip top-left, unchanged
7. If status === 'generating': replace "Vision" chip text with "Generating…"
8. Entire banner is TouchableOpacity → onPress opens Film modal
```

**Triggering generation**: `useVisionAssets` calls `requestGeneration(goalId)` on mount if `assets` is empty (no rows exist yet). This is a fire-and-forget — the banner renders the fallback gradient immediately.

---

## Phase 5 — Living Mood Film Modal

### 5.1 Route

`app/vision/_layout.tsx`: Stack, `presentation: 'fullScreenModal'`, `headerShown: false`, background `COLORS.ink1`.

`app/vision/[goalId].tsx`: receives `goalId` from router params.

### 5.2 Layout

```
Full screen, ink1 background.

┌─────────────────────────────────────┐
│                                     │  ← expo-image, full bleed, 100% height
│         generated image             │     resizeMode="cover"
│                                     │
│                                     │
│                                     │
│  ┌ stage pill ──────── regen btn ┐  │  ← position: absolute, bottom 200
│  │  ● ○ ○ ○  Stage 1 of 4      ↺ │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ caption text (displayItalic) │  │  ← frosted card, bottom 60
│  │ goal title (mono, small)     │  │
│  └──────────────────────────────┘  │
│  [×] close                         │  ← top-right, 44pt tap target
└─────────────────────────────────────┘
```

### 5.3 Stage Pill

4 dots. Filled dot = current stage. Tapping a dot navigates to that stage's image (allows preview of future states). Future stages shown at 40% opacity (aspirational, not grayed out).

### 5.4 Ambient Audio

```typescript
// On modal mount, if PRO_VISION_AUDIO:
const sound = await Audio.Sound.createAsync(
  AMBIENT_AUDIO[sphere],   // require('../assets/audio/ambient_health.m4a') etc.
  { isLooping: true, volume: 0.25 }
);
await sound.playAsync();
// On modal unmount: sound.unloadAsync()
```

Free tier: Audio.Sound not loaded. A subtle lock icon appears beside the caption card with text "Ambient sound — Pro". Tap → upgrade sheet (stub for MVP).

### 5.5 Regen Button

`↺` icon, top-right of stage pill row.

- If `status === 'generating'`: spinner, disabled
- If `last_regen_at` within 7 days (free): shows lock icon, tap → "1 regen per week on free plan. Upgrade for unlimited."
- Otherwise: tap → confirm sheet ("Regenerate this vision? Takes ~10 seconds.") → calls `requestRegen(goalId, currentStage)`

---

## Phase 6 — Goals Tab Integration

**File**: `app/(tabs)/goals.tsx`

Two changes:

### 6.1 Replace LinearGradient with VisionBanner

```diff
- <LinearGradient colors={tone} start={…} end={…} style={{ height: 130 }}>
-   {/* Vision chip + caption */}
- </LinearGradient>
+ <VisionBanner
+   goalId={g.id}
+   sphere={g.sphere}
+   progress={g.progress}
+   caption={caption}
+   onPress={() => router.push(`/vision/${g.id}`)}
+ />
```

The `VISION_TONES` constant stays in `goals.tsx` as the fallback gradient source, passed into `VisionBanner` as a `fallbackColors` prop.

### 6.2 Trigger generation for existing goals on first load

In `GoalsScreen`:
```typescript
const { requestGeneration } = useVisionAssets();
useEffect(() => {
  state.goals.forEach(g => requestGeneration(g.id));
}, []);  // fire-and-forget on first mount; hook is idempotent
```

---

## Phase 7 — Trigger on Progress Change

When `TOGGLE_SUBTASK` advances `goal.progress` across a stage boundary, the new stage image should auto-request if it doesn't exist yet.

In `store/index.tsx` (wherever `TOGGLE_SUBTASK` is handled), after computing new progress:

```typescript
const oldStage = stageFromProgress(oldProgress);
const newStage = stageFromProgress(newProgress);
if (newStage !== oldStage) {
  // Signal to VisionBanner to fetch the new stage.
  // VisionBanner's useVisionAssets handles this automatically
  // because it re-evaluates stageFromProgress(progress) on render.
  // The hook calls requestGeneration if that stage has no row.
}
```

No explicit dispatch needed — the reactive pattern in `useVisionAssets` picks up the new stage on the next render of `VisionBanner`.

---

## Phase 8 — Deferred Features (v2)

| Feature | Reason deferred |
|---|---|
| Lock screen widget | Requires `expo-widgets` (native module, complex build config) |
| iOS Live Activity | Requires `expo-activity-kit` / native code |
| Suno API for music gen | API not publicly stable; rate limits and pricing unclear |
| img-to-img continuity | Requires storing stage 0 image URL server-side before generating stage 1 — adds Edge Function complexity; MVP generates all 4 independently with same seed |
| AI-personalized prompts | Guard behind `PRO_VISION_REGEN`; requires goal content in Edge Function |
| Video/animated cinemagraph | Post-MVP; requires a video generation endpoint (Kling, Runway) |

---

## Phase 9 — Testing

### 9.1 Unit Tests (`__tests__/vision-stage.test.ts`)

- `stageFromProgress(0)` → 0
- `stageFromProgress(0.24)` → 0
- `stageFromProgress(0.25)` → 1
- `stageFromProgress(0.74)` → 2
- `stageFromProgress(1.0)` → 3
- `buildPrompt({ sphere: 'finance', stage: 0, ... })` contains required keywords
- `promptHash` returns 8-char hex, deterministic

### 9.2 Unit Tests (`__tests__/vision-regen.test.ts`)

- Rate-limit guard: `canRegen(lastRegenAt: daysAgo(6))` → false (free)
- Rate-limit guard: `canRegen(lastRegenAt: daysAgo(8))` → true (free)
- Rate-limit guard: `canRegen(lastRegenAt: daysAgo(1), isPro: true)` → true
- Idempotency: calling `requestGeneration` twice with same goal doesn't double-insert

### 9.3 Component Smoke Tests

- `VisionBanner` renders gradient when asset status is 'pending'
- `VisionBanner` renders Image when asset status is 'ready' and signedUrl is set

---

## Implementation Order

| # | Task | File(s) | Notes |
|---|---|---|---|
| 1 | Install expo-image, expo-av | `package.json` | Gate all vision code on this |
| 2 | Feature flags | `constants/flags.ts` | Add PRO_VISION_REGEN, PRO_VISION_AUDIO |
| 3 | Migration + storage bucket | `supabase/migrations/0005_vision_assets.sql` | Run `supabase db push` locally |
| 4 | Prompt builder + seed + stage selector | `lib/vision-prompts.ts`, `lib/vision-seed.ts`, `lib/vision-stage.ts` | No UI dependency |
| 5 | Store hook | `store/vision.tsx` | Depends on migration |
| 6 | Edge Function scaffold | `supabase/functions/generate-vision/index.ts` | Stub fal.ai call first, wire real call second |
| 7 | VisionBanner component | `components/vision/VisionBanner.tsx` | Uses gradient fallback until edge function wired |
| 8 | Goals tab swap | `app/(tabs)/goals.tsx` | Replace LinearGradient, add onPress, trigger generation on mount |
| 9 | Film modal route | `app/vision/_layout.tsx`, `app/vision/[goalId].tsx` | |
| 10 | FilmOverlay component | `components/vision/FilmOverlay.tsx` | Stage pill + regen button + caption |
| 11 | Audio integration | `app/vision/[goalId].tsx` | Load audio assets, guard behind flag |
| 12 | Progress-change trigger | `store/index.tsx` | Verify no double-requests |
| 13 | Unit tests | `__tests__/vision-stage.test.ts`, `__tests__/vision-regen.test.ts` | |

---

## Complexity Tracking

| Risk | Mitigation |
|---|---|
| fal.ai latency (>10s) | Edge Function times out gracefully; client shows gradient; status='error' surfaced as "retry" button, not crash |
| Generated image quality is wrong tone | Curate prompt templates before launch; add `"no horror, no sadness, no urban decay"` negative prompt suffix |
| Signed URL expiry mid-scroll | `useVisionAssets` refreshes URL when `expiresAt < now + 5m`; `expo-image` caches to disk so a refresh failure doesn't blank a previously-seen image |
| Cost overrun | Rate-limit enforced server-side in Edge Function; free tier cap = 1 generation set on goal creation + 1 regen/week |
| iOS simulator has no FAL_API_KEY | Edge Function requires env var; local dev uses `supabase functions serve --env-file .env.local` |
| Audio assets not committed | Add `assets/audio/` to `.gitignore` exclusion; document download step in README |
| Expo-image vs Image API differences | `expo-image` `source` prop accepts `{ uri: string }` identically to RN Image — no API breakage |

---

## Monetization Gate

```typescript
// constants/flags.ts
export const PRO_VISION_REGEN  = false;  // Unlimited regeneration (free: 1/week)
export const PRO_VISION_AUDIO  = false;  // Ambient audio in Film modal
```

Free tier: 1 auto-generated 4-image set per goal, 1 manual regen per 7 days, no audio.  
Pro tier: unlimited regens, ambient audio, AI-personalized prompts (v2), video cinemagraph (v2).

**Upgrade trigger**: The regen button and the audio lock in the Film modal both route to an upgrade sheet. This is the highest-intent upgrade moment in the app — the user is already looking at their vision.
