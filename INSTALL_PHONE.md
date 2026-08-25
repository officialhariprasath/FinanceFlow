# Install FinanceFlow APK on your phone (v1.2.4)

## If update says “package conflicts with existing package”

The phone has an older APK signed with a different key. Do this **once**:

1. Open FinanceFlow → back up if you use on-device backup (Settings).
2. Uninstall **FinanceFlow**.
3. Install `FinanceFlow-v1.2.4.apk` (from the update link, Drive, or `/releases/`).
4. Later updates will install over this build without uninstalling.

## File to use
- Desktop: `FinanceFlow-v1.2.4.apk`
- Or from the project after build: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

## Fresh install (recommended first time / if old build is stuck)

1. Copy `FinanceFlow-v1.2.4.apk` to the phone (USB, Google Drive, WhatsApp to yourself, or email).
2. On the phone, open the APK file.
3. If Android asks, allow **Install unknown apps** for Files / Chrome / Drive (whichever opened the APK).
4. Tap **Install**, then **Open**.
5. Confirm the app shows **1.2.4** under Settings → Check for updates (or About).

If install fails because an older app is already present, uninstall **FinanceFlow** first, then install this APK again.

## In-app update (after this build is on the phone)

1. Host `FinanceFlow-v1.2.4.apk` at the URL in `frontend/public/app-update.json` → `apkUrl` (Vercel `/releases/` or GitHub Release).
2. Deploy web + API so `GET /app/update` reports `versionCode: 7`.
3. Open the installed app → update dialog, or **Settings → Check for updates**.

## Notes
- Keep the same package id (`com.financeflow.agent`) so updates replace the existing app.
- First-time installs from Drive/Chrome may need “Allow from this source”.
