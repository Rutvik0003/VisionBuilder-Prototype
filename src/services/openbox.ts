// C2-F3 open-box delivery at the door + Hub "Refusals & RTO" actions (PRD v3 §9.5, §7 rows 10b and 11).
import dayjs from 'dayjs';
import { customAlphabet } from 'nanoid';
import { useStore } from '../store';
import type { Inspection, Order } from '../types';
import { nowIso } from '../lib/time';
import { t } from '../lib/strings';
import { rupees } from '../lib/format';
import { placeOrder, setOrderStatus, updateOrder } from './orders';
import { markDelivered, refreshArriving } from './delivery';
import { afterOrderPlaced } from './ivr';
import { startRedirect } from './redirect';
import { itemsLabel } from './catalog';

export const INSPECTION_SECONDS = 120; // 2:00 countdown
export const HARD_STOP_SECONDS = 300; // 5:00 hard stop
export const CHECKLIST = ['Correct item', 'Colour / design', 'Size label', 'Quantity', 'No damage'] as const;
export const REFUSAL_REASONS = ['Wrong item', 'Colour/design different', 'Wrong size label', 'Damaged', 'Changed mind'] as const;
export const RTO_AFTER_ATTEMPTS = 3;

const orderIdGen = customAlphabet('0123456789', 9);
const sealCode = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
const get = () => useStore.getState();
const findOrder = (id: string) => get().orders.find((o) => o.id === id)!;
const inspectionOf = (o: Order): Inspection => o.inspection ?? { checklist: {} };

function patchInspection(orderId: string, patch: Partial<Inspection>) {
  const o = findOrder(orderId);
  updateOrder(orderId, { inspection: { ...inspectionOf(o), ...patch } });
}

// ---------------------------------------------------------------- rider at the door

export function takeSealPhoto(orderId: string) {
  patchInspection(orderId, { sealPhotoAt: nowIso() });
  get().log('C2-F3', 'seal_photo_taken', 'rider', {}, orderId);
}

export function startInspection(orderId: string) {
  patchInspection(orderId, { startedAt: nowIso() });
  get().log('C2-F3', 'inspection_started', 'rider', { limitSeconds: INSPECTION_SECONDS }, orderId);
}

export function toggleCheck(orderId: string, item: string) {
  const i = inspectionOf(findOrder(orderId));
  patchInspection(orderId, { checklist: { ...i.checklist, [item]: !i.checklist[item] } });
}

const secondsUsed = (o: Order) => (o.inspection?.startedAt ? dayjs().diff(dayjs(o.inspection.startedAt), 'second') : 0);

/** Delivery can only be confirmed once every checklist item passed. Anything failing → the customer refuses. */
export const checklistComplete = (i?: Inspection) => !!i?.sealPhotoAt && !!i.startedAt && CHECKLIST.every((c) => i.checklist[c]);

export function acceptAfterInspection(orderId: string, note?: string, otpVerified = false): boolean {
  const o = findOrder(orderId);
  if (!checklistComplete(o.inspection)) {
    get().log('C2-F3', 'accept_blocked_checklist', 'rider', { checked: CHECKLIST.filter((c) => o.inspection?.checklist[c]).length }, orderId);
    return false;
  }
  patchInspection(orderId, { outcome: 'accepted' });
  get().log('C2-F3', 'inspection_accepted', 'customer', { seconds: secondsUsed(o), checklist: inspectionOf(o).checklist }, orderId);
  markDelivered(orderId, note, otpVerified);
  return true;
}

