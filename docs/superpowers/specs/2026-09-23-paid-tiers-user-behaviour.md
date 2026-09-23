# Goalify Free vs Goalify Beyond: user behaviour spec

**Date:** 2026-09-23
**Purpose:** The complete description of what a user can do on each plan, when they are asked to upgrade, and how a 7-day trial fits in. Use it as the source for building paid tiers (billing, paywall, entitlement checks).
**Plan names:** Free, and **Goalify Beyond** ("Beyond" for short), $3.99/month. Copy and tagline are in `constants/brand.ts`.

### Status labels used throughout

| Label | Meaning |
|---|---|
| **LIVE** | Built and enforced in production today |
| **HIDDEN** | Built, but switched off by a flag in `constants/flags.ts` |
| **SPEC'D** | Described in an earlier spec (`specs/005`, `specs/007`) but never built |
| **PROPOSED** | New recommendation in this document, not built |

---

## 1. The plan lifecycle

```
Sign up ──► Free ──(paywall: "Start 7-day free trial")──► Beyond trial (7 days, card on file)
              ▲                                                   │
              │                                   day 8: charged $3.99 ──► Beyond (paid)
              │                                                   │                │
              └──────── cancels during trial ◄────────────────────┘                │
              └──────── cancels / payment fails (at end of paid period) ◄──────────┘
```

### 1.1 Billing channels, all through RevenueCat  (DECIDED; to build)

RevenueCat is the single source of truth for "is this user Beyond?", whichever store they paid through:

| Channel | Where the user pays | Notes |
|---|---|---|
| **Apple App Store** | iOS app | Required for in-app digital subscriptions on iOS |
| **Google Play** | Android app | Required for in-app digital subscriptions on Android |
| **Stripe** (RevenueCat Web Billing) | Web app (Expo web build on Vercel) and web checkout links | Store rules on linking out from a mobile app to web checkout differ by country and change often. Check current App Store / Play policies for each storefront before adding a link-out inside the mobile apps |

- **One product, one entitlement:** entitlement `beyond`, with products `beyond_monthly` ($3.99) and optionally `beyond_annual` (D2) set up in each store and in Stripe, all attached to that entitlement in RevenueCat.
- **Same account everywhere:** the RevenueCat App User ID = the Supabase `user.id`, so a purchase on any channel unlocks Beyond on every device the user signs into.

### 1.2 Trial: 7-day free trial, charged on day 8  (DECIDED; to build)

- **What it is:** a **store free trial** (an "introductory offer" in App Store Connect and Play Console, a trial period on the Stripe price), managed by RevenueCat. The user starts it from the paywall, confirms with the store's payment sheet (payment method on file), and gets full Beyond for 7 days. **Unless they cancel, they're charged $3.99 on day 8**, and it renews monthly after that.
- **Who can start it:** each store allows one trial per store account for this subscription. Apple and Google enforce this themselves. RevenueCat exposes eligibility, so the paywall shows "Start 7-day free trial" only to eligible users and "Subscribe" to everyone else.
- **Before the trial:** new users are on **Free from day one** (section 2). The trial is offered:
  - **Day 0, after onboarding:** a welcome paywall: *"Try Goalify Beyond free for 7 days"*, with **Start free trial** / **Maybe later**.
  - **At every upgrade moment** (section 4), while the user is still eligible.
- **During the trial the user sees:**
  - A "Beyond trial · N days left" chip on the Profile screen.
  - **Day 5:** push notification *"Your free trial ends in 2 days. You'll be charged $3.99 on <date> unless you cancel."* Tapping it opens Profile → Manage subscription. Stating the charge date clearly reduces refunds and chargebacks, and many regions' auto-renewal rules expect a clear notice before the first charge (check the rules for your markets).
- **Day 8:**
  - **Not cancelled:** charged; stays Beyond with no interruption. Optional: a "Welcome to Goalify Beyond" sheet.
  - **Cancelled:** drops to Free when the trial ends. On the next app open, a one-time sheet: *"Your trial has ended"*, listing what changes, with **Resubscribe** and **Continue with Free**. They're no longer trial-eligible, so the paywall says Subscribe.
