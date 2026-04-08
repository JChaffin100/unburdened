# Unburdened

> *"Come to me, all who are weary and burdened, and I will give you rest."* — Matthew 11:28

A deeply personal, private Christian accountability Progressive Web App. Unburdened is a safe space for honest confession, reflection, and growth — powered by an AI companion that runs **entirely on your device**. No data ever leaves your phone.

---

## What is Unburdened?

Unburdened is an accountability companion in your pocket. You create accountability areas — things you want to grow in or struggle with — and have honest, private conversations with an AI that listens, encourages, asks good questions, and holds you accountable in a grace-filled, Christ-centred way.

Everything is encrypted. The AI runs on-device. Nothing touches a server.

---

## Key Features

- **100% private** — AI runs locally via MediaPipe LiteRT (Gemma 4 E2B). No internet required for chat.
- **AES-256-GCM encryption** — all personal data encrypted at rest using a key derived from your passcode. Passcode never stored.
- **Accountability areas** — create named areas of your life you want to grow in, each with its own AI conversation history and rolling summary.
- **4 AI personas** — Empathetic, Direct, Coach, and Balanced. Switch mid-session.
- **Session summaries** — the AI generates a rolling 150–200 word summary of your journey in each area to give future sessions context.
- **Commitments tracking** — make, track, and resolve commitments per area.
- **Encrypted backups** — export/import `.ubk` backup files. The backup is encrypted with your passcode.
- **Auto-lock** — locks after configurable inactivity (5 min / 10 min / 30 min / never).
- **Full PWA** — installable, works offline, portrait-first mobile design.

---

## Screenshots

_Screenshots coming soon — add after first install._

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19 + Vite |
| Styling | CSS custom properties (no UI library) |
| Encryption | Web Crypto API (PBKDF2 → AES-256-GCM) |
| Database | IndexedDB via `idb` |
| AI model | Gemma 4 E2B via MediaPipe LiteRT (`@mediapipe/tasks-genai`) |
| Model storage | Origin Private File System (OPFS) |
| Drag & drop | SortableJS |
| Icons | `sharp` (PNG resize) |
| Deployment | GitHub Pages + GitHub Actions |

---

## Prerequisites

- **Node.js 18+** — for local development and building
- **Chrome on Android** (or a Chromium-based desktop browser with WebGPU enabled) — required for AI chat features
- ~2 GB of device storage — for the Gemma model (downloaded once, stored in OPFS)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/unburdened.git
cd unburdened
```

### 2. Install dependencies

```bash
npm install
```

### 3. Generate PWA icons

```bash
npm run generate-icons
```

This resizes `unburdened_icon.png` into all 16 required icon sizes in `public/icons/`.

### 4. Run locally

```bash
npm run dev
```

Open `http://localhost:5173/unburdened/` in your browser.

> **Note:** WebGPU (required for AI) may need to be enabled in browser flags for local dev on desktop.

### 5. Build for production

```bash
npm run build
```

Output is in `dist/`.

### 6. Preview the production build

```bash
npm run preview
```

---

## First Launch Walkthrough

1. **Welcome screen** — app icon, name, and Matthew 11:28.
2. **Your name** — enter the name you'd like the companion to use.
3. **Create a passcode** — alphanumeric, minimum 4 characters. This is the only protection for all your data — it cannot be recovered if forgotten.
4. **Download the AI model** — ~1–2 GB, WiFi recommended. You can skip this and download later from Settings → AI Companion. The app works without the model (areas, commitments, and history are fully functional; only chat requires the model).
5. **Add your first area** or go straight to the home screen.

---

## GitHub Pages Deployment

### One-time setup

1. Create a GitHub repository named `unburdened`.
2. Go to **Settings → Pages** → set source to the `gh-pages` branch.
3. Your app will be live at `https://<your-username>.github.io/unburdened/`.

### Automatic deploys (GitHub Actions)

Every push to `main` automatically:
1. Installs dependencies
2. Generates icons from the master PNG
3. Builds the app
4. Deploys to the `gh-pages` branch

No secrets configuration needed — `GITHUB_TOKEN` is provided automatically.

### Manual deploy

```bash
npm run deploy
```

Requires the `gh-pages` package (already in devDependencies).

---

## Regenerating Icons

If you replace `unburdened_icon.png`:

```bash
npm run generate-icons
```

This regenerates all 16 sizes in `public/icons/`. The CI pipeline runs this automatically before building.

---

## Backup and Restore

### Export encrypted backup

**Settings → Data → Export encrypted backup**

Downloads an `unburdened-backup-YYYY-MM-DD.ubk` file. The file is encrypted with your current passcode. Keep this file safe — without the matching passcode, it cannot be decrypted.

### Import encrypted backup

**Settings → Data → Import encrypted backup**

Select a `.ubk` file. You'll be prompted for the passcode used when the backup was created (which may differ from your current passcode). On success, all data is re-encrypted with your current passcode and stored locally.

### Preferences CSV

Non-sensitive preferences (theme, auto-lock, nudge settings) can be exported and imported as a plain CSV from **Settings → Data**.

---

## Versioning

The version string lives in exactly **one place**:

```js
// public/sw.js — line 1
const VERSION = '1.0.0';
```

To bump the version:
1. Update `VERSION` in `public/sw.js`
2. The new cache name (`unburdened-vX.X.X`) causes old caches to be deleted on the next activation
3. The Settings panel reads the version at runtime — no other files need updating

---

## Browser Support

| Browser | Chat (AI) | Core app |
|---|---|---|
| Chrome 113+ (Android/desktop) | ✅ | ✅ |
| Edge 113+ | ✅ | ✅ |
| Safari 16+ (iOS/macOS) | ❌ (no WebGPU) | ✅ |
| Firefox | ❌ (no WebGPU) | ✅ |

AI chat requires WebGPU. All other features (areas, commitments, history, encrypted backups) work in any modern browser.

---

## Privacy & Security

- **Passcode**: used to derive a PBKDF2 key (310,000 iterations, SHA-256). Never stored.
- **Encryption key**: held in memory only during an unlocked session. Cleared on lock, tab close, or app backgrounding.
- **PBKDF2 salt**: the only thing stored in localStorage. Non-sensitive — prevents dictionary attacks.
- **All personal data**: encrypted with AES-256-GCM before storage in IndexedDB.
- **AI model**: stored in OPFS (Origin Private File System) — inaccessible to other apps.
- **No network calls**: after the model is downloaded, no data ever leaves the device.

---

## License

MIT — see [LICENSE](LICENSE).

Copyright © 2026 Unburdened Contributors.
