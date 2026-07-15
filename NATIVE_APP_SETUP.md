# C-Street Native App — Setup Guide

You've got Capacitor + the native plugins installed. The rest happens on your Mac.

## 1. Get the code on your Mac
Export the project from Lovable (top-right → **GitHub** → Connect / Transfer), then:
```bash
git clone <your-repo>
cd <your-repo>
bun install     # or npm install
```

## 2. Generate the native projects (one-time)
```bash
bun run build
npx cap add ios
npx cap add android
npx cap sync
```
This creates `/ios` and `/android` folders. Commit them.

## 3. Live-reload against the Lovable preview
The `capacitor.config.ts` already points `server.url` at your Lovable preview, so opening the app on your phone will load the live preview.

- **iOS** (needs Xcode, free — no paid Apple Developer account required for personal device install):
  ```bash
  npx cap open ios
  ```
  In Xcode: pick your iPhone as the target, sign with your free Apple ID (Signing & Capabilities → Team → Add Account), press ▶︎.

- **Android** (needs Android Studio):
  ```bash
  npx cap open android
  ```
  Enable USB debugging on your phone, plug it in, press ▶︎.

## 4. Native Google Sign-In
The `@codetrix-studio/capacitor-google-auth` plugin is installed. To finish it up you'll need:
- A Google OAuth **Web client ID** — put it in `capacitor.config.ts` → `GoogleAuth.serverClientId`.
- An **iOS client ID** and an **Android client ID** from Google Cloud Console, added to `ios/App/App/Info.plist` and `android/app/google-services.json` respectively.

Ping me when you have the client IDs and I'll wire the sign-in flow to use the native plugin on device (and keep the existing web flow on desktop).

## 5. Push Notifications
Web push is already working via VAPID. For native:
- **Android**: needs Firebase Cloud Messaging — add `google-services.json` to `android/app/`.
- **iOS**: requires a paid Apple Developer account for APNs. Since you don't have one, we'll leave iOS push disabled for now; Android push will work fine.

## 6. Publishing a real build (later)
When you're ready to ship a real bundle instead of live-reload:
1. Remove (or comment out) the `server.url` block in `capacitor.config.ts`.
2. `bun run build && npx cap sync`
3. Build in Xcode / Android Studio.

For distributing to a few people without app stores:
- **Android**: build a signed APK, share the file — they enable "Install unknown apps" and tap it.
- **iOS**: with a free Apple ID you can install to your own devices via Xcode. Each install lasts 7 days before you need to re-sign.
