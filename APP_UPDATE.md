# In-app Android updates

After phones install **FinanceFlow 1.2.0+** once, you can ship new APKs without WhatsApping each person.

## How it works

1. App opens → checks `app-update.json` (Vercel) and `/app/update` (API)
2. If `versionCode` on the server is **higher** than the phone → **Update available** dialog
3. User taps **Update app** → APK downloads → Android installer opens

## One-time: install the updater APK

People on older APKs (1.1.0 and below) must install **1.2.0** once manually. After that, in-app updates work.

APK path after build:

```
frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

Also copied as `FinanceFlow-v1.2.0.apk` on the Desktop when you build.

---

## Publish a new update (every release)

### 1. Bump Android version

Edit `frontend/android/app/build.gradle`:

```
versionCode 4          // must increase every release
versionName "1.2.1"
```

### 2. Build the APK

```powershell
cd FINNECT-Finance-OS\frontend
npm run cap:apk
```

### 3. Upload the APK to GitHub Releases

1. Open https://github.com/officialhariprasath/FinanceFlow/releases  
2. **Draft a new release** → tag e.g. `v1.2.1`  
3. Upload `app-debug.apk` renamed to `FinanceFlow.apk`  
4. Publish  
5. Copy the **direct asset URL**, e.g.  
   `https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.1/FinanceFlow.apk`

### 4. Point the update manifest at that APK

Update **both** files with the new `versionCode`, `versionName`, and `apkUrl`:

- `frontend/public/app-update.json` (goes live with Vercel)
- `backend/app/api/app_update.py` (goes live with Render)

Example:

```json
{
  "versionCode": 4,
  "versionName": "1.2.1",
  "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.1/FinanceFlow.apk",
  "notes": "Bug fixes and improvements",
  "force": false
}
```

### 5. Deploy

```powershell
git add -A
git commit -m "Release Android 1.2.1"
git push origin main
```

Wait for **Vercel** (JSON) and **Render** (API) to finish.

### 6. Test

Open the installed FinanceFlow app → dialog should appear, or **Settings → Check for updates**.

---

## Notes

- `versionCode` must always go up (3 → 4 → 5…). `versionName` is for display only.
- First time Android may ask **Allow install from this source** — user enables it, taps Update again.
- `force: true` hides the Later button.
- Web browser users never see this dialog (native app only).
