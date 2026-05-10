# Implementation Plan: User Onboarding & Auth (Supabase)

**Branch**: `001-user-onboarding-auth` | **Date**: 2026-05-09 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-user-onboarding-auth/spec.md`

## Summary

Add Supabase-backed authentication (email/password + Google + Apple OAuth), a server-side user profile, and persisted onboarding state to the existing Expo / React Native (expo-router) Goalify app. The current `StoreProvider` reducer remains the source of truth for in-app domain data (today actions, goals, habits, journal); a parallel `AuthProvider` wraps it and gates the route tree via expo-router groups: `(auth)` for unauthenticated, `(onboarding)` for newly-signed-up users, `(tabs)` for fully onboarded. Tokens are stored in `expo-secure-store`. Profile and onboarding rows are protected by Postgres row-level security with `auth.uid() = user_id` policies. Apple Sign-In is included to satisfy App Store guideline 4.8 since Google OAuth is offered.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81 (New Architecture enabled)
**Primary Dependencies**: Expo SDK 54, expo-router 6, `@supabase/supabase-js` v2, `expo-secure-store`, `expo-auth-session` (for Google OAuth web flow), `expo-apple-authentication` (for Apple Sign-In on iOS), `expo-web-browser`, `expo-linking` (already present).
**Storage**: Supabase Postgres (managed). Tables: `public.profiles`, `public.onboarding_state`. RLS enabled on both.
**Testing**: jest + jest-expo (already configured), `@testing-library/react-native`. Add a thin `supabase` mock module for unit tests; integration tests run against a Supabase local dev stack (`supabase start`) when available, otherwise skipped.
**Target Platform**: iOS 15+, Android 7+, web (expo web bundler is configured but auth is mobile-first; web parity is a stretch goal, not blocking).
**Project Type**: Mobile app (Expo React Native) + managed backend (Supabase). No custom backend service.
**Performance Goals**: Cold-launch to home tab ≤ 1s for an authenticated user with cached session (excluding font load). Onboarding step transitions ≤ 100ms perceived. Auth screen interactive ≤ 500ms.
**Constraints**: Tokens MUST live in secure keychain/keystore (no AsyncStorage). All RPC over HTTPS. RLS MUST prevent cross-user reads (verified in tests). Offline-first auth is out of scope; profile edits queue locally and flush on reconnect.
**Scale/Scope**: Initial target ≤ 10k users, well within Supabase free tier. Two new tables, ~6 new screens (auth landing, sign-in, sign-up, password-reset, 4-step onboarding flow), ~3 new providers/hooks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution at `.specify/memory/constitution.md` is the unfilled scaffold (placeholders only). No project-specific principles to gate against. Recommendation: run `/speckit-constitution` to capture project principles before `/speckit-tasks`. For this plan, no gate violations are tracked in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-onboarding-auth/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output
    ├── auth-api.md          # Supabase Auth client surface used
    ├── profile-api.md       # PostgREST contract for profiles
    └── onboarding-api.md    # PostgREST contract for onboarding_state
```

### Source Code (repository root)

```text
app/
├── _layout.tsx                  # Wrap with <AuthProvider>; redirect by auth/onboarding state
├── (auth)/                      # NEW - unauthenticated routes
│   ├── _layout.tsx
│   ├── index.tsx                # Landing (sign-in / sign-up CTAs, OAuth buttons)
│   ├── sign-in.tsx
│   ├── sign-up.tsx
│   └── reset-password.tsx
├── (onboarding)/                # NEW - signed-in but not yet completed
│   ├── _layout.tsx              # Stack with progress indicator
│   ├── name.tsx                 # Step 1: display name
│   ├── spheres.tsx              # Step 2: pick primary spheres
│   ├── tone.tsx                 # Step 3: coaching tone
│   └── pronouns.tsx             # Step 4: optional pronouns -> mark complete
├── (tabs)/                      # EXISTING - main app
│   └── ...
└── profile.tsx                  # EXISTING - rewire to read/write profile via supabase

components/
└── ui/                          # EXISTING - reuse Card, Pill, etc.

constants/
└── theme.ts                     # EXISTING

store/
├── index.tsx                    # EXISTING - domain reducer
├── auth.tsx                     # NEW - AuthProvider, useAuth(), session bootstrapping
├── profile.tsx                  # NEW - useProfile() hook (fetch/update/cache)
└── onboarding.tsx               # NEW - useOnboarding() hook

lib/
└── supabase.ts                  # NEW - typed Supabase client + secure-storage adapter

supabase/                        # NEW - managed via supabase CLI
├── config.toml
└── migrations/
    ├── 0001_profiles.sql
    └── 0002_onboarding_state.sql

__tests__/
├── auth.test.tsx                # NEW - sign-in/sign-up reducer + redirect logic
├── onboarding.test.tsx          # NEW - step machine, resume behavior
├── profile.test.tsx             # NEW - update/cache behavior
└── rls.integration.test.ts      # NEW - integration test against local supabase
```

**Structure Decision**: Mobile + managed-backend layout. No custom API server: the Supabase client speaks directly to PostgREST and GoTrue, with RLS enforcing access control. Route groups (`(auth)`, `(onboarding)`, `(tabs)`) replace ad-hoc gating logic. New providers (`auth`, `profile`, `onboarding`) live alongside the existing domain `store/index.tsx` and are composed in `app/_layout.tsx` so the existing reducer is untouched.

## Complexity Tracking

> No constitution violations identified — section intentionally empty.
