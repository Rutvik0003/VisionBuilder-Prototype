// Phase 7 — last mile, driven by the rider and the customer (PRD v3 §7 rows 7–10d, §10.6–10.8).
import dayjs from 'dayjs';
import { useStore, type DataState } from '../store';
import type { LatLng, Order, SlotLabel, Visit } from '../types';
import { nowIso } from '../lib/time';
import { fmtDate, rupees } from '../lib/format';
import { t } from '../lib/strings';
import { distanceM } from './geo';
import { setOrderStatus, updateOrder } from './orders';
import { moveBooking } from './slots';
import { deliveryPoint, laneStats, nnOrder } from './routing';

export const EARNING_PER_DROP = 13.5;
const MIN_PER_STOP = 9;
const get = () => useStore.getState();
const findOrder = (id: string) => get().orders.find((o) => o.id === id)!;
const freshVisit = (): Visit => ({ arrived: false, callsMade: 0, doorMessageSent: false });

// ---------------------------------------------------------------- route state

const ON_ROUTE: Order['status'][] = ['PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'];

/**
 * Other parcels for the same door in the same rider's run (e.g. one checkout split by seller).
 * The rider handles them as ONE stop: one arrival, one OTP, one delivery (or one failed attempt).
 */
export function sameStop(o: Order, s: Pick<DataState, 'orders'> = get()): Order[] {
  if (!o.route) return [];
  return s.orders.filter((x) => x.id !== o.id && x.customerId === o.customerId && x.addressId === o.addressId
    && !!x.route && x.route.riderId === o.route!.riderId && x.route.date === o.route!.date && x.route.run === o.route!.run
    && ON_ROUTE.includes(x.status) && !x.visit?.outcome && !x.visit?.skipRequested);
}

/** A rider's remaining stops, in order. "Not home" stops stay until the rider skips them. */
export function pendingStops(s: Pick<DataState, 'orders' | 'riders'>, riderId: string): Order[] {
  const rider = s.riders.find((r) => r.id === riderId)!;
  return [...new Set(rider.routeOrderIds)]
    .map((id) => s.orders.find((o) => o.id === id)!)
    .filter((o) => o && o.route?.riderId === riderId
      && (ON_ROUTE.includes(o.status) || (o.visit?.skipRequested && !o.visit.outcome)))
    .sort(byRoute);
}

const RUN_ORDER = ['Morning', 'Afternoon', 'Evening'];
/** Stop order: delivery date, then run, then stop number. */
export const byRoute = (a: Order, b: Order) =>
  a.route!.date.localeCompare(b.route!.date) || RUN_ORDER.indexOf(a.route!.run) - RUN_ORDER.indexOf(b.route!.run) || a.route!.seq - b.route!.seq;

/** 0 = the rider is heading to this stop now. */
export function stopsAway(s: Pick<DataState, 'orders' | 'riders'>, o: Order): number {
  if (!o.route) return -1;
  return pendingStops(s, o.route.riderId).findIndex((x) => x.id === o.id);
}

/** ETA range: now + (stopsAway + 1) × 9 min, ± 20 min, rounded to 15 min. */
export function etaRange(away: number): [string, string] {
  const mid = dayjs().add((away + 1) * MIN_PER_STOP, 'minute');
  const round = (d: dayjs.Dayjs) => d.minute(Math.round(d.minute() / 15) * 15).second(0);
  const a = round(mid.subtract(20, 'minute'));
  const b = round(mid.add(20, 'minute'));
  return [a.format('h:mm'), b.format('h:mm A')];
}

/**
 * Where the rider is (simulated): on the way from the last finished stop (or the hub) to the stop they're
 * heading to now — 60% of the way there. With no run under way, at the last finished stop / hub.
 */
export function riderPosition(s: Pick<DataState, 'orders' | 'riders' | 'addresses' | 'hubs'>, riderId: string): LatLng {
  const rider = s.riders.find((r) => r.id === riderId)!;
  const hub = s.hubs.find((h) => h.id === rider.hubId)!;
  const point = (o: Order) => deliveryPoint(s.addresses.find((a) => a.id === o.addressId)!);
  const done = [...new Set(rider.routeOrderIds)].map((id) => s.orders.find((o) => o.id === id)!)
    .filter((o) => o?.route?.riderId === riderId && o.visit?.outcome);
  const from = done.length ? point(done.sort(byRoute).at(-1)!) : { lat: hub.lat, lng: hub.lng };
  const pending = pendingStops(s, riderId);
  // Standing at a door (tapped Arrived, not finished yet) → that's where the rider is.
  const atDoor = pending.find((o) => o.visit?.arrived && !o.visit.outcome);
  if (atDoor) return point(atDoor);
  const heading = pending.find((o) => o.status === 'OUT_FOR_DELIVERY' || o.status === 'ARRIVING_SOON');
  if (!heading || heading.visit?.arrived) return heading ? point(heading) : from;
  const to = point(heading);
  // T3.2: refreshed every 60 s — the rider moves ~10% closer per minute since their last stop (35% → 92%).
  const minutes = rider.progressAt ? dayjs().diff(dayjs(rider.progressAt), 'minute') : 0;
  const f = Math.min(0.92, 0.35 + minutes * 0.1);
  return { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f };
}

