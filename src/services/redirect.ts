// R1 · Redirect Loop for RTO parcels only. A parcel marked RTO after failed attempts was never opened: the seller's
// seal is still on. The hub checks it from the outside (seal, label, box), scores local demand, and offers it to nearby
// shoppers who have the exact item in their cart / wishlist. First to pay gets it, delivered tomorrow from the hub.
// Open-box refusals are NOT redirected: they were opened at the door and resealed in a tamper bag, so they go back to
// the seller. No clock: "next 5 after a few hours" and "not sold in 3 days" are hub buttons; the 3-day cap also applies on real dates.
import dayjs from 'dayjs';
import { customAlphabet } from 'nanoid';
import { useStore } from '../store';
import type { Customer, Order, Product, Redirect } from '../types';
import { nowIso } from '../lib/time';
import { rupees } from '../lib/format';
import { t } from '../lib/strings';
import { updateOrder } from './orders';
import { scoreOrder } from './rescue';

const get = () => useStore.getState();
const findOrder = (id: string) => get().orders.find((o) => o.id === id)!;
const orderId = customAlphabet('0123456789', 9);

export const BONUS_PER_REDIRECT = 10;
export const HARD_CAP_DAYS = 3;
/** R1.8 learned hold window per category: fast movers 2–3 days, slow movers return at once. */
export const HOLD_DAYS: Record<Product['category'], number> = { fashion: 3, home: 3, kitchen: 0, beauty: 0 };

/** Stable pseudo-random 0..1 from a string (keeps the demo deterministic). */
function rand(key: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h % 10000) / 10000;
}

const productOf = (o: Order) => get().products.find((p) => p.id === o.items[0].productId)!;

/** The redirect record, for an open-box refusal or an RTO parcel. */
export const redirectOf = (o: Order) => o.refusal?.redirect ?? o.rto?.redirect;

function patchRedirect(o: Order, patch: Partial<Redirect>) {
  const redirect: Redirect = { state: 'qc', nudged: { top: [], next: [] }, ...redirectOf(o), ...patch };
  if (o.refusal) updateOrder(o.id, { refusal: { ...o.refusal, redirect } });
  else if (o.rto) updateOrder(o.id, { rto: { ...o.rto, redirect } });
  return redirect;
}

/** Called when a parcel is marked RTO (never opened, still under the seller's seal). */
export function startRedirect(refusedOrderId: string) {
  const o = findOrder(refusedOrderId);
  if (!o.rto) return;
  patchRedirect(o, { state: 'qc' });
}

// ---------------------------------------------------------------- R1.4 nearby cart & wishlist matches

export interface Match {
  customer: Customer;
  source: 'cart' | 'wishlist';
  addedDaysAgo: number;
  revisits: number;
  deliveries: number;
  recentRefusal: boolean;
  score: number;
  nudgedThisWeek: boolean;
}

/** Shoppers at the same hub with this exact item (size / colour) in their cart or wishlist, ranked. */
export function nearbyMatches(refusedOrderId: string): Match[] {
  const s = get();
  const o = findOrder(refusedOrderId);
  const p = productOf(o);
  const out: Match[] = [];
  for (const c of s.customers) {
    if (c.id === o.customerId) continue;
    const addr = s.addresses.find((a) => a.customerId === c.id && !a.deleted && a.hubId === o.hubId);
    // The New User has no saved address yet: the app's location puts them near this hub; they add an address when buying.
    const newUserNearby = !c.background && !s.addresses.some((a) => a.customerId === c.id && !a.deleted);
    if (!addr && !newUserNearby) continue;
    const demo = !c.background;
    const r = rand(`${c.id}|${p.clusterId}`);
    if (!demo && r < 0.25) continue; // ~75% of nearby shoppers have this exact item saved (demo data)
    const addedDaysAgo = demo ? 1 : 1 + Math.floor(r * 12);
    const revisits = demo ? 4 : Math.floor(rand(`${c.id}|rev`) * 5);
    const recentRefusal = c.pastRefusalReasons.length > 0;
    const score = Math.round((10 - Math.min(addedDaysAgo, 10)) * 3 + revisits * 4 + Math.min(c.deliveredOrders, 15) * 2 - (recentRefusal ? 25 : 0));
    const week = c.redirectNudgedAt ? dayjs().diff(dayjs(c.redirectNudgedAt), 'day') < 7 : false;
    out.push({ customer: c, source: r > 0.6 ? 'wishlist' : 'cart', addedDaysAgo, revisits, deliveries: c.deliveredOrders, recentRefusal, score, nudgedThisWeek: week });
  }
  // Demo accounts first (so a demo can show the nudge on the New User's phone), then by score
  return out.sort((a, b) => Number(!!a.customer.background) - Number(!!b.customer.background) || b.score - a.score);
}

// ---------------------------------------------------------------- R1.2 quality check + R1.3 demand score

