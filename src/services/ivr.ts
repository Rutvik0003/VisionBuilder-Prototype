// P1 · IVR order confirmation for risk-flagged COD orders (checklist P1.1–P1.7), plus the Vaani still-home call (T2.7).
// No clock: the "no tap in 10 min" and "3 hours later" steps are simulator buttons. Quiet hours use the real clock.
import dayjs from 'dayjs';
import { useStore } from '../store';
import type { Order } from '../types';
import { fmtDate, rupees } from '../lib/format';
import { t } from '../lib/strings';
import { setOrderStatus, updateOrder, UPI_DISCOUNT } from './orders';
import { moveBooking } from './slots';
import { isApproximate, sendLocationPing } from './addresses';

const get = () => useStore.getState();
const findOrder = (id: string) => get().orders.find((o) => o.id === id)!;

export const HIGH_VALUE = 1500;
/** Pincodes with a high historical RTO share (Hardoi). */
export const HIGH_RTO_PINCODES = ['241001', '241121'];

// ---------------------------------------------------------------- P1.1 risk flag

/** Reasons a COD order should be confirmed before it ships. 2+ reasons → high, 1 → medium, 0 → not flagged. */
export function confirmationRisk(o: Order): { risk: 'medium' | 'high'; reasons: string[] } | null {
  if (o.payment !== 'COD') return null;
  const s = get();
  const customer = s.customers.find((c) => c.id === o.customerId)!;
  const address = s.addresses.find((a) => a.id === o.addressId);
  const earlier = s.orders.filter((x) => x.customerId === o.customerId && x.id !== o.id);
  const category = (id: string) => s.products.find((p) => p.id === id)?.category;
  const reasons: string[] = [];
  if (customer.deliveredOrders === 0 && !earlier.some((x) => x.payment === 'COD')) reasons.push('First COD order');
  if (o.total >= HIGH_VALUE) reasons.push(`High value (${rupees(o.total)})`);
  const seen = new Set(earlier.flatMap((x) => x.items.map((i) => category(i.productId))));
  if (earlier.length && o.items.some((i) => !seen.has(category(i.productId)))) reasons.push('New category');
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

/** Runs the moment an order is placed. */
export function afterOrderPlaced(orderId: string) {
  const s = get();
  const o = findOrder(orderId);
  const flag = confirmationRisk(o);
  if (flag) {
    updateOrder(orderId, { confirm: { ...flag, state: 'awaiting', calls: 0 } });
    s.log('P1', 'risk_flagged', 'system', { risk: flag.risk, reasons: flag.reasons }, orderId);
    sendConfirmWhatsApp(orderId);
  }
  const a = s.addresses.find((x) => x.id === o.addressId);
  if (a && o.hubId && isApproximate(a)) sendLocationPing(a.id, orderId);
}

function sendConfirmWhatsApp(orderId: string) {
  const s = get();
  const o = findOrder(orderId);
  const product = s.products.find((p) => p.id === o.items[0].productId)!;
  s.sendMessage({
    customerId: o.customerId, orderId, channel: 'whatsapp', featureId: 'P1',
    text: t('confirmMsg', s.lang, { item: product.title, amount: rupees(o.total), when: fmtDate(o.slot.date) }),
    buttons: [
      { label: t('ivrConfirmBtn', s.lang), action: `ivr_confirm:${orderId}` },
      { label: t('ivrCancelBtn', s.lang), action: `ivr_cancel:${orderId}` },
    ],
  });
  s.log('P1', 'confirm_whatsapp_sent', 'system', {}, orderId);
}

function answerConfirm(orderId: string, answer: string) {
  get().patch((st) => ({
    messages: st.messages.map((m) => (m.orderId === orderId && (m.featureId === 'P1' || m.featureId === 'IVR') && !m.answered ? { ...m, answered: answer } : m)),
  }));
}

// ---------------------------------------------------------------- customer answers (WhatsApp or keypad)

export function confirmOrder(orderId: string, via: 'whatsapp' | 'call') {
  const o = findOrder(orderId);
  if (!o.confirm || o.confirm.state === 'confirmed' || o.status !== 'PLACED') return;
  updateOrder(orderId, { confirm: { ...o.confirm, state: 'confirmed' } });
  answerConfirm(orderId, t('ivrConfirmBtn', get().lang));
  get().log('P1', 'order_confirmed', 'customer', { via }, orderId);
}

export const canCancelUnshipped = (orderId: string) => findOrder(orderId).status === 'PLACED';

export function cancelUnconfirmed(orderId: string, via: 'whatsapp' | 'call' | 'seller') {
  const o = findOrder(orderId);
  if (o.status !== 'PLACED') return;
  if (o.hubId) moveBooking(o.hubId, o.slot, { date: o.slot.date, window: 'Any time' }); // free the slot
  setOrderStatus(orderId, 'CANCELLED', via === 'seller' ? 'Cancelled before dispatch (could not reach you)' : 'Cancelled on order confirmation', {
    confirm: o.confirm ? { ...o.confirm, state: 'cancelled' } : undefined,
  });
  answerConfirm(orderId, t('ivrCancelBtn', get().lang));
  get().log('P1', 'order_cancelled_before_dispatch', via === 'seller' ? 'transit' : 'customer', { via }, orderId);
  get().log('C1-F5', 'reverse_trip_avoided', 'system', { saving: 'cancelled before dispatch' }, orderId);
  if (via === 'seller') {
    // P1.6: one-tap reorder link
    get().sendMessage({
      customerId: o.customerId, orderId, channel: 'whatsapp', featureId: 'P1',
      text: t('cancelledReorder', get().lang, { id: orderId }),
      buttons: [{ label: t('reorderBtn', get().lang), action: `reorder:${orderId}` }],
    });
  }
}

/** High risk, never reached: pay by UPI to ship now. */
export function payUpiToShip(orderId: string) {
  const o = findOrder(orderId);
  if (!o.confirm || o.payment !== 'COD') return;
  updateOrder(orderId, { payment: 'UPI', total: o.total - UPI_DISCOUNT, confirm: { ...o.confirm, state: 'released' } });
  answerConfirm(orderId, t('payUpiShip', get().lang));
  get().log('P1', 'paid_upi_to_ship', 'customer', { amount: o.total - UPI_DISCOUNT }, orderId);
}

export function releaseOrder(orderId: string) {
  const o = findOrder(orderId);
  if (!o.confirm) return;
  updateOrder(orderId, { confirm: { ...o.confirm, state: 'released' } });
  get().log('P1', 'confirmation_released', 'transit', {}, orderId);
}

// ---------------------------------------------------------------- calls (simulator buttons, quiet hours)

/** P1.5: no automated calls between 9 pm and 9 am (device clock). */
export const inQuietHours = (now = dayjs()) => now.hour() >= 21 || now.hour() < 9;

/** "No tap in 10 min" (1st call) or "3 hours later" (2nd call). Returns 'queued' during quiet hours. */
export function placeConfirmCall(orderId: string): 'ringing' | 'queued' | 'skip' {
  const o = findOrder(orderId);
  if (!o.confirm || o.confirm.state !== 'awaiting' || o.confirm.calls >= 2) return 'skip';
  if (inQuietHours()) {
    updateOrder(orderId, { confirm: { ...o.confirm, queued: true } });
    get().log('P1', 'call_queued_quiet_hours', 'system', { until: '9 am' }, orderId);
    return 'queued';
  }
  return ring(orderId);
}

/** Quiet hours over (9 am): place the queued call. */
export function placeQueuedCall(orderId: string) {
  const o = findOrder(orderId);
  if (!o.confirm?.queued) return;
  ring(orderId);
}

function ring(orderId: string): 'ringing' {
  const o = findOrder(orderId);
  const calls = (o.confirm?.calls ?? 0) + 1;
  updateOrder(orderId, { confirm: { ...o.confirm!, calls, queued: false } });
  get().patch(() => ({ call: { orderId, kind: 'confirm', ringAt: Date.now() + 1200 } }));
  get().log('P1', 'ivr_call_placed', 'system', { attempt: calls }, orderId);
  return 'ringing';
}

/** Declined / not answered. After the 2nd unanswered call the order is "never reached" (P1.6). */
export function confirmCallMissed(orderId: string) {
  const s = get();
  const o = findOrder(orderId);
  if (!o.confirm || o.confirm.state !== 'awaiting') return;
  s.log('P1', 'ivr_call_missed', 'system', { attempt: o.confirm.calls }, orderId);
  if (o.confirm.calls < 2) return;
  updateOrder(orderId, { confirm: { ...o.confirm, state: 'never_reached' }, pingPriority: o.confirm.risk === 'medium' });
  s.log('P1', 'never_reached', 'system', { risk: o.confirm.risk, outcome: o.confirm.risk === 'medium' ? 'ships, flagged for still-home ping' : 'held: pay by UPI or cancel' }, orderId);
  if (o.confirm.risk === 'high') {
    s.sendMessage({
      customerId: o.customerId, orderId, channel: 'whatsapp', featureId: 'P1',
      text: t('neverReachedHigh', s.lang, { id: orderId }),
      buttons: [
        { label: t('payUpiShip', s.lang), action: `pay_upi_ship:${orderId}` },
        { label: t('ivrCancelBtn', s.lang), action: `ivr_cancel:${orderId}` },
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
