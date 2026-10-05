# Meesho DICE: Delivery Orchestration Prototype

A clickable web prototype of **VisionBuilders' RTO-reduction solution** for Meesho (DICE S3). It simulates the whole delivery journey across five apps that share one live store: **Customer**, **Seller & Transit**, **Hub Manager**, **Rider** and **Network Ops**, plus an **Activity Log**.

Everything is simulated, with no backend and no real WhatsApp, calls, payments or map APIs. All data lives in your browser.

---

## 1. What you need

| Tool | Version | Check with |
|---|---|---|
| **Node.js** | 18 or newer (developed on 22) | `node -v` |
| **npm** | comes with Node.js | `npm -v` |
| A modern browser | Chrome, Edge or Firefox | — |
| Internet | only for the map tiles (OpenStreetMap) and the first `npm install` | — |

If you don't have Node.js, download the **LTS** version from https://nodejs.org and install it with the default options. Close and reopen your terminal afterwards.

---

## 2. Download the code

Pick one of the two options.

**Option A: ZIP file**
1. Download the project ZIP (from GitHub: **Code → Download ZIP**, or the file shared with you).
2. Right-click the ZIP and choose **Extract All…**, e.g. to `Desktop\Meesho Prototype`.

**Option B: Git**
```bash
git clone <repository-url> "Meesho Prototype"
```

---

## 3. Install and run

Open a terminal in the project folder. On Windows: open the folder in File Explorer, click the address bar, type `cmd`, and press Enter.

**Step 1: install the dependencies (first time only, takes 1–2 minutes)**
```bash
npm install
```

**Step 2: start the app**
```bash
npm run dev
```

**Step 3: open the app.** The terminal prints a link like `http://localhost:5173/`. Open it in your browser.

To stop the app, press **Ctrl + C** in the terminal.

> If port 5173 is busy, Vite picks the next free port (5174, …). Use the link the terminal shows.

---

## 4. Using the prototype

The first page is the **Launcher**. Pick a role:

| Tile | What it is |
|---|---|
| **Existing User** | Rekha Yadav: 3 saved addresses, past orders, a medium-risk COD buyer |
| **New User** | Kavita Patel: no address yet, a first-time COD buyer |
| **Seller & Transit** | Simulator: Seller ships → In transit → Reached hub, delays, awaiting confirmation |
| **Hub Manager** | Hardoi LMDC / Pune: Inbound, Replies, Held, Routes, Live, Disputes, Returns / Redirect, Risk |
| **Rider** | Suresh, Imran, Deepak (Hardoi): stop-by-stop delivery, open-box check, OTP |
| **Network Ops** | PeakPromise festive demand vs capacity |
| **Activity Log** | Every event, with who, what, when and the feature ID |

Tips:
- **No clock:** nothing happens on a timer. Every step (ship, scan in, plan the run, call…) is a button in one of the apps.
- **Use several tabs:** open each app in its own browser tab; they all share the same data.
- **Reset demo** (Launcher → Settings) puts everything back to the starting data.
- **Show feature tags** (Launcher → Settings) shows feature IDs such as `C1-F2` on screen.
- **Delivery OTP:** the rider screen shows the customer's OTP, or tap **Customer reads it out**.
- **Quiet hours:** confirmation calls follow your computer's clock. Between 9 pm and 9 am they are queued; press **"9 am → place queued call"** in Seller & Transit.

For a guided demo, follow:
- [DEMO_STEPS.md](DEMO_STEPS.md): click-by-click steps covering every feature.
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md): the same story in shorter parts, with what to say.

---

## 5. Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app for local use (with live reload) |
| `npm run build` | Type-checks and builds a production version into `dist/` |
| `npm run preview` | Serves the built `dist/` folder locally (run `npm run build` first) |
| `npm run test:e2e` | Runs the Playwright walkthroughs A–D and the Reset check; screenshots go to `screenshots/` |

The automated tests need a browser that Playwright downloads once:
```bash
npx playwright install chromium
```

---

## 6. Project structure

```
src/
  apps/
    Launcher.tsx      role picker, Reset demo, settings
    customer/         customer phone app (checkout, orders, messages, IVR call, child lock…)
    transit/          Seller & Transit simulator
    hub/              Hub Manager console (tabs, run planner, redirect loop, risk)
    rider/            Rider app (stops, open-box flow, OTP)
    ops/              Network Ops forecast
    log/              Activity Log
  services/           business logic (slots, routing, delivery, IVR, redirect, DIGIPIN, child lock…)
  store/              shared Zustand store, saved in the browser's localStorage
  data/               seed data (customers, hubs, riders, products, dummy parcels)
  lib/                strings (English / Hindi), formatting, time helpers
public/products/      product photos
e2e/                  Playwright walkthroughs
```

**Tech stack:** React 18, TypeScript, Vite 5, Tailwind CSS, React Router, Zustand, React-Leaflet (OpenStreetMap), dayjs, qrcode.

**More documentation:**
- [PROTOTYPE_STATUS.md](PROTOTYPE_STATUS.md): checklist status for every feature.
- [ASSUMPTIONS.md](ASSUMPTIONS.md): design decisions and simplifications.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `npm` / `node` is not recognised | Install Node.js LTS, then reopen the terminal |
| `npm install` fails | Check your internet connection. Delete the `node_modules` folder and `package-lock.json`, then run `npm install` again |
| The page is blank or shows old data | Click **Reset demo** on the Launcher, or hard-refresh with Ctrl + Shift + R |
| Maps are grey | The map tiles need internet. Pins and DIGIPINs still work offline |
| No incoming call after "Meesho calls" | Open the **Customer** tab. Between 9 pm and 9 am, use **"9 am → place queued call"** first |
| Port already in use | Use the URL printed in the terminal, or stop the other server |
