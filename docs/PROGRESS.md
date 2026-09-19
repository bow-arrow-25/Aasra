# Aasra Round 2 progress

Scanned `src/` on 19 Sep 2026. Status is **Done** only when the code path exists **and** is wired into the UI. No source files were changed for this review.

| Round 2 plan item | Status | Main file(s) | What works / what’s missing |
| --- | --- | --- | --- |
| Family login (email) + elder login (pairing code + PIN) | Partial | `src/components/RoomScreen.jsx`, `src/App.jsx`, `src/context/GlobalState.jsx` | Family creates or joins a 6-digit room; elder types that code on a large keypad. No email/password family login, and no elder PIN. |
| Payment guard with ₹10,000 rule | Done | `src/lib/rules.js`, `src/context/GlobalState.jsx`, `src/ParentView.jsx`, `src/components/SimulationPanel.jsx` | `amount > 10000` and payee not on the safe list is **BLOCKED**; unknown payees under the cap go to **HOLD**; safe/small payments **ALLOW**. Overlay + events are wired. |
| Family Approve/Reject | Partial | `src/ChildDashboard.jsx`, `src/context/GlobalState.jsx` | Family **Reject** is on the dashboard and in SimulationPanel; parent then sees “Family said no”. There is no **Approve** action. |
| Cooling-off timer | Not started | — | No wait period before a large payment can complete. HOLD is a family-check flag, not a timer. |
| Scam-call warning + live call analyser + 20-min alarm | Partial | `src/ParentView.jsx`, `src/context/GlobalState.jsx`, `src/components/SimulationPanel.jsx` | Scam/KYC overlay, hang-up, and 20-minute alarm (15s in DEMO_MODE) are wired. No live analyser (no call transcript or keyword scan). |
| SMS analyser + family Mark as spam | Not started | — | No SMS inbox, scoring, or Mark as spam control. |
| Payments tab + collect-request warning | Not started | — | No payments tab and no UPI collect-request warning. Payments only appear as parent overlay + event log. |
| Reminders with pop-up on elder screen | Not started | — | No reminder model, schedule, or elder pop-up. |
| Two-way voice messages | Done | `src/components/VoiceRecorder.jsx`, `src/components/VoiceMessageList.jsx`, `src/ParentView.jsx`, `src/ChildDashboard.jsx` | Elder and family can record (max 30s) and play clips; unheard family clips banner on the elder home screen. |
| One-tap 1930 report | Done | `src/components/ReportModal.jsx`, `src/ChildDashboard.jsx` | Critical events show **Report to 1930**: draft, copy, `tel:1930`, cybercrime.gov.in, download. Elder screen has no report button. |
| Telugu/Hindi + read-aloud | Partial | `src/lib/i18n.js`, `src/lib/speak.js`, `src/components/LanguageToggle.jsx`, `src/ParentView.jsx` | EN/TE/HI toggle and read-aloud on elder call, payment, and check-in. Several Telugu strings still English; family dashboard is English-only. |
| Firebase two-device sync | Done | `src/lib/sync.js`, `src/context/GlobalState.jsx`, `src/components/RoomScreen.jsx` | Same room syncs over Firebase Realtime Database when `.env` is set; otherwise BroadcastChannel (same-browser demo). |
| Notifications + escalation | Done | `src/ChildDashboard.jsx`, `src/context/GlobalState.jsx` | Hidden-tab desktop alerts for WARN/CRITICAL + parent voice; unacked CRITICAL/HOLD escalates to Meera (15s demo / 2 min live). Needs the family tab to stay open. |
| Simulation panel | Done | `src/components/SimulationPanel.jsx`, `src/App.jsx` | Backtick toggles the panel on every route. Full demo plus individual check-in, calls, UPI, reject, and reset. |

## Known bugs

- Elder voice check-in joins **all** SpeechRecognition results, so after one “I am okay” it can keep checking in every 8 seconds for the rest of the home-screen session (`src/ParentView.jsx`).
- 20-minute call alarm and escalation timers run only when `role === "family"`. If the family dashboard tab is closed, the elder phone never alarms or escalates.
- Family can Reject but cannot Approve; the elder dismisses HOLD/BLOCK with **Got it**, which clears the overlay without a family yes.
- `setLang` / `setDemoMode` are published as room actions, so one device’s language or DEMO_MODE toggle can overwrite the other.
- Several Telugu strings are still English (`checkedIn`, `scamBody`, `rejectedBody`, `roomHint`, `micPermissionDenied` in `src/lib/i18n.js`).
- README says **Reset demo (clears room)** wipes the room code; `resetDemo` clears Firebase/BroadcastChannel data but keeps `roomCode` in session, so both screens stay joined.
- Desktop notifications never fire while the family tab is visible, and never fire if that tab is closed (no push / FCM).