- **Counters and the trial:** counters are kept per feature *and* per period (`consume_ai_quotas`), so:
  - **Chat and insights:** the two plans use different periods (Free: chat ever / insights per month; Beyond: chat per day+month / insights per day). Beyond usage never eats into Free allowances: a user who sent 40 messages on Beyond still has whatever remains of their 10 Free messages if they return to Free.
  - **Vision images:** both plans share the same daily and monthly counters. Images made on Beyond count toward Free's 10 in that same calendar month.
  - **Weekly review and nudges:** same limits on both plans, so nothing changes at the switch.

### 1.3 Free

Core app unlimited; AI and vision features capped (section 2). The user is asked to upgrade only at meaningful moments (section 4), never through blocking pop-ups.

### 1.4 Beyond (paid)

- $3.99/month (annual price: **decision D2**).
- Everything in section 3.
- **If they cancel or payment fails:** they keep Beyond until the end of the paid period (plus any grace period the store gives for failed payments), then drop to Free. **Nothing they created is deleted**: goals, habits, journal, images and letters all stay. Only Free limits apply from then on.

---

## 2. Free plan: complete user behaviour

### 2.1 Core features: unlimited and free forever

These drive the daily habit, so gating them would hurt retention. None has an AI cost.

| Feature | Where | Free behaviour | Status |
|---|---|---|---|
| Goals + subtasks | Goals tab | Unlimited goals and subtasks; progress bars, life-area filters, due dates | LIVE |
| Habits | Habits tab | Unlimited habits, streaks, 4/8/12-week heatmap | LIVE |
| Habit reminders | Habits tab | Per-habit reminder at any time | LIVE |
| Morning ritual | Today → "Pick today's One" | Pick a focus area, 3 suggested actions, lock a must-do. Suggestions come from built-in lists, with **no AI** (`lib/ritual-coach.ts`) | LIVE |
| Evening close | Today → "Close the day" | Review, journal line, pick tomorrow's area, streak celebration | LIVE |
| Ritual streak | Today, streak screen | Real streak, 28-day grid, share as text | LIVE |
| Journal | Journal tab | Unlimited entries, full text, search, 30-day mood chart. Mood scoring is word-based, **no AI** | LIVE |
| Future-self letter | Coach → Future | Write and update letters (1m / 3m / 6m / 1y) | LIVE |
| Life score, levels | Today, Profile | Calculated from goal progress | LIVE |
| Affirmations, quote | Today | Built-in library | LIVE |
| Home-screen widget | iOS / Android | Today's One + streak | LIVE |
| Calendar sync | Profile | Habits as recurring calendar events | LIVE |
| Data export | Profile | JSON export | LIVE |
| Circles | Profile → Circles | Create/join circles, see members' daily done/not-done + streak | LIVE, unlimited (see 2.3) |

### 2.2 AI and vision features: capped on Free

Every limit below is enforced **on the server** (`supabase/functions/*`, migration 0020), so a modified app can't bypass it. All windows are in UTC.

| Feature | What triggers it | Free limit | When the limit is reached, the user sees… | Status |
|---|---|---|---|---|
| **Coach chat** (Coach → Insights → "Ask your coach") | Each message sent | **10 messages in total, ever** | Coach replies: *"You've used your 10 free messages with your coach. Upgrade to Goalify Beyond to keep chatting."* The server flags this with `upgrade: true`, so the **paywall opens here** (section 4, U1). | Limit LIVE; paywall PROPOSED |
| **Personalized insights** (Coach → Insights) | Automatic on app open, if the saved set is >10 days old | **3 per month**; each set is kept for 10 days, so they spread across the month | The last insights stay visible. PROPOSED: under them, *"New insights every day with Beyond"* (U3) | Limit LIVE |
| **Weekly review** (Coach → Weekly) | Automatic on app open, if the saved review is >7 days old | **1 per week** (same as Beyond) | n/a (never visible in normal use) | LIVE |
| **Streak nudge** (evening notification) | Morning ritual locked with the must-do not yet done, and streak > 0 | **1 per day** (same as Beyond) | Not sent | LIVE |
| **Mood check-in** (morning notification → Journal) | Journal saved while the last 3 entries trend downward | **1 per day** (same as Beyond) | Not sent | LIVE |
| **Vision image** (goal cards, Coach → Vision, full-screen view) | Creating a goal | **1 image per goal, 10 per month** (and max 6/day) | New goals beyond 10 in a month show the life-area gradient instead of an image. PROPOSED: small caption *"Vision images for every goal with Beyond"* (U4) | LIVE |
| **Regenerate vision image** (full-screen view) | Tapping regenerate | **Not available** | Today the button is hidden. PROPOSED: show it with a lock; tapping opens the paywall (U2) | Server gate LIVE; button HIDDEN |
| **Ambient audio** (full-screen view) | Opening a vision | **Not available** | "♩ Ambient · Beyond" badge. PROPOSED: tapping it opens the paywall (U5) | HIDDEN (no audio files yet) |

