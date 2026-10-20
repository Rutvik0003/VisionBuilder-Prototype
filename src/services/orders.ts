import dayjs from 'dayjs';
import { customAlphabet } from 'nanoid';
import { useStore } from '../store';
import type { Address, CartItem, Hub, Order, OrderStatus, Payment, RescueScore, SlotLabel } from '../types';
import { latency } from './api';
import { nowIso } from '../lib/time';
import { clusterInfo, openBoxEligible } from './catalog';
import { availability, confirmSlot } from './slots';
import { scoreOrder } from './rescue';

const orderId = customAlphabet('0123456789', 9);

export const UPI_DISCOUNT = 15;

/** Days from order to promised delivery, by hub tier; non-pilot addresses ship via 3PL (+5 days). */
const PROMISE_DAYS: Record<Hub['tier'], number> = { metro: 2, tier2: 3, tier3: 3 };

/** Extra days a seller needs before the parcel can reach the hub (e.g. ships from further away). */
export const SELLER_EXTRA_DAYS: Record<string, number> = { S_STEELKING: 1, S_PANIPAT: 1 };

/** Promised delivery date to this address; with sellers, the latest of their ready dates. */
export function promisedDateFor(address: Pick<Address, 'hubId'>, sellerIds: string[] = [], now = nowIso()): string {
  const hub = useStore.getState().hubs.find((h) => h.id === address.hubId);
  const days = (hub ? PROMISE_DAYS[hub.tier] : 5) + Math.max(0, ...sellerIds.map((id) => SELLER_EXTRA_DAYS[id] ?? 0));
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

/**
 * Place a checkout. Items from the same seller travel as one order (one parcel); items from different sellers
 * become one order per seller, linked by `groupId`. A group is confirmed together (one WhatsApp, one call) and
 * shares one delivery OTP. Delivery: "together" (default) = one slot for every parcel, on or after the latest
 * seller's ready date; "separate" = each parcel gets its own slot (`partSlots`), from its own ready date.
 * Returns the orders, the first one being the group's lead.
 */
export async function placeOrder(input: {
  customerId: Order['customerId']; items: CartItem[]; address: Address; payment: Payment; fromCart: boolean;
  slot?: Order['slot']; holdId?: string; deliverOnOrAfter?: string; openBox?: boolean;
  deliveryMode?: 'together' | 'separate'; partSlots?: Record<string, { date: string; window: SlotLabel; holdId?: string }>;
}): Promise<Order[]> {
  return latency(() => {
    const s = useStore.getState();
    const customer = s.customers.find((c) => c.id === input.customerId)!;
    const lines = lineItems(input.items);
    // One order per seller, in the order the items appear
    const sellers = [...new Set(lines.map((l) => l.product.sellerId))];
    const parts = sellers.map((sellerId) => lines.filter((l) => l.product.sellerId === sellerId));
    const hubId = input.address.hubId;
    const together = input.deliveryMode !== 'separate' || !hubId || parts.length < 2;
    const latest = promisedDateFor(input.address, sellers);
    // C1-F1: slots only exist for pilot hubs; elsewhere it's the promised date, any time.
    const shared: Order['slot'] = hubId && input.slot ? input.slot : { date: latest, window: 'Any time' };
    const plan = sellers.map((sellerId) => {
      const ready = promisedDateFor(input.address, [sellerId]);
      const own = input.partSlots?.[sellerId];
      return together
        ? { slot: shared, holdId: undefined as string | undefined, promisedDate: latest }
        : { slot: own ? { date: own.date, window: own.window } : { date: ready, window: 'Any time' as SlotLabel }, holdId: own?.holdId, promisedDate: ready };
    });

    if (hubId) {
      // Every parcel takes a seat in its window: check there is room for all of them before booking any.
      const need = new Map<string, { date: string; window: SlotLabel; n: number; held: number }>();
      plan.forEach((p, i) => {
        if (p.slot.window === 'Any time') return;
        const k = `${p.slot.date}|${p.slot.window}`;
        const cur = need.get(k) ?? { date: p.slot.date, window: p.slot.window, n: 0, held: 0 };
        cur.n += 1;
        if (together ? i === 0 && !!input.holdId : !!p.holdId) cur.held += 1; // our own held seat already counts as used
        need.set(k, cur);
      });
      for (const w of need.values()) {
        if (availability(s, hubId, w.date, w.window as Exclude<SlotLabel, 'Any time'>).left + w.held < w.n) {
          throw new SlotUnavailableError(`${w.window} on ${w.date} has no room for ${w.n} parcel${w.n > 1 ? 's' : ''}`);
        }
      }
      plan.forEach((p, i) => { confirmSlot(hubId, p.slot.date, p.slot.window, together ? (i === 0 ? input.holdId : undefined) : p.holdId); });
    }

    const deliveryOtp = String(1000 + Math.floor(Math.random() * 9000)); // D1.8: one OTP for the whole door drop
    const ids = parts.map(() => orderId());
    const groupId = parts.length > 1 ? ids[0] : undefined;
    const orders: Order[] = parts.map((part, i) => {
      const { total: partTotal } = priceSummary(part.map((l) => ({ productId: l.productId, qty: l.qty, size: l.size })), input.payment);
      // The UPI discount is once per checkout: it stays on the lead order only.
      const total = i === 0 || input.payment !== 'UPI' ? partTotal : partTotal + UPI_DISCOUNT;
      // Open-box is the customer's choice (opt-in), only on COD and only for parcels whose category allows it.
      const openBox = !!input.openBox && input.payment === 'COD' && part.some((l) => openBoxEligible(l.product, customer, input.address));
      const order: Order = {
        id: ids[i],
        customerId: input.customerId,
        items: part.map((l) => ({ productId: l.productId, qty: l.qty, price: l.product.price, size: l.size })),
        total,
        payment: input.payment,
        addressId: input.address.id,
        hubId: input.address.hubId,
        promisedDate: plan[i].promisedDate,
        slot: plan[i].slot,
        deliverOnOrAfter: input.payment === 'COD' ? input.deliverOnOrAfter : undefined,
        openBox,
        status: 'PLACED',
        homeCheck: 'not_sent',
        rescue: undefined as unknown as RescueScore, // scored just below
        attempts: [],
        timeline: [{ at: nowIso(), status: 'PLACED', note: groupId ? `Order placed · parcel ${i + 1} of ${parts.length}` : 'Order placed' }],
        createdAt: nowIso(),
        rescheduleCount: 0,
        deliveryOtp,
        groupId,
      };
      order.rescue = scoreFromStore(order);
      return order;
    });

    s.patch((st) => ({
      orders: [...orders, ...st.orders], // lead first in the list
      cart: input.fromCart
        ? { ...st.cart, [input.customerId]: (st.cart[input.customerId] ?? []).filter((c) => !input.items.some((i) => i.productId === c.productId)) }
        : st.cart,
      checkout: null,
    }));
    if (groupId) s.log('CORE', 'order_split_by_seller', 'system', { orders: ids, sellers: sellers.length }, groupId);
    for (const order of orders) {
      s.log('CORE', 'order_placed', 'customer', { total: order.total, payment: input.payment, hubId: order.hubId, promisedDate: order.promisedDate, mode: together ? 'together' : 'separate', groupId: groupId ?? null }, order.id);
      s.log('C3-F2', 'rescue_scored', 'system', { trigger: 'place_order', pRto: order.rescue.pRto, band: order.rescue.band, topReason: order.rescue.topReason }, order.id);
      if (order.rescue.holdout) s.log('C3-F2', 'holdout_assigned', 'system', {}, order.id);
      if (order.hubId) {
        s.log('C1-F1', 'slot_confirmed', 'system', { date: order.slot.date, window: order.slot.window }, order.id);
        if (order.deliverOnOrAfter) s.log('C1-F1', 'cod_date_selected', 'customer', { deliverOnOrAfter: order.deliverOnOrAfter }, order.id);
      }
      if (order.openBox) s.log('C2-F3', 'openbox_order_placed', 'system', {}, order.id);
    }
    const multiClusters = lines.filter((l) => clusterInfo(l.product, s.products).multi).map((l) => l.product.clusterId);
    if (multiClusters.length) s.log('C3-F1', 'post_order_suppressed', 'system', { clusterIds: multiClusters }, orders[0].id);
    return orders;
  }, 400, 700);
}

/** Orders placed in the same checkout (just this order when it wasn't split). */
export function groupOf(o: Order): Order[] {
  if (!o.groupId) return [o];
  return useStore.getState().orders.filter((x) => x.groupId === o.groupId);
}

/**
 * Other parcels going to the same door on the same day (a split checkout, or two separate orders).
 * They move together when the day changes and are delivered (or attempted) together by the rider.
 */
export function dropSiblings(o: Order, statuses?: OrderStatus[]): Order[] {
  return useStore.getState().orders.filter((x) => x.id !== o.id && x.customerId === o.customerId
    && x.addressId === o.addressId && x.slot.date === o.slot.date && (!statuses || statuses.includes(x.status)));
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

