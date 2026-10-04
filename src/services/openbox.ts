// C2-F3 open-box delivery at the door + Hub "Refusals & RTO" actions (PRD v3 §9.5, §7 rows 10b and 11).
import dayjs from 'dayjs';
import { customAlphabet } from 'nanoid';
import { useStore } from '../store';
import type { Inspection, Order } from '../types';
import { nowIso } from '../lib/time';
import { t } from '../lib/strings';
import { placeOrder, setOrderStatus, updateOrder } from './orders';
import { markDelivered, refreshArriving } from './delivery';
import { afterOrderPlaced } from './ivr';
import { startRedirect } from './redirect';

export const INSPECTION_SECONDS = 120; // 2:00 countdown
export const HARD_STOP_SECONDS = 300; // 5:00 hard stop
export const CHECKLIST = ['Correct item', 'Colour / design', 'Size label', 'Quantity', 'No damage'] as const;
export const REFUSAL_REASONS = ['Wrong item', 'Colour/design different', 'Wrong size label', 'Damaged', 'Changed mind'] as const;
export const RTO_AFTER_ATTEMPTS = 3;

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
export function refuseAfterInspection(orderId: string, reason: string, damaged: boolean, enteredSealId?: string) {
  const s = get();
  const o = findOrder(orderId);
  const sealId = (enteredSealId?.trim().toUpperCase()) || `TB-${sealCode()}`;
  const redirectEligible = reason === 'Changed mind' && !damaged;
  const at = nowIso();
  setOrderStatus(orderId, 'REFUSED_AFTER_INSPECTION', `Refused after inspection · ${reason}`, {
    sealId,
    inspection: { ...inspectionOf(o), outcome: 'refused' },
    refusal: { at, reason, damaged, itemPhotoAt: at, sealId, redirectEligible },
    visit: { arrived: true, callsMade: 0, doorMessageSent: false, ...o.visit, outcome: 'refused' },
    attempts: [...o.attempts, {
      at, riderId: o.route?.riderId ?? '', arrived: true, callsMade: o.visit?.callsMade ?? 0,
      doorMessageSent: !!o.visit?.doorMessageSent, result: 'refused_after_inspection', reason,
    }],
  });
  s.sendMessage({
    customerId: o.customerId, orderId, channel: 'whatsapp', featureId: 'C2-F3', text: t('refusedPush', s.lang, { reason }),
    buttons: [
      { label: t(reason === 'Changed mind' ? 'orderAgain' : 'getCorrectItem', s.lang), action: `replace:${orderId}` },
      { label: t('closeOrder', s.lang), action: `close_refused:${orderId}` },
    ],
  });
  s.log('C2-F3', 'inspection_refused', 'customer', { reason, damaged, seconds: secondsUsed(o) }, orderId);
  s.log('C2-F3', 'reseal_done', 'rider', { sealId, redirectEligible }, orderId);
  startRedirect(orderId); // R1: hub quality check → redirect shelf
  if (o.route) refreshArriving(o.route.riderId);
  return { sealId, redirectEligible };
}

/** Abort for safety: the parcel stays sealed with the rider; recorded as an attempt the customer can reschedule. */
export function abortOpenBox(orderId: string) {
  const s = get();
  const o = findOrder(orderId);
  const at = nowIso();
  setOrderStatus(orderId, 'ATTEMPT_FAILED', 'Open-box stopped for safety, parcel still sealed', {
    inspection: { ...inspectionOf(o), outcome: 'aborted' },
    visit: { arrived: true, callsMade: 0, doorMessageSent: false, ...o.visit, outcome: 'failed' },
    attempts: [...o.attempts, {
      at, riderId: o.route?.riderId ?? '', arrived: true, callsMade: o.visit?.callsMade ?? 0,
      doorMessageSent: !!o.visit?.doorMessageSent, result: 'failed', reason: 'Open-box aborted for safety',
    }],
  });
  s.sendMessage({
    customerId: o.customerId, orderId, channel: 'whatsapp', featureId: 'C2-F4',
    text: t('attemptMsg', s.lang, { time: dayjs(at).format('h:mm A') }),
    buttons: [{ label: t('attemptMissed', s.lang), action: `attempt_missed:${orderId}` }],
  });
  s.log('C2-F3', 'openbox_aborted', 'rider', {}, orderId);
  if (o.route) refreshArriving(o.route.riderId);
}

// ---------------------------------------------------------------- hub: refusals & RTO

/** Refused parcel: back to the seller, or (Changed mind, undamaged) redirected to the next buyer nearby. */
export function setDisposition(orderId: string, disposition: 'return_to_seller' | 'redirect') {
  const o = findOrder(orderId);
  if (!o.refusal || (disposition === 'redirect' && !o.refusal.redirectEligible)) return;
  updateOrder(orderId, { refusal: { ...o.refusal, disposition } });
  get().log('C2-F3', disposition === 'redirect' ? 'redirect_loop_queued' : 'returned_to_seller', 'hub', { sealId: o.refusal.sealId }, orderId);
}

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
  const fresh = await placeOrder({ customerId: o.customerId, items, address, payment: 'COD', fromCart: false, openBox: o.openBox });
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
