# Mobile app & APK guide

FinanceFlow is a **responsive web app** that can be:

1. Used in the mobile browser (works today)
2. Installed as **PWA** (Add to Home Screen)
3. Built as a native **Android APK** for collection agents (Capacitor)

---

## Owner vs Agent — what each user sees

### Owner (`owner@financeflow.demo`)

| Page | Purpose |
|------|---------|
| Dashboard | Business overview, capital, profit |
| Collections | All borrowers today |
| Customers | Full CRUD |
| Loans | Create loans, capital check |
| Payments | All payments |
| Capital | Add / view capital |
| **Manage Agents** | **Add, edit, remove agents, assign borrowers** |
| **Agent Settlements** | Approve agent cash/UPI handovers |
| Renewals | Loan renewals |
| Settings | Business settings |

### Collection Agent (`kumar@financeflow.demo`)

| Page | Purpose |
|------|---------|
| Dashboard | Today's summary |
| **Collections** | Collect from **assigned** borrowers only |
| **My Settlement** | Wallet, ledger, submit settlement |
| Customers | View assigned customers |
| Loans | View loans |
| Payments | Record collections |

Agents **cannot**: manage agents, approve settlements, add capital, delete locked payments.

### Manager (`manager@financeflow.demo`)

Same as agent plus capital/profit views and can see agent settlements list (owner approves).

---

## Mobile responsive UI

- Hamburger menu on phones/tablets
- Sidebar slides in as a drawer
- Tables scroll horizontally
- Touch-friendly buttons and inputs
- Safe areas for notched phones

Test: resize browser or use Chrome DevTools device mode.

---

## Option A — Browser / PWA (no APK)

1. Open `http://<your-pc-ip>:5173` on the agent's phone (same Wi‑Fi).
2. Chrome → **Add to Home screen**.

Set backend to listen on LAN:

```powershell
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Update `frontend/.env`:

```
VITE_API_BASE_URL=http://192.168.x.x:8000
```

Restart `npm run dev`.

---

## Option B — Android APK (for agents)

### Requirements

- Node.js 18+
- **Android Studio** (includes Android SDK & Java)
- Backend reachable from phones (LAN IP or cloud server)

### 1. Set API URL for phones

Edit `frontend/.env.agent` — replace with your PC's LAN IP:

```
VITE_API_BASE_URL=http://192.168.1.10:8000
VITE_AGENT_APP=true
```

Find IP: `ipconfig` → IPv4 Address.

### 2. Build web + sync Capacitor

```powershell
cd FINNECT-Finance-OS\frontend
copy .env.agent .env
npm install
npm run build:agent
npx cap sync android
```

### 3. Build APK

**Debug APK (easy, for testing):**

```powershell
cd android
.\gradlew assembleDebug
```

APK output:

```
frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

Share `app-debug.apk` with agents (enable "Install unknown apps" on Android).

**Release APK:** requires signing key — use Android Studio → Build → Generate Signed Bundle/APK.

### 4. Open in Android Studio (optional)

```powershell
npx cap open android
```

---

## Important: API must not be `localhost` on phones

`127.0.0.1` only works on the same machine. Agents' phones need:

```
http://<owner-pc-lan-ip>:8000
```

Or a deployed server URL when you go to production.

---

## Demo credentials

See `DEMO_CREDENTIALS.md`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build:agent` | Build agent-focused web bundle |
| `npm run cap:sync` | Build + sync to Android project |
| `npm run cap:apk` | Build debug APK (needs Android SDK) |
