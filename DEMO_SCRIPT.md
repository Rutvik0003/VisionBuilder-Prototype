# Demo video script

One continuous story that covers every feature. Press **Reset demo** (Launcher → Settings) once before you start; you don't need to reset between parts.
Feature IDs in brackets match the slides. Turn on **Show feature tags** on the Launcher if you want them visible on screen.

**Before recording**
- **Time of day:** record between **9 am and 9 pm**. Outside those hours Meesho's confirmation call is queued, and you'll have to press "9 am → place queued call" in Seller & Transit.
- **Internet:** keep the internet on, because map tiles load from OpenStreetMap.
- **Tabs:** keep four browser tabs open, one per app: Customer, Seller & Transit, Hub Manager (Hardoi LMDC) and Rider. Every app reads the same store, so switching tabs is instant.
- **Delivery OTP:** the rider screen shows "Demo: this customer's OTP is ____". You can also tap **Customer reads it out**.

---

## Part 1 · New customer and address (New User, Kavita) · ~2 min
1. **Launcher → New User.** Home shows no delivery date, only **Add address** (there's no address yet).
2. **Open "Floral Rayon Kurti".** Tap **Same item from ₹469 · 3 sellers** to show the seller compare sheet [C3-F1].
3. **Account → Addresses → Add new address.**
   - Enter pincode **241001** and say: "the map opens at an approximate spot".
   - Tap **Skip for now** so the pin is left approximate. That sets up the GPS ping in Part 2.
   - Fill in the details and **Save address**. The address list shows the confidence badge (Approximate) [C2-F1].

## Part 2 · Checkout with the Timing layer (Kavita) · ~2 min
4. **Product → pick a size → Buy Now.** The stepper reads **Address → Delivery → Payment → Summary** [C1-F1].
5. **Delivery step:**
   - Point out "When should we deliver?", the day chips, and **Any time (fastest)** selected by default.
   - Click a day whose **Evening shows "Full"** (greyed out, can't be picked).
   - Pick **Saturday → Afternoon 12-4**. The banner reads "Slot held for you" with a countdown.
   - Optional: switch on **Need it by a date?** and show the warning it gives.
6. **Payment step:** choose **Cash on Delivery**, then **Deliver on or after → Sat** (payday cash). Continue → **Place Order**.
7. **Order placed:** the confirmation note appears, because this is a first COD order, so it's risk-flagged [P1].
8. **Messages:**
   - **"Confirm your order …"** has Confirm order / Cancel order buttons. Tap **Confirm order**.
   - **"Share my location"** ping (the address was approximate): tap **Share location → Allow**. You get a DIGIPIN, and the address becomes **Pinned** [C2-F1].

## Part 3 · Seller & Transit delay · ~1.5 min
9. **Seller & Transit → Orders tab.** Kavita's row: click **Label** to show the label preview with the QR code and DIGIPIN box [X2].
10. Click **Seller missed dispatch → 1d** [C1-F5].
11. **Customer → Messages:** "may arrive late, on Sun … instead of Sat".
    - Point out the three buttons: **Okay / Pick another time / Cancel for free**. Free cancel is offered only because the seller hasn't shipped yet.
    - Tap **Pick another time → Afternoon → Confirm new time**.
12. **Transit:** **Seller ships → In transit → Reached hub**. Optionally show that the Destination column says **Valmo**.

## Part 4 · Hub: Inbound and Replies · ~1 min
13. **Hub Manager → Inbound tab:** Kavita's parcel → **Scan in** [C1-F2].
14. **Customer → Messages:** "…will arrive Sun, Afternoon 12-4. Will you be home?" Point out **Yes / Change day/time / Add directions / Pay now**. Tap **Yes, I'll be there**.
15. **Hub → Replies tab:** the reply counts update across apps (shared store).

## Part 5 · Routes, rider, live tracking, "I'm not home" · ~3 min
16. **Hub → Routes → pick Sun → Plan afternoon run** [C3-F3].
    - Talk through the run plan: stops, riders, km, expected drops, the map, and the rider lanes with the ~min ETA.
    - Each stop shows its **DIGIPIN-6 cluster** and "open-box +2 min" where it applies.
    - Optional: show **Move stop** (pick a reason).
    - **Lock & publish.**
17. **Rider → Suresh (or whoever got the stop) → Start … run.** If another customer is ahead of Kavita, deliver that stop first (Arrived → Delivered → OTP → Confirm).
18. **Customer → order page:** live map with the rider moving; **Messages:** "Suresh is 10 min away" [C1-F3].
19. **Order page → Message rider → "Call me at the gate"** (masked chat) [C1-F4].
20. **Order page → I'm not home** → pick a new day → **Confirm new time**.
    - Say: "the stop is skipped, and it isn't a failed attempt".
    - **Rider:** the stop shows **"Customer not home, skip."** → **Skip stop**. The rider's remaining stops are re-ordered automatically [P3.8].
21. **Next day:**
    - **Hub → Routes → new date → Plan → Lock & publish.**
    - **Rider:** finish the earlier run, then **Start** → Kavita's stop → **Arrived at stop → Call customer → Delivered → OTP → Confirm delivery**. Delivered on the first attempt.

## Part 6 · Doorstep layer with open-box accept (Existing User, Rekha) · ~3 min
22. **Launcher → Existing User → Account → Addresses.** Show the badges (Verified / Pinned / Approximate), plus edit, delete and set-default.
23. **Add new address (Shop):**
    - Pincode 241001 → **drag the pin**; the DIGIPIN updates live → **Confirm pin**.
    - Optional: show **"Not at this address? Send a link to pin it"** [C2-F1].
    - Save.
24. **Order the kurti ₹499 to the new Shop address:** COD → switch on **Open-box delivery** (offered only for fashion and home items) → Place Order [C2-F3].
    - Rekha is a medium-risk customer, so she **confirms on WhatsApp**.
25. **Transit:** ship → in transit → reached hub. **Hub:** Scan in. **Rekha:** Yes. **Hub:** plan and publish the run. **Rider:** Start.
26. **Rekha → Message rider → "Call me at the gate".**
27. **Rider → her stop ("Next delivery"):**
    - Show the exact pin, DIGIPIN, **From customer: 'Call me at the gate'**, and "Calls made · number masked".
    - **"Address not found" / "Customer unavailable" are locked**: "Tap Arrived at stop first" [C2-F4].
    - Tick **No network**: the map hides and the phone decodes the DIGIPIN into coordinates plus distance and direction [D1.12].
28. **Arrived at stop → Open-box check:**
    - **Take seal photo → Start inspection (2:00 timer)**.
    - The accept button stays locked until all **5 checks** are ticked.
    - Enter the **OTP** → **Customer accepts · collect ₹499**.
29. **Rekha → Addresses:** the Shop address now shows **"Verified by 1 delivery"** (an OTP delivery within 30 m of the pin) [D1.8].

## Part 7 · Refusal and Redirect Loop · ~3 min
30. Rekha orders the kurti again with open-box and you take it to the door, as in steps 24–28.
    - On Home, point out "Hiding listings of items you've already ordered" [C3-F1].
31. **Rider: Open-box check → seal photo → start inspection → Customer refuses.**
    - Pick reason **Changed mind** → **Take item photo** → **Scan** (fills the seal ID) → **Reseal in tamper-evident bag** [R1.1].
32. **Rekha → Messages:** offered **Order again / Close order**. Tap **Close order**, or show the replacement sheet.
33. **Hub → Returns / Redirect:**
    - Quality check (Right item? Undamaged? Seal intact?) → **Submit QC**.
    - The card shows **Demand Score: High** with its inputs, and "On the redirect shelf until …", the per-category hold window (3-day cap).
    - The list shows nearby shoppers who saved the exact item → **Nudge top 5**, then optionally **Nudge next 5 (a few hours later)**. Push goes first, and WhatsApp only to opted-in shoppers.
34. **Launcher → New User (Kavita, Hardoi address).** Home shows **"Ready near you, delivered tomorrow"**. Tap the card → **Buy now · ₹499** [R1.6].
35. **Hub → Returns / Redirect:**
    - The card reads **Sold to Kavita Patel**: new order for tomorrow, first order closed.
    - **Label** shows the new invoice label. The **Hub bonus ₹10** card updates.
    - **Transit → Redirect sales / Open-box refusals tabs** show the same sale.

## Part 8 · Dispatch layer: child lock and confirmation call (Rekha) · ~2 min
36. **Account → Child PIN Lock** → set the PIN twice [P2].
37. Order anything as COD → **Place Order** → the PIN sheet appears.
    - Enter a wrong PIN 3 times: "Too many wrong PINs" and a 5-minute countdown.
    - **Messages** has the owner's WhatsApp alert.
    - **Forgot PIN? → Send OTP** (the code shows under the box and in Messages) → Verify → new PIN → order placed.
38. **Don't tap Confirm.**
    - **Transit → Awaiting confirmation:** "Seller ships" is disabled.
    - Click **No tap in 10 min → Meesho calls** [P1].
39. **Customer tab:** the incoming call screen → **Answer** → the script: "…Press 1 to confirm your order. Press 2 to cancel it." → press **2** → "Your order has been cancelled. Nothing to pay." (cancelled before shipping).
    - Optional, on another order: miss the call twice using **3 hours later → second call** → "never reached". A medium-risk order ships with a priority ping; a high-risk order is held.

## Part 9 · Failures, disputes, Vaani call, holds · ~2 min
40. **Vaani call:**
    - Rekha places one more order → ship it to the hub → **Scan in**, and **don't reply**.
    - **Hub → Replies → Trigger automated call** → the call screen on Rekha's phone → press **1** (or **2** to change the day) [C1-F2].
41. **Held tab:** if a customer changed the day, the parcel shows with its **Owner, Release date and days held**. More than 3 days shows **Escalate**.
42. **Failed attempt and dispute:**
    - On any stop: Arrived → Call customer twice → **Customer unavailable**.
    - The customer gets "Our rider tried to deliver…" → **I was here, no one came**.
    - **Hub → Disputes:** the rider's evidence (geofence, calls, door message) → **Customer is right / Rider is right**.
43. **"Address not found"** attempts show under Disputes for review → **Send pin request**.
44. **Hub → Returns / Redirect → Failed deliveries:** Ramesh Chandra at 3/3 → **Mark RTO**.

## Part 10 · Wrap-up extras · ~1.5 min
45. **3PL vs Valmo [X1]:** add an address with pincode **226001** (Lucknow, outside the pilot) and order.
    - Checkout says **Valmo only** for slots and open-box.
    - When the partner is out for delivery, the order page offers only **Yes, I'll be home**.
46. **Hub → Risk tab:** the rescue engine's next-best actions.
47. **Network Ops (PeakPromise):** the 21-day demand vs capacity forecast.
48. **Account → Language → Hindi:** messages switch language [X5].
49. **Activity Log (/log):** every event from the video, with who, what and when, plus the feature ID.
50. **Reset demo:** back to the clean start.

**Total ≈ 20–22 min.** To make separate short videos instead, split them as Parts 1–5 (Timing), 6 (Doorstep), 7 (Redirect), 8–9 (Dispatch) and 10 (extras). Press Reset demo before each one.
