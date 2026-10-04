// Action-driven order lifecycle (PRD v3 §7). Nothing happens without a button press;
// "system" effects run instantly inside the press that caused them.
import { useStore } from '../store';
import type { Order, OrderStatus, SlotLabel } from '../types';
import dayjs from 'dayjs';
import { fmtDate, rupees } from '../lib/format';
import { t } from '../lib/strings';
import { rescore, setOrderStatus, updateOrder, UPI_DISCOUNT } from './orders';
import { moveBooking } from './slots';

const get = () => useStore.getState();
const findOrder = (id: string) => get().orders.find((o) => o.id === id)!;
const hubName = (hubId: string | null) => get().hubs.find((h) => h.id === hubId)?.name ?? 'the delivery partner';

/** "Tue, 29 Sep, Evening 4-8" (window omitted for Any time). */
export function deliveryWhen(o: Order) {
  const window = o.slot.window !== 'Any time' ? `, ${o.slot.window}` : '';
  return `${fmtDate(o.slot.date)}${window}`;
}

// ---------------------------------------------------------------- Seller & Transit (S1.1): ships → in transit → reached hub

/** P1.7: a flagged order waits until the customer confirms (or the order is released). */
export const awaitingConfirmation = (o: Order) => o.confirm?.state === 'awaiting';

export function sellerShips(orderId: string) {
  const o = findOrder(orderId);
  if (o.status !== 'PLACED' || awaitingConfirmation(o)) return;
  setOrderStatus(orderId, 'SHIPPED', `Shipped by ${sellerOf(o)}`);
  get().log('CORE', 'seller_shipped', 'transit', {}, orderId);
}

export function markInTransit(orderId: string) {
  const o = findOrder(orderId);
  if (o.status !== 'SHIPPED') return;
  setOrderStatus(orderId, 'IN_TRANSIT', o.hubId ? `On the way to ${hubName(o.hubId)}` : 'With delivery partner');
  get().log('CORE', 'in_transit', 'transit', {}, orderId);
}

/** Reached the last-mile hub → Hub Inbound (scan-in sends the still-home ping). 3PL: partner delivers; ping only. */
export function reachedHub(orderId: string) {
  const o = findOrder(orderId);
  if (o.status !== 'IN_TRANSIT') return;
  if (!o.hubId) {
    setOrderStatus(orderId, 'OUT_FOR_DELIVERY', 'With delivery partner (3PL)', { homeCheck: 'awaiting' });
    get().log('CORE', 'reached_3pl_partner', 'transit', {}, orderId);
    sendHomeCheck(orderId, true);
    return;
  }
  setOrderStatus(orderId, 'AT_HUB', `Reached ${hubName(o.hubId)}`);
  get().log('CORE', 'reached_hub', 'transit', { hubId: o.hubId }, orderId);
}

const sellerOf = (o: Order) => get().products.find((p) => p.id === o.items[0].productId)?.sellerName ?? 'the seller';

// ---------------------------------------------------------------- C1-F5 delay alert (T4): missed dispatch / transit delay

/** Move an order's slot to a new date, keeping the window if it's open there (else Any time). */
function moveToDate(o: Order, date: string, window: SlotLabel) {
  let slot = { date, window };
  if (o.hubId && !moveBooking(o.hubId, o.slot, slot)) {
    slot = { date, window: 'Any time' };
    moveBooking(o.hubId, o.slot, slot);
  }
  updateOrder(o.id, { slot });
  return slot;
}

/** T4.4: free cancel only before the seller ships; after pickup the alert offers "Pick another time" instead. */
export const canCancelFree = (o: Order) => o.status === 'DELAYED_IN_TRANSIT' && o.delay?.prevStatus === 'PLACED';

/**
 * "Seller missed dispatch" (before shipping) or "Transit delay" (after pickup). New date = current slot date + days.
 * The customer gets: "Your order may arrive late, on [new day] instead of [old day]. Sorry about this."
 */