// ---------------------------------------------------------------- start + progress

/** The earliest published run this rider hasn't started yet (stops still PLANNED). */
export function nextRunToStart(s: Pick<DataState, 'orders' | 'riders'>, riderId: string) {
  const planned = pendingStops(s, riderId).filter((o) => o.status === 'PLANNED');
  if (!planned.length) return null;
  const order = (o: Order) => `${o.route!.date}|${['Morning', 'Afternoon', 'Evening'].indexOf(o.route!.run)}`;
  const first = planned.map(order).sort()[0];
  const stops = planned.filter((o) => order(o) === first);
  return { date: stops[0].route!.date, run: stops[0].route!.run, stops };
}

/** Start the next run: its PLANNED stops go OUT_FOR_DELIVERY and customers get live tracking. */
export function startRoute(riderId: string): boolean {
  const s = get();
  const next = nextRunToStart(s, riderId);
  if (!next) return false;
  const stops = next.stops;
  s.patch((st) => ({ riders: st.riders.map((r) => (r.id === riderId ? { ...r, started: true } : r)) }));
  for (const o of stops) {
    setOrderStatus(o.id, 'OUT_FOR_DELIVERY', 'Out for delivery', { visit: freshVisit() });
    get().sendMessage({ customerId: o.customerId, orderId: o.id, channel: 'push', featureId: 'C1-F3', text: t('ofdPush', get().lang), buttons: [] });
  }
  s.log('CORE', 'route_started', 'rider', { riderId, stops: stops.length });
  s.log('C1-F3', 'tracking_shown', 'system', { riderId });
  refreshArriving(riderId);
  return true;
}

/** ARRIVING_SOON + "about 10 minutes away" once, for stops ≤ 2 away. */
export function refreshArriving(riderId: string) {
  get().patch((st) => ({ riders: st.riders.map((r) => (r.id === riderId ? { ...r, progressAt: nowIso() } : r)) }));
  const s = get();
  const rider = s.riders.find((r) => r.id === riderId)!;
  if (!rider.started) return;
  pendingStops(s, riderId).forEach((o, i) => {
    if (i > 2 || o.status !== 'OUT_FOR_DELIVERY' || o.arrivingNotified) return;
    const told = sameStop(o).some((x) => x.arrivingNotified);
    setOrderStatus(o.id, 'ARRIVING_SOON', 'About 10 minutes away', { arrivingNotified: true });
    if (told) { get().log('C1-F3', 'arriving_alert_merged', 'system', {}, o.id); return; } // same door: already told
    get().sendMessage({
      customerId: o.customerId, orderId: o.id, channel: 'whatsapp', featureId: 'C1-F3', text: t('arrivingMsg', get().lang, { rider: rider.name }),
      buttons: [
        { label: t('callRider', get().lang), action: `call_rider:${o.id}` },
        { label: t('notHome', get().lang), action: `not_home:${o.id}` },
      ],
    });
    get().log('C1-F3', 'arriving_alert_sent', 'system', { stopsAway: i }, o.id);
  });
}

function patchVisit(orderId: string, patch: Partial<Visit>) {
  const o = findOrder(orderId);
  updateOrder(orderId, { visit: { ...(o.visit ?? freshVisit()), ...patch } });
}

// ---------------------------------------------------------------- rider at the stop

/** Masked call (C1-F4). Confirmed customers pick up; others don't, in this simulation. */
export function riderCalls(orderId: string): boolean {
  const o = findOrder(orderId);
  const answered = o.homeCheck === 'yes' && !o.visit?.skipRequested;
  patchVisit(orderId, { callsMade: (o.visit?.callsMade ?? 0) + 1 });
  get().log('C1-F4', 'masked_call_started', 'rider', { direction: 'rider→customer' }, orderId);
  get().log('C1-F4', answered ? 'call_answered' : 'call_missed', 'system', {}, orderId);
  return answered;
}

