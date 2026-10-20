// P1 · IVR order confirmation for risk-flagged COD orders (checklist P1.1–P1.7), plus the Vaani still-home call (T2.7).
// No clock: the "no tap in 10 min" and "3 hours later" steps are simulator buttons. Quiet hours use the real clock.
import dayjs from 'dayjs';
import { useStore } from '../store';
import type { Order } from '../types';
import { fmtDate, rupees } from '../lib/format';
import { t } from '../lib/strings';
import { groupOf, setOrderStatus, updateOrder, UPI_DISCOUNT } from './orders';
import { moveBooking } from './slots';
import { isApproximate, sendLocationPing } from './addresses';

const get = () => useStore.getState();
const findOrder = (id: string) => get().orders.find((o) => o.id === id)!;

export const HIGH_VALUE = 1500;
/** Pincodes with a high historical RTO share (Hardoi). */
export const HIGH_RTO_PINCODES = ['241001', '241121'];

// A checkout split into one order per seller (`groupId`) is confirmed as ONE unit: one risk flag, one WhatsApp,
// one call, one "never reached" outcome. The customer can still keep some items and cancel others.

/** Orders confirmed together with this one (still with the seller and waiting on the same confirmation). */
export function confirmGroup(orderId: string): Order[] {
  return groupOf(findOrder(orderId)).filter((o) => !!o.confirm && o.status === 'PLACED');
}
const ids = (orders: Order[]) => orders.map((o) => o.id);
const idList = (orders: Order[]) => orders.map((o) => '#' + o.id).join(', ');
const productOf = (productId: string) => get().products.find((p) => p.id === productId)!;

/** One line per item across the group, used by WhatsApp, the call and the choose sheet. */
export interface ConfirmLine { key: string; orderId: string; index: number; productId: string; title: string; size?: string; qty: number; amount: number; seller: string }
export function confirmLines(orders: Order[]): ConfirmLine[] {
  return orders.flatMap((o) => o.items.map((it, index) => {
    const p = productOf(it.productId);
    return { key: `${o.id}:${index}`, orderId: o.id, index, productId: it.productId, title: p.title, size: it.size, qty: it.qty, amount: it.price * it.qty, seller: p.sellerName };
  }));
}
const lineName = (l: ConfirmLine) => `${l.title}${l.size ? ` (${l.size})` : ''}${l.qty > 1 ? ` × ${l.qty}` : ''}`;

// ---------------------------------------------------------------- P1.1 risk flag

/** Reasons a COD checkout should be confirmed before it ships. 2+ reasons → high, 1 → medium, 0 → not flagged. */
export function confirmationRisk(group: Order | Order[]): { risk: 'medium' | 'high'; reasons: string[] } | null {
  const orders = Array.isArray(group) ? group : [group];
  const o = orders[0];
  if (o.payment !== 'COD') return null;
  const s = get();
  const customer = s.customers.find((c) => c.id === o.customerId)!;
  const address = s.addresses.find((a) => a.id === o.addressId);
  const own = new Set(ids(orders));
  const earlier = s.orders.filter((x) => x.customerId === o.customerId && !own.has(x.id));
  const category = (id: string) => s.products.find((p) => p.id === id)?.category;
  const total = orders.reduce((sum, x) => sum + x.total, 0); // the whole checkout counts, not each parcel
  const reasons: string[] = [];
  if (customer.deliveredOrders === 0 && !earlier.some((x) => x.payment === 'COD')) reasons.push('First COD order');
  if (total >= HIGH_VALUE) reasons.push(`High value (${rupees(total)})`);
  const seen = new Set(earlier.flatMap((x) => x.items.map((i) => category(i.productId))));
  if (earlier.length && orders.some((x) => x.items.some((i) => !seen.has(category(i.productId))))) reasons.push('New category');
  if (customer.pastRefusalReasons.length || (address && HIGH_RTO_PINCODES.includes(address.pincode))) reasons.push('Recent RTO / high-RTO pincode');
  if (!reasons.length) return null;
  return { risk: reasons.length >= 2 ? 'high' : 'medium', reasons };
}

