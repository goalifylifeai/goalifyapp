# Feature 007: Vision Board → Living Mood Film — Implementation Summary

**Date**: 2026-05-10  
**Branch**: `007-vision-board-living-mood-film`  
**Status**: MVP complete. Pending: `supabase db push`, `npx expo install expo-av`, FAL_API_KEY env var, audio asset files.

---

## What was built

The four hand-coded gradients in the Goals tab vision banner are replaced by AI-generated images (one per progress stage, four per goal). Tapping the banner opens a full-screen "Living Mood Film" modal with the stage-correct image, stage navigation dots, a regen button, and a caption overlay. Image generation runs via a Supabase Edge Function calling the fal.ai FLUX Schnell model. Free users get one auto-generation on goal creation and one manual regen per 7 days; Pro users get unlimited regens and ambient audio.

---

## Files created

### Constants & feature flags
| File | What it does |
|---|---|
| `constants/flags.ts` | `PRO_VISION_REGEN` and `PRO_VISION_AUDIO` (both `false` for free tier MVP) |

### Library utilities
| File | What it does |
|---|---|
| `lib/vision-stage.ts` | `stageFromProgress(progress)` — maps 0–1 progress to stage 0–3; `STAGE_LABELS` map |
| `lib/vision-seed.ts` | `seedFromGoalId(goalId)` — deterministic fal.ai seed via DJB2 hash of goal ID |
| `lib/vision-prompts.ts` | `buildPrompt({ sphere, stage })` — 16 curated scene descriptions (4 spheres × 4 stages) + style suffix; `promptHash(prompt)` for idempotency |

### Database
| File | What it does |
|---|---|
| `supabase/migrations/0005_vision_assets.sql` | `vision_assets` table — one row per user per goal per stage (0–3); tracks `status`, `storage_path`, `prompt_hash`, `seed`, `last_regen_at`, `regen_count`; RLS enforced |

### Store
| File | What it does |
|---|---|
| `store/vision.tsx` | `VisionAssetsProvider` + `useVisionAssets()` hook — loads all vision assets for the current user on mount, caches signed Supabase Storage URLs (2-hour TTL with 5-minute pre-refresh buffer), exposes `requestGeneration`, `requestRegen`, `canRegen`, `getSignedUrl` |

### Supabase Edge Function
| File | What it does |
|---|---|
| `supabase/functions/generate-vision/index.ts` | Deno function — authenticates caller via JWT, builds prompts, calls `fal.ai/flux/schnell` (text-to-image, same seed for all 4 stages), downloads result, uploads to Supabase Storage bucket `vision-assets` at `{user_id}/{goal_id}/stage_{n}.jpg`, writes final status back to DB; enforces 7-day regen cooldown server-side; idempotent (skips stages where `prompt_hash` already matches) |

### Components
| File | What it does |
|---|---|
| `components/vision/VisionBanner.tsx` | Replaces the `LinearGradient` block inside each goal card — renders fallback gradient until image is ready, cross-fades to generated image, shows animated shimmer while generating, fires `requestGeneration` on first mount if no asset exists |
| `components/vision/FilmOverlay.tsx` | Stage dot navigation (4 tappable dots), regen button with rate-limit alert, frosted caption card, goal title label — all overlaid on the Film modal |

### Routes
| File | What it does |
|---|---|
| `app/vision/_layout.tsx` | `fullScreenModal` Stack layout for vision routes, dark background, fade animation |
| `app/vision/[goalId].tsx` | Living Mood Film screen — full-bleed image with `Animated.Image` cross-fade on stage change, dark scrim for legibility, close button, `FilmOverlay`, ambient audio hook (guarded behind `PRO_VISION_AUDIO` flag, dynamic import of `expo-av`) |

### Tests
| File | What it covers |
|---|---|
| `__tests__/vision-stage.test.ts` | 17 tests: `stageFromProgress` boundary cases, `buildPrompt` content + sphere/stage coverage, `promptHash` format + determinism, `seedFromGoalId` range + determinism |
| `__tests__/vision-regen.test.ts` | 8 tests: free-tier rate-limit guard (6 days = blocked, 8 days = allowed, null = allowed), Pro bypass, idempotency key equality |

---

## Files edited

| File | Change |
|---|---|
| `app/(tabs)/goals.tsx` | Removed `LinearGradient` import; replaced the gradient JSX block with `<VisionBanner>`; imported `VISION_CAPTIONS` from `constants/data` (removed local duplicate); added `router.push('/vision/${g.id}')` as `onPress` |
| `app/_layout.tsx` | Added `VisionAssetsProvider` import + wrapping in the provider tree (inside `DailyRitualProvider`); added `<Stack.Screen name="vision" />` to the root Stack |

---

## Architecture decisions

| Decision | Choice | Reason |
|---|---|---|
| Image generation | fal.ai `flux/schnell` | ~$0.003/image, ~1.5s generation, supports deterministic seed |
| All 4 stages | Independent text-to-image with same seed | Avoids sequential img-to-img dependency in Edge Function; visual consistency comes from seed alone. img-to-img continuity is a v2 enhancement |
| Storage | Supabase Storage `vision-assets` bucket | Already in stack; no additional service needed |
| Signed URLs | 2-hour TTL, cached in-memory, refreshed 5 min before expiry | Avoids re-fetching on every render while not storing stale URLs |
| Audio (MVP) | Dynamic import of `expo-av`, guarded by `PRO_VISION_AUDIO = false` | Suno API not stable for production; bundled audio files are a placeholder path |
| Generation trigger | Fire-and-forget on `VisionBanner` mount | No loading state on the Goals tab — gradient shows immediately, image fades in when ready |
| Rate limiting | Server-side in Edge Function + client-side UI gate | Defense in depth; client gate avoids unnecessary invocations |

---

## What is NOT done (v2)

| Feature | Reason deferred |
|---|---|
| Lock screen widget | Requires native module (`expo-widgets`); complex build config |
| iOS Live Activity | Requires native code (`expo-activity-kit`) |
| Suno API ambient music | API not publicly stable for production use |
| img-to-img stage continuity | Requires sequential generation in Edge Function; seed-only is good enough for MVP |
| AI-personalized prompts | Guarded behind `PRO_VISION_REGEN`; needs goal content passed to Edge Function |
| Video cinemagraph | Requires video generation API (Kling, Runway); post-MVP |
| `expo-image` disk cache | `VisionBanner` uses RN's built-in `Image`; upgrade when `expo-image` is installed |

---

## Setup steps to activate

1. **Apply migrations**
   ```bash
   supabase db push
   ```

2. **Create storage bucket** (if not done via migration comment)
   Run in Supabase dashboard SQL editor:
   ```sql
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('vision-assets', 'vision-assets', false)
   ON CONFLICT DO NOTHING;
   ```

3. **Set Edge Function env var**
   ```bash
   supabase secrets set FAL_API_KEY=your_key_here
   ```
   For local dev: add `FAL_API_KEY=...` to `.env.local` and run:
   ```bash
   supabase functions serve generate-vision --env-file .env.local
   ```

4. **Install expo-av** (needed when `PRO_VISION_AUDIO` is enabled)
   ```bash
   npx expo install expo-av
   ```

5. **Add audio assets** (when ready to enable Pro audio)
   Place files at:
   ```
   assets/audio/ambient_finance.m4a
   assets/audio/ambient_health.m4a
   assets/audio/ambient_career.m4a
   assets/audio/ambient_relationships.m4a
   ```
   Then uncomment the `require()` lines in `app/vision/[goalId].tsx` and set `PRO_VISION_AUDIO = true` in `constants/flags.ts`.