export function reportTransitDelay(orderId: string, days = 1, cause: 'missed_dispatch' | 'transit' = 'transit') {
  const s = get();
  const o = findOrder(orderId);
  const allowed = cause === 'missed_dispatch' ? o.status === 'PLACED' : ['SHIPPED', 'IN_TRANSIT'].includes(o.status);
  if (!allowed) return;
  const oldDate = o.slot.date;
  const newDate = dayjs(oldDate).add(days, 'day').format('YYYY-MM-DD');
  const freeCancel = o.status === 'PLACED';
  setOrderStatus(orderId, 'DELAYED_IN_TRANSIT', `${cause === 'missed_dispatch' ? 'Seller missed dispatch' : 'Delayed in transit'}, now ${fmtDate(newDate)}`, {
    delay: { oldDate, newDate, source: 'transit', cause, prevStatus: o.status },
  });
  const lang = s.lang;
  let text = t('delayMessage', lang, { newDate: fmtDate(newDate), oldDate: fmtDate(oldDate) });
  if (o.needBy && o.needBy < newDate) text += '\n' + t(freeCancel ? 'delayNeedBy' : 'delayNeedByNoCancel', lang, { needBy: fmtDate(o.needBy) });
  s.sendMessage({
    customerId: o.customerId, orderId, channel: 'whatsapp', featureId: 'C1-F5', text,
    buttons: [
      { label: t('delayOk', lang, { day: dayjs(newDate).format('ddd') }), action: `delay_ok:${orderId}` },
      { label: t('delayPick', lang), action: `delay_pick:${orderId}` },
      ...(freeCancel ? [{ label: t('delayCancel', lang), action: `delay_cancel:${orderId}` }] : []),
    ],
  });
  s.log('C1-F5', 'delay_reported', 'transit', { cause, days, oldDate, newDate, needBy: o.needBy ?? null }, orderId);
  s.log('C1-F5', 'delay_alert_sent', 'system', { freeCancel, missesNeedBy: !!o.needBy && o.needBy < newDate }, orderId);
}

function answerDelay(orderId: string, answer: string) {
  get().patch((st) => ({
    messages: st.messages.map((m) => (m.featureId === 'C1-F5' && !m.answered && m.orderId === orderId ? { ...m, answered: answer } : m)),
  }));
}

/** Back to where the parcel was before the delay (with seller, or in transit). */
const resumeStatus = (o: Order): OrderStatus => o.delay?.prevStatus ?? 'PLACED';

export function acceptDelay(orderId: string) {
  const o = findOrder(orderId);
  if (o.status !== 'DELAYED_IN_TRANSIT' || !o.delay) return;
  const slot = moveToDate(o, o.delay.newDate, o.slot.window);
  setOrderStatus(orderId, resumeStatus(o), `New delivery date ${fmtDate(slot.date)}`);
  answerDelay(orderId, t('delayOk', get().lang, { day: dayjs(slot.date).format('ddd') }));
  get().log('C1-F5', 'delay_accepted', 'customer', { newDate: slot.date }, orderId);
}

export function rescheduleAfterDelay(orderId: string, date: string, window: SlotLabel): boolean {
  const o = findOrder(orderId);
  if (o.status !== 'DELAYED_IN_TRANSIT') return false;
  if (o.hubId && !moveBooking(o.hubId, o.slot, { date, window })) return false;
  updateOrder(orderId, { slot: { date, window } });
  setOrderStatus(orderId, resumeStatus(o), `Rescheduled to ${fmtDate(date)}`);
  answerDelay(orderId, t('delayPick', get().lang));
  get().log('C1-F5', 'delay_rescheduled', 'customer', { date, window }, orderId);
  return true;
}

/** Free cancel: only possible if the seller hadn't shipped yet. */
export function cancelForFree(orderId: string) {
  const o = findOrder(orderId);
  if (!canCancelFree(o)) return;
  if (o.hubId) moveBooking(o.hubId, o.slot, { date: o.slot.date, window: 'Any time' }); // free the slot
  setOrderStatus(orderId, 'CANCELLED', 'Cancelled for free after a delay');
  answerDelay(orderId, t('delayCancel', get().lang));
  get().log('C1-F5', 'delay_cancelled_free', 'customer', {}, orderId);
  get().log('C1-F5', 'reverse_trip_avoided', 'system', { saving: 'no RTO: cancelled before the seller shipped' }, orderId);
}

// ---------------------------------------------------------------- Hub accept → C1-F2 home check

export function hubAccept(orderIds: string[]) {
  for (const id of orderIds) {
    const o = findOrder(id);
    if (o.status !== 'AT_HUB') continue;
    setOrderStatus(id, 'ACCEPTED', 'Accepted at your local hub', { homeCheck: 'awaiting' });
    get().log('CORE', 'hub_accepted', 'hub', { hubId: o.hubId }, id);
    sendHomeCheck(id);
    rescore(id, 'hub_accept');
  }
}

