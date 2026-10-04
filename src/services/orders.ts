import dayjs from 'dayjs';
import { customAlphabet } from 'nanoid';
import { useStore } from '../store';
import type { Address, CartItem, Hub, Order, OrderStatus, Payment, RescueScore } from '../types';
import { latency } from './api';
import { nowIso } from '../lib/time';
import { clusterInfo, openBoxEligible } from './catalog';
import { confirmSlot } from './slots';
import { scoreOrder } from './rescue';

const orderId = customAlphabet('0123456789', 9);

export const UPI_DISCOUNT = 15;

/** Days from order to promised delivery, by hub tier; non-pilot addresses ship via 3PL (+5 days). */
const PROMISE_DAYS: Record<Hub['tier'], number> = { metro: 2, tier2: 3, tier3: 3 };

export function promisedDateFor(address: Pick<Address, 'hubId'>, now = nowIso()): string {
  const hub = useStore.getState().hubs.find((h) => h.id === address.hubId);
  const days = hub ? PROMISE_DAYS[hub.tier] : 5;
  return dayjs(now).add(days, 'day').format('YYYY-MM-DD');
}

export function lineItems(items: CartItem[]) {
  const products = useStore.getState().products;
  return items
    .map((i) => ({ ...i, product: products.find((p) => p.id === i.productId)! }))
    .filter((i) => i.product);
}

export function priceSummary(items: CartItem[], payment?: Payment) {
  const lines = lineItems(items);
  const mrp = lines.reduce((a, l) => a + l.product.mrp * l.qty, 0);
  const price = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const upiDiscount = payment === 'UPI' ? UPI_DISCOUNT : 0;
  return { mrp, price, discount: mrp - price, upiDiscount, total: price - upiDiscount };
}

/** C3-F2: score an order from current store state (hub-only; customers never see it). */
function scoreFromStore(order: Parameters<typeof scoreOrder>[0]['order'] & { customerId: string; addressId: string; hubId: string | null }): RescueScore {
  const s = useStore.getState();
  return scoreOrder({
    order,
    customer: s.customers.find((c) => c.id === order.customerId)!,
    address: s.addresses.find((a) => a.id === order.addressId)!,
    hub: s.hubs.find((h) => h.id === order.hubId),
    products: s.products,
    festiveMode: s.festiveMode,
  });
}

/** Re-run the rescue engine (on Hub Accept and on home-check replies). */
export function rescore(orderId: string, trigger: 'hub_accept' | 'home_check') {
  const s = useStore.getState();
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return;
  const rescue = scoreFromStore(o);
  updateOrder(orderId, { rescue });
  s.log('C3-F2', 'rescue_scored', 'system', { trigger, pRto: rescue.pRto, band: rescue.band, topReason: rescue.topReason }, orderId);
}

export class SlotUnavailableError extends Error {}

export async function placeOrder(input: {
  customerId: Order['customerId']; items: CartItem[]; address: Address; payment: Payment; fromCart: boolean;
  slot?: Order['slot']; holdId?: string; needBy?: string; deliverOnOrAfter?: string; openBox?: boolean;
}): Promise<Order> {
  return latency(() => {
    const s = useStore.getState();
    const customer = s.customers.find((c) => c.id === input.customerId)!;
    const lines = lineItems(input.items);
    const { total } = priceSummary(input.items, input.payment);
    const promisedDate = promisedDateFor(input.address);
    // Open-box is the customer's choice (opt-in), only on COD and only if an item's category allows it.
    const openBox = !!input.openBox && input.payment === 'COD' && lines.some((l) => openBoxEligible(l.product, customer, input.address));
    // C1-F1: slots only exist for pilot hubs; elsewhere it's the promised date, any time.
    const slot = input.address.hubId && input.slot ? input.slot : { date: promisedDate, window: 'Any time' as const };
    if (input.address.hubId && !confirmSlot(input.address.hubId, slot.date, slot.window, input.holdId)) {
      throw new SlotUnavailableError(`${slot.window} on ${slot.date} just filled up`);
    }
    const order: Order = {
      id: orderId(),
      customerId: input.customerId,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.product.price, size: l.size })),
      total,
      payment: input.payment,
      addressId: input.address.id,
      hubId: input.address.hubId,
      promisedDate,
      slot,
      needBy: input.needBy,
      deliverOnOrAfter: input.payment === 'COD' ? input.deliverOnOrAfter : undefined,
      openBox,
      status: 'PLACED',
      homeCheck: 'not_sent',
      rescue: undefined as unknown as RescueScore, // scored just below
      attempts: [],
      timeline: [{ at: nowIso(), status: 'PLACED', note: 'Order placed' }],
      createdAt: nowIso(),
      rescheduleCount: 0,
      deliveryOtp: String(1000 + Math.floor(Math.random() * 9000)), // D1.8: read out to the rider at the door
    };
    order.rescue = scoreFromStore(order);
    s.patch((st) => ({
      orders: [order, ...st.orders],
      cart: input.fromCart
        ? { ...st.cart, [input.customerId]: (st.cart[input.customerId] ?? []).filter((c) => !input.items.some((i) => i.productId === c.productId)) }
        : st.cart,
      checkout: null,
    }));
    s.log('CORE', 'order_placed', 'customer', { total, payment: input.payment, hubId: order.hubId, promisedDate }, order.id);
    s.log('C3-F2', 'rescue_scored', 'system', { trigger: 'place_order', pRto: order.rescue.pRto, band: order.rescue.band, topReason: order.rescue.topReason }, order.id);
    if (order.rescue.holdout) s.log('C3-F2', 'holdout_assigned', 'system', {}, order.id);
    if (order.hubId) {
      s.log('C1-F1', 'slot_confirmed', 'system', { date: slot.date, window: slot.window }, order.id);
      if (order.needBy) s.log('C1-F1', 'need_by_set', 'customer', { needBy: order.needBy }, order.id);
      if (order.deliverOnOrAfter) s.log('C1-F1', 'cod_date_selected', 'customer', { deliverOnOrAfter: order.deliverOnOrAfter }, order.id);
    }
    if (openBox) s.log('C2-F3', 'openbox_order_placed', 'system', {}, order.id);
    const multiClusters = lines.filter((l) => clusterInfo(l.product, s.products).multi).map((l) => l.product.clusterId);
    if (multiClusters.length) s.log('C3-F1', 'post_order_suppressed', 'system', { clusterIds: multiClusters }, order.id);
    return order;
  }, 400, 700);
}

