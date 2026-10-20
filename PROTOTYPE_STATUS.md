# Prototype status: VisionBuilders RTO Reduction (Meesho DICE S3)

Status of the prototype against the readiness checklist. ✅ Done · 🟡 Partial · ❌ Missing.

_Final status, 2026-10-04: every row is ✅. Rows marked "(team decision)" were built the way the team chose in place of the literal checklist wording; see "Adapted items" at the end._

**Team decisions:**
- **No simulated clock.** Time-based steps run from explicit simulator buttons. The 9 pm–9 am quiet-hours rule uses the device's real clock.
- **Only two customer accounts:** Existing User (Rekha Yadav) and New User (Kavita Patel). Walkthrough A runs on the New User.
- **IVR confirmation follows the checklist.** Only risk-flagged COD orders get it, and the Existing User is a medium-risk customer.

## Verification
- `npm run build` ✅ (tsc + vite).
- `npm run test:e2e` ✅: 5/5 Playwright tests pass (walkthroughs A–D plus the Reset-demo check).
  - Every test fails on any console error or page error, and none occurred.
  - Screenshots are in `screenshots/A-timing`, `B-doorstep`, `C-dispatch`, `D-redirect` and `reset`.
- "Reset demo" returns the store to the same seed every time (`e2e/z-reset.spec.ts`).

## 0. Foundation
| ID | Item | Status | Where in code | What is missing |
|---|---|---|---|---|
| F0.1 | Launcher with links to every app | ✅ | `src/apps/Launcher.tsx` | — |
| F0.2 | Shared store across apps | ✅ | `src/store/index.ts` (Zustand, persisted) | — |
| F0.3 | Seed data | ✅ (team decision) | `src/data/seed.ts`, `products.ts` | Seeded: Rekha (Hardoi 241001); riders Suresh, Imran, Deepak; Hardoi LMDC; "Floral Rayon Kurti" ₹499. Ramcharan is played by the New User |
| F0.4 | "Reset demo" | ✅ | Launcher → Settings | — |
| F0.5 | Activity Log `/log` | ✅ (team decision) | `store.events` (every event is still recorded) | The `/log` screen was removed at the team’s request; events are still logged in the store |
| F0.6 | Advance-time control | ✅ (team decision) | Simulator buttons in Seller & Transit, Hub, Rider | Each timed step is a button: "No tap in 10 min → Meesho calls", "3 hours later → second call", "Hold window ended → return", run Lock & publish, etc. |

## 1. Timing layer
| ID | Item | Status | Where in code | What is missing |
|---|---|---|---|---|
| T1.1 | Stepper Address → Delivery → Payment → Summary | ✅ | `customer/Checkout.tsx` | — |
| T1.2 | Heading + sub-text | ✅ | `lib/strings.ts` slotTitle/slotSub | — |
| T1.3 | Day chips | ✅ | `customer/SlotPicker.tsx` | — |
| T1.4 | Any time (fastest) + 3 windows | ✅ | SlotPicker | — |
| T1.5 | Capacity-based, Full greyed | ✅ | `services/slots.ts` | — |
| T1.6 | Hold banner + release | ✅ | SlotPicker `HoldTimer` | — |
| T1.7 | COD "Deliver on or after" | ✅ (team decision) | Checkout payment step (`cashDayTitle`) | Reworded in plain language at the team’s request: "Paying cash? When will you have the money? We will come on that day or later (for example, your salary day)." |
| T1.8 | Slot saved and shown everywhere | ✅ | OrderDetails, hub, rider | — |
| T2.1 | WhatsApp ping on hub scan-in | ✅ | Hub → Inbound "Scan in" → `flow.hubAccept` | — |
| T2.2 | Ping wording | ✅ | strings hcMessage/hcCash | — |
| T2.3 | Reply buttons | ✅ | `flow.sendHomeCheck` | — |
| T2.4 | Change → Held with owner + release date | ✅ | Hub → Held table (Owner, Release date, Held) | — |
| T2.5 | Add directions → door-pin flow | ✅ | `AddressEditor ?step=pin&return=order:` | — |
| T2.6 | Pay now → prepaid | ✅ | `flow.payNow` | — |
| T2.7 | Vaani voice call screen, hub-triggered | ✅ | Hub → Replies "Trigger automated call" → `ivr.ringVaani` → `customer/IvrCall.tsx` | — |
| T2.8 | Held > 3 days escalation | ✅ | Hub → Held "Escalate" flag | — |
| T3.1 | Order page header lines | ✅ | `customer/OrderDetails.tsx` | — |
| T3.2 | Live map card + 60 s refresh | ✅ | `DeliveryCards.TrackingCard`, `delivery.riderPosition` | — |
| T3.3 | "Suresh is 10 min away" | ✅ | `delivery.refreshArriving` (`arrivingMsg`) | — |
| T3.4 | Call / Message (masked) / I'm not home | ✅ | DeliveryCards | — |
| T3.5 | Not-home removes stop, no failed attempt | ✅ | `delivery.customerNotHome` | — |
| T3.6 | Open-box note on card | ✅ | OrderCards OpenBoxInfo | — |
| T3.7 | Map hidden after delivery, first name only | ✅ | TrackingCard | — |
| T4.1 | Seller missed dispatch / Transit delay | ✅ | `transit/TransitApp.tsx` (1/2/3-day picker each) | — |
| T4.2 | Delay wording | ✅ | strings delayMessage | — |
| T4.3 | Okay / Pick another time / Cancel for free | ✅ | DelayCard | — |
| T4.4 | Free cancel only before seller ships | ✅ | `flow.canCancelFree` (DelayCard + CancelFreeSheet) | — |
| T4.5 | New date shown | ✅ | — | — |

