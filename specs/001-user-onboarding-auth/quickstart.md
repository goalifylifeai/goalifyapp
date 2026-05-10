# Quickstart: Building & running the auth/onboarding feature

## 1. Provision Supabase

```bash
# Install Supabase CLI (one-time, macOS)
brew install supabase/tap/supabase

# Initialize local config in repo (writes to supabase/)
supabase init

# Start local stack (Docker required)
supabase start
# Copy the printed API URL + anon key into .env (see step 3)
```

For cloud: create a project at supabase.com, then `supabase link --project-ref <ref>`. Migrations apply via `supabase db push`.

## 2. Add migrations

Create `supabase/migrations/0001_profiles.sql` and `0002_onboarding_state.sql` matching `specs/001-user-onboarding-auth/data-model.md`. Apply locally:

```bash
supabase db reset      # local only — recreates DB from migrations
```

## 3. Configure env

Create `.env` in repo root (gitignored):

```
SUPABASE_URL=http://127.0.0.1:54321        # or your cloud project URL
SUPABASE_ANON_KEY=eyJhbGciOi...
GOOGLE_OAUTH_IOS_CLIENT_ID=...
GOOGLE_OAUTH_ANDROID_CLIENT_ID=...
GOOGLE_OAUTH_WEB_CLIENT_ID=...             # used by expo-auth-session for token exchange
```

Convert `app.json` → `app.config.js` so values surface in `Constants.expoConfig.extra`. Commit `.env.example` with empty values.

## 4. Install client deps

```bash
npx expo install @supabase/supabase-js expo-secure-store expo-auth-session expo-web-browser expo-apple-authentication
```

## 5. Wire it up

- `lib/supabase.ts` — create the client with the SecureStore adapter (see contracts/auth-api.md).
- `store/auth.tsx` — `<AuthProvider>` exposing `{ session, user, signIn, signUp, signOut, signInWithGoogle, signInWithApple, requestPasswordReset }`.
- `store/profile.tsx` — `useProfile()` hook.
- `store/onboarding.tsx` — `useOnboarding()` hook with step advancer.
- `app/_layout.tsx` — wrap existing tree: `<AuthProvider><StoreProvider><AuthGate>{children}</AuthGate></StoreProvider></AuthProvider>`.
- `app/(auth)/`, `app/(onboarding)/` — new route groups; see plan.md project structure for the exact file list.

## 6. Run

```bash
npm start            # expo start
# press i / a for iOS / Android
```

## 7. Validate

```bash
npm test                                       # unit tests (jest)
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
  SUPABASE_TEST_ANON_KEY=... \
  npm run test:integration                     # RLS test against local stack
```

Manual smoke checklist (matches spec acceptance scenarios):

- [ ] Email sign-up creates user, sends confirmation, lands on onboarding step 1.
- [ ] Force-quit during onboarding step 2 → reopen → resumes on step 2 with values.
- [ ] Sign in on a second device after completing onboarding on the first → lands on tabs.
- [ ] Google sign-in (iOS + Android) creates account and routes correctly.
- [ ] Apple sign-in (iOS) creates account and routes correctly.
- [ ] Sign out clears session; reopening app shows auth landing.
- [ ] Forgot-password email arrives, deep link opens reset screen, new password works.
- [ ] Profile name edit persists across device restart and second-device sign-in.
- [ ] Account deletion removes user; profile + onboarding rows are gone (verify via `supabase db` or psql).
- [ ] RLS test: as user A, try to SELECT user B's profile → 0 rows; try UPDATE → 0 rows affected.

## 8. Hand off to `/speckit-tasks`

Once this plan + artifacts are reviewed, run `/speckit-tasks` to generate `tasks.md` (the actionable work breakdown). Optional: `/speckit-checklist` for a quality checklist, `/speckit-analyze` for cross-artifact consistency.