/** Refuse → reason → item photo → reseal in a tamper bag. Always produces a seal ID and a reason. */
export function refuseAfterInspection(orderId: string, reason: string, damaged: boolean, enteredSealId?: string, keptFrom?: Order) {
  const s = get();
  const o = findOrder(orderId);
  const sealId = (enteredSealId?.trim().toUpperCase()) || `TB-${sealCode()}`;
  // Opened at the door and resealed in a tamper bag: the hub can't inspect it, so it always goes back to the seller.
  const redirectEligible = false;
  const at = nowIso();
  setOrderStatus(orderId, 'REFUSED_AFTER_INSPECTION', `Refused after inspection · ${reason}`, {
    sealId,
    inspection: { ...inspectionOf(o), outcome: 'refused' },
    refusal: { at, reason, damaged, itemPhotoAt: at, sealId, redirectEligible, disposition: 'return_to_seller', ...(o.payment === 'UPI' ? { refund: { amount: o.total, at } } : {}) },
    visit: { arrived: true, callsMade: 0, doorMessageSent: false, ...o.visit, outcome: 'refused' },
    attempts: [...o.attempts, {
      at, riderId: o.route?.riderId ?? '', arrived: true, callsMade: o.visit?.callsMade ?? 0,
      doorMessageSent: !!o.visit?.doorMessageSent, result: 'refused_after_inspection', reason,
    }],
  });
  s.sendMessage({
    customerId: o.customerId, orderId, channel: 'whatsapp', featureId: 'C2-F3',
    text: (keptFrom
      ? t('refusedPartPush', s.lang, { reason, kept: itemsLabel(keptFrom, s.products), returned: itemsLabel(o, s.products) })
      : t('refusedPush', s.lang, { reason }))
      + (o.payment === 'UPI' ? ' ' + t('refundLine', s.lang, { amount: rupees(o.total) }) : ''),
    buttons: [
      { label: t(reason === 'Changed mind' ? 'orderAgain' : 'getCorrectItem', s.lang), action: `replace:${orderId}` },
      { label: t('closeOrder', s.lang), action: `close_refused:${orderId}` },
    ],
  });
  s.log('C2-F3', 'inspection_refused', 'customer', { reason, damaged, seconds: secondsUsed(o) }, orderId);
  if (o.payment === 'UPI') s.log('C2-F3', 'refund_initiated', 'system', { amount: o.total, to: 'UPI' }, orderId);
  s.log('C2-F3', 'reseal_done', 'rider', { sealId, redirectEligible }, orderId);
  s.log('C2-F3', 'returning_to_seller', 'system', { reason: 'Opened at the door: sealed in a tamper bag, not resold' }, orderId);
  if (o.route) refreshArriving(o.route.riderId);
  return { sealId, redirectEligible };
}

/**
 * One open-box parcel with several items: the customer keeps some and returns the rest.
 * The returned items move to their own order (same seller, same door) that is refused and resealed in a tamper bag
 * → back to the seller, with Order again / Close for the customer. The kept items are delivered and paid for.
 */
export function refuseSomeItems(orderId: string, returns: { index: number; qty: number }[], reason: string, damaged: boolean, enteredSealId: string, otpVerified: boolean) {
  const s = get();
  const o = findOrder(orderId);
  // how many of each line come back (a line of 2 can return 1 and keep 1)
  const back = new Map(returns.filter((r) => r.qty > 0).map((r) => [r.index, Math.min(r.qty, o.items[r.index]?.qty ?? 0)]));
  if (back.size === 0) return null;
  const keep = o.items.map((it, i) => ({ ...it, qty: it.qty - (back.get(i) ?? 0) })).filter((it) => it.qty > 0);
  const returned = o.items.map((it, i) => ({ ...it, qty: back.get(i) ?? 0 })).filter((it) => it.qty > 0);
  if (!keep.length) return { ...refuseAfterInspection(orderId, reason, damaged, enteredSealId), childId: orderId };
  const sum = (items: Order['items']) => items.reduce((a, it) => a + it.price * it.qty, 0);
  // What was paid is split: the kept part keeps any UPI discount, the returned part is what comes back (refund if prepaid)
  const discount = Math.max(0, sum(o.items) - o.total);
  const keptTotal = Math.max(0, sum(keep) - discount);
  const backTotal = o.total - keptTotal;
  const at = nowIso();
  const childId = orderIdGen();
  const child: Order = {
    ...o, id: childId, items: returned, total: backTotal, returnedFrom: o.id, groupId: undefined, attempts: [],
    timeline: [{ at, status: o.status, note: `Returned at the door from order #${o.id}` }],
  };
  s.patch((st) => ({ orders: [child, ...st.orders] }));
  s.log('C2-F3', 'items_returned_at_door', 'customer', { returned: returned.length, kept: keep.length, reason }, orderId);
  const result = refuseAfterInspection(childId, reason, damaged, enteredSealId, { ...o, items: keep });
  // the rest of the parcel is accepted: the customer pays only for what they keep
  updateOrder(orderId, { items: keep, total: keptTotal, returnedPart: childId, sealId: undefined });
  patchInspection(orderId, { outcome: 'accepted' });
  s.log('C2-F3', 'inspection_accepted', 'customer', { seconds: secondsUsed(o), partial: true, kept: keep.length }, orderId);
  markDelivered(orderId, undefined, otpVerified);
  return { ...result, childId };
}