## 2. Doorstep layer
| ID | Item | Status | Where in code | What is missing |
|---|---|---|---|---|
| D1.1–D1.6 | Pin step, map, live DIGIPIN, link, skip/confirm | ✅ | `customer/AddressEditor.tsx`, `RemotePin.tsx`, `services/digipin.ts` | — |
| D1.7 | Address list badges + seeds | ✅ | `customer/Account.tsx` | — |
| D1.8 | OTP delivery within 30 m → L3 | ✅ | `delivery.learnDrop` (OTP-verified) + rider OTP entry | — |
| D1.9 | Rider "Next delivery" screen | ✅ | `rider/RiderApp.tsx` RiderStop | — |
| D1.10 | Call / door msg / calls made / Arrived | ✅ | RiderStop | — |
| D1.11 | Geofence-gated "Address not found" / "Customer unavailable" | ✅ | RiderStop + `delivery.canMarkAttempt` | — |
| D1.12 | Offline DIGIPIN decode + "No network" toggle | ✅ | `digipin.decodeDigipin`, RiderStop | — |
| D2.1 | Open-box only for COD Fashion & Home | ✅ | `data/products.ts` (kitchen off), `catalog.openBoxEligible` | — |
| D2.2–D2.5 | Seal photo, 2:00 timer, checklist, accept/refuse/abort | ✅ | `rider/OpenBoxFlow.tsx` | — |
| D2.6 | Reseal in tamper-evident bag + enter/scan seal ID | ✅ | OpenBoxFlow seal ID input + "Scan" | — |

## 3. Dispatch layer
| ID | Item | Status | Where in code | What is missing |
|---|---|---|---|---|
| P1.1 | Risk flag + reasons in log | ✅ | `services/ivr.ts` `confirmationRisk` | — |
| P1.2 | Flagged order-placed message | ✅ | `OrderPlaced.tsx` (`confirmPlaced`) | — |
| P1.3 | WhatsApp Confirm / Cancel | ✅ | `ivr.afterOrderPlaced`, Inbox | — |
| P1.4 | Call after no tap, exact script, keypad 1/2/End | ✅ | Transit "No tap in 10 min → Meesho calls", `IvrCall.tsx` | — |
| P1.5 | Second call + quiet hours | ✅ | Transit "3 hours later → second call", `ivr.inQuietHours`, "9 am → place queued call" | — |
| P1.6 | Never reached: medium ships / high held or cancelled + reorder | ✅ | `ivr.confirmCallMissed`, `cancelUnconfirmed` | — |
| P1.7 | Seller "Awaiting confirmation" hold | ✅ | Transit → Awaiting confirmation tab; Seller ships disabled | — |
| P2.1 | "Child PIN Lock" toggle | ✅ | `customer/ChildLock.tsx` | — |
| P2.2 | PIN modal | ✅ | ChildLock PinGateSheet | — |
| P2.3 | Forgot PIN → OTP | ✅ | ChildLock ResetFlow | — |
| P2.4 | 3 wrong → 5 min pause + owner WhatsApp alert | ✅ | `services/childLock.ts` verifyPin | — |
| P3.1–P3.3 | Run cards, plan summary, map | ✅ | `services/routing.ts`, `hub/RunPlanner.tsx` | — |
| P3.4 | DIGIPIN-6 clustering | ✅ | `routing.cluster6` + planRun cluster→rider | — |
| P3.5 | Fewest-km order; not-home/no-reply last; +2 min open-box | ✅ | `routing.nnOrder`, `laneStats.minutes` | — |
| P3.6 | Rider lanes | ✅ | RunPlanner | — |
| P3.7 | Move stop with reason; rider flags failure | ✅ | `routing.moveStop`, `delivery.markAttempt` | — |
| P3.8 | Live re-plan on "I'm not home" | ✅ | `delivery.resequenceRemaining` | — |
| P3.9 | Start route disabled until published | ✅ | RiderApp | — |

