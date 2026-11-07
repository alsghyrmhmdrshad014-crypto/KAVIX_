# KAVIX Android APK Builder

This wraps the existing KAVIX HTML/CSS/JavaScript game platform in an Android WebView using Capacitor.

## Build an APK with GitHub Actions (no Android Studio required)

1. Create a GitHub repository named `KAVIX-Android`.
2. Upload **all the contents of this folder** to the repository root (not the ZIP file).
3. Open the repository's **Actions** tab.
4. If GitHub asks, enable Actions.
5. Select **Build KAVIX Android APK** and press **Run workflow** (or push to `main`).
6. Wait for the workflow to finish successfully.
7. Open the completed workflow run, scroll to **Artifacts**, and download `KAVIX-Android-APK`.
8. Extract the downloaded artifact ZIP; inside is `app-debug.apk`. Install it on your Android phone.

## Important limitations

- This APK bundles the KAVIX website files, so the basic app UI and solo play can run locally.
- KAVIX accounts/maps are currently stored in browser localStorage; they are not shared between devices.
- Multiplayer requires the KAVIX Node server to be deployed separately with WebSocket support. The APK build does not deploy that server.
- Third-party Three.js and Google Fonts are loaded from the internet.
- The existing multiplayer URL selector supports `?ws=wss://YOUR-SERVER` when opening a game page. A deployed server URL is needed for online multiplayer.
- This is a debug APK for personal testing, not a signed Play Store release.

## Original project

The original Node server and tests are retained in this folder. The APK wrapper does not replace or remove them.

## Render server host setting

The included `server/server.js` now defaults to `0.0.0.0` (while still honoring Render's `PORT` environment variable). After uploading this updated project to the GitHub repository connected to Render, trigger a redeploy. You do not need to add a separate `HOST` environment variable unless you want to override the default.