// ---------------------------------------------------------------- hub: refusals & RTO

export const failedAttempts = (o: Order) => o.attempts.filter((a) => a.result === 'failed').length;

/** Enabled only after 3 failed attempts. */
export function markRTO(orderId: string) {
  const o = findOrder(orderId);
  if (failedAttempts(o) < RTO_AFTER_ATTEMPTS) return;
  const reason = o.attempts.at(-1)?.reason ?? 'Not delivered';
  setOrderStatus(orderId, 'RTO', `Not delivered after ${failedAttempts(o)} attempts · returning to the seller`, { rto: { at: nowIso(), reason } });
  get().log('CORE', 'rto_marked', 'hub', { attempts: failedAttempts(o), lastReason: reason }, orderId);
  // R1: an RTO parcel was never opened, so it can be resold nearby before it travels back to the seller
  startRedirect(orderId);
}

/** Try again tomorrow: the parcel waits in Held and rejoins that day's run automatically. */
export function reattemptTomorrow(orderId: string) {
  const o = findOrder(orderId);
  if (o.status !== 'ATTEMPT_FAILED') return;
  const date = dayjs().add(1, 'day').format('YYYY-MM-DD');
  setOrderStatus(orderId, 'HELD', `Re-attempt on ${dayjs(date).format('ddd, D MMM')}`, { slot: { date, window: o.slot.window } });
  get().log('C2-F4', 'reattempt_scheduled', 'hub', { date, attempts: failedAttempts(o) }, orderId);
}

// ---------------------------------------------------------------- customer: after refusing at the door

function answerRefusal(orderId: string, answer: string) {
  get().patch((st) => ({
    messages: st.messages.map((m) => (m.orderId === orderId && m.featureId === 'C2-F3' && !m.answered ? { ...m, answered: answer } : m)),
  }));
}

/**
 * Replacement: a new order linked to the refused one — same item (optionally another size) at the price
 * originally paid, same address, Cash on Delivery with open-box again. It goes through the normal flow.
 */
export async function orderReplacement(orderId: string, size?: string): Promise<Order | null> {
  const o = findOrder(orderId);
  if (!o.refusal || o.refusal.customerChoice) return null;
  const address = get().addresses.find((a) => a.id === o.addressId)!;
  const items = o.items.map((it, i) => ({ productId: it.productId, qty: it.qty, size: i === 0 && size ? size : it.size }));
  const [fresh] = await placeOrder({ customerId: o.customerId, items, address, payment: 'COD', fromCart: false, openBox: o.openBox }); // same item, same seller → one order
  updateOrder(fresh.id, { replacementFor: o.id, openBox: fresh.openBox || o.openBox });
  updateOrder(orderId, { refusal: { ...o.refusal, customerChoice: 'replacement', replacementOrderId: fresh.id } });
  answerRefusal(orderId, t('getCorrectItem', get().lang));
  afterOrderPlaced(fresh.id);
  get().log('C2-F3', 'replacement_ordered', 'customer', { replacementOrderId: fresh.id, reason: o.refusal.reason, newSize: size ?? null }, orderId);
  return findOrder(fresh.id);
}

/** Close the refused order. Cash on Delivery, so there is nothing to pay or refund. */
export function closeRefusedOrder(orderId: string) {
  const o = findOrder(orderId);
  if (!o.refusal || o.refusal.customerChoice) return;
  updateOrder(orderId, { refusal: { ...o.refusal, customerChoice: 'closed' } });
  answerRefusal(orderId, t('closeOrder', get().lang));
  get().log('C2-F3', 'refused_order_closed', 'customer', { reason: o.refusal.reason }, orderId);
}
