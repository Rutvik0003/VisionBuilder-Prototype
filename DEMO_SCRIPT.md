# Demo video script (v2)

One continuous story that covers every feature in the checklist. Press **Reset demo** (bottom of the sidebar) once before you start. You never need to reset in the middle.

**Cast**
- **Rekha Yadav** (Existing User): main customer, medium-risk COD buyer, 3 saved addresses.
- **Kavita Patel** (New User): no address yet; first-time COD buyer; becomes the nearby shopper who buys the redirected parcel.
- **Hub:** Hardoi LMDC, with riders Suresh, Imran and Deepak.
- **Dummy parcels already at the hub:**
  - Suman Verma (Morning)
  - Pooja Mishra (Afternoon)
  - Ramesh Chandra (3 failed attempts)

**Before recording**
- **Time of day:** record between **9 am and 9 pm**. Outside those hours Meesho's call is queued, and you'll press "9 am → place queued call".
- **Internet:** keep the internet on, because map tiles load from OpenStreetMap.
- **Switching roles:** use the sidebar on the left; no browser tabs needed. Each role reopens where you left it.
- **Delivery OTP:** the rider screen shows "Demo: this customer's OTP is ____". Type it in, or tap **Customer reads it out**.
- **Feature tags (optional):** Sidebar → **Show feature tags** puts the IDs (C1-F1, R1…) on screen.
- **Rider:** whoever you see in a run plan is the rider to open. If another customer's stop comes first, deliver it (Arrived → Delivered → OTP → Confirm delivery).

---

## Part 1 · Intro (30 s)
1. **Sidebar:** "Every role is one click away: customer, seller/transit, hub manager, rider. Nothing moves on a timer; each step is a button."

## Part 2 · New user, catalogue and address (Kavita) · ~2 min · C3-F1, C2-F1
2. **Sidebar → New User.** The product cards show **no delivery date**, only a prompt to add an address.
3. **Open "Floral Rayon Kurti"** → tap **Same item from ₹469 · 3 sellers** to show the identical-product compare sheet.
4. **Account → Addresses → Add new address** → pincode **241001**.
   - Say: "the map opens at an approximate spot from the pincode".
   - Tap **Skip for now**; we'll get her exact location later.
   - Fill in name, house and area → **Save address**. The list shows the badge **Approximate**.

## Part 3 · Checkout, Timing layer (Kavita) · ~2.5 min · C1-F1, P1
5. **Home → any fashion product** (e.g. a saree) → pick a size → **Buy Now**.
   - The stepper reads **Address → Delivery → Payment → Summary**.
6. **Delivery step:**
   - "When should we deliver?" with its sub-text, the day chips, and **Any time (fastest)** selected by default.
   - Click through the days until one shows **Evening "Full"**, greyed out and not selectable.
   - Choose **Saturday → Afternoon 12-4**. The banner reads "Slot held for you. Place the order before the timer ends." with a countdown.
7. **Payment step:** **Cash on Delivery** → **Deliver on or after → Sat** (payday cash) → **Continue → Place Order**.
8. **Order placed:** the note says Meesho will ask her to confirm. A first COD order is risk-flagged.
9. **Messages:**
   - **"Confirm your order: … Tap Confirm and we'll ship it."** → tap **Confirm order** [P1.3].
   - **"Share my location"** (her address is approximate) → **Share location → Allow** → "Location saved · DIGIPIN …" [C2-F1 / GPS ping].
   - **Account → Addresses** now shows **Pinned**.

## Part 4 · Seller & Transit delay · ~1.5 min · C1-F5, X1, X2
10. **Seller & Transit → Orders tab:**
    - Kavita's row shows Destination **Hardoi LMDC · Valmo** [X1].
    - Click **Label**: the label preview with the QR code, DIGIPIN box and masked phone number [X2].