### 2.3 Circles on Free  (DECIDED: D3)

**Unlimited on Free**, the same as Beyond. Circles bring in new users through invites and cost nothing to run.

### 2.4 What a Free user never sees
- No ads, no blocking pop-ups, no lock icons on core features.
- No countdowns outside the trial.

### 2.5 Cost of a Free user (Gemini 3 Flash)
- Maximum: **~$0.10/month** (the 10 lifetime chats land in the first month; ~$0.06/month after that). Typical: a few cents.
- On Sonnet 5, the current model: ~$0.37/month maximum.

---

## 3. Goalify Beyond: complete user behaviour

Everything in Free, plus:

| Feature | Beyond behaviour | Limit (server-enforced) | Status |
|---|---|---|---|
| **Coach chat** | Ongoing conversation with the coach | **20/day and 150/month.** At the limit: *"You've reached today's 20 coach messages. Your coach will be back tomorrow."* / *"You've used this month's 150 coach messages. They reset on the 1st."* | Limits LIVE (active once `getPlan()` returns Beyond) |
| **Personalized insights** | Fresh insights every day | 1/day, kept 24 hours | LIVE (same condition) |
| **Weekly review** | Same as Free | 1/week | LIVE |
| **Nudges** | Same as Free | 1/day each | LIVE |
| **Vision images** | 1 per goal | 30/month (6/day) | LIVE (same condition) |
| **Regenerate vision image** | New image for a goal | Once per image per 7 days; counts toward the 30/month | Server LIVE; button HIDDEN until the app knows the plan |
| **Ambient audio in vision view** | Looping ambient sound per life area | n/a | HIDDEN. Needs 4 audio files (`assets/audio/ambient_*.m4a`) |
| **Vision images from the goal's title** | e.g. "Learn Spanish" → a café table with a Spanish novel, instead of the generic life-area scene | Same image limits | SPEC'D (`specs/007` §2.2), not built |
| **AI-picked ritual actions** | Morning ritual suggests actions picked by AI from the user's goals/habits/journal, instead of built-in lists | PROPOSED: 1/day | SPEC'D (`PRO_RITUAL_AI`, unused flag) |
| **Ritual close sound** | Ambient sound on the evening celebration | n/a | SPEC'D (`PRO_RITUAL_SOUND`, unused flag) |
| **Branded share card** | Evening close / streak shared as an image card instead of text | n/a | SPEC'D (`specs/005`) |
| **Circles** | Unlimited (see D3) | n/a | LIVE |

### 3.1 Recommended Beyond launch scope (PROPOSED)
Launch with what's already built, and don't hold up launch for the spec'd extras:
1. Coach chat 150/month
2. Daily insights
3. Vision regenerate
4. 30 vision images/month

Add these as "new in Beyond" updates after launch, which also helps retention: ambient audio, vision from goal titles, AI ritual actions, branded share card.

### 3.2 Cost of a Beyond user (Gemini 3 Flash)
| | Per month |
|---|---|
| Maximum (every limit used) | **~$0.83** |
| Revenue after 15% store fee | **$3.39** |
| Margin at maximum usage | **~75%** |

