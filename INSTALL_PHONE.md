# Install FinanceFlow APK on your phone (v1.2.1)

## File to use
- Desktop: `FinanceFlow-v1.2.1.apk`
- Or from the project after build: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

## Fresh install (recommended first time / if old build is stuck)

1. Copy `FinanceFlow-v1.2.1.apk` to the phone (USB, Google Drive, WhatsApp to yourself, or email).
2. On the phone, open the APK file.
3. If Android asks, allow **Install unknown apps** for Files / Chrome / Drive (whichever opened the APK).
4. Tap **Install**, then **Open**.
5. Confirm the app shows **1.2.1** under Settings → Check for updates (or About).

If install fails because an older app is already present, uninstall **FinanceFlow** first, then install this APK again.

## In-app update (after this build is on the phone)

1. Upload `FinanceFlow-v1.2.1.apk` (or `FinanceFlow.apk`) to a GitHub Release whose download URL matches `frontend/public/app-update.json` → `apkUrl`.
2. Deploy web + API so `GET /app/update` reports `versionCode: 4`.
3. On the phone: Settings → **Check for updates** → Update → allow install.

Phones still on an older APK without the updater must use the fresh install steps above once.

## What’s in 1.2.1
- Solid modal backgrounds (New Loan, etc.)
- Login with email **or** mobile
- Forgot / reset password via email code
- Owner & agent registration email verification (6-digit code)
