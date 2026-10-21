# Assumptions and design decisions

The build follows **Combined PRD v3** (`Combined_PRD_Prototype_Build_Spec_v3.md`). This file records choices made where v3 is silent or ambiguous.

## Navigation and apps
- **Launcher (`/`)** has tiles for Existing User, New User, Seller & Transit, Hub Manager (hub picker), Rider (rider picker), Network Ops and Activity Log. Settings: *Show feature tags* and *Reset prototype data*, which asks for confirmation in-page.
- **No global top bar.** Every app header has a "Switch app" grid icon (top-right) that returns to the Launcher.
- **Back behaviour:** back goes to the previous screen in the app. With no history, it goes to the app's home (`useBack`).
- **Hub tabs** live in the URL (`?tab=`), so browser back moves between them. Tabs for later phases show but are disabled, with a note of the phase they arrive in.
- **Seller & Transit:** "Report transit delay" shows but stays disabled until Phase 5 (C1-F5), where v3 puts it.
- **Feature tags** only show when the Launcher's *Show feature tags* setting is on. They sit on each new-feature element.

## Data and seed
- **Existing User = Rekha Yadav**, 12 delivered orders, `pastRefusalReasons: ['not_available']`. Addresses:
  - **Home** (241001): L3. Two past drops ~12 m apart; learned point = their midpoint. The GeoIndia cell is ~350 m off.
  - **Shop** (241121): L2, pinned, with a DIGIPIN. ~5.8 km from the hub, so it falls in the far zone.
  - **Other** (411038, son's hostel): L1.
  - 4 past delivered orders. One of them is the lowest listing of the bedsheet cluster.
- **New User = Kavita Patel.** No address, no orders.
- **Walkthrough A's "Printed Cotton Saree"** is the old "Chanderi Cotton Saree" renamed. Its photo file is now `printed-cotton-saree.jpg`.
- **Known pincodes:** the four pilot pincodes, plus four non-pilot ones (226001 Lucknow, 110001 Delhi, 400001 Mumbai, 560001 Bengaluru).
  - Non-pilot pincodes get `hubId = null`: standard 3PL delivery, promised +5 days, no slot step, no open-box. "Complete fulfilment" marks them shipped via 3PL.
  - Pincodes outside this list are rejected, because the prototype has no geocoder.
- **Promised date:** +2 days for the metro hub, +3 days for the tier-2/3 hub.
- **`Address.truePoint`** is where the door really is. "Use my current location" lands within ~8 m of it. New addresses get a GeoIndia guess and a true point, each within ±300 m of the pincode centre.
- **Addresses are soft-deleted**, so orders already delivered still show their address. Delete is blocked while an active order uses the address (v3 §9.2).
- **The first address saved becomes the default.** The product page's "Change" sets a per-account *deliver to* address. Checkout starts with it selected.
- **Forecast baseline:** P50 ≈ 68% of capacity, not v3's 80%. At 80%, P90 (×1.25) equals capacity, which would make every normal day amber. The "else" bottleneck value is 0.1, per v3.
- **Slot inventory:** 5 days × 3 windows per hub. Two windows are pre-filled to Full: Hardoi day 2 evening and Pune day 2 morning.
- **Customers have no `tier` field in v3.** The rescue engine (Phase 6) will take tier from the order's hub.

## C2-F1 map pin
- **The editor is two steps:**
  1. *Pin step*: pincode first, because the map needs a centre, then the map.
  2. *Details step*.
- **When the pin step shows:** new addresses, and edits of L0/L1 addresses, start on the pin step. L2/L3 edits start on details, with an "Adjust pin" link.
- **Map:** Leaflet with OpenStreetMap tiles. Tapping the map also moves the pin. The dashed circle is the GeoIndia guess (~200 m). A tile failure shows a notice, and the pin and DIGIPIN keep working.
- **Confidence on save:** L2 if pinned, otherwise L1. An address that has learned drops stays L3.
- **"Send a link to pin it"** skips the pin now. After Save, a WhatsApp-style message with a link to `/pin/:addressId` lands in Messages. Pinning there sets L2 (source `remote`) and marks the message "Pinned".
- **DIGIPIN** was verified against the spec's reference value: Dak Bhawan (28.622788, 77.213033) → `39J-49L-L8T4`.

## C3-F1 price transparency
- **"Lowest price"** means the listing is the (joint) cheapest in a cluster with more than one seller. Single-seller items get no badge.
- **Post-order suppression** hides every listing of a cluster while the customer has an order from it that isn't closed (delivered, cancelled, refused or RTO). The feed shows a small "Hiding N listings…" note.
- **The compare sheet** shows price, seller, rating, delivery date (same address for every listing) and open-box eligibility. *Switch* replaces the page, so back doesn't return to the pricier listing.

## C1-F2 home check (built ahead of Phase 5 to keep the flow working)
- **Hub Accept** → status `ACCEPTED`, `homeCheck = awaiting`, plus a WhatsApp-style message and a card.
- **Deduplication:** one message per customer per delivery date. A second parcel for the same date is appended to the first message, and its buttons act on both orders.
- **Replies:**
  - *Yes* → `homeCheck = yes`.
  - *Change day/time* → `HELD` + `change_requested`. The hub's *Release* moves it back to `ACCEPTED`, keeping `change_requested`.
  - *Add directions* saves to `Address.directions` and sends a confirmation line.
- **Mark no reply** (hub) → `no_reply` plus a Vaani voice message in Messages. It never cancels the order.
- **Change time** is allowed until PLANNED, at most 2 changes. Before the parcel reaches the hub, a change only updates the slot.

## C2-F3 open-box
- **Offered to every customer (team decision).** v3 limited it to customers with fewer than 3 delivered orders or a past wrong-item refusal. Eligibility is now:
  - the category allows open-box, and
  - the address has a pilot hub.
- **COD is still required.** The customer inspects before paying, so refusing at the door involves no refund. The badge text says "on Cash on Delivery".
- **The badge** shows on the feed and the product page. `order.openBox` is fixed at Place order.

## C1-F1 slots, need-by, cash day (Phase 4)
- **Capacity:** effective = floor(capacity × (1 − hub.bufferPct/100)). A window is open while confirmed + active holds is below effective. Capacity per window = per-rider capacity × riders: Hardoi 9 × 3 = 27, Pune 12 × 3 = 36.
- **Holds** are records with an expiry time (10 minutes), not a `reserved` counter. An expired hold simply stops counting, so abandoned checkouts never leak capacity. `SlotInventory.reserved` stays 0.
- **Hold lifecycle:**
  - Picking another window, day or address, or starting a new checkout, releases the previous hold.
  - When the countdown ends, the hold is released and the customer sees "Tap the time again to hold it".
  - Place order still re-checks availability. If the window filled meanwhile, checkout returns to the Delivery step with "That time just filled up".
- **"Any time (fastest)"** is the default and never uses window capacity.
- **Date chips:** the promised date plus the next 3 days. Rows beyond the seeded 5 days are created on demand with the same deterministic fill.
- **Two seeded "Full" windows** sit on each hub's promised day, so the demo shows them: Hardoi day 3 Evening, Pune day 2 Morning.
- **Need it by a date?** offers chips from the day before the promise to +5 days. If the chosen slot is after the need-by date, an inline warning appears. The delay alert (C1-F5) comes in Phase 5.
- **Cash day (COD only, on the Payment step):** "Any day" or promised … +4 days. If the chosen slot is earlier than the cash day, delivery moves to the cash day, keeping the window if it's open (otherwise Any time), with a toast.
- **Change time after ordering** uses the same picker and moves the booking between windows (−1 / +1). Full windows are refused. It's allowed only for pilot-hub orders, until PLANNED, at most 2 changes.
- **Non-pilot addresses:** the Delivery step shows "Time slots aren't available for this address yet. It will arrive by {date}".

## C1-F5 transit delay (Phase 5)
- **"Report transit delay"** (Seller & Transit, PLACED orders only) sets the new date to the *current slot date* + 2 days. v3 says "promised + 2"; using the slot date keeps it a real delay when the customer already picked a later slot. Status becomes `DELAYED_IN_TRANSIT`.
- **Customer alert:** a WhatsApp-style message and a delay card, which takes top precedence on the order page. Buttons:
  - **Okay** → back to PLACED on the new date, keeping the window if it's open.
  - **Pick another time** → slot picker starting at the new date.
  - **Cancel for free** → in-page confirm sheet, then CANCELLED. The slot booking is released and `reverse_trip_avoided` is logged.
- **Need-by:** if `needBy` is before the new date, the message and card add "You said you need it by … It won't make it, so you can cancel for free now". The cancel button becomes the primary action.
- **No reply:** Transit can still press **Complete fulfilment**. The parcel continues on the new date; nothing is ever auto-cancelled.

## C3-F2 rescue engine (Phase 6)
- **Formula:** v3 §10.3, verbatim. The `tier` term uses the order's hub tier (customers have no tier in v3).
- **When it runs:** on Place order, on Hub Accept, and again when the customer answers "Yes, I'll be there", because the availability term drops by 0.10.
- **Holdout:** a stable hash of the order ID puts 10% of orders in a holdout, shown in the Risk tab. As v3 says, the ping is still sent to holdout orders.
- **Action column:** the Risk tab derives it from the v2 policy table (band ≥ medium and not holdout). It is not stored on the order.
- **Calibration caveat:** with the v3 weights, a typical tier-3 COD order scores p(RTO) ≈ 0.45–0.65 ("high", top reason Availability), well above the real ~24% COD RTO. Expected successful drops therefore look low. The rules are kept as specified until the team re-tunes the weights.

## C3-F3 routing (Phase 6)
- **Background parcels:** each hub is seeded with the day's parcels from other shoppers, already ACCEPTED with mixed home-check replies. Hardoi has 12, 2 of them in the far zone, with enough COD to hit the cash limit. Pune has 7. They're marked as background customers and never appear in the Launcher.
- **Candidates** are ACCEPTED orders (HELD excluded). Slot dates are ignored, so the plan covers every accepted parcel. There's no clock, so there's no "today" filter.
- **Delivery point:** learned > pin > GeoIndia cell. Far zone = more than 5 km straight-line from the hub. The last rider takes the far-zone run and is left out of the normal pool.
- **Capacity:** `capacityPerWindow` per rider per window. "Any time" counts only against the rider's day total (3 × per-window). Cash: COD sum ≤ ₹15,000 per rider.
- **Carried stops:** stops already published to a rider count against capacity and cash when planning again.
- **Unassigned reason:** `cash_limit` when some rider had capacity but not cash room, otherwise `over_capacity`.
- **Distance and drops:** km = straight-line path hub → stops × 1.3 road factor. Expected successful drops = Σ(1 − pRto).
- **Lane order:** stops are ordered by window, then sweep angle.
- **Move stop** needs a reason. It's a manager override, so it bypasses the capacity and cash checks, and it's logged.
- **Publish** marks orders PLANNED with `route {riderId, seq}` and appends to each rider's `routeOrderIds`. The rider app shows the stop list; Start route and stop actions come in Phase 7. The customer sees "{Rider} from Meesho Delivery will bring your parcel …".

## Delivery runs and cut-offs (team decision, replaces the single "Plan routes")
- **Runs:** each hub plans a delivery date as three runs: Morning (cut-off 8:30 am), Afternoon (11:30 am) and Evening (3:30 pm). There's no clock, so the cut-off is shown as text and the hub presses **Plan** and then **Lock & publish** per run.
- **Which run a parcel belongs to:** its own window. **Any time** goes in the Morning run only if the customer confirmed; otherwise it goes in the Afternoon run, sequenced after the confirmed stops.
- **No reply:** never holds or cancels a parcel. A chosen window is treated as the availability signal. Unconfirmed parcels go out marked "Unconfirmed", and the rider calls ahead.
- **Carry-over:** a parcel carries into a later run only once its own run is locked without it (it didn't fit). Parcels overdue from an earlier day go into the first open run of the next planned date. Carry-overs are assigned first.
- **Held parcels** rejoin automatically when their new date's run is planned (`hold_released`, auto). **Release now** remains in the Held view for earlier runs.
- **Limits:** per-run capacity is `capacityPerWindow` per rider. The ₹15,000 COD limit is per rider per *day*, so cash from earlier runs that day counts.
- **Background parcels** are due on each hub's promised day (Hardoi +3 days, Pune +2), the same day a demo order placed now is due, so they share runs.
- **Change time** stays allowed until the parcel's run is published (PLANNED). The customer sees "You can change this until {cut-off} on {date}".

## Hub Manager layout
- **Today board** for a chosen delivery date:
  1. Incoming.
  2. Home-check replies: summary chips, plus only the people who still need chasing.
  3. Runs: three cards, then the plan with a map, lanes and anything that won't fit.
  4. Riders: live progress.
- **Held, Disputes, Refusals & RTO and Risk** are secondary views.
- **Tables** show customer and area, slot, one status chip and one risk dot. Clicking a row opens a drawer with the full detail and contextual actions.

## Phase 7: rider, tracking, attempts
- **Starting a run:** a rider starts one published run at a time, the earliest not yet started, and must finish it first. Its stops go OUT_FOR_DELIVERY, and customers get a push and live tracking.
- **Tracking:** stops away = position among the rider's remaining stops. ETA = now + (stops away + 1) × 9 min ± 20 min, rounded to 15 min. ARRIVING_SOON and "about 10 minutes away" are sent once, when a stop is 2 or fewer away, including at the start.
- **Rider position** (maps) = the last finished stop, else the hub.
- **Masked calls (C1-F4)** are simulated: confirmed customers answer, others don't. Every call counts toward the verified-attempt rule. Customer quick replies appear on the rider's stop screen.
- **Mark attempt (C2-F4)** needs Arrived AND (2 calls OR a door message). Pressing it earlier logs `attempt_button_locked` and shows "Call twice or send a door message first".
- **Delivered:** earnings go up by ₹13.5 and the customer's `deliveredOrders` by one. The drop point is the real door with up to ~15 m of offset. Two drops within 30 m → L3, with the learned point at their midpoint (C2-F2). The rider's note chip is saved as the address's rider note.
- **"I'm not home":** the customer picks a new slot and the parcel goes to HELD, with no failed attempt. The rider sees "Customer not home, skip" and a **Skip stop** button.
- **"I was here, no one came":** the attempt is marked disputed (open) and shows in Hub → Disputes with the evidence. The parcel is re-queued for the next day in the same window. The hub resolves it as customer right or rider right; nothing is ever deducted automatically.
- **"Yes, I missed it"** → pick a new slot → HELD.
- **Background customers** don't answer attempt notices, so their failed parcels stay ATTEMPT_FAILED. Phase 8 adds "Mark RTO" after 3 failed attempts.

## Fixes after Phase 7 review
- **Open-box display** no longer depends on having an address. It shows whenever the category allows it, and hides only once the chosen address is known to be outside the pilot hubs. At checkout it still needs COD and a pilot-hub address.
- **Transit delay length:** Seller & Transit picks 1, 2, 3 or 5 days. The new date = current slot date + that many days.
- **Risk for the hub manager is shown as an instruction.** Rows show a *next best action* derived from the top reason:
  - Availability → Confirm before dispatch
  - Address → Ask for exact pin
  - Trust → Offer open-box
  - Timing → Offer another slot
  - Price → Reassure on price
  - Low risk → On track

  The replies list is sorted riskiest-first. The drawer has one-tap **Call via Vaani** and **Send pin request**. The raw p(RTO) stays in the drawer and the Risk view, for analysts. Risk also feeds routing's "expected successful drops".
- **Replies after routes are published:**
  - "Yes, I'll be there" still counts after a parcel is PLANNED or out for delivery. The rider sees it as Confirmed.
  - "Change day/time" is allowed until the rider taps Arrived (max 2 changes). If the parcel is already on a route, it goes to HELD with `skipRequested`. The rider keeps the parcel and gets a "Customer not home, skip" banner, and it doesn't count as a failed attempt.
  - When the new date is planned, the parcel is assigned to **the same rider first** (if capacity and cash allow), since it's already on their bike.
- **Tracking map:**
  - The view fits both the rider and the home.
  - The rider is drawn 60% of the way from the last finished stop (or the hub) to the stop they're heading to, with a dashed line to the customer.
  - Maps sit in their own stacking context (`isolate`), so Leaflet layers can't cover sheets, drawers or headers.
- **Message rider** takes free text (140 characters) as well as the quick replies. The rider sees the messages, with times, on the stop screen.

## Phase 8: open-box at the door + Refusals & RTO
- **Rider flow:** after **Arrived**, open-box orders show **Open-box check** instead of Delivered. Mark attempt stays available if the customer isn't reachable. The steps are:
  1. Seal photo (placeholder).
  2. **Start inspection** with a 2:00 countdown. It turns amber once time is up and shows a red hard stop at 5:00. `startedAt` is stored, so the timer survives leaving the screen.
  3. The five-point checklist.
  4. **Customer accepts** (collect cash → Delivered, with earnings and address learning as usual) or **Customer refuses**.
- **Refusal:**
  - The customer picks a reason: Wrong item · Colour/design different · Wrong size label · Damaged · Changed mind. "Damaged" forces the damaged flag.
  - The rider takes the item photo (placeholder); **Reseal with tamper bag** stays disabled until then.
  - Resealing generates a seal ID (`TB-` + 6 characters) and sets status `REFUSED_AFTER_INSPECTION`. The attempt is recorded as `refused_after_inspection`.
  - The customer sees "Returned after inspection · {reason} · Nothing to pay". A refusal always has a seal ID and a reason.
- **Redirect Loop eligible** = reason "Changed mind" and not damaged. In Refusals & RTO, the hub picks **Redirect** (only when eligible) or **Return to seller**. The prototype records the decision only; there's no onward redirect order.
- **Abort for safety** is always visible and asks for confirmation. The parcel stays sealed with the rider, and it's recorded as a failed attempt ("Open-box aborted for safety"). The customer gets the attempt notice with "Yes, I missed it" to pick a new time.
- **Failed deliveries:** each shows attempt dots (x/3).
  - **Re-attempt tomorrow** parks the parcel as HELD for tomorrow, in the same window, and it rejoins that day's run automatically.
  - **Mark RTO** is enabled only at 3 failed attempts. It sets status `RTO` with the last reason; customers see "Returned to the seller".
- **Seeded for the demo** (Hardoi): Ramesh Chandra with 3 failed attempts (ready for Mark RTO) and Sarita Maurya with 2.
- **Tally**, per hub, from events and orders: cancelled before the last mile (`reverse_trip_avoided`), rescheduled instead of failing (home-check change, "I'm not home", "missed it"), refusals redirected, returned at the door, and RTO taken.

## After an open-box refusal: replacement or close (team request)
- **Where the options appear:** the refused order card and a WhatsApp-style message (with buttons) both offer **Get the correct item** (labelled **Order again** when the reason was "Changed mind") or **Close order**.
- **Replacement:** a new linked order (`replacementFor`) with the same item and address, at the original price, Cash on Delivery, with open-box again. For fashion items the customer can pick another size first, and "Wrong size label" prompts "Pick the size you need". It goes through the normal flow: Transit → hub → rider.
- **Close order:** marks `refusal.customerChoice = closed`. It was Cash on Delivery, so there is nothing to pay or refund.
- **Hub view:** Refusals & RTO shows the customer's choice (Awaiting customer / Customer wants replacement #id / Customer closed order) next to the seal ID. The Redirect / Return decision about the refused item is separate from this.
- **Checklist gate:** "Customer accepts" is disabled until all 5 checks are ticked, with the hint "Tick all 5 checks… Something not right? Use Customer refuses." `acceptAfterInspection` enforces the same rule (seal photo + inspection started + all 5 checks), logging `accept_blocked_checklist` if bypassed.
- **Rider position:** a rider who has tapped Arrived (and not finished the stop) is drawn at that door.

## Team additions: open-box opt-in, IVR confirmation, GPS location ping, child lock, slot fix
- **Open-box is opt-in.** On the Payment step, Cash on Delivery orders that contain an eligible category show an **Open-box delivery** toggle, off by default. `order.openBox` is set only if the customer switches it on. The product page says open-box is *available* and can be chosen at checkout. Replacement orders keep the original order's choice.
- **IVR order confirmation:**
  - About 3 seconds after any order is placed (checkout or replacement), an incoming call appears over the customer app.
  - Answering plays an order summary, then: **1** confirm · **2** cancel, with a second "press 1 to cancel / 9 to go back" step · **3** share exact location, offered only while the address is approximate.
  - Declining, not answering for 30 s, or hanging up without choosing leaves a **missed call** in Messages with Confirm / Cancel buttons.
  - Cancelling is only possible while the order is still with the seller (PLACED). It frees the slot and logs `reverse_trip_avoided`.
  - Seller & Transit shows the IVR status: confirmed / missed / ringing. Confirmation doesn't gate fulfilment in the prototype.
  - Feature ID `IVR` (new; not in v3).
- **GPS location ping:**
  - After an order to a pilot-hub address with no pin that isn't verified (L0/L1), the customer gets one WhatsApp-style "Share my location" message per address.
  - The order page shows a nudge card for the same purpose.
  - Sharing goes through an "Allow Meesho to use your current location?" prompt. It pins the address from the phone's GPS (simulated: within ~5 m of the real door) → DIGIPIN, L2 (L3 stays L3).
- **Slot bug fix:** pre-filled bookings for a window are now keyed by the *calendar date*, not "days from today". Previously, a window that was Full when the customer ordered could look open when they rescheduled days later.
  - Every 3rd calendar day, Hardoi's Evening and Pune's Morning windows are pre-filled to Full, so any 4-day picker range shows at least one.
  - In the reschedule sheets, switching to a date where the selected window is full falls back to "Any time".
- **Child lock (Account → Settings):**
  - The customer sets a 4-digit PIN (entered twice). It's stored only as a salted hash.
  - When on, **Place Order** (checkout and replacements) asks for the PIN first.
  - **3 wrong PINs** lock ordering for **5 minutes**, with a live countdown that persists across screens.
  - **Forgot PIN?** sends a 6-digit OTP by SMS to the registered number (it lands in Messages; the prototype also shows it under the input). The OTP expires in 5 minutes. A correct OTP lets the customer set a new PIN and clears the lockout.
  - Turning child lock off or changing the PIN requires the current PIN, or the OTP reset.

## Readiness-checklist round (2026-10-04)
_This section supersedes the earlier "IVR order confirmation" notes._
- **Accounts and time:** still only Existing User (Rekha) and New User (Kavita). There is still no clock; every timed step is a button.
  - Walkthrough A (the slide's kirana owner) runs as the New User.
  - The 9 pm–9 am quiet-hours rule uses the device's real clock.
- **P1 confirmation (replaces the earlier ring-on-every-order IVR):**
  - Only risk-flagged COD orders are asked to confirm. The reasons are first COD order, high value (≥ ₹1,500), new category, and recent RTO / high-RTO pincode. One reason means medium risk, two or more means high.
  - The Existing User is a medium-risk customer.
  - Flow: WhatsApp Confirm / Cancel → Seller & Transit "No tap in 10 min → Meesho calls" → call screen (1 confirm / 2 cancel) → "3 hours later → second call".
  - If the customer is never reached: a medium-risk order ships with a priority ping; a high-risk order stays held, with Pay by UPI / Cancel offered.
  - The seller can't ship while a parcel is "Awaiting confirmation" (or until they Release it).
- **Transit states:** Seller ships → In transit → Reached hub. A delay is either "Seller missed dispatch" (before shipping) or "Transit delay" (after). The customer can cancel for free only before the seller ships.
- **Hub tabs:** Inbound (Scan in = sends "Will you be home?") · Replies (+ Trigger automated call) · Held (owner, release date, Escalate after 3 days) · Routes · Live · Disputes (+ "Address not found" review) · Returns / Redirect · Risk.
- **Rider:**
  - The stop screen is titled "Next delivery".
  - "Address not found" / "Customer unavailable" are locked until Arrived plus 2 calls or a door message.
  - A delivery OTP is needed to confirm a delivery (the "Customer reads it out" helper fills it, since there is no second phone).
  - A "No network" toggle hides the map and decodes the DIGIPIN on the phone (coordinates + distance/bearing).
  - Open-box refusal needs a seal ID, entered or "Scan"ned.
- **Verified address:** an OTP-verified delivery within 30 m of the pin promotes the address to L3 at once. The 2-drop rule still applies otherwise. A pinned address's drop point is the pin, since the rider is geofenced there.
- **Routing:**
  - Near parcels are grouped by DIGIPIN-6 cell (~1 km), one rider per cell where capacity and cash allow.
  - Stop order is nearest-neighbour (fewest km). Unconfirmed Any time, no-reply and not-home parcels go last.
  - Lane ETA = 18 km/h + 4 min per stop + 2 min per open-box.
  - "I'm not home" re-sequences the rider's remaining stops from where they are and refreshes the arriving alert.
- **Redirect Loop:**
  - Hub QC (right item / undamaged / seal intact) → Demand Score. The score is weighted: nearby carts × 4 + searches/10 + sales/10 + season bonus; ≥ 40 is High, ≥ 20 is Medium.
  - High → held for the category window (fashion 3 d, home 2 d), Medium → 1 day, Low or slow category → returned. The cap is 3 days, enforced on real dates when the tab opens.
  - Nudges go to the top 5, then the next 5. Each is a push, plus WhatsApp if opted in, and each shopper gets at most 1 nudge a week. Shoppers with a recent refusal are skipped.
  - The parcel sells at the listing price. The first to pay gets a new UPI order for tomorrow, plus a new invoice and label; the hub earns a +₹10 bonus.
  - Shoppers at that hub also see it on Home under "Ready near you, delivered tomorrow".
- **Child lock:** the 3rd wrong PIN also sends the account owner a WhatsApp alert.
- **Valmo vs 3PL:** time slots, open-box, live tracking, "I'm not home" and changing the time are labelled "Valmo only". A 3PL order only gets the "Will you be home?" Yes.
- **Maps:** pans and zooms are not animated. An animation still running when the screen changed made Leaflet throw a console error.
- **Tests:** `npm run test:e2e` runs walkthroughs A–D plus a Reset-demo check with Playwright (dev server on port 5180). Screenshots go to `screenshots/<walkthrough>/<step>.png`.

## Redirect Loop for RTO parcels (team request)
- **RTO parcels join the loop:** marking a parcel RTO (after 3 failed attempts) now sends it into the Redirect Loop, the same as an open-box refusal. It was never opened, so the card reads "RTO · original packaging" and goes through the same QC.
- **Only High demand goes on the shelf:** a High Demand Score puts the parcel on the redirect shelf for up to **3 days**. Medium or Low demand, or a slow-moving category (kitchen, beauty), goes straight back to the seller.
- **Not sold in 3 days:** the parcel returns to the seller. In the demo that's the button "Not sold in 3 days → return to seller". On real dates the 3-day cap is enforced when the hub opens the Returns tab.
- **Demo shoppers first:**
  - Demo accounts are ranked first among nearby shoppers, so the main customer (Rekha) refusing a parcel pings the **New User (Kavita)**. Rekha herself is skipped as the refuser, or for "recent refusal".
  - A New User with no saved address still counts as nearby. Tapping **Buy now** asks for an address, then completes the purchase.
  - The hub's "Simulate … pays first" button is shown only for the background shoppers; demo accounts buy on their own phone.

## Child lock: lockout per order (team request)
- **Lockout is per order:** 3 wrong PINs lock **that order only** (same items and sizes) for 5 minutes. A different order can still be placed with the correct PIN, and the lock sheet says so.
- **Separate attempt counts:** wrong-PIN counts are kept per order. Turning the lock off or changing the PIN has its own count.
- **Unchanged:** the owner's WhatsApp alert on the 3rd wrong PIN. **Forgot PIN → OTP** sets a new PIN and clears every lockout.

## Removed at the team's request (2026-10-20)
- **"Need it by a date?":** removed from checkout, the order pages, the hub drawer and Seller & Transit, along with the "won't make your need-by date" delay warning. The rescue score no longer uses it.
- **Activity Log screen (`/log`):** removed from the Launcher and the routes. Events are still recorded in the store, and the tests read them.
- **Network Ops / PeakPromise:** the `/ops` screen and its 21-day forecast data are removed.
- **Hub Risk tab:** removed from Hardoi LMDC and Pune. The rescue engine still orders the Replies list (riskiest first) and shows the next-best action in the parcel drawer.

## Several items, several sellers (team request, 2026-10-20)
- **Split by seller:** a checkout becomes one order per seller. Items from the same seller travel as one order (one parcel); different sellers give separate orders linked by `groupId`. Each parcel ships, and can be delayed, on its own at Seller & Transit.
- **Shared slot and OTP:** the parcels share the chosen slot (each takes a seat in the window, so the window must have room for all of them) and one delivery OTP. The UPI discount applies once per checkout.
- **One confirmation per checkout:**
  - The risk flag is worked out for the whole checkout (e.g. high value uses the combined total).
  - One WhatsApp lists every item, with **Confirm all / Keep some, cancel some / Cancel all**.
  - Seller & Transit shows one card and places **one** call ("No tap in 10 min" and "3 hours later" cover the whole checkout).
  - On the call: **1** confirm all, **2** cancel all, **3** go item by item (1 keep / 2 cancel).
  - "Never reached", Pay by UPI and the reorder link are also per checkout.
- **Keeping some items:**
  - A seller's order whose items are all cancelled is cancelled, and its slot seat freed.
  - An order that keeps some items is trimmed (total recomputed) and confirmed.
- **Same door, same day:** parcels for the same door on the same day, whether a split checkout or separate orders, are treated as one drop.
  - **Before the rider:** one "Will you be home?" (already merged), one automated call from the hub, and changing the day moves them all.
  - **On the route:** one rider (the planner keeps a door together) and one "10 min away" message.
  - **At the door:** one arrival, one OTP, one handover and one rider payment for the drop; "Collect" shows the total.
  - **If it fails:** "I'm not home" skips them all, a failed attempt covers them all with one message, and "I was here" / "I missed it" answer for all of them.
  - **Exception:** an open-box parcel still gets its own check at the door.
- **Calls after a reload:** an answered call is cleared at once, so reloading the page never rings it again.
- **Cash-day wording:** reworded for first-time and less-literate users: "Paying cash? When will you have the money? We will come on that day or later (for example, your salary day)."

## Redirect Loop: RTO parcels only (team request, 2026-10-20)
- **Open-box refusals go back to the seller.** They were opened at the door and resealed in a tamper bag, so the hub can't check or resell them. The hub's Returns tab lists them under "Open-box refusals → back to the seller", and Seller & Transit shows "Returning to you". The customer can still order again or close the order.
- **Only RTO parcels enter the Redirect Loop.** These are parcels marked RTO after 3 failed attempts; they were never opened and the seller's seal is still on.
- **The quality check is a packaging check from the outside.** The hub checks three things: *Seller seal intact? · Label matches the order? · Box undamaged (no dents, tears or water)?*
  - All three OK → the parcel is scored for local demand. High → redirect shelf for up to 3 days. Anything else → back to the seller.
- **The nudge wording now says "Still in its original sealed pack, checked at your local hub".**
- **Home no longer shows the "Hiding n listings of items you've already ordered" line.** Listings for items already on their way are still hidden, just without that note.

## Multi-item parcels and open-box (team request, 2026-10-20)
- **Every item is named.** A parcel with several items from one seller lists all of them, e.g. "Blackout Door Curtains (Set of 2) + Cushion Covers (Set of 5)".
  - Seller & Transit puts one line per item plus "N items in one parcel".
  - The hub names every item on its tables (Inbound, Replies, Held, Disputes), the run planner, the Returns tab and the shipping label.
- **Open-box, one parcel with several items:** after "Customer refuses", the rider ticks which items are coming back (all are ticked by default).
  - If only some are returned, those items are resealed in a tamper bag and move to their own order (refused → back to the seller, with Order again / Close for the customer).
  - The rest is delivered with the OTP, and the customer pays only for what they keep. The two orders link to each other ("Some items returned at the door" / "Returned from order #…").
- **Open-box, several parcels at one door (different sellers):** each parcel still gets its own open-box check. Accepting one never hands over the other; the other can be accepted or refused on its own.
- **Returning part of a parcel, what the customer sees:**
  - **WhatsApp:** says "You kept … and returned … at the door (reason). You paid only for what you kept." It offers **Get the correct item / Close order** for the returned part.
  - **Order page:** the delivered order's page shows the same choice in a "Part of this parcel was returned at the door" card.
- **Messages opens at the newest message** (like WhatsApp), so a new notification is never hidden at the bottom.
- **The shipping label is drawn on top of the page, outside the table cell that opens it**, so long addresses and item lists wrap inside the label.

## Sidebar instead of the launcher (team request, local only, 2026-10-21)
- **Always-on sidebar:** a sidebar on the left replaces the launcher page. It lists Customer (Existing / New User), Seller & Transit, each hub and each rider (grouped by hub). Clicking one shows that role's current screen. All roles share one live store, so it is always up to date.
- **Each role remembers its last screen** (e.g. an order page, the hub's Routes tab, a rider stop), so switching back returns you there. Reset demo clears this.
- **Live counts on the sidebar:** unread messages per customer, parcels with the seller / in transit, parcels waiting at each hub, and stops left per rider.
- **Settings at the bottom:** Reset demo and Show feature tags. The sidebar can be collapsed to icons. "/" opens the customer phone. The old "Switch app" header icon is gone.

## Sellers ready on different days (team request, 2026-10-21)
- **Seller ready dates:** sellers can need extra days before their parcel reaches the hub (prototype: Steel King and Panipat Home Mills +1 day). The product page shows that seller's own date.
- **When a cart's sellers are ready on different days**, checkout's Delivery step lists each parcel with its "from" date and offers two choices:
  - **Deliver together** (default, recommended): one visit on or after the later date, one slot, one OTP, one time to be at home.
  - **Deliver each when ready:** a slot picker per parcel, each starting at that parcel's own ready date. Each slot is held separately.
- **Cash day:** the COD "When will you have the money?" day moves any earlier parcel slot to that day.
- **Confirmation is still once per checkout.** When parcels come on different days, the WhatsApp and the call say "arriving Sat, 24 Oct and Sun, 25 Oct" and mark each item's day. The order-placed page shows each parcel's slot.
- **Fixed:** message templates now fill every placeholder (e.g. "{n} sellers … {n} parcels").

## Open-box: Abort for safety removed (team request, 2026-10-21)
- **Abort for safety is gone:** the open-box check no longer has an "Abort for safety" button. At the door the rider either completes the check (accept, refuse, or return some items) or uses the normal attempt buttons on the stop screen.

## Edge cases fixed (2026-10-21)
- **Prepaid open-box parcels (paid with "Pay now"):** a refusal at the door records a refund to UPI and tells the customer: "₹X will be refunded to your UPI in 2–3 days." The hub's Returns tab shows "Refund ₹X to UPI".
  - For a partial return, the refund is the returned part of what was paid; the UPI discount stays with the kept items.
  - The rider sees "prepaid, nothing to collect" / "refund ₹X" instead of a cash amount.
- **Returning part of a quantity:** with 2+ of one item, the rider sets how many come back (− / +), e.g. return 1 of 2 curtains and keep 1.
- **"Keep some, cancel some"** says "each arriving on its own day" when the parcels come on different days.
- **Two tabs or windows stay in sync:** when one tab saves, the others reload that state, so a second tab shows the latest data and never writes over it.
- **Order confirmation by quantity:** "Keep some, cancel some" also appears when a single item is ordered 2 or more times.
  - **WhatsApp sheet:** an item with 2+ pieces has **− / +** to set how many to keep ("keep 1 of 2"); single items keep the Cancel / Keep button.
  - **The call:** an item with 2+ pieces asks "Press 1 to keep all, 2 to cancel all, 3 to keep only some". Pressing 3 asks "How many of the 3 do you want to keep? Press a number from 1 to 2".
  - **Result:** the order keeps only the chosen quantity, and the total is recalculated.

## Clearer counts, messages and labels (2026-10-21)
- **"N deliveries" counts visits, not parcels:** parcels on the same day and time window are one delivery. For example, 3 parcels where 2 come Sat morning and 1 Sun morning = "2 deliveries".
- **Messages name the items they are about:**
  - **Delay:** "Your order of Cotton Double Bedsheet + 2 Pillow Covers may arrive late…"
  - **Will you be home?:** "Your Meesho order of Floral Rayon Kurti (M) + Anarkali Printed Kurta Set (M) has reached…". When a second parcel for the same day joins the message, it is rebuilt with every item and the combined cash amount.
  - **10 min away:** "Suresh is 10 min away with your Meesho order of …"
- **Shipping label:** the DIGIPIN shows only when the address really has one (pinned, or verified by deliveries). Otherwise the label says "DIGIPIN · NOT SET · use the address above", and the QR code carries no location.