The coach runs on **Gemini 3 Flash** (decision D4). On Sonnet 5 the maximum would be ~$2.87, a ~15% margin.

A 7-day trial user costs at most ~$0.65 (140 chats + 30 images), typically ~$0.10. With a store trial, a user who cancels costs this amount and pays nothing.

---

## 4. Upgrade moments (where the paywall opens)

Every entry point opens the **same paywall** with a `source` tag, so you can measure which moment converts best.

| # | Moment | Screen | Trigger | What the user sees | Status |
|---|---|---|---|---|---|
| U1 | **Free chat used up** | Coach → Ask your coach | 11th message on Free (server returns `upgrade: true`) | Coach message with the limit text + **"Get Goalify Beyond"** button under it → paywall | Server LIVE; button PROPOSED |
| U2 | **Regenerate vision** | Full-screen vision | Tap the (locked) regenerate button on Free | Paywall with the vision pitch: *"See it. Build it. Become it."* The earlier vision spec calls this the highest-intent upgrade moment in the app | PROPOSED (button hidden today) |
| U3 | **Insights waiting** | Coach → Insights | Free user whose insights are older than 1 day | Quiet line under the insights: *"New insights every day with Beyond"* → paywall | PROPOSED |
| U4 | **Vision images used up** | Goal card | Goal created after the 10th image this month | Caption on the gradient: *"Vision images for every goal with Beyond"* → paywall | PROPOSED |
| U5 | **Ambient audio** | Full-screen vision | Tap "♩ Ambient · Beyond" badge | Paywall | PROPOSED (badge exists, not tappable) |
| U0 | **Welcome offer** | After onboarding (day 0) | New, trial-eligible user | "Try Goalify Beyond free for 7 days" paywall (1.2) | PROPOSED |
| U6 | **Trial reminder / ended** | Push notification (trial day 5), sheet (after a cancelled trial ends) | Trial timeline | See 1.2 | PROPOSED |
| U7 | **Profile** | Profile | Always | "Goalify Beyond" row: shows plan status, trial days left, **Upgrade** / **Manage subscription** | PROPOSED |

**Rules for every upgrade moment:**
- Show upgrade prompts only when the user tries something Beyond offers, never on a timer. U0 and U6 are the exceptions.
- The paywall's main button depends on trial eligibility (from RevenueCat): **"Start 7-day free trial"** if eligible, **"Subscribe · $3.99/month"** if not.
- Anything that opens the paywall can be dismissed, and the user returns exactly where they were.
- After purchase, the action that triggered it continues (e.g. the regenerate starts).
- Required by the stores: **Restore purchases**, price and period, auto-renew terms, and links to the Terms of Use and Privacy Policy.

---

## 5. Where "Pro"/"Beyond" exists in the code today