11. **Seller missed dispatch → 1d.**
12. **Kavita → Messages:** "Your order may arrive late, on Sun … instead of Sat."
    - Point at the three buttons: **Okay / Pick another time / Cancel for free**. Free cancel appears only because the seller hasn't shipped yet.
    - Tap **Pick another time → Afternoon → Confirm new time**.
13. **Transit:** **Seller ships → In transit → Reached hub** (three explicit states) [S1.1].

## Part 5 · Hub inbound and the home ping · ~1 min · C1-F2
14. **Hub → Inbound tab:** "Scanning a parcel in sends the WhatsApp ping" → **Scan in** on Kavita's parcel.
15. **Kavita → Messages:** "…will arrive Sun, Afternoon 12-4. Will you be home? Amount ₹…"
    - Point at **Yes / Change day/time / Add directions / Pay now**.
    - Tap **Yes, I'll be there**.
16. **Hub → Replies tab:** the counts update immediately (shared store).

## Part 6 · Routes, rider, live tracking, "I'm not home" (Kavita) · ~3 min · C3-F3, C1-F3, C1-F4
17. **Hub → Routes → pick Sun → Plan afternoon run.**
    - Explain the plan summary: stops · riders · km · expected successful drops.
    - Show the map with rider lanes, each lane's **km and ~min ETA**, and each stop's **DIGIPIN-6 cluster** code.
    - **Move stop** → choose a rider and a reason → it moves (manager override).
    - **Lock & publish.**
18. **Rider app → the assigned rider → Start Sun · Afternoon run.** Deliver Pooja first if her stop comes first.
19. **Kavita → My Orders → the order:**
    - The header shows "Delivery slot: Sun, 11 Oct · Afternoon 12-4".
    - The live map shows the rider pin moving (it refreshes every 60 s).
    - **Messages:** **"Suresh is 10 min away with your Meesho order."**
20. **Order page → Message rider → "Call me at the gate"** (masked chat, no numbers shared).
21. **Order page → I'm not home** → pick tomorrow → **Confirm new time**.
    - Say: "the rider skips me, and it doesn't count as a failed delivery".
22. **Rider:** Kavita's stop shows **"Customer not home, skip."** → **Skip stop**. The rest of the route is re-sequenced automatically [P3.8].
23. **Next day:**
    - **Hub → Routes → tomorrow → Plan → Lock & publish.**
    - **Rider:** finish any earlier stops → **Start** → Kavita's stop → **Arrived at stop → Call customer → Delivered** → enter the **OTP** → **Confirm delivery**.
    - **Kavita's order:** "Delivered on …", on the first attempt.

## Part 7 · Doorstep layer with open-box accept (Rekha) · ~3.5 min · C2-F1, C2-F2, C2-F3, C2-F4
24. **Sidebar → Existing User → Account → Addresses:**
    - Show the badges (**Verified by n deliveries / Pinned / Approximate**).
    - Show **Edit, Delete, Set as default and Remove pin** on a card.
25. **Add new address (label: Shop):**
    - Pincode 241001 → **drag the pin**; the **DIGIPIN updates live** → **Confirm pin**.
    - Mention **"Not at this address? Send a link to pin it"** for someone else's address.
    - Save.
26. **Floral Rayon Kurti ₹499 (Shree Textiles)** → size → Buy Now → choose the new **Shop** address → Delivery: Any time → Payment: **Cash on Delivery** → switch on **Open-box delivery** → Place Order.
    - Say: "open-box only appears for COD fashion and home items".
