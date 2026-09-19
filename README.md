# Aasra

Family scam-shield for Indian senior citizens. React + Vite + Tailwind v4.

Family signs in with email. The elder phone uses a 6-digit pairing code and a 4-digit PIN. If Firebase is configured, both devices sync over the internet through `households/{id}/actions`. If `.env` is missing, they fall back to `BroadcastChannel` for a same-browser demo.

## Setup

```bash
npm install
npm run dev
```

`npm run dev` already uses `vite --host`, so other devices on the same Wi-Fi can open the app.

| Screen | URL |
| --- | --- |
| Chooser | `/#/` |
| Elder phone | `/#/parent` |
| Family dashboard | `/#/child` |

After sign-in, routing follows role: family always sees the dashboard, elder always sees the parent phone. Press `` ` `` on any screen to open **SimulationPanel**.

## Firebase (free Spark plan)

Internet sync and real accounts need a free Firebase project. Do **not** enable Storage. Voice clips stay inside the action as a short base64 data URL (max 30 seconds).

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and create a project (Spark / no billing).
2. Add a **Web** app. Copy the config values.
3. Build > **Authentication** > Sign-in method > enable **Email/Password** and **Anonymous**.
4. Build > **Realtime Database** > Create database > start in **test mode**, then paste the rules below.
5. Copy `.env.example` to `.env` and fill:

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

6. Restart `npm run dev` so Vite picks up `.env`.

### Realtime Database rules

Open `database.rules.json` in this repo. In the Firebase console go to **Realtime Database > Rules**, replace the editor contents with that file, and **Publish**.

Those rules allow only authenticated members of a household to read or write `households/{householdId}`. Pairing-code lookup requires a signed-in user (the elder phone uses Anonymous Auth). User records at `users/{uid}` can only be read or written by that user.

Without `.env`, Aasra still runs. Sync then uses BroadcastChannel, which works between tabs in the **same** browser profile only.

## Test with two browsers (Firebase)

1. Add `.env`, enable Email/Password + Anonymous auth, publish `database.rules.json`, restart the dev server.
2. Browser A (laptop): `#/child` → create an account → fill elder name, age, city, language, safe UPI list. Copy the 6-digit pairing code from **Settings**.
3. Browser B (or the phone): `#/parent` → type the pairing code → set a 4-digit PIN → confirm PIN.
4. Check in, send a voice message, or simulate a UPI block. The other device should update.
5. Close the elder tab and reopen `#/parent`. Only the PIN pad should show. Three wrong PINs lock the pad for 30 seconds.
6. Dashboard **Settings → Sign out**. On the elder phone, press and hold **Aasra** in the header to sign out.

Demo shortcuts (visible while DEMO_MODE is on): **Demo: Family** and **Demo: Amma** sign in to the seeded household `aasra-demo` (pairing code `123456`, PIN `1234`).

## Test the offline fallback (no Firebase)

Open two tabs in the same browser:

1. Tab 1: `#/` or `#/child` → **Demo: Family**.
2. Tab 2: `#/parent` → **Demo: Amma**.

Actions copy across those tabs. Two different Chrome profiles will **not** sync until Firebase is configured.

You can also create a 6-digit code on the family login screen and pair the elder phone (code, then PIN) without Firebase.

## Review 2 demo script

Use this for a live walkthrough (~20 seconds of playback, plus talk-over).

1. Laptop at **1366×768**: open `#/` → **Demo: Family**.
2. Phone at **390px** (or a second tab): open `#/` → **Demo: Amma**.
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
   - Open **Settings** for the pairing code and **Sign out**.

**Stop demo** cancels the remaining steps. **Reset demo** wipes the live board (not the household or pairing code).