/** Seller may ship once confirmed / released; medium-risk "never reached" ships too; high-risk never-reached waits. */
export function canShip(o: Order) {
  const c = o.confirm;
  if (!c) return true;
  if (c.state === 'confirmed' || c.state === 'released') return true;
  if (c.state === 'never_reached') return c.risk === 'medium';
  return false;
}

/** Runs the moment a checkout is placed (all of its orders). */
export function afterOrderPlaced(orderIds: string | string[]) {
  const s = get();
  const orders = (Array.isArray(orderIds) ? orderIds : [orderIds]).map(findOrder);
  const lead = orders[0];
  const flag = confirmationRisk(orders);
  if (flag) {
    for (const o of orders) updateOrder(o.id, { confirm: { ...flag, state: 'awaiting', calls: 0 } });
    s.log('P1', 'risk_flagged', 'system', { risk: flag.risk, reasons: flag.reasons, orders: orders.length }, lead.id);
    sendConfirmWhatsApp(orders.map((o) => findOrder(o.id)));
  }
  const a = s.addresses.find((x) => x.id === lead.addressId);
  if (a && lead.hubId && isApproximate(a)) sendLocationPing(a.id, lead.id); // once per address
}

function sendConfirmWhatsApp(orders: Order[]) {
  const s = get();
  const lead = orders[0];
  const lines = confirmLines(orders);
  const key = ids(orders).join(',');
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  const text = lines.length === 1
    ? t('confirmMsg', s.lang, { item: lines[0].title, amount: rupees(total), when: fmtDate(lead.slot.date) })
    : t('confirmMsgMulti', s.lang, {
      n: lines.length, amount: rupees(total), when: fmtDate(lead.slot.date),
      list: lines.map((l) => `• ${lineName(l)} · ${rupees(l.amount)} · ${l.seller}`).join('\n'),
    });
  const buttons = lines.length === 1
    ? [{ label: t('ivrConfirmBtn', s.lang), action: `ivr_confirm:${key}` }, { label: t('ivrCancelBtn', s.lang), action: `ivr_cancel:${key}` }]
    : [
      { label: t('confirmAllBtn', s.lang), action: `ivr_confirm:${key}` },
      { label: t('chooseItemsBtn', s.lang), action: `ivr_choose:${key}` },
      { label: t('cancelAllBtn', s.lang), action: `ivr_cancel:${key}` },
    ];
  s.sendMessage({ customerId: lead.customerId, orderId: lead.id, channel: 'whatsapp', featureId: 'P1', text, buttons });
  s.log('P1', 'confirm_whatsapp_sent', 'system', { orders: orders.length, items: lines.length }, lead.id);
}

/** Mark every confirmation message for these orders as answered. */
function answerConfirm(orderIds: string[], answer: string) {
  const set = new Set(orderIds);
  get().patch((st) => ({
    messages: st.messages.map((m) => ((m.featureId === 'P1' || m.featureId === 'IVR') && !m.answered
      && ((m.orderId && set.has(m.orderId)) || m.buttons.some((b) => b.action.split(':')[1]?.split(',').some((id) => set.has(id))))
      ? { ...m, answered: answer } : m)),
  }));
}

// ---------------------------------------------------------------- customer answers (WhatsApp or keypad)

/** Confirm every order in the group. */
export function confirmOrder(orderId: string | string[], via: 'whatsapp' | 'call') {
  const group = confirmGroup(Array.isArray(orderId) ? orderId[0] : orderId).filter((o) => o.confirm!.state !== 'confirmed');
  if (!group.length) return;
  for (const o of group) updateOrder(o.id, { confirm: { ...o.confirm!, state: 'confirmed' } });
  answerConfirm(ids(group), t(group.length > 1 ? 'confirmAllBtn' : 'ivrConfirmBtn', get().lang));
  for (const o of group) get().log('P1', 'order_confirmed', 'customer', { via }, o.id);
}

export const canCancelUnshipped = (orderId: string) => findOrder(orderId).status === 'PLACED';

