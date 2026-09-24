# Product analytics: setup runbook

Goalify sends product analytics to **PostHog Cloud EU**. Only users who opted in are tracked. Design and event
list: [specs/009-product-analytics/plan.md](../specs/009-product-analytics/plan.md).

Without `POSTHOG_API_KEY`, analytics is off: no consent prompt, no Profile toggle, no network calls.

## 1. PostHog project

1. Create an account at https://eu.posthog.com (EU region).
2. Project settings:
   - **Discard client IP data**: on.
   - Session replay, autocapture, heatmaps, surveys: off. The app doesn't use them.
3. Sign the DPA (Organization settings → Legal).
4. Copy the **Project API key** (`phc_…`). It is public and ships in the app.

## 2. App

`.env`:

```
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://eu.i.posthog.com
```

`posthog-react-native`, `expo-application`, `expo-device` and `expo-localization` are native modules, so **make a new
dev client / EAS build**. An existing build won't have them. After changing `.env`, restart Metro with `--clear`,
otherwise the old config stays cached in the bundle.

For EAS builds, add the same variables as EAS environment variables.

## 3. Server (Supabase secrets)

```
supabase secrets set POSTHOG_API_KEY=phc_...                  # revenuecat-webhook → subscription events
supabase secrets set POSTHOG_PERSONAL_API_KEY=phx_...         # optional: delete-account erases the person
supabase secrets set POSTHOG_PROJECT_ID=12345                 # optional, with the key above
supabase functions deploy revenuecat-webhook delete-account
```

This is the production project (see the Supabase deploy notes), so deploy deliberately.

- The webhook forwards `subscription_started/renewed/cancelled/uncancelled/expired`, `billing_issue` and
  `subscription_product_changed`, **only** when the RevenueCat customer has `analytics_consent = granted`. The app sets
  that attribute from the consent choice. The RevenueCat event id is reused as the PostHog event uuid, so webhook
  retries don't double-count.
- The personal API key needs the `person:write` scope. Without it, handle erasure requests by hand in PostHog
  (Persons → delete, with events).

## 4. Consent (GDPR / §25 TDDDG)

- `/analytics-consent` opens once the user is signed in and settled in the app. "Allow" and "No thanks" have equal
  weight. Until the user answers, events are held **in memory only**. "Allow" sends them; "No thanks" drops them.
- Profile → App → "Share usage data" changes the choice at any time. Withdrawing calls `optOut()` and `reset()`.
- The choice is stored per device (`@goalify/analytics-consent`).

## 5. Store disclosures and privacy policy

**App Store privacy label** (in addition to the existing entries):

| Data type | Linked to user | Tracking | Purpose |
|---|---|---|---|
| Identifiers → User ID | Yes | No | Analytics |
| Usage Data → Product Interaction | Yes | No | Analytics |

No App Tracking Transparency prompt is needed: there's no advertising ID and no cross-app tracking.

**Google Play Data safety**: App activity → App interactions; Device or other IDs. Collected, not shared,
purpose Analytics, encrypted in transit, users can request deletion, optional (user can opt out).

**Privacy policy** (goalify.life/privacy) should state:
- PostHog Inc. is the processor, with EU hosting in Frankfurt.
- Legal basis: consent for app usage analytics. Subscription lifecycle events are also only sent with consent.
- What we collect: screens, feature usage, counts and categories, plan, and a pseudonymous account ID.
- What we never collect: written content, name, email.
- Retention period, plus how to withdraw consent (Profile) and how to request deletion.

## 6. Dashboards

Build these in PostHog once data flows (definitions in the plan):
1. Acquisition funnel
2. Retention D1/D7/D30 with commitment actions
3. Weekly Committed Users (≥3 days per week)
4. Monetization by paywall `source`
5. AI limit hits

## 7. Verifying

- Unit: `npx jest __tests__/analytics`
- Web e2e (PostHog traffic intercepted, needs the e2e account in `.env`):
  `npx expo start --web --port 8091 --clear` with `POSTHOG_API_KEY=phc_e2e`, then
  `POSTHOG_API_KEY=phc_e2e npx playwright test e2e/analytics-consent.spec.ts`
- Device: PostHog → Activity shows live events after "Allow".
