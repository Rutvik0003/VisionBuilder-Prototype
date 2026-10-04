// C3-F3 route planning, per delivery date and per run (Morning / Afternoon / Evening).
//
//  • A run's parcels: ACCEPTED parcels due that day whose window maps to this run. "Any time" goes in the
//    Morning run only if the customer confirmed; otherwise it waits for the Afternoon run (more time to reply).
//  • Carry-overs go first: parcels left unassigned by an earlier run that day, or overdue from an earlier day.
//  • HELD parcels due that day are released automatically when the run is planned (the customer chose that day).
//  • Far zone (> 5 km) → one rider as a batch. The rest: confirmed first, grouped by DIGIPIN-6 cluster (~1 km cell)
//    so a cluster stays with one rider, round-robin across riders within per-run capacity and the rider's day
//    cash limit (₹15,000 COD).
//  • Stop order: nearest-neighbour (fewest km); not-home / no-reply / unconfirmed Any time parcels go last.
//    ETA: 18 km/h road speed + 4 min per stop + 2 min extra for open-box.
//  • Lock & publish freezes the run: parcels become PLANNED and go to the rider app. Anything left over carries on.
import dayjs from 'dayjs';
import { useStore, type DataState } from '../store';
import type { Address, Hub, LatLng, Order, RouteLane, RoutePlan, RunId, SlotLabel } from '../types';
import { distanceM } from './geo';
import { nowIso } from '../lib/time';
import { setOrderStatus } from './orders';
import { encodeDigipin } from './digipin';

export const FAR_ZONE_M = 5000;
const ROAD_FACTOR = 1.3;
const SPEED_KMH = 18;
const STOP_MIN = 4;
export const OPEN_BOX_MIN = 2;
export const RUNS: RunId[] = ['Morning', 'Afternoon', 'Evening'];
export const RUN_WINDOW: Record<RunId, Exclude<SlotLabel, 'Any time'>> = {
  Morning: 'Morning 9-12', Afternoon: 'Afternoon 12-4', Evening: 'Evening 4-8',
};
/** Operating cut-off shown to customers and the hub (no clock in the prototype: the hub presses Lock). */
export const RUN_CUTOFF: Record<RunId, string> = { Morning: '8:30 am', Afternoon: '11:30 am', Evening: '3:30 pm' };
const ACTIVE_ROUTE: Order['status'][] = ['PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON', 'DELIVERED'];

const get = () => useStore.getState();
export const runKey = (hubId: string, date: string, run: RunId) => `${hubId}|${date}|${run}`;
export const isLocked = (s: Pick<DataState, 'runs'>, hubId: string, date: string, run: RunId) => !!s.runs[runKey(hubId, date, run)];

const isConfirmed = (o: Order) => o.homeCheck === 'yes' || o.homeCheck === 'change_requested';

/** Which run a parcel belongs to on its day. */
export function targetRun(o: Order): RunId {
  switch (o.slot.window) {
    case 'Morning 9-12': return 'Morning';
    case 'Afternoon 12-4': return 'Afternoon';
    case 'Evening 4-8': return 'Evening';
    default: return isConfirmed(o) ? 'Morning' : 'Afternoon';
  }
}

/** Best known door: learned from deliveries > customer pin > GeoIndia cell. */
export function deliveryPoint(a: Address): LatLng {
  const p = a.learned ?? a.pin ?? a.geoCell;
  return { lat: p.lat, lng: p.lng };
}

const angle = (hub: Hub, p: LatLng) => Math.atan2(p.lat - hub.lat, p.lng - hub.lng);
/** P3.4: first 6 DIGIPIN characters ≈ a 1 km cell. Parcels in one cell go to one rider. */
export const cluster6 = (p: LatLng) => encodeDigipin(p.lat, p.lng).replace(/-/g, '').slice(0, 6);

/**
 * Parcels for (hub, date, run) and which of them are carry-overs. A parcel belongs to its own run; it only
 * carries into a later run once its run has been locked without it, or when it's overdue from an earlier day.
 * HELD parcels due that day are included (they're released when the run is planned).
 */