const HOME_CHECK_ACTIONS = ['check_yes', 'check_change', 'check_directions', 'pay_now'] as const;

/** One message per customer per delivery date: a second parcel for the same day joins the first message. */
function sendHomeCheck(orderId: string, thirdParty = false) {
  const s = get();
  const o = findOrder(orderId);
  const existing = s.messages.find((m) => m.featureId === 'C1-F2' && m.channel === 'whatsapp' && !m.answered
    && m.customerId === o.customerId && m.buttons[0]?.action.startsWith('check_yes:')
    && parseAction(m.buttons[0].action).orderIds.some((id) => findOrder(id).slot.date === o.slot.date));

  if (existing) {
    s.patch((st) => ({
      messages: st.messages.map((m) => (m.id !== existing.id ? m : {
        ...m,
        text: m.text + '\n' + t('hcAlsoParcel', st.lang, { id: o.id }),
        buttons: m.buttons.map((b) => ({ ...b, action: `${b.action},${o.id}` })),
      })),
    }));
    s.log('C1-F2', 'check_deduplicated', 'system', { mergedInto: existing.id }, orderId);
    return;
  }

  const lang = s.lang;
  let text = t('hcMessage', lang, { when: deliveryWhen(o) });
  if (o.payment === 'COD') text += '\n' + t('hcCash', lang, { amount: rupees(o.total) });
  const buttons = HOME_CHECK_ACTIONS
    // X1: a 3PL parcel only gets the ping (the other actions need a Valmo hub)
    .filter((a) => (!thirdParty || a === 'check_yes') && (a !== 'pay_now' || o.payment === 'COD'))
    .map((a) => ({ label: t(({ check_yes: 'hcYes', check_change: 'hcChange', check_directions: 'hcDirections', pay_now: 'hcPayNow' } as const)[a], lang), action: `${a}:${o.id}` }));
  s.sendMessage({ customerId: o.customerId, orderId: o.id, channel: 'whatsapp', featureId: 'C1-F2', text, buttons });
  s.log('C1-F2', 'check_sent', 'system', { channel: 'whatsapp', payment: o.payment, deliveryDate: o.slot.date }, orderId);
}

function markAnswered(orderId: string, answer: string) {
  get().patch((st) => ({
    messages: st.messages.map((m) => (m.featureId === 'C1-F2' && !m.answered
      && m.buttons.some((b) => parseAction(b.action).orderIds.includes(orderId)) ? { ...m, answered: answer } : m)),
  }));
}

// ---------------------------------------------------------------- customer replies

export function homeYes(orderIds: string[]) {
  for (const id of orderIds) {
    const o = findOrder(id);
    // A reply still counts after routes are published — the rider sees it as Confirmed.
    if (!['ACCEPTED', 'PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'].includes(o.status) || o.homeCheck === 'yes') continue;
    updateOrder(id, { homeCheck: 'yes' });
    markAnswered(id, t('hcYes', get().lang));
    get().log('C1-F2', 'check_yes', 'customer', {}, id);
    rescore(id, 'home_check');
  }
}

/** Change time is allowed until PLANNED, at most 2 changes. */
/** Change time: allowed right up until the rider reaches the door (max 2 changes). */
export const canChangeTime = (o: Order) =>
  !!o.hubId && o.rescheduleCount < 2 && !o.visit?.arrived && !o.visit?.skipRequested
  && ['PLACED', 'SHIPPED', 'IN_TRANSIT', 'AT_HUB', 'ACCEPTED', 'HELD', ...ON_ROUTE].includes(o.status);

const ON_ROUTE: Order['status'][] = ['PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'];