export function sendDoorMessage(orderId: string) {
  const o = findOrder(orderId);
  patchVisit(orderId, { doorMessageSent: true });
  get().sendMessage({ customerId: o.customerId, orderId, channel: 'push', featureId: 'C1-F4', text: t('doorMsg', get().lang), buttons: [] });
  pushChat(orderId, 'rider', 'I’m at your door');
  get().log('C1-F4', 'rider_message_sent', 'rider', { text: 'at_door' }, orderId);
}

export function markArrived(orderId: string) {
  patchVisit(orderId, { arrived: true });
  for (const x of sameStop(findOrder(orderId))) patchVisit(x.id, { arrived: true }); // same door, same arrival
  get().log('C2-F4', 'arrived_at_stop', 'rider', { geofence: 'satisfied' }, orderId);
}

export const canMarkAttempt = (v?: Visit) => !!v && v.arrived && (v.callsMade >= 2 || v.doorMessageSent);

/**
 * Delivered: earnings, learned address (C2-F2), next stop.
 * Other parcels for the same door are handed over in the same stop (one OTP, one drop), except open-box
 * parcels, which still need their own check at the door.
 */
export function markDelivered(orderId: string, note?: string, otpVerified = false) {
  const o = findOrder(orderId);
  const together = sameStop(o).filter((x) => !x.openBox);
  deliverOne(orderId, note, otpVerified, true);
  for (const x of together) deliverOne(x.id, undefined, otpVerified, false);
  if (together.length) get().log('CORE', 'delivered_together', 'rider', { parcels: together.length + 1 }, orderId);
  const rider = get().riders.find((r) => r.id === o.route?.riderId);
  if (rider) refreshArriving(rider.id);
}

function deliverOne(orderId: string, note: string | undefined, otpVerified: boolean, firstOfStop: boolean) {
  const s = get();
  const o = findOrder(orderId);
  const rider = s.riders.find((r) => r.id === o.route?.riderId);
  setOrderStatus(orderId, 'DELIVERED', note ? `Delivered · ${note}` : 'Delivered', {
    visit: { ...(o.visit ?? freshVisit()), outcome: 'delivered' },
    attempts: [...o.attempts, { at: nowIso(), riderId: rider?.id ?? '', arrived: true, callsMade: o.visit?.callsMade ?? 0, doorMessageSent: !!o.visit?.doorMessageSent, result: 'delivered' }],
  });
  s.patch((st) => ({
    riders: st.riders.map((r) => (r.id === rider?.id && firstOfStop ? { ...r, earningsToday: r.earningsToday + EARNING_PER_DROP } : r)), // paid per drop, not per parcel
    customers: st.customers.map((c) => (c.id === o.customerId ? { ...c, deliveredOrders: c.deliveredOrders + 1 } : c)),
  }));
  if (firstOfStop) s.sendMessage({ customerId: o.customerId, orderId, channel: 'push', featureId: 'CORE', text: t('deliveredPush', s.lang), buttons: [] });
  s.log('CORE', 'delivered', 'rider', { payment: o.payment, collected: o.payment === 'COD' ? o.total : 0, otpVerified }, orderId);
  if (firstOfStop) learnDrop(o, note, otpVerified); // one drop point per door visit
}

/** C2-F2: store the drop point; two drops within 30 m → verified (L3) at their midpoint. Address text never changes. */
function learnDrop(o: Order, note?: string, otpVerified = false) {
  const s = get();
  const a = s.addresses.find((x) => x.id === o.addressId)!;
  const jitter = () => (Math.random() - 0.5) * 0.00025; // ≤ ~15 m
  // The rider navigates to the pin (geofenced "Arrived"), so a pinned address drops there; otherwise at the real door.
  const at = a.pin ?? a.truePoint;
  const drop = { lat: at.lat + jitter(), lng: at.lng + jitter(), at: nowIso() };
  const drops = [...(a.learned?.drops ?? []), drop];
  let learned = { lat: a.learned?.lat ?? drop.lat, lng: a.learned?.lng ?? drop.lng, drops, riderNote: note ?? a.learned?.riderNote };
  let confidence = a.confidence;
  const prev = drops.at(-2);
  // D1.8: an OTP-verified delivery within 30 m of the customer's pin verifies the door straight away.
  const ref = a.pin ?? (a.learned ? { lat: a.learned.lat, lng: a.learned.lng } : undefined);
  if (otpVerified && ref && distanceM(ref, drop) <= 30) {
    learned = { ...learned, lat: (ref.lat + drop.lat) / 2, lng: (ref.lng + drop.lng) / 2 };
    if (confidence !== 'L3') {
      confidence = 'L3';
      s.log('C2-F2', 'address_promoted_L3', 'system', { via: 'otp_delivery_within_30m', metres: Math.round(distanceM(ref, drop)) }, o.id);
    }
  } else if (prev && distanceM(prev, drop) <= 30) {
    learned = { ...learned, lat: (prev.lat + drop.lat) / 2, lng: (prev.lng + drop.lng) / 2 };
    if (confidence !== 'L3') {
      confidence = 'L3';
      s.log('C2-F2', 'address_promoted_L3', 'system', { drops: drops.length }, o.id);
    }
  }
  s.patch((st) => ({ addresses: st.addresses.map((x) => (x.id === a.id ? { ...x, learned, confidence } : x)) }));
  s.log('C2-F2', 'drop_point_captured', 'rider', { drops: drops.length }, o.id);
  if (note) s.log('C2-F2', 'rider_note_added', 'rider', { note }, o.id);
}

