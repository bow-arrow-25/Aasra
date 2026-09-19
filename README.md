# Aasra

Family scam-shield for Indian senior citizens. React + Vite + Tailwind v4.

Parent phone and family laptop stay in sync through a 6-digit room. If Firebase is configured, they sync over the internet. If `.env` is missing, they fall back to `BroadcastChannel` for a same-browser demo.

## Setup

```bash
npm install
npm run dev
```

`npm run dev` already uses `vite --host`, so other devices on the same Wi-Fi can open the app.

| Screen | URL |
| --- | --- |
| Chooser | `/#/` |
| Parent phone | `/#/parent` |
| Family dashboard | `/#/child` |

Press `` ` `` on any screen to open **SimulationPanel**.

## Open the parent view on a real phone

1. On the laptop, run `npm run dev` (or `npx vite --host`).
2. Note the Network URL Vite prints, for example `http://192.168.1.24:5173/`.
3. Put the phone on the **same Wi-Fi**.
4. On the phone browser open `http://YOUR-LAN-IP:5173/#/parent`.
5. On the laptop open `http://localhost:5173/#/child`, create a 6-digit room, then type that code on the phone pad.

Windows may need to allow Node through the firewall the first time.

## Firebase Realtime Database (free Spark plan)

Internet sync needs a free Firebase project. Do **not** enable Storage. Voice clips stay inside the action as a short base64 data URL (max 30 seconds).

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and create a project (Spark / no billing).
2. Add a **Web** app. Copy the config values.
3. Build > **Realtime Database** > Create database > start in **test mode**.
4. Copy `.env.example` to `.env` and fill:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

`VITE_FIREBASE_DATABASE_URL` looks like `https://YOUR-PROJECT-id-default-rtdb.firebaseio.com`.

5. Restart `npm run dev` so Vite picks up `.env`.

Test-mode rules (Spark, demo only):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Without `.env`, Aasra still runs. Sync then uses BroadcastChannel, which works between tabs in the **same** browser profile only.

## Test with two browser profiles (internet)

1. Add `.env` and restart the dev server.
2. Profile A: `#/child` → **Create 6-digit code**.
3. Profile B (or the phone): `#/parent` → enter the same code.
4. Check in, send a voice message, or simulate a UPI block. The other device should update.
5. **Reset demo** clears `rooms/{code}` and both screens.

## Test the offline fallback (no Firebase)

Open two tabs in the same browser: `#/child` and `#/parent`, join the same code. Actions copy across tabs. Two different Chrome profiles will **not** sync until Firebase is configured.

## Review 2 demo script

Use this for a live walkthrough (~20 seconds of playback, plus talk-over).

1. Laptop at **1366×768**: open `#/child` and create a 6-digit room.
2. Phone at **390px** (or a second tab): open `#/parent` and type the same code.
3. On the laptop, press `` ` `` to open SimulationPanel.
4. Leave **DEMO_MODE** on (15-second escalation and 15-second call alarm). Turn it off only if you want real 2-minute / 20-minute timers.
5. Optionally click **Enable desktop alerts** on the family dashboard and allow notifications.
6. Click **Run full demo**. It waits 3 seconds between steps:

   1. Parent check-in (“I am okay”)
   2. KYC call answered (parent overlay + critical event)
   3. 20-minute call alarm (critical event; parent banner)
   4. ₹25,000 UPI blocked (Refund Officer)
   5. Family rejects the payment
   6. Parent sends a voice message to family

7. Watch both screens together: parent phone shows the call, alarm, and blocked/rejected payment; family dashboard logs each event, shows the **Reject** action, then the voice clip.
8. Optional extras after the script:
   - Leave a new CRITICAL event unacked for 15 seconds → **Escalated to Meera** badge.
   - Hide the family tab, trigger a WARN/CRITICAL event → desktop notification.
   - Press **Report to 1930** on a critical event.

**Stop demo** cancels the remaining steps. **Reset demo (clears room)** wipes the board and the room code — use that only when the walkthrough is over.
