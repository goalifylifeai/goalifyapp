# Phase 0 Research: User Onboarding & Auth (Supabase)

## Decisions

### D1. Supabase JS client v2 with custom secure storage adapter

- **Decision**: Use `@supabase/supabase-js` v2, configured with a storage adapter backed by `expo-secure-store` for session persistence. Set `auth: { storage: SecureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }`.
- **Rationale**: v2 is the current major and only supported line; `detectSessionInUrl` must be false on React Native (no `window.location`). Default storage is `localStorage` (web-only); on RN we must supply our own. `expo-secure-store` uses iOS Keychain and Android Keystore — meeting FR-017.
- **Alternatives considered**:
  - AsyncStorage: rejected — not encrypted at rest, fails security requirement.
  - `react-native-mmkv` with encryption key in Keychain: faster, but extra dependency and indirection. Reserve for if profiling shows secure-store is a bottleneck (it isn't for session reads).

### D2. Apple Sign-In via `expo-apple-authentication`, Google via `expo-auth-session` PKCE flow

- **Decision**: On iOS, use `expo-apple-authentication` to obtain an Apple ID token, then call `supabase.auth.signInWithIdToken({ provider: 'apple', token })`. For Google on both iOS and Android, use `expo-auth-session/providers/google` to run the PKCE flow against Google's OAuth endpoint and pass the `id_token` to `supabase.auth.signInWithIdToken({ provider: 'google', token })`.
- **Rationale**: `signInWithIdToken` is the recommended path for native OAuth (no in-browser redirect dance, no deep-link round-trip). Apple Sign-In is required by App Store guideline 4.8 because we offer Google OAuth.
- **Alternatives considered**:
  - `supabase.auth.signInWithOAuth` + `expo-web-browser` redirect: rejected for native — adds a browser hop and a fragile deep-link return; only useful on web.
  - Native Google Sign-In SDK (`@react-native-google-signin/google-signin`): more native UX but requires a config plugin and Firebase project setup. Defer unless `expo-auth-session` UX proves poor.

### D3. Route grouping with expo-router for auth gating

- **Decision**: Create three route groups: `(auth)`, `(onboarding)`, `(tabs)`. In the root `_layout.tsx`, an `AuthGate` component reads session + profile + onboarding state from `AuthProvider`/`useOnboarding` and calls `router.replace()` to the correct group on every state change.
- **Rationale**: Groups keep URL paths clean and let each group own its layout (different headers, no tab bar in auth/onboarding). Centralized redirect avoids per-screen guards.
- **Alternatives considered**:
  - Conditional rendering of `<Slot />` based on auth state: works but loses URL-driven navigation and breaks deep-link handling for password reset.
  - Per-screen `<Redirect />`: scattered, easy to miss, race-prone with async session restore.

### D4. Profiles auto-created by Postgres trigger on `auth.users` insert

- **Decision**: Add a `handle_new_user()` plpgsql function + `on_auth_user_created` trigger that inserts a `profiles` row and an `onboarding_state` row whenever a new `auth.users` row is created.
- **Rationale**: Idempotent, atomic with sign-up. Avoids a client round-trip on first sign-in and prevents the "signed in but no profile row yet" race. Standard Supabase pattern.
- **Alternatives considered**:
  - Client-side upsert on first sign-in: race condition between OAuth callback and first PostgREST call; also requires INSERT permission on profiles, complicating RLS.
  - Edge function on auth webhook: more moving parts; trigger is simpler and runs in the same transaction.

### D5. RLS policies use `auth.uid() = user_id`

- **Decision**: Enable RLS on `profiles` and `onboarding_state`. Policies:
  - `select`: `auth.uid() = user_id`
  - `update`: `auth.uid() = user_id` (USING and WITH CHECK)
  - `insert`: deny client (handled by trigger)
  - `delete`: deny client (cascades from `auth.users` deletion)
- **Rationale**: Simplest model that meets SC-005. Insert/delete locked down because the trigger and cascade handle them.
- **Alternatives considered**:
  - Allow client INSERT: would require careful WITH CHECK and opens an attack surface; trigger is cleaner.
  - Use a single `users` table with all fields: couples profile cadence to onboarding cadence; separate tables let onboarding be wiped/replayed independently.

### D6. Onboarding state machine: server-authoritative, client-cached

- **Decision**: Store `current_step` (enum: `name | spheres | tone | pronouns | complete`), `selections` (jsonb), `completed_at` (timestamptz, nullable) on `onboarding_state`. Each step's "Next" button performs an UPDATE via PostgREST and on success advances local state. On app launch, fetch onboarding row; if `completed_at IS NULL`, route into `(onboarding)` at `current_step`.
- **Rationale**: Satisfies FR-013 (resume on any device) and the FR-014 / SC-004 cross-device sync requirement. Server is source of truth; client is cache.
- **Alternatives considered**:
  - Client-only with eventual sync: fails the cross-device acceptance scenario.
  - One column per step: harder to evolve onboarding without migrations; jsonb is appropriate for a small evolving structured blob.

### D7. Account deletion via Edge Function with service-role key

- **Decision**: Add a Supabase Edge Function `delete-account` that the authenticated user invokes. The function verifies the JWT, then calls `supabase.auth.admin.deleteUser(user.id)` using the service role key (kept server-side). Cascade from `auth.users` removes profile + onboarding rows.
- **Rationale**: `auth.admin.deleteUser` requires service role and must never be exposed to clients. Edge Function keeps the secret server-side and gives us a single audited entry point.
- **Alternatives considered**:
  - Soft delete (mark deleted): leaves PII; harder to honor deletion-rights regulations.
  - Skip self-serve deletion: blocks App Store review (Apple requires in-app account deletion when sign-up exists in-app).

### D8. Deep link scheme reuse for password reset

- **Decision**: Reuse the existing `goalify://` scheme. Configure Supabase Auth `redirectTo` as `goalify://reset-password`, register the route at `app/(auth)/reset-password.tsx`, parse the access token from the URL via `expo-linking`, and call `supabase.auth.updateUser({ password })`.
- **Rationale**: Scheme already declared in `app.json`. No new platform config.
- **Alternatives considered**:
  - Universal links (`https://goalify.app/...`): better UX (opens app from email without scheme prompt) but requires AASA/asset-links file hosting. Defer to v1.1.

### D9. Local Supabase stack for integration tests

- **Decision**: Use `supabase start` (Docker-based local stack) for the RLS integration test. CI can opt-in via env flag; local dev runs them via `npm run test:integration`. Unit tests mock the supabase client.
- **Rationale**: RLS correctness is a security-critical claim (SC-005); needs a real Postgres to verify. Mocked tests cannot prove RLS works.
- **Alternatives considered**:
  - Test against shared dev project: pollutes shared data, slow, requires network; rejected.
  - Skip RLS tests: unacceptable — primary security gate.

### D10. Environment configuration via `expo-constants` + `app.config.js`

- **Decision**: Convert `app.json` to `app.config.js` (already present in festivalstracker, not yet here) so we can read `process.env.SUPABASE_URL` and `SUPABASE_ANON_KEY` at build time and surface them via `Constants.expoConfig.extra`. `.env` is git-ignored; `.env.example` is committed.
- **Rationale**: Keeps secrets out of git and lets EAS Build inject environment-specific values.
- **Alternatives considered**:
  - Hardcode anon key: anon key is not a secret per se but rotating it requires a code change; env is the standard pattern.

## Open items resolved during research

- **Email confirmation policy**: Require for password reset & email change; allow sign-in pre-confirmation with a banner — matches Supabase defaults and balances friction vs. security.
- **OAuth account linking**: Defer automatic linking to v1.1; for v1, treat matching emails as separate accounts and surface a clear error ("an account with this email already exists, sign in with [method]"). Documented in spec edge cases.
- **Offline edits**: Profile updates use a simple "queue last write" approach via React state — no dedicated offline store. If user kills the app while offline mid-edit, that edit is lost. Acceptable for v1.

## Out of scope (deferred)

- Magic-link / OTP sign-in.
- Multi-factor auth (TOTP).
- Universal links for password reset.
- Server-side analytics for SC-006 dashboard.
- Migrating domain data (goals, habits, journal) to Supabase — separate feature.