export function demandFor(refusedOrderId: string): NonNullable<Redirect['demand']> {
  const o = findOrder(refusedOrderId);
  const p = productOf(o);
  const matches = nearbyMatches(refusedOrderId).filter((m) => !m.recentRefusal).length;
  const base = p.category === 'fashion' ? 1 : p.category === 'home' ? 0.6 : 0.2;
  const searches7d = Math.round((60 + rand(`${p.clusterId}|s`) * 160) * base);
  const sales30to90d = Math.round((20 + rand(`${p.clusterId}|v`) * 90) * base);
  const season = p.category === 'fashion' ? 'Festive season (high)' : p.category === 'home' ? 'Normal' : 'Low';
  // Weighted: nearby carts / wishlists count most, then searches and recent sales, plus a season bonus.
  const points = matches * 4 + searches7d / 10 + sales30to90d / 10 + (season.startsWith('Festive') ? 10 : season === 'Normal' ? 5 : 0);
  const score = points >= 40 ? 'High' : points >= 20 ? 'Medium' : 'Low';
  return { score, inputs: { cartsWishlists: matches, searches7d, sales30to90d, season } };
}

/** Packaging check from the outside (the parcel stays sealed): seller seal, label vs order, box condition. */
export function runQualityCheck(refusedOrderId: string, qc: { sealIntact: boolean; labelMatches: boolean; boxUndamaged: boolean }) {
  const s = get();
  const o = findOrder(refusedOrderId);
  if (!o.rto) return;
  const passed = qc.sealIntact && qc.labelMatches && qc.boxUndamaged;
  s.log('R1', 'quality_check', 'hub', { ...qc, passed }, o.id);
  if (!passed) {
    patchRedirect(o, { state: 'returned', qc: { ...qc, passed }, returnReason: 'Failed packaging check' });
    s.log('R1', 'returned_to_seller', 'hub', { reason: 'Failed packaging check' }, o.id);
    return;
  }
  const demand = demandFor(o.id);
  const p = productOf(o);
  s.log('R1', 'demand_scored', 'system', { score: demand.score, ...demand.inputs }, o.id);
  // Only High demand goes on the shelf, for up to 3 days (slow-moving categories return at once). Not sold by then → seller.
  const holdDays = demand.score === 'High' ? Math.min(HARD_CAP_DAYS, HOLD_DAYS[p.category]) : 0;
  if (holdDays === 0) {
    patchRedirect(o, { state: 'returned', qc: { ...qc, passed }, demand, holdDays, returnReason: demand.score !== 'High' ? `${demand.score} local demand` : 'Slow-moving category' });
    s.log('R1', 'returned_to_seller', 'system', { reason: 'Low demand / slow category' }, o.id);
    return;
  }
  patchRedirect(o, { state: 'shelf', qc: { ...qc, passed }, demand, holdDays, holdUntil: dayjs().add(holdDays, 'day').format('YYYY-MM-DD') });
  s.log('R1', 'on_redirect_shelf', 'hub', { holdDays }, o.id);
}

// ---------------------------------------------------------------- R1.4 / R1.5 / R1.10 nudges

function nudge(refusedOrderId: string, wave: 'top' | 'next') {
  const s = get();
  const o = findOrder(refusedOrderId);
  const r = redirectOf(o);
  if (!r || r.state !== 'shelf') return [];
  const already = new Set([...r.nudged.top, ...r.nudged.next]);
  const pick = nearbyMatches(o.id).filter((m) => !m.recentRefusal && !m.nudgedThisWeek && !already.has(m.customer.id)).slice(0, 5);
  const p = productOf(o);
  const price = p.price; // R1.5: same as the listing price, sold on the original seller's listing
  for (const m of pick) {
    const text = t('redirectNudge', s.lang, { item: p.title, price: rupees(price), seller: p.sellerName });
    // App push first; WhatsApp only for opted-in shoppers
    s.sendMessage({ customerId: m.customer.id, orderId: o.id, channel: 'push', featureId: 'R1', text, buttons: [{ label: t('redirectBuy', s.lang), action: `redirect_buy:${o.id}` }] });
    if (m.customer.whatsappOptIn) s.sendMessage({ customerId: m.customer.id, orderId: o.id, channel: 'whatsapp', featureId: 'R1', text, buttons: [{ label: t('redirectBuy', s.lang), action: `redirect_buy:${o.id}` }] });
  }
  s.patch((st) => ({ customers: st.customers.map((c) => (pick.some((m) => m.customer.id === c.id) ? { ...c, redirectNudgedAt: nowIso() } : c)) }));
  const ids = pick.map((m) => m.customer.id);
  patchRedirect(findOrder(o.id), { nudged: { ...r.nudged, [wave]: ids } });
  s.log('R1', wave === 'top' ? 'nudged_top_5' : 'nudged_next_5', 'system', { shoppers: ids.length, whatsapp: pick.filter((m) => m.customer.whatsappOptIn).length }, o.id);
  return ids;
}