## 4. Redirect loop
| ID | Item | Status | Where in code | What is missing |
|---|---|---|---|---|
| R1.1 | Refusal reason + seal ID | ✅ (team decision) | OpenBoxFlow → `openbox.refuseAfterInspection` | Open-box refusals are opened at the door, so they go back to the seller; only RTO parcels (never opened) enter the Redirect Loop |
| R1.2 | QC → redirect shelf / return | ✅ (team decision) | Hub → Returns / Redirect packaging check → `redirect.runQualityCheck` | The parcel stays sealed: the check is from the outside (seller seal, label vs order, box condition) |
| R1.3 | Local Demand Score + inputs | ✅ | `redirect.demandFor`, RedirectCard | — |
| R1.4 | Cart & wishlist match, top 5 / next 5 | ✅ | `redirect.nearbyMatches`, "Nudge top 5" / "Nudge next 5" | — |
| R1.5 | Buyer notification, price ≥ listing | ✅ | `redirect.nudge` (listing price, "Buy now") | — |
| R1.6 | "Ready near you" home strip | ✅ | `customer/HomeFeed.tsx` ReadyNearYou | — |
| R1.7 | Sale closes first order, new label, next-day route | ✅ | `redirect.buyRedirect`, LabelButton | — |
| R1.8 | Hold window per category, 3-day cap | ✅ | `HOLD_DAYS`, `enforceHoldCap`, "Hold window ended → return" | — |
| R1.9 | ₹10 bonus counter | ✅ | Returns tab "Hub bonus" card | — |
| R1.10 | 1 nudge per buyer per week; push first | ✅ | `redirect.nudge` | — |

## 5. Seller / transit simulator
| ID | Item | Status | Where in code | What is missing |
|---|---|---|---|---|
| S1.1 | Seller ships → In transit → Reached hub | ✅ | `transit/TransitApp.tsx`, `flow.sellerShips/markInTransit/reachedHub` | — |
| S1.2 | Missed dispatch / transit delay | ✅ | TransitApp DelayPicker | — |
| S1.3 | Awaiting confirmation, refusal photos, redirect sales | ✅ | Transit tabs | — |

## 6. Hub Manager tabs
| ID | Item | Status | Where in code | What is missing |
|---|---|---|---|---|
| H1.1–H1.5 | Inbound, Replies, Held, Routes, Live | ✅ | `hub/HubConsole.tsx` tabs | — |
| H1.6 | Disputes incl. "address not found" | ✅ | DisputesView ("Address not found" for review) | — |
| H1.7 | Returns / Redirect | ✅ | `hub/RefusalsView.tsx` RedirectCard | — |
| H1.8 | Trigger automated call | ✅ | Replies tab → call screen on the customer phone | — |

## 7. Cross-checks
| ID | Item | Status | Where in code | What is missing |
|---|---|---|---|---|
| X1 | Valmo vs 3PL ("Valmo only" labels) | ✅ | Checkout (3PL), OrderDetails PartnerCard, Transit destination column, label | — |
| X2 | Label preview with DIGIPIN + QR | ✅ | `components/ShippingLabel.tsx` (Transit, hub drawer, redirect sale) | — |
| X3 | Masked numbers | ✅ | seeds + label | — |
| X4 | Nothing blocks an order | ✅ | — | — |
| X5 | Hindi / English toggle on messages | ✅ | Account → Language | — |
| — | Colours plum `#5E1A47` / orange `#F7941D` | ✅ | `tailwind.config.js` | — |

## Adapted items (built differently from the literal checklist, by team decision)
- **F0.3 Ramcharan:** not seeded. The team kept only the Existing User and New User accounts. Walkthrough A runs on the New User (Kavita Patel), who is also a first-time COD buyer.
- **F0.6 Advance time:** no clock. Every time-triggered event has a button, so a demo never waits on a timer.
  - The one exception is quiet hours (no calls 9 pm–9 am). It follows the device's real clock; outside 9 am–9 pm the call is queued and Transit shows "9 am → place queued call".
- **Map tiles** come from OpenStreetMap and need internet. Offline, the map shows "Map tiles couldn't load" while the pin and DIGIPIN keep working, and the rider's "No network" mode decodes the DIGIPIN on the phone.