export function runCandidates(s: Pick<DataState, 'orders' | 'runs'>, hubId: string, date: string, run: RunId) {
  const idx = RUNS.indexOf(run);
  const belongsHere = (o: Order) => {
    const own = targetRun(o);
    return own === run || (RUNS.indexOf(own) < idx && isLocked(s, hubId, date, own));
  };
  const firstOpen = RUNS.find((r) => !isLocked(s, hubId, date, r));
  const orders = s.orders.filter((o) => {
    if (o.hubId !== hubId || (o.status !== 'ACCEPTED' && o.status !== 'HELD')) return false;
    if (o.slot.date < date) return o.status === 'ACCEPTED' && run === firstOpen; // overdue: first open run of the day
    return o.slot.date === date && belongsHere(o);
  });
  const carry = orders.filter((o) => o.slot.date < date || targetRun(o) !== run).map((o) => o.id);
  return { orders, carry };
}

/** Delivery dates the hub can plan: anything with accepted/held/planned parcels, earliest first. */
export function hubDates(s: Pick<DataState, 'orders'>, hubId: string): string[] {
  const set = new Set<string>();
  for (const o of s.orders) {
    if (o.hubId !== hubId) continue;
    if (['ACCEPTED', 'HELD'].includes(o.status)) set.add(o.slot.date);
    if (o.route && ['PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'].includes(o.status)) set.add(o.route.date);
  }
  return [...set].sort();
}

export function laneStats(hub: Hub, orderIds: string[], orders: Order[], addresses: Address[]) {
  let km = 0, expected = 0, cod = 0, minutes = 0;
  let prev: LatLng = { lat: hub.lat, lng: hub.lng };
  for (const id of orderIds) {
    const o = orders.find((x) => x.id === id)!;
    const p = deliveryPoint(addresses.find((a) => a.id === o.addressId)!);
    km += (distanceM(prev, p) * ROAD_FACTOR) / 1000;
    prev = p;
    expected += 1 - o.rescue.pRto;
    if (o.payment === 'COD') cod += o.total;
    minutes += STOP_MIN + (o.openBox ? OPEN_BOX_MIN : 0);
  }
  minutes += (km / SPEED_KMH) * 60;
  return { km: Math.round(km * 10) / 10, expectedDrops: Math.round(expected * 10) / 10, codTotal: cod, minutes: Math.round(minutes) };
}

/** Parcels that should be visited last: more time to reply, or the customer said they're out. */
export const goesLast = (o: Order) => (o.slot.window === 'Any time' && !isConfirmed(o)) || o.homeCheck === 'no_reply' || !!o.visit?.skipRequested;

/** P3.5 nearest-neighbour order from a start point (fewest km); "goes last" parcels after the rest. */
export function nnOrder(start: LatLng, orderIds: string[], orders: Order[], addresses: Address[]) {
  const pt = (id: string) => { const o = orders.find((x) => x.id === id)!; return deliveryPoint(addresses.find((a) => a.id === o.addressId)!); };
  const late = (id: string) => goesLast(orders.find((x) => x.id === id)!);
  const out: string[] = [];
  let at = start;
  for (const group of [orderIds.filter((id) => !late(id)), orderIds.filter(late)]) {
    const left = [...group];
    while (left.length) {
      let best = 0;
      for (let k = 1; k < left.length; k++) if (distanceM(at, pt(left[k])) < distanceM(at, pt(left[best]))) best = k;
      const [id] = left.splice(best, 1);
      out.push(id);
      at = pt(id);
    }
  }
  return out;
}

function sequence(hub: Hub, orderIds: string[], orders: Order[], addresses: Address[]) {
  return nnOrder({ lat: hub.lat, lng: hub.lng }, orderIds, orders, addresses);
}