/** C2-F4: allowed only after Arrived AND (2 calls OR a door message). */
export function markAttempt(orderId: string, reason: string): boolean {
  const s = get();
  const o = findOrder(orderId);
  if (!canMarkAttempt(o.visit)) {
    s.log('C2-F4', 'attempt_button_locked', 'rider', { arrived: !!o.visit?.arrived, calls: o.visit?.callsMade ?? 0 }, orderId);
    return false;
  }
  const at = nowIso();
  const stop = [o, ...sameStop(o)]; // same door: one attempt for all its parcels
  for (const x of stop) {
    setOrderStatus(x.id, 'ATTEMPT_FAILED', `Delivery attempted · ${reason}`, {
      visit: { ...(x.visit ?? freshVisit()), arrived: true, callsMade: o.visit!.callsMade, doorMessageSent: o.visit!.doorMessageSent, outcome: 'failed' },
      attempts: [...x.attempts, { at, riderId: o.route!.riderId, arrived: true, callsMade: o.visit!.callsMade, doorMessageSent: o.visit!.doorMessageSent, result: 'failed', reason }],
    });
  }
  const key = stop.map((x) => x.id).join(',');
  s.sendMessage({
    customerId: o.customerId, orderId, channel: 'whatsapp', featureId: 'C2-F4',
    text: t('attemptMsg', s.lang, { time: dayjs(at).format('h:mm A') }),
    buttons: [
      { label: t('attemptHere', s.lang), action: `attempt_here:${key}` },
      { label: t('attemptMissed', s.lang), action: `attempt_missed:${key}` },
    ],
  });
  s.log('C2-F4', 'attempt_marked', 'rider', { reason, calls: o.visit!.callsMade, doorMessage: o.visit!.doorMessageSent }, orderId);
  s.log('C2-F4', 'attempt_notice_sent', 'system', {}, orderId);
  refreshArriving(o.route!.riderId);
  return true;
}

export function skipStop(orderId: string) {
  const o = findOrder(orderId);
  // the other parcels for this door were rescheduled with it ("I'm not home" covers the door)
  const skipped = get().orders.filter((x) => x.id !== o.id && x.customerId === o.customerId && x.addressId === o.addressId
    && x.route?.riderId === o.route?.riderId && x.visit?.skipRequested && !x.visit.outcome);
  updateOrder(orderId, { visit: { ...(o.visit ?? freshVisit()), outcome: 'skipped' } });
  for (const x of skipped) updateOrder(x.id, { visit: { ...x.visit!, outcome: 'skipped' } });
  get().log('C1-F3', 'stop_skipped', 'rider', { reason: 'customer_not_home' }, orderId);
  if (o.route) refreshArriving(o.route.riderId);
}

// ---------------------------------------------------------------- customer side

function pushChat(orderId: string, from: 'customer' | 'rider', text: string) {
  const o = findOrder(orderId);
  updateOrder(orderId, { chat: [...(o.chat ?? []), { from, text, at: nowIso() }] });
}

export function customerCallsRider(orderId: string) {
  get().log('C1-F4', 'masked_call_started', 'customer', { direction: 'customer→rider' }, orderId);
  get().log('C1-F4', 'call_answered', 'system', {}, orderId);
}

export function customerMessagesRider(orderId: string, text: string) {
  pushChat(orderId, 'customer', text);
  get().log('C1-F4', 'quick_reply_used', 'customer', { text }, orderId);
}

function answer(orderId: string, featureId: string, label: string) {
  get().patch((st) => ({
    messages: st.messages.map((m) => (m.orderId === orderId && m.featureId === featureId && !m.answered ? { ...m, answered: label } : m)),
  }));
}