export function setOrderStatus(id: string, status: OrderStatus, note: string, extra: Partial<Order> = {}) {
  useStore.getState().patch((st) => ({
    orders: st.orders.map((o) => (o.id === id
      ? { ...o, ...extra, status, timeline: [...o.timeline, { at: nowIso(), status, note }] }
      : o)),
  }));
}

export function updateOrder(id: string, patch: Partial<Order>) {
  useStore.getState().patch((st) => ({ orders: st.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
}

export const ACTIVE_STATUSES: OrderStatus[] = [
  'PLACED', 'SHIPPED', 'IN_TRANSIT', 'DELAYED_IN_TRANSIT', 'AT_HUB', 'ACCEPTED', 'HELD', 'PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON', 'ATTEMPT_FAILED',
];

// ---- Customer-facing status presentation (never shows RTO / risk wording) ----
export const CUSTOMER_STATUS: Record<OrderStatus, { label: string; tone: 'brand' | 'success' | 'warning' | 'danger' | 'muted' }> = {
  PLACED: { label: 'Order placed', tone: 'brand' },
  SHIPPED: { label: 'Shipped', tone: 'brand' },
  IN_TRANSIT: { label: 'In transit', tone: 'brand' },
  DELAYED_IN_TRANSIT: { label: 'Running late', tone: 'warning' },
  AT_HUB: { label: 'At local hub', tone: 'brand' },
  ACCEPTED: { label: 'At local hub', tone: 'brand' },
  HELD: { label: 'Rescheduled', tone: 'warning' },
  PLANNED: { label: 'Arriving soon', tone: 'brand' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'brand' },
  ARRIVING_SOON: { label: 'Arriving soon', tone: 'success' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  ATTEMPT_FAILED: { label: 'Delivery attempted', tone: 'warning' },
  REFUSED_AFTER_INSPECTION: { label: 'Returned', tone: 'muted' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
  RTO: { label: 'Returned', tone: 'muted' },
};

export const TIMELINE_STEPS: { label: string; statuses: OrderStatus[] }[] = [
  { label: 'Placed', statuses: ['PLACED'] },
  { label: 'Shipped', statuses: ['SHIPPED', 'IN_TRANSIT', 'DELAYED_IN_TRANSIT'] },
  { label: 'At local hub', statuses: ['AT_HUB', 'ACCEPTED', 'HELD', 'PLANNED'] },
  { label: 'Out for delivery', statuses: ['OUT_FOR_DELIVERY', 'ARRIVING_SOON', 'ATTEMPT_FAILED'] },
  { label: 'Delivered', statuses: ['DELIVERED'] },
];

/** Index of the furthest timeline step reached (Placed → With seller → At local hub → Out for delivery → Delivered). */
export function timelineStep(status: OrderStatus): number {
  for (let i = TIMELINE_STEPS.length - 1; i >= 1; i--) if (TIMELINE_STEPS[i].statuses.includes(status)) return i;
  return 1;
}

