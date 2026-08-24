# Install FinanceFlow APK on your phone (v1.2.2)

## File to use
- Desktop: `FinanceFlow-v1.2.2.apk`
- Or from the project after build: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

## Fresh install (recommended first time / if old build is stuck)

1. Copy `FinanceFlow-v1.2.2.apk` to the phone (USB, Google Drive, WhatsApp to yourself, or email).
2. On the phone, open the APK file.
3. If Android asks, allow **Install unknown apps** for Files / Chrome / Drive (whichever opened the APK).
4. Tap **Install**, then **Open**.
5. Confirm the app shows **1.2.2** under Settings → Check for updates (or About).

If install fails because an older app is already present, uninstall **FinanceFlow** first, then install this APK again.

## In-app update (after this build is on the phone)

1. Host `FinanceFlow-v1.2.2.apk` at the URL in `frontend/public/app-update.json` → `apkUrl` (Vercel `/releases/` or GitHub Release).
2. Deploy web + API so `GET /app/update` reports `versionCode: 5`.
3. Open the installed app → update dialog, or **Settings → Check for updates**.

## Notes
- Keep the same package id (`com.financeflow.agent`) so updates replace the existing app.
- First-time installs from Drive/Chrome may need “Allow from this source”.