function cancelOne(o: Order, via: 'whatsapp' | 'call' | 'seller') {
  if (o.hubId) moveBooking(o.hubId, o.slot, { date: o.slot.date, window: 'Any time' }); // free its slot seat
  setOrderStatus(o.id, 'CANCELLED', via === 'seller' ? 'Cancelled before dispatch (could not reach you)' : 'Cancelled on order confirmation', {
    confirm: o.confirm ? { ...o.confirm, state: 'cancelled' } : undefined,
  });
  get().log('P1', 'order_cancelled_before_dispatch', via === 'seller' ? 'transit' : 'customer', { via }, o.id);
  get().log('C1-F5', 'reverse_trip_avoided', 'system', { saving: 'cancelled before dispatch' }, o.id);
}

/** Cancel every order in the group (still with the seller). */
export function cancelUnconfirmed(orderId: string | string[], via: 'whatsapp' | 'call' | 'seller') {
  const first = Array.isArray(orderId) ? orderId[0] : orderId;
  const o0 = findOrder(first);
  const group = (o0.confirm ? confirmGroup(first) : [o0]).filter((o) => o.status === 'PLACED');
  if (!group.length) return;
  group.forEach((o) => cancelOne(o, via));
  answerConfirm(ids(group), t(group.length > 1 ? 'cancelAllBtn' : 'ivrCancelBtn', get().lang));
  if (via === 'seller') {
    // P1.6: one-tap reorder link (one message for the whole checkout)
    get().sendMessage({
      customerId: o0.customerId, orderId: group[0].id, channel: 'whatsapp', featureId: 'P1',
      text: t('cancelledReorder', get().lang, { ids: idList(group) }),
      buttons: [{ label: t('reorderBtn', get().lang), action: `reorder:${ids(group).join(',')}` }],
    });
  }
}

/**
 * Keep some items, cancel the rest (WhatsApp "Keep some, cancel some" or keypad 3 on the call).
 * An order whose items are all cancelled is cancelled; an order keeping some items is trimmed and confirmed.
 */
export function applyConfirmChoices(orderId: string, cancelKeys: string[], via: 'whatsapp' | 'call') {
  const group = confirmGroup(orderId);
  if (!group.length) return { kept: [] as ConfirmLine[], cancelled: [] as ConfirmLine[] };
  const lines = confirmLines(group);
  const cancel = new Set(cancelKeys);
  const kept = lines.filter((l) => !cancel.has(l.key));
  const cancelled = lines.filter((l) => cancel.has(l.key));
  const lang = get().lang;
  if (!kept.length) { cancelUnconfirmed(orderId, via); return { kept, cancelled }; }
  for (const o of group) {
    const keepItems = o.items.filter((_, i) => !cancel.has(`${o.id}:${i}`));
    if (!keepItems.length) { cancelOne(o, via); continue; }
    const removed = o.items.length - keepItems.length;
    const newTotal = keepItems.reduce((sum, it) => sum + it.price * it.qty, 0) - (o.payment === 'UPI' && o.id === group[0].id ? UPI_DISCOUNT : 0);
    updateOrder(o.id, { items: keepItems, total: newTotal, confirm: { ...o.confirm!, state: 'confirmed' } });
    if (removed) get().log('P1', 'items_cancelled_before_dispatch', 'customer', { via, removed }, o.id);
    get().log('P1', 'order_confirmed', 'customer', { via, partial: removed > 0 }, o.id);
  }
  answerConfirm(ids(group), t('choiceDone', lang, { kept: kept.map(lineName).join(', '), cancelled: cancelled.map(lineName).join(', ') }));
  return { kept, cancelled };
}

/** High risk, never reached: pay by UPI to ship now (the whole checkout; one UPI discount). */
export function payUpiToShip(orderId: string | string[]) {
  const group = confirmGroup(Array.isArray(orderId) ? orderId[0] : orderId).filter((o) => o.payment === 'COD');
  if (!group.length) return;
  group.forEach((o, i) => updateOrder(o.id, { payment: 'UPI', total: o.total - (i === 0 ? UPI_DISCOUNT : 0), confirm: { ...o.confirm!, state: 'released' } }));
  answerConfirm(ids(group), t('payUpiShip', get().lang));
  get().log('P1', 'paid_upi_to_ship', 'customer', { amount: group.reduce((a, o) => a + o.total, 0) - UPI_DISCOUNT, orders: group.length }, group[0].id);
}

