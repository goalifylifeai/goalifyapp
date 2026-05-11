# Android Build Setup (Gradle / Native)

This guide covers generating the native Android project from Expo and building
a signed release APK/AAB with Gradle — without EAS.

---

## Prerequisites

- **Java 17** — `java -version` should show 17.x. Install via `brew install openjdk@17`.
- **Android Studio** (for SDK tools and emulator) — or just the command-line tools.
- **Android SDK** — API level 35 (set `ANDROID_HOME` in your shell profile).
- **Node / npm** already installed.

```bash
# Add to ~/.zshrc or ~/.bash_profile
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

---

## Step 1 — Generate the native Android project

Expo managed workflow has no `android/` directory by default.
Run `prebuild` to generate it:

```bash
cd /Users/pulkit/goalify
npx expo prebuild --platform android --clean
```

`--clean` wipes any previous prebuild artifacts. After this you will have an
`android/` directory committed to the repo (or kept local — your call).

> Re-run `prebuild` any time you add a new native Expo plugin in `app.config.js`.

---

## Step 2 — Add google-services.json (required for push notifications)

Expo Notifications uses Firebase Cloud Messaging (FCM) on Android.

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Create a project → Add Android app → package name: `com.goalify.app`.
3. Download `google-services.json`.
4. Place it at `android/app/google-services.json`.

The `expo-notifications` plugin wires this up automatically during prebuild.

---

## Step 3 — Create a release keystore

Do this once and keep the keystore file safe (outside the repo).

```bash
keytool -genkey -v \
  -keystore ~/goalify-release.keystore \
  -alias goalify \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You'll be prompted for passwords and organisation info. Save the passwords — you cannot recover them.

---

## Step 4 — Configure signing in Gradle

Edit `android/gradle.properties` — add at the bottom:

```properties
GOALIFY_STORE_FILE=/Users/yourname/goalify-release.keystore
GOALIFY_STORE_PASSWORD=your_store_password
GOALIFY_KEY_ALIAS=goalify
GOALIFY_KEY_PASSWORD=your_key_password
```

> **Never commit this file with real passwords.** Add these as CI environment variables instead,
> or keep a separate `gradle.properties` locally that is gitignored.

Then in `android/app/build.gradle`, inside the `android { }` block:

```groovy
android {
    // ... existing config ...

    signingConfigs {
        release {
            storeFile file(GOALIFY_STORE_FILE)
            storePassword GOALIFY_STORE_PASSWORD
            keyAlias GOALIFY_KEY_ALIAS
            keyPassword GOALIFY_KEY_PASSWORD
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## Step 5 — Set environment variables for the build

The app reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and OAuth client IDs from `.env` at build time
(via `dotenv/config` in `app.config.js`).

Make sure your `.env` file exists and is populated before running prebuild:

```bash
cp .env.example .env
# fill in real values
```

---

## Step 6 — Build a release AAB (for Play Store)

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Build a release APK (for direct distribution / testing)

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Step 7 — Test the release build on a device

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## Step 8 — Upload to Play Console

1. Go to Play Console → your app → **Production** (or Internal Testing first).
2. Create a new release → upload the `.aab` file.
3. Add release notes.
4. Submit for review.

First-time reviews typically take **1–3 business days**.

---

## Common Issues

| Problem | Fix |
|---|---|
| `JAVA_HOME` not set | `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` |
| SDK not found | Set `ANDROID_HOME` and run `sdkmanager "platform-tools"` |
| google-services.json missing | Add it to `android/app/` (Step 2) |
| Signing config not found | Check `gradle.properties` key names match `build.gradle` references |
| `expo-apple-authentication` crash on Android | This plugin is iOS only — ensure it is gated behind `Platform.OS === 'ios'` in all usages |

---

## Rebuilding after dependency changes

Any time you add or remove an Expo plugin or native package:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew bundleRelease
```