export const nudgeTop5 = (id: string) => nudge(id, 'top');
/** "A few hours later" (button): the next 5 shoppers. */
export const nudgeNext5 = (id: string) => nudge(id, 'next');

// ---------------------------------------------------------------- R1.7 sale

/** Can this shopper buy it right now (needs a delivery address served by the parcel's hub)? */
export function needsAddressToBuy(refusedOrderId: string, buyerId: string) {
  const o = findOrder(refusedOrderId);
  return !get().addresses.some((a) => a.customerId === buyerId && !a.deleted && a.hubId === o.hubId);
}

/** First to pay gets it. Closes the refused order, prints a new invoice + label, adds the parcel to tomorrow's route. */
export function buyRedirect(refusedOrderId: string, buyerId: string): Order | null {
  const s = get();
  const o = findOrder(refusedOrderId);
  const r = redirectOf(o);
  if (!r || r.state !== 'shelf') return null; // someone else already paid
  const buyer = s.customers.find((c) => c.id === buyerId)!;
  const address = s.addresses.find((a) => a.customerId === buyerId && !a.deleted && a.hubId === o.hubId);
  if (!address) return null;
  const p = productOf(o);
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const item = o.items[0];
  const fresh: Order = {
    id: orderId(), customerId: buyerId, items: [{ productId: item.productId, qty: item.qty, price: p.price, size: item.size }],
    total: p.price * item.qty, payment: 'UPI', addressId: address.id, hubId: o.hubId, promisedDate: tomorrow,
    slot: { date: tomorrow, window: 'Any time' }, openBox: false, status: 'ACCEPTED', homeCheck: 'yes',
    rescue: undefined as unknown as Order['rescue'], attempts: [],
    timeline: [
      { at: nowIso(), status: 'PLACED', note: 'Bought from a nearby hub (original sealed pack)' },
      { at: nowIso(), status: 'ACCEPTED', note: 'At your local hub · delivering tomorrow' },
    ],
    createdAt: nowIso(), rescheduleCount: 0, redirectOf: o.id, deliveryOtp: String(1000 + Math.floor(Math.random() * 9000)),
  };
  fresh.rescue = scoreOrder({ order: fresh, customer: buyer, address, hub: s.hubs.find((h) => h.id === o.hubId), products: s.products, festiveMode: s.festiveMode });
  s.patch((st) => ({ orders: [fresh, ...st.orders] }));
  patchRedirect(findOrder(o.id), { state: 'sold', buyerId, newOrderId: fresh.id, price: fresh.total });
  // first order closed (COD → nothing to refund; prepaid would be refunded)
  if (o.payment === 'UPI') s.log('R1', 'first_order_refunded', 'system', { amount: o.total }, o.id);
  s.log('R1', 'redirect_sold', buyer.background ? 'system' : 'customer', { buyer: buyer.name, price: fresh.total, newOrderId: fresh.id }, o.id);
  s.log('R1', 'invoice_printed', 'hub', { orderId: fresh.id, seller: p.sellerName }, fresh.id);
  s.log('R1', 'label_printed', 'hub', { orderId: fresh.id }, fresh.id);
  s.log('R1', 'hub_bonus', 'system', { amount: BONUS_PER_REDIRECT }, o.id);
  s.sendMessage({ customerId: buyerId, orderId: fresh.id, channel: 'push', featureId: 'R1', text: t('redirectBought', s.lang, { item: p.title }), buttons: [] });
  return fresh;
}

/** R1.8: not sold within the hold window (button, or the 3-day cap on real dates) → return to seller. */
export function returnFromShelf(refusedOrderId: string, reason = 'Not sold in 3 days') {
  const o = findOrder(refusedOrderId);
  if (redirectOf(o)?.state !== 'shelf') return;
  patchRedirect(o, { state: 'returned', returnReason: reason });
  get().log('R1', 'returned_to_seller', 'system', { reason }, o.id);
}

/** Apply the hard cap on real dates (called when the Returns view opens). */
export function enforceHoldCap() {
  const today = dayjs().format('YYYY-MM-DD');
  for (const o of get().orders) {
    const r = redirectOf(o);
    if (r?.state === 'shelf' && r.holdUntil && r.holdUntil < today) returnFromShelf(o.id, `Hold cap reached (${HARD_CAP_DAYS} days)`);
  }
}

/** High-score parcels on a shelf at this hub, for the "Ready near you" strip (R1.6). */
export function readyNearYou(customerId: string, hubId: string | null | undefined) {
  if (!hubId) return [];
  return get().orders.filter((o) => o.hubId === hubId && o.customerId !== customerId
    && redirectOf(o)?.state === 'shelf' && redirectOf(o)?.demand?.score === 'High');
}

export function hubBonus(hubId: string) {
  return get().orders.filter((o) => o.hubId === hubId && redirectOf(o)?.state === 'sold').length * BONUS_PER_REDIRECT;
}