27. **Rekha → Messages → Confirm order** (she's a medium-risk customer).
28. **Transit:** Seller ships → In transit → Reached hub. **Hub → Inbound:** **Scan in**. **Rekha → Messages:** **Yes, I'll be there**.
29. **Hub → Routes → that date → Plan morning run → Lock & publish. Rider → Start.** Deliver Suman first if needed.
30. **Rekha → order page → Message rider → "Call me at the gate".**
31. **Rider → Rekha's stop:**
    - The title reads **"Next delivery"**, with the exact pin and DIGIPIN, **From customer: 'Call me at the gate'**, "Calls made: 0 · number masked via Meesho", and the chips **Collect ₹499 · Open-box · Confirmed**.
    - **"Address not found" / "Customer unavailable" are greyed out**: "Tap Arrived at stop first" [C2-F4].
    - Tick **No network**: the map is replaced by the DIGIPIN decoded on the phone, with coordinates and distance/direction from the rider [D1.12]. Untick it.
32. **Arrived at stop → Open-box check:**
    - **Take seal photo → Start inspection (2:00 timer)**.
    - Point out that **Customer accepts** stays locked until all **5 checks** are ticked.
    - Tick all 5 → enter the **OTP** → **Customer accepts · collect ₹499**.
    - Point out **Abort for safety** at the bottom.
33. **Rekha → Account → Addresses:** Shop now shows **"Verified by 1 delivery"**. An OTP delivery within 30 m of the pin verifies it at once [D1.8].

## Part 8 · Open-box refusal → back to the seller · ~2 min · C2-F3
34. **Rekha** orders the same kurti again: COD + **Open-box**, to the Shop address.
    - Confirm → ship → Scan in → Yes → plan and publish → rider Start (same as steps 27–29).
35. **Rider → Rekha's stop → Arrived → Open-box check → seal photo → Start inspection → Customer refuses:**
    - Reason **Changed mind** → **Take item photo** → **Scan** (fills the seal ID, e.g. TB-123456).
    - **Reseal in tamper-evident bag** → the stop shows the seal ID and "take it back to the hub, it goes to the seller".
36. **Rekha → Messages:** offered **Order again** (replacement) or **Close order**.
    - Tap **Order again** to show the replacement sheet, close it, then tap **Close order**.
37. **Seller & Transit → Open-box refusals tab:** the seller sees the seal and item photos, the seal ID, and "Returning to you".
38. **Hub → Returns / Redirect → Open-box refusals → back to the seller:** "Tamper bag TB-… · Returning to seller".
    - Say: "It was opened at the door, so the hub can't check it or resell it."

## Part 9 · RTO → Redirect Loop → New User buys · ~3 min · R1
39. **Hub → Returns / Redirect → Failed deliveries:**
    - Ramesh Chandra shows **3/3** dots → **Mark RTO** (only enabled after 3 failures). **Re-attempt tomorrow** is the other option.
40. His parcel appears under **RTO parcels → Redirect Loop**, labelled **RTO · original packaging**.
    - **Packaging check · parcel stays sealed:** Seller seal intact? · Label matches the order? · Box undamaged? Leave all 3 ticked → **Submit check**.
    - **Demand Score: High** with its inputs (nearby carts/wishlists, searches in 7 days, sales over 30–90 days, season).
    - "On the redirect shelf until … · hold window 3 days (cap 3 days)".
41. The nearby shopper list puts **Kavita Patel (Demo)** first → **Nudge top 5**. Each shopper gets push, and WhatsApp if opted in. Optional: **Nudge next 5 (a few hours later)**.
42. **Kavita → Home:** **"Ready near you, delivered tomorrow"**. **Messages** has the ping: "Still in its original sealed pack, checked at your local hub – delivered tomorrow… First to pay gets it."
    - Tap **Buy now** (either place). If she has no address yet, she adds one and the purchase completes.
43. **Hub → Returns / Redirect:**
    - The card reads **"Sold to Kavita Patel"**: new order on tomorrow's route, **+₹10 hub bonus**. The **Hub bonus** card reads ₹10.
    - **Label**: the new invoice label ("REDIRECT RESALE · NEW INVOICE").
44. **Seller & Transit → Redirect sales tab:** "RTO parcel · sold on your listing to Kavita Patel".
    - Say: "If nobody had bought it in 3 days, **Not sold in 3 days → return to seller** sends it back."

## Part 10 · Dispatch layer: child lock and confirmation call (Rekha) · ~2.5 min · P2, P1
45. **Rekha → Account → Child PIN Lock** toggle → choose a PIN and confirm it.
46. Order any item as COD → **Place Order** → the PIN sheet appears.
    - Enter a **wrong PIN 3 times**: "Too many wrong PINs", with a 5-minute countdown.
    - **Messages:** the owner's WhatsApp alert.
    - Close the sheet and order a **different** item: the PIN works, because only the locked order is blocked. Go back to the first item: it is still locked.
47. **Forgot PIN? → Send OTP** (the code shows under the box and in Messages) → enter it → **Verify** → set a new PIN twice → enter the new PIN → order placed.
48. **Don't tap Confirm this time.**
    - **Seller & Transit → Awaiting confirmation tab:** the order is held and **Seller ships** is disabled.
    - Click **No tap in 10 min → Meesho calls**.
49. **Rekha's phone:** the incoming call screen → **Answer** → "Namaste Rekha! … Press 1 to confirm your order. Press 2 to cancel it." → press **2** → "Your order has been cancelled. Nothing to pay."
    - Optional, on another order: **Decline** twice (using **3 hours later → second call**). The order is "never reached": a medium-risk order ships with a priority ping, a high-risk one stays held with Pay by UPI / Cancel.
50. Turn the child lock off again (**Account → toggle → PIN**) so the next order is quicker.

## Part 11 · Automated call, Held, Pay now, dispute (Rekha) · ~3 min · C1-F2, C2-F4
51. Rekha places one more COD order to **Home** → Confirm → ship → **Hub → Inbound → Scan in**. **Don't reply to the ping.**
52. **Hub → Replies tab:** her order sits at the top (riskiest first) → **Trigger automated call**.
53. **Rekha's phone:** the automated call → **Answer** → press **2** (change day) → the Change day/time sheet → pick a later day → **Confirm new time**.
54. **Hub → Held tab:** her parcel shows **Owner: Customer (asked for a new day)**, **Release date**, and days held. Over 3 days, an **Escalate** flag appears. **Release now** exists for an earlier run.
55. **Rekha → Messages → the ping → Pay now**: the order switches to prepaid (UPI) [T2.6].
56. **Hub → Routes → the new date → Plan → Lock & publish. Rider → Start → Rekha's stop:**
    - **Arrived at stop** → **Call customer** twice (or **I'm at your door**). Now **Customer unavailable** unlocks → tap it.
57. **Rekha → Messages:** "Our rider tried to deliver at … Were you there?" → **I was here, no one came**.
58. **Hub → Disputes:** the evidence chips (✓ Arrived (geofence), calls, door message) → **Customer is right / Rider is right**. No automatic penalty.
    - The **"Address not found" for review** section lists any such attempt, with **Send pin request** / **Re-attempt tomorrow**.

## Part 12 · Wrap-up extras · ~2 min · X1, X5, ops
59. **3PL vs Valmo:** Rekha → **Add new address** with pincode **226001** (Lucknow, outside the pilot) → order to it.
    - Checkout says "Standard delivery via partner", and **Valmo only** for slots and open-box.
    - **Transit:** Destination **3PL partner** → Seller ships → In transit → Reached hub.
    - **Order page:** "With our delivery partner (3PL)" with only **Yes, I'll be home**.
60. **Rekha → Account → Language → हिंदी:** messages switch to Hindi [X5]. Switch back.
61. **Sidebar → Reset demo:** "back to a clean start, ready for the next recording".

---

**Total ≈ 25 min.** For shorter clips, press Reset demo before each one:

| Clip | Parts | Covers |
|---|---|---|
| Timing layer | 2–6 | slots, delay, ping, tracking, not-home |
| Doorstep layer | 7 | pin, DIGIPIN, rider screen, open-box |
| Redirect Loop | 8–9 | refusal, QC, demand, nudge, sale, RTO |
| Dispatch layer | 10–11 | child lock, confirmation call, automated call, held, dispute |
| Extras | 12 | 3PL, Hindi, reset |

For the Redirect clip on its own, start with Part 7 steps 26–29 to get a parcel to Rekha's door.
