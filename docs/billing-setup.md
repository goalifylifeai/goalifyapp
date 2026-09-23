# Goalify Beyond: billing setup

Code is done; these steps happen in dashboards. Do them in order.

## 1. RevenueCat (via MCP)

Done through the RevenueCat MCP server.

1. Create project "Goalify". Add apps: iOS (`com.goalifylife.app`), Android (`com.goalifylife.app`), Web Billing (connect Stripe).
2. Entitlement: identifier **`beyond`**.
3. Products (once each store has them, step 2–4): `beyond_monthly`, `beyond_annual` → attach both to `beyond`.
4. Offering **`default`** (mark Current) with packages **`$rc_monthly`** → `beyond_monthly` and **`$rc_annual`** → `beyond_annual`, per app.
5. API keys → copy the three public SDK keys into `.env` / EAS secrets as `REVENUECAT_IOS_KEY`, `REVENUECAT_ANDROID_KEY`, `REVENUECAT_WEB_KEY`.
6. Secret API key (v1) → `supabase secrets set REVENUECAT_SECRET_API_KEY=sk_...`
7. Integrations → Webhooks: URL `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`, Authorization header `Bearer <long random string>`.
   Then `supabase secrets set REVENUECAT_WEBHOOK_AUTH="Bearer <same string>"`. Send a test event; expect 200.

## 2. App Store Connect

Subscription group "Goalify Beyond": `beyond_monthly` ($3.99, 1 month) and `beyond_annual` ($29.99, 1 year).
Each: Introductory Offer → Free, 1 week, new subscribers. Add the App Store Connect API key / In-App Purchase key in RevenueCat.

## 3. Google Play Console (via MCP)

Done through the Google Play Console MCP server.

Subscription `beyond_monthly` (base plan monthly, $3.99) and `beyond_annual` (base plan yearly, $29.99).
Each base plan: offer "free-trial", 7 days free, eligibility "New customer acquisition". Connect the Play service account in RevenueCat.

## 4. Stripe (RevenueCat Web Billing)

Create the two products in RevenueCat Web Billing with a 7-day trial. Before adding any link from the mobile apps to web checkout, check current App Store / Play rules for each storefront.

## 5. Deploy

- `supabase db push` (migration 0021)
- `supabase functions deploy revenuecat-webhook sync-subscription ai-coach generate-vision`
- New EAS development build (the SDK is native): `eas build --profile development`
- Publish a Terms of Use page at https://goalify.life/terms (the paywall links to it; Apple requires it).

## 6. Test with sandbox accounts

Free → paywall shows "Start 7-day free trial" → buy → regenerate continues → Profile shows "Beyond trial · 7 days left" →
cancel in the store → reminder cancelled → after sandbox expiry, reopen → "Your trial has ended" sheet → paywall shows "Subscribe".

## 7. Vision sound cue

The per-life-area sound (`assets/audio/vision_*.m4a`) is built but off: flip `VISION_SOUND_AVAILABLE` in `constants/flags.ts` to `true` once every licence in `assets/audio/SOURCES.md` is confirmed for a paid app. Beyond users then hear it and Free users see the "♩ Ambient · Beyond" badge that opens the paywall.