export function releaseOrder(orderId: string) {
  const group = confirmGroup(orderId);
  for (const o of group) updateOrder(o.id, { confirm: { ...o.confirm!, state: 'released' } });
  if (group.length) get().log('P1', 'confirmation_released', 'transit', { orders: group.length }, group[0].id);
}

// ---------------------------------------------------------------- calls (simulator buttons, quiet hours)

/** P1.5: no automated calls between 9 pm and 9 am (device clock). */
export const inQuietHours = (now = dayjs()) => now.hour() >= 21 || now.hour() < 9;

const patchConfirm = (group: Order[], patch: Partial<NonNullable<Order['confirm']>>) =>
  group.forEach((o) => updateOrder(o.id, { confirm: { ...findOrder(o.id).confirm!, ...patch } }));

/** "No tap in 10 min" (1st call) or "3 hours later" (2nd call): ONE call for the whole checkout. */
export function placeConfirmCall(orderId: string): 'ringing' | 'queued' | 'skip' {
  const group = confirmGroup(orderId);
  const c = group[0]?.confirm;
  if (!c || c.state !== 'awaiting' || c.calls >= 2) return 'skip';
  if (inQuietHours()) {
    patchConfirm(group, { queued: true });
    get().log('P1', 'call_queued_quiet_hours', 'system', { until: '9 am' }, group[0].id);
    return 'queued';
  }
  return ring(group);
}

/** Quiet hours over (9 am): place the queued call. */
export function placeQueuedCall(orderId: string) {
  const group = confirmGroup(orderId);
  if (!group[0]?.confirm?.queued) return;
  ring(group);
}

function ring(group: Order[]): 'ringing' {
  const calls = (group[0].confirm?.calls ?? 0) + 1;
  patchConfirm(group, { calls, queued: false });
  get().patch(() => ({ call: { orderId: group[0].id, kind: 'confirm', ringAt: Date.now() + 1200 } }));
  get().log('P1', 'ivr_call_placed', 'system', { attempt: calls, orders: group.length }, group[0].id);
  return 'ringing';
}

/** Declined / not answered. After the 2nd unanswered call the checkout is "never reached" (P1.6). */
export function confirmCallMissed(orderId: string) {
  const s = get();
  const group = confirmGroup(orderId).filter((o) => o.confirm!.state === 'awaiting');
  if (!group.length) return;
  const c = group[0].confirm!;
  s.log('P1', 'ivr_call_missed', 'system', { attempt: c.calls }, group[0].id);
  if (c.calls < 2) return;
  for (const o of group) updateOrder(o.id, { confirm: { ...o.confirm!, state: 'never_reached' }, pingPriority: c.risk === 'medium' });
  s.log('P1', 'never_reached', 'system', { risk: c.risk, orders: group.length, outcome: c.risk === 'medium' ? 'ships, flagged for still-home ping' : 'held: pay by UPI or cancel' }, group[0].id);
  if (c.risk === 'high') {
    const key = ids(group).join(',');
    s.sendMessage({
      customerId: group[0].customerId, orderId: group[0].id, channel: 'whatsapp', featureId: 'P1',
      text: t('neverReachedHigh', s.lang, { ids: idList(group) }),
      buttons: [
        { label: t('payUpiShip', s.lang), action: `pay_upi_ship:${key}` },
        { label: t(group.length > 1 ? 'cancelAllBtn' : 'ivrCancelBtn', s.lang), action: `ivr_cancel:${key}` },
      ],
    });
  }
}

/** T2.7 / H1.8: automated Vaani call for a COD no-reply (hub-triggered). */
export function ringVaani(orderId: string) {
  get().patch(() => ({ call: { orderId, kind: 'vaani', ringAt: Date.now() + 1200 } }));
  get().log('C1-F2', 'vaani_call_ringing', 'hub', {}, orderId);
}

export function endCall() {
  get().patch(() => ({ call: null }));
}
