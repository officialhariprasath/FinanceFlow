# Mobile app & APK guide

FinanceFlow ships as:

1. **Web app** — https://finance-flow-rho-ten.vercel.app  
2. **Android APK** — native Capacitor shell with **on-device backup**

---

## What the Android app does

- Same FinanceFlow UI (owner + agent roles)
- Talks to your live API: `https://financeflow-api-gf0x.onrender.com`
- **Stores a local backup on the phone** (customers, loans, payments, renewals, collections, capital)
- Auto-backs up after login / when the app resumes (at most every 6 hours)
- Settings → **Device backup** → Backup now / Export & share (Drive, Files, WhatsApp, etc.)

Backup files live in the app’s private storage while installed. Use **Export / share backup** to keep a copy in Google Drive or Downloads if you reinstall the phone.

---

## Build the APK (Windows)

### Requirements

- Node.js 18+
- Android Studio / Android SDK (`ANDROID_HOME` set)
- Java 17

### 1. Build + sync + APK

```powershell
cd FINNECT-Finance-OS\frontend
npm install
npm run cap:apk
```

Output:

```
frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

### 2. Install on phone

1. Copy `app-debug.apk` to the phone  
2. Enable **Install unknown apps** for Files / Chrome  
3. Open the APK and install **FinanceFlow**  
4. Log in with your owner or agent account  

### 3. Open in Android Studio (optional)

```powershell
npm run cap:open
```

---

## Agent API URL

`frontend/.env.agent` is used for APK builds:

```
VITE_API_BASE_URL=https://financeflow-api-gf0x.onrender.com
VITE_AGENT_APP=true
```

Change that URL if your Render service hostname changes, then rebuild with `npm run cap:apk`.

---

## Local LAN testing (optional)

For a local backend on the same Wi‑Fi:

```
VITE_API_BASE_URL=http://192.168.x.x:8000
VITE_AGENT_APP=true
```

`127.0.0.1` will **not** work on a physical phone.

---

## Demo credentials

See `DEMO_CREDENTIALS.md`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build:agent` | Build web bundle for the app |
| `npm run cap:sync` | Build + sync into Android project |
| `npm run cap:apk` | Produce debug APK |
| `npm run cap:open` | Open Android Studio |