| Location | What it does | Change needed for paid tiers |
|---|---|---|
| `supabase/functions/_shared/plan.ts` → `getPlan()` | **The single server-side plan check.** Returns `'free'` for everyone | Return `'beyond'` when the user's RevenueCat `beyond` entitlement is active. That includes the free trial, so there's no separate trial logic. Read it from a `subscriptions` table kept up to date by the RevenueCat webhook (or the RevenueCat REST API) |
| `supabase/functions/ai-coach/index.ts` → `LIMITS`, `CACHE_TTL_MS` | Per-plan chat/insights/weekly/nudge limits; returns `upgrade: true` on the Free chat limit | None |
| `supabase/functions/generate-vision/index.ts` → `IMAGE_LIMITS`, regen check | Per-plan image limits; regenerate refused unless Beyond (`pro_required`) | None |
| `supabase/migrations/0020_ai_quota_windows.sql` | Counters (day/week/month/total) | None |
| `constants/flags.ts` | `PRO_VISION_REGEN`, `PRO_VISION_AUDIO`, `PRO_RITUAL_AI`, `PRO_RITUAL_SOUND`: fixed `false` constants | Replace with a `usePlan()` hook that reads the user's real plan (from RevenueCat and/or the server) |
| `components/vision/FilmOverlay.tsx` | Regenerate button hidden unless `PRO_VISION_REGEN` | Show for everyone; on Free, lock it and open the paywall (U2) |
| `store/vision.tsx` → `canRegenAsset` | Regenerate allowed only if `PRO_VISION_REGEN` | Use `usePlan()` |
| `app/vision/[goalId].tsx` | "♩ Ambient · Beyond" badge; audio only if `PRO_VISION_AUDIO` | Make the badge tappable (U5); ship audio files |
| `store/coach-ai.tsx` → `CoachLimitError.upgrade` | Tells the UI when the Free chat allowance is used up | Coach screen shows the "Get Goalify Beyond" button (U1) |
| `constants/brand.ts` | Plan name, tagline, paywall pitch | Use in paywall + all upgrade copy |
| `lib/ritual-coach.ts` | Built-in ritual suggestions (Free and Beyond today) | Beyond: AI-picked actions (spec'd) |

**Missing pieces to build:**
- **Billing:** RevenueCat SDK (`react-native-purchases`, needs the EAS development build), `beyond` entitlement, `beyond_monthly` on Apple/Google/Stripe with a 7-day trial, paywall screen, restore purchases.
- **Plan state on the server:** a `subscriptions` table updated by a RevenueCat webhook, read by `getPlan()`.
- **Plan state in the app:** `usePlan()` built on RevenueCat `CustomerInfo` (entitlement `beyond`: active? `periodType === TRIAL`? expiration date), returning `{ plan, isTrial, trialEndsAt, isTrialEligible }`.
- **Billing setup:** products + 7-day intro offer in App Store Connect and Play Console, a Stripe product/price with a 7-day trial connected via RevenueCat Web Billing, all attached to the `beyond` entitlement. RevenueCat App User ID = Supabase `user.id`.
- **Trial UI:** welcome sheet, profile chip, day-5 notification, day-7 sheet.
- **Upgrade entry points:** U1–U7.

---

## 6. Edge cases

| Case | Behaviour |
|---|---|
| User subscribes during the trial | Plan becomes paid Beyond immediately. Unused trial days are simply absorbed (no double trial) |
| Trial ends mid-conversation | The next message is counted against Free (10 total); the conversation isn't cut off mid-reply |
| Beyond → Free with >10 images already this month | Existing images stay; only new generation is capped |
| Beyond → Free with coach insights generated today | They stay visible; the next refresh follows Free timing (10-day cache) |
| Reinstall / new device | Plan follows the account (server) and the store account (Restore purchases) |
| Same person tries to get a second trial | Stores allow one trial per store account (Apple ID / Google account), so a new Goalify account on the same store account isn't eligible. **Cross-channel gap:** someone could trial on the app store and again via Stripe on the web. Use RevenueCat's eligibility info to show "Subscribe" instead of a trial to anyone who has already had one, on any channel. Worst-case cost of an abused trial is ~$0.65 |
| User starts a trial, then deletes the app | The store still charges on day 8 unless they cancel through the store. The day-5 reminder (1.2) covers this |
| User subscribes on iOS, then signs in on Android or web | Beyond everywhere (same RevenueCat App User ID). Manage/cancel only through the store they paid with; Profile should say which one |
| Counter timezone | Limits reset at 00:00 **UTC**, not local midnight. Copy says "tomorrow" / "on the 1st", which is close enough |
| Coach chat history | Not saved between app launches today (in-memory only), on either plan. Consider saving history as a Beyond feature later |

---

## 7. Decisions needed before building

| # | Decision | Recommendation |
|---|---|---|
| D1 | Trial type | ✅ **Decided:** 7-day store free trial through RevenueCat (card on file, charged $3.99 on day 8 unless cancelled) on Apple, Google and Stripe |
| D2 | Annual plan price | e.g. **$29.99/year** (~37% off $3.99 × 12) |
| D3 | Circles on Free | ✅ **Decided:** unlimited |
| D4 | Coach model | ✅ **Decided:** Gemini 3 Flash |
| D5 | Launch scope for Beyond | **Built features only** (3.1); spec'd extras as later updates |
| D6 | Are Free users' 10 coach messages a lifetime allowance, even after years? | Yes, as specified. Could add "+5 each month" later if Free engagement drops |
