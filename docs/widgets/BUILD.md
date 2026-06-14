# Home-screen widget — build & install

The **medium "Today's One"** widget shows today's must-do action + your streak,
on iOS (WidgetKit) and Android. It reads a small snapshot the app writes on every
ritual change. **Widgets cannot run in Expo Go** — you need a development build.

## What's already wired (app side, unit-tested)
- `lib/widget-snapshot.ts` — builds the snapshot `{ date, oneText, oneDone, streak, focusSphere }` (`__tests__/widget-snapshot.test.ts`).
- `lib/date.ts` — `streakFromDates`, local-timezone dates (`__tests__/date.test.ts`).
- `store/daily-ritual.tsx` — computes the real streak from `daily_intentions` history and calls `writeWidgetSnapshot()` whenever today's ritual changes. Also exposes `streak` + `activeDates` (now shown on the home card and `streak-info`).
- `lib/widget-bridge.ts` — writes the snapshot to AsyncStorage + the OS shared container. Defensive: no-ops if the native module is absent.

## Native pieces (this directory + `targets/`)
- `targets/widget/` — iOS WidgetKit extension (`index.swift`, `expo-target.config.js`).
- `widgets/GoalifyMediumWidget.tsx` — Android widget UI.
- `widgets/widget-task-handler.tsx` + `widgets/register-android.ts` — Android render handler (registered in `index.ts`).
- `widgets/update-android.tsx` — repaints the Android widget on update.

## One-time setup

1. **Install the native libs (Expo-compatible versions):**
   ```bash
   npx expo install @bacons/apple-targets react-native-android-widget
   ```

2. **Apple Developer portal:** create an **App Group** `group.com.goalifylife.app`
   and enable it for the app id `com.goalifylife.app`. (Must match `APP_GROUP` in
   `lib/widget-bridge.ts`, the entitlement in `app.config.js`, and `targets/widget/`.)

3. **Set your Apple Team ID** (used by `@bacons/apple-targets`):
   ```bash
   export APPLE_TEAM_ID=XXXXXXXXXX   # or edit app.config.js
   ```

## Build & run

```bash
npx expo prebuild --clean          # generates ios/ + android/ with the targets
# iOS (device or simulator with a dev build):
eas build --profile development --platform ios     # or: npx expo run:ios
# Android:
eas build --profile development --platform android # or: npx expo run:android
```

> `eas.json` now ships a `development` profile (`developmentClient: true`, internal
> distribution, iOS simulator enabled). Adjust credentials/resource class as needed.

## Verify
1. Launch the app, complete the **morning ritual** (sets today's One).
2. Add the **"Today's One"** widget to the home screen.
3. The tile shows the must-do text + streak. Toggling the One in-app updates it
   (iOS: within WidgetKit's refresh budget; Android: immediately via `requestWidgetUpdate`).
4. Tapping the tile deep-links to `goalify://ritual/morning`.

## Notes / not yet done
- Small + large families, Live Activity / Dynamic Island, and Apple Watch are out of scope (medium only).
- Swift/TSX layouts will likely need a pass on a real device — they are unverified by CI.
- The streak source is `daily_intentions` (`must_do_done || closed_at`). If you later want
  "checking off any Today action" to also count (per the streak-info copy), extend
  `activeDatesFromIntentions` / the history query to include those signals.