/** Returns false when the chosen window is full (or changes are no longer allowed). */
export function changeDayTime(orderId: string, date: string, window: SlotLabel): boolean {
  const o = findOrder(orderId);
  if (!canChangeTime(o)) return false;
  if (o.hubId && !moveBooking(o.hubId, o.slot, { date, window })) {
    get().log('C1-F1', 'slot_full_seen', 'customer', { date, window }, orderId);
    return false;
  }
  const when = `${fmtDate(date)}${window !== 'Any time' ? `, ${window}` : ''}`;
  const extra = { slot: { date, window }, rescheduleCount: o.rescheduleCount + 1 };
  if (ON_ROUTE.includes(o.status)) {
    // Already on a rider's route: the rider keeps the parcel and skips the stop; it goes out again on the new date
    // (preferably with the same rider). Not a failed attempt.
    setOrderStatus(orderId, 'HELD', `Rescheduled to ${when}, rider will skip today’s stop`, {
      ...extra, homeCheck: 'change_requested', visit: { arrived: false, callsMade: 0, doorMessageSent: false, ...o.visit, skipRequested: true },
    });
    markAnswered(orderId, t('hcChange', get().lang));
    get().log('C1-F2', 'check_change', 'customer', { date, window, afterDispatch: true, riderId: o.route?.riderId }, orderId);
    get().log('C1-F2', 'hold_created', 'system', { until: date, keepWithRider: o.route?.riderId }, orderId);
  } else if (['ACCEPTED', 'HELD'].includes(o.status)) {
    // At the hub → parcel is held for the new day.
    setOrderStatus(orderId, 'HELD', `Rescheduled to ${when}`, { ...extra, homeCheck: 'change_requested' });
    markAnswered(orderId, t('hcChange', get().lang));
    get().log('C1-F2', 'check_change', 'customer', { date, window }, orderId);
    get().log('C1-F2', 'hold_created', 'system', { until: date }, orderId);
  } else {
    updateOrder(orderId, extra);
    get().log('C1-F1', 'slot_rescheduled', 'customer', { date, window }, orderId);
  }
  return true;
}

/** Saves the text to the address (directions for the rider) and confirms back to the customer. */
export function addDirections(orderId: string, text: string) {
  const s = get();
  const o = findOrder(orderId);
  s.patch((st) => ({ addresses: st.addresses.map((a) => (a.id === o.addressId ? { ...a, directions: text } : a)) }));
  s.sendMessage({ customerId: o.customerId, orderId, channel: 'push', featureId: 'C1-F2', text: t('hcDirectionsSaved', s.lang), buttons: [] });
  s.log('C1-F2', 'check_directions', 'customer', { length: text.length }, orderId);
}

export function payNow(orderId: string) {
  const o = findOrder(orderId);
  if (o.payment !== 'COD') return;
  updateOrder(orderId, { payment: 'UPI', total: o.total - UPI_DISCOUNT });
  get().log('C1-F2', 'paid_now_upi', 'customer', { amount: o.total - UPI_DISCOUNT }, orderId);
}

/** Delivery days the customer can move to: the original promise and the next 3 days. */
export function rescheduleDates(o: Order, n = 4): string[] {
  return Array.from({ length: n }, (_, i) => dayjs(o.promisedDate).add(i, 'day').format('YYYY-MM-DD'));
}

// ---------------------------------------------------------------- hub follow-ups

/** No reply never cancels: mark it and leave a Vaani voice message. */
export function markNoReply(orderId: string) {
  const s = get();
  const o = findOrder(orderId);
  if (!['ACCEPTED', 'PLANNED'].includes(o.status) || o.homeCheck !== 'awaiting') return;
  updateOrder(orderId, { homeCheck: 'no_reply' });
  s.sendMessage({
    customerId: o.customerId, orderId, channel: 'voice', featureId: 'C1-F2',
    text: t('vaaniTranscript', s.lang, { when: deliveryWhen(o) }),
    buttons: [
      { label: t('vaaniPress1', s.lang), action: `check_yes:${o.id}` },
      { label: t('vaaniPress2', s.lang), action: `check_change:${o.id}` },
    ],
  });
  s.log('C1-F2', 'check_no_reply', 'hub', {}, orderId);
  s.log('C1-F2', 'vaani_call_placed', 'system', {}, orderId);
}

export function releaseHold(orderId: string) {
  const o = findOrder(orderId);
  if (o.status !== 'HELD') return;
  setOrderStatus(orderId, 'ACCEPTED', `Ready for delivery on ${fmtDate(o.slot.date)}`);
  get().log('C1-F2', 'hold_released', 'hub', {}, orderId);
}

// ---------------------------------------------------------------- message buttons

export type InboxAction = 'check_yes' | 'check_change' | 'check_directions' | 'pay_now' | 'delay_ok' | 'delay_pick' | 'delay_cancel'
  | 'call_rider' | 'not_home' | 'attempt_here' | 'attempt_missed' | 'replace' | 'close_refused' | 'ivr_confirm' | 'ivr_cancel' | 'share_location' | 'pay_upi_ship' | 'reorder' | 'redirect_buy';

export function parseAction(action: string): { kind: InboxAction; orderIds: string[] } {
  const [kind, ids] = action.split(':');
  return { kind: kind as InboxAction, orderIds: ids.split(',') };
}