export function planRun(hubId: string, date: string, run: RunId): RoutePlan | null {
  const s0 = get();
  if (isLocked(s0, hubId, date, run)) return null;

  // Held parcels due today rejoin automatically.
  const { orders: initial } = runCandidates(s0, hubId, date, run);
  for (const o of initial.filter((x) => x.status === 'HELD')) {
    setOrderStatus(o.id, 'ACCEPTED', `Back in the ${run} run on ${dayjs(date).format('ddd, D MMM')}`);
    s0.log('C1-F2', 'hold_released', 'system', { auto: true, date, run }, o.id);
  }

  const s = get();
  const hub = s.hubs.find((h) => h.id === hubId)!;
  const riders = s.riders.filter((r) => r.hubId === hubId);
  const { orders: candidates, carry } = runCandidates(s, hubId, date, run);
  const addr = (o: Order) => s.addresses.find((a) => a.id === o.addressId)!;
  const dist = (o: Order) => distanceM({ lat: hub.lat, lng: hub.lng }, deliveryPoint(addr(o)));

  const far = candidates.filter((o) => dist(o) > FAR_ZONE_M);
  const near = candidates.filter((o) => dist(o) <= FAR_ZONE_M);
  const farRider = far.length && riders.length > 1 ? riders[riders.length - 1] : null;
  const pool = riders.filter((r) => r !== farRider);

  // Cash already on each rider from earlier runs that day counts against the ₹15,000 limit.
  const lanes = new Map<string, { ids: string[]; cod: number }>();
  for (const r of riders) {
    const earlier = s.orders.filter((o) => o.route?.riderId === r.id && o.route.date === date && ACTIVE_ROUTE.includes(o.status));
    lanes.set(r.id, { ids: [], cod: earlier.reduce((a, o) => a + (o.payment === 'COD' ? o.total : 0), 0) });
  }
  const unassigned: RoutePlan['unassigned'] = [];
  const cap = hub.capacityPerWindow;

  const fits = (riderId: string, o: Order) => {
    const lane = lanes.get(riderId)!;
    const rider = riders.find((r) => r.id === riderId)!;
    return { capacityOk: lane.ids.length < cap, cashOk: o.payment !== 'COD' || lane.cod + o.total <= rider.cashLimit };
  };
  const assign = (riderId: string, o: Order) => {
    const lane = lanes.get(riderId)!;
    lane.ids.push(o.id);
    if (o.payment === 'COD') lane.cod += o.total;
  };

  const priority = (a: Order, b: Order) =>
    Number(carry.includes(b.id)) - Number(carry.includes(a.id))
    || Number(isConfirmed(b)) - Number(isConfirmed(a))
    || cluster6(deliveryPoint(addr(a))).localeCompare(cluster6(deliveryPoint(addr(b))))
    || angle(hub, deliveryPoint(addr(a))) - angle(hub, deliveryPoint(addr(b)));

  for (const o of [...far].sort(priority)) {
    const target = farRider ?? pool[0];
    const f = fits(target.id, o);
    if (f.capacityOk && f.cashOk) assign(target.id, o);
    else unassigned.push({ orderId: o.id, reason: f.capacityOk ? 'cash_limit' : 'over_capacity' });
  }

  let pointer = 0;
  const clusterRider = new Map<string, string>();
  for (const o of [...near].sort(priority)) {
    const cell = cluster6(deliveryPoint(addr(o)));
    // A rescheduled parcel may still be on a rider's bike: give it back to the same rider if it fits.
    const keeper = o.route && pool.find((r) => r.id === o.route!.riderId);
    if (keeper) {
      const f = fits(keeper.id, o);
      if (f.capacityOk && f.cashOk) { assign(keeper.id, o); if (!clusterRider.has(cell)) clusterRider.set(cell, keeper.id); continue; }
    }
    // Same DIGIPIN-6 cluster → same rider, if it fits
    const owner = clusterRider.get(cell);
    if (owner) {
      const f = fits(owner, o);
      if (f.capacityOk && f.cashOk) { assign(owner, o); continue; }
    }
    let placed = false, sawCapacity = false;
    for (let k = 0; k < pool.length; k++) {
      const r = pool[(pointer + k) % pool.length];
      const f = fits(r.id, o);
      if (f.capacityOk) sawCapacity = true;
      if (f.capacityOk && f.cashOk) { assign(r.id, o); if (!clusterRider.has(cell)) clusterRider.set(cell, r.id); pointer = (pointer + k + 1) % pool.length; placed = true; break; }
    }
    if (!placed) unassigned.push({ orderId: o.id, reason: sawCapacity ? 'cash_limit' : 'over_capacity' });
  }

  const planLanes: RouteLane[] = riders.map((r) => {
    const ids = sequence(hub, lanes.get(r.id)!.ids, s.orders, s.addresses);
    return { riderId: r.id, orderIds: ids, farZone: r === farRider, ...laneStats(hub, ids, s.orders, s.addresses) };
  });

  const plan: RoutePlan = { hubId, date, run, createdAt: nowIso(), lanes: planLanes, unassigned, overrides: [], carryOver: carry };
  s.patch((st) => ({ plans: { ...st.plans, [runKey(hubId, date, run)]: plan } }));
  s.log('C3-F3', 'plan_requested', 'hub', {
    hubId, date, run, parcels: candidates.length, clusters: new Set(near.map((o) => cluster6(deliveryPoint(addr(o))))).size, carryOver: carry.length, farZone: far.length, unassigned: unassigned.length,
    expectedDrops: Math.round(planLanes.reduce((a, l) => a + l.expectedDrops, 0) * 10) / 10,
  });
  for (const u of unassigned) s.log('C3-F3', 'parcel_unassigned', 'system', { reason: u.reason, run }, u.orderId);
  return plan;
}