/** Park the parcel for a new slot (next batches pick it up automatically on that date). */
function holdFor(o: Order, date: string, window: SlotLabel, note: string) {
  const slot = { date, window };
  if (o.hubId && !moveBooking(o.hubId, o.slot, slot)) slot.window = 'Any time';
  setOrderStatus(o.id, 'HELD', note, { slot, homeCheck: 'change_requested' });
}

/** C1-F3/10d: "I'm not home" — the rider skips (no failed attempt); the parcel waits for the new slot. */
export function customerNotHome(orderId: string, date: string, window: SlotLabel) {
  const o = findOrder(orderId);
  for (const x of [o, ...sameStop(o)]) { // every parcel for this door is skipped and moves to the new slot
    updateOrder(x.id, { visit: { ...(x.visit ?? freshVisit()), skipRequested: true } });
    holdFor(findOrder(x.id), date, window, `Not home · rescheduled to ${fmtDate(date)}`);
  }
  answer(orderId, 'C1-F3', t('notHome', get().lang));
  get().log('C1-F3', 'not_home_tapped', 'customer', { newDate: date, window }, orderId);
  if (o.route && ON_ROUTE.includes(o.status)) resequenceRemaining(o.route.riderId);
}

/** P3.8 live re-plan: re-order the rider's remaining stops (nearest first from where they are now) and refresh ETAs. */
export function resequenceRemaining(riderId: string) {
  const s = get();
  const rider = s.riders.find((r) => r.id === riderId)!;
  const hub = s.hubs.find((h) => h.id === rider.hubId)!;
  const left = pendingStops(s, riderId).filter((o) => o.status !== 'PLANNED' && !o.visit?.skipRequested && !o.visit?.arrived);
  if (!left.length) { refreshArriving(riderId); return; }
  const ids = nnOrder(riderPosition(s, riderId), left.map((o) => o.id), s.orders, s.addresses);
  const seqs = left.map((o) => o.route!.seq).sort((a, b) => a - b);
  ids.forEach((id, i) => { const o = findOrder(id); updateOrder(id, { route: { ...o.route!, seq: seqs[i] } }); });
  const eta = laneStats(hub, ids, get().orders, get().addresses).minutes;
  s.log('C3-F3', 'route_resequenced', 'system', { riderId, stops: ids.length, etaMin: eta, reason: 'customer_not_home' });
  refreshArriving(riderId);
}

/** "I was here, no one came" → Hub Disputes; the parcel is re-queued for the next day. Never an automatic penalty. */
export function disputeAttempt(orderId: string) {
  for (const x of failedTogether(orderId)) disputeOne(x.id);
}

/** Parcels that failed in the same door visit as this one (one answer covers them all). */
function failedTogether(orderId: string): Order[] {
  const o = findOrder(orderId);
  const at = o.attempts.at(-1)?.at;
  return get().orders.filter((x) => x.id === o.id || (x.customerId === o.customerId && x.addressId === o.addressId
    && x.status === 'ATTEMPT_FAILED' && x.attempts.at(-1)?.at === at));
}

function disputeOne(orderId: string) {
  const o = findOrder(orderId);
  const attempts = o.attempts.map((a, i) => (i === o.attempts.length - 1 ? { ...a, disputed: true, dispute: 'open' as const } : a));
  updateOrder(orderId, { attempts });
  const next = dayjs(o.slot.date).add(1, 'day').format('YYYY-MM-DD');
  holdFor(findOrder(orderId), next, o.slot.window, `Disputed attempt · re-delivery ${fmtDate(next)}`);
  answer(orderId, 'C2-F4', t('attemptHere', get().lang));
  get().log('C2-F4', 'attempt_disputed', 'customer', {}, orderId);
}

export function attemptMissed(orderId: string, date: string, window: SlotLabel) {
  for (const x of failedTogether(orderId)) holdFor(findOrder(x.id), date, window, `Missed delivery · rescheduled to ${fmtDate(date)}`);
  answer(orderId, 'C2-F4', t('attemptMissed', get().lang));
  get().log('C2-F4', 'attempt_rescheduled', 'customer', { date, window }, orderId);
}

export function resolveDispute(orderId: string, valid: boolean) {
  const o = findOrder(orderId);
  const attempts = o.attempts.map((a) => (a.dispute === 'open' ? { ...a, dispute: valid ? 'valid' as const : 'invalid' as const } : a));
  updateOrder(orderId, { attempts });
  get().log('C2-F4', 'dispute_resolved', 'hub', { outcome: valid ? 'customer_right' : 'rider_right' }, orderId);
}

export const codText = (o: Order) => (o.payment === 'COD' ? `Collect ${rupees(o.total)}` : 'Prepaid');