/** Manager override: move one stop to another rider (reason required). */
export function moveStop(key: string, orderId: string, toRiderId: string, reason: string) {
  const s = get();
  const plan = s.plans[key];
  if (!plan || !reason.trim()) return;
  const hub = s.hubs.find((h) => h.id === plan.hubId)!;
  const from = plan.lanes.find((l) => l.orderIds.includes(orderId))?.riderId ?? 'unassigned';
  if (from === toRiderId) return;
  const lanes = plan.lanes.map((l) => {
    let ids = l.orderIds.filter((id) => id !== orderId);
    if (l.riderId === toRiderId) ids = sequence(hub, [...ids, orderId], s.orders, s.addresses);
    return { ...l, orderIds: ids, ...laneStats(hub, ids, s.orders, s.addresses) };
  });
  s.patch((st) => ({
    plans: {
      ...st.plans,
      [key]: {
        ...plan, lanes,
        unassigned: plan.unassigned.filter((u) => u.orderId !== orderId),
        overrides: [...plan.overrides, { orderId, from, to: toRiderId, reason: reason.trim() }],
      },
    },
  }));
  s.log('C3-F3', 'override_made', 'hub', { from, to: toRiderId, reason: reason.trim() }, orderId);
}

export function discardPlan(key: string) {
  get().patch((st) => ({ plans: { ...st.plans, [key]: null } }));
}

/** Lock & publish: parcels get their rider + stop number, riders get their lists, the run is frozen. */
export function lockAndPublish(key: string) {
  const s = get();
  const plan = s.plans[key];
  if (!plan) return;
  for (const lane of plan.lanes) {
    const rider = get().riders.find((r) => r.id === lane.riderId)!;
    const offset = rider.routeOrderIds.length;
    lane.orderIds.forEach((id, i) => {
      setOrderStatus(id, 'PLANNED', `Assigned to ${rider.name} (${plan.run} run)`, {
        route: { riderId: rider.id, seq: offset + i + 1, date: plan.date, run: plan.run },
        visit: undefined, arrivingNotified: false, // a re-planned parcel starts a fresh visit
      });
    });
    get().patch((st) => ({
      riders: st.riders.map((r) => (r.id === lane.riderId ? { ...r, routeOrderIds: [...r.routeOrderIds, ...lane.orderIds] } : r)),
    }));
  }
  get().patch((st) => ({ plans: { ...st.plans, [key]: null }, runs: { ...st.runs, [key]: { lockedAt: nowIso() } } }));
  s.log('C3-F3', 'plan_published', 'hub', {
    date: plan.date, run: plan.run, riders: plan.lanes.filter((l) => l.orderIds.length).length,
    stops: plan.lanes.reduce((a, l) => a + l.orderIds.length, 0), carriedOver: plan.unassigned.length, overrides: plan.overrides.length,
  });
}
