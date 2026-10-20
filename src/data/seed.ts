import dayjs from 'dayjs';
import type { Address, Customer, Hub, Order, Rider, SlotInventory, SlotLabel } from '../types';
import { encodeDigipin } from '../services/digipin';
import { PRODUCTS } from './products';
import { scoreOrder } from '../services/rescue';

export { PRODUCTS };

export const HUBS: Hub[] = [
  {
    id: 'HUB_HARDOI', name: 'Hardoi LMDC', tier: 'tier3',
    lat: 27.3965, lng: 80.125, pincodes: ['241001', '241121'], capacityPerWindow: 9, bufferPct: 10,
  },
  {
    id: 'HUB_PUNE', name: 'Pune Kothrud LMDC', tier: 'metro',
    lat: 18.5074, lng: 73.8077, pincodes: ['411038', '411029'], capacityPerWindow: 12, bufferPct: 10,
  },
];

/**
 * Known pincodes (approximate centroids). Pilot pincodes map to a hub; the rest get `hubId = null`
 * (normal delivery: no slot step, no open-box). Unknown pincodes are rejected in the prototype.
 */
export const PINCODES: Record<string, { lat: number; lng: number; city: string; state: string }> = {
  '241001': { lat: 27.3985, lng: 80.1300, city: 'Hardoi', state: 'Uttar Pradesh' },
  '241121': { lat: 27.4330, lng: 80.1640, city: 'Hardoi', state: 'Uttar Pradesh' },
  '411038': { lat: 18.5074, lng: 73.8077, city: 'Pune', state: 'Maharashtra' },
  '411029': { lat: 18.4966, lng: 73.8216, city: 'Pune', state: 'Maharashtra' },
  // non-pilot
  '226001': { lat: 26.8467, lng: 80.9462, city: 'Lucknow', state: 'Uttar Pradesh' },
  '110001': { lat: 28.6328, lng: 77.2197, city: 'New Delhi', state: 'Delhi' },
  '400001': { lat: 18.9388, lng: 72.8354, city: 'Mumbai', state: 'Maharashtra' },
  '560001': { lat: 12.9716, lng: 77.5946, city: 'Bengaluru', state: 'Karnataka' },
};

export const hubIdForPincode = (pincode: string) => HUBS.find((h) => h.pincodes.includes(pincode))?.id ?? null;

const rider = (id: string, name: string, hubId: string): Rider => ({
  id, name, hubId, vehicle: 'bike', cashLimit: 15000, earningsToday: 0, routeOrderIds: [], currentIndex: 0, started: false,
});

export const RIDERS: Rider[] = [
  rider('R_SURESH', 'Suresh', 'HUB_HARDOI'),
  rider('R_IMRAN', 'Imran', 'HUB_HARDOI'),
  rider('R_DEEPAK', 'Deepak', 'HUB_HARDOI'),
  rider('R_ANIL', 'Anil', 'HUB_PUNE'),
  rider('R_RAVI', 'Ravi', 'HUB_PUNE'),
  rider('R_SAGAR', 'Sagar', 'HUB_PUNE'),
];

export const CUSTOMERS: Customer[] = [
  {
    id: 'existing', name: 'Rekha Yadav', blurb: 'Repeat buyer · 12 delivered orders · 3 saved addresses',
    phone: '+91 98XXX 41210', language: 'en', deliveredOrders: 12, pastRefusalReasons: ['not_available'],
    defaultAddressId: 'A_REKHA_HOME', whatsappOptIn: true,
  },
  {
    id: 'new', name: 'Kavita Patel', blurb: 'First-time buyer · no saved address',
    phone: '+91 90XXX 55120', language: 'en', deliveredOrders: 0, pastRefusalReasons: [], whatsappOptIn: true,
  },
];

const SEED_AT = dayjs().subtract(20, 'day').format('YYYY-MM-DDTHH:mm:ss');

// Home: two past drops ~12 m apart → learned point (their midpoint) → L3.
const HOME_DROPS = [
  { lat: 27.39925, lng: 80.13335, at: dayjs().subtract(41, 'day').format('YYYY-MM-DDTHH:mm:ss') },
  { lat: 27.39915, lng: 80.13345, at: dayjs().subtract(18, 'day').format('YYYY-MM-DDTHH:mm:ss') },
];
const SHOP_PIN = { lat: 27.4352, lng: 80.1655 };

export const ADDRESSES: Address[] = [
  {
    id: 'A_REKHA_HOME', customerId: 'existing', label: 'Home', name: 'Rekha Yadav', phone: '+91 98XXX 41210',
    line1: 'H.No. 12, Yadav Bhawan', area: 'Station Road',
    directions: 'Near old cinema hall, opposite ration shop',
    pincode: '241001', city: 'Hardoi', state: 'Uttar Pradesh', hubId: 'HUB_HARDOI',
    geoCell: { lat: 27.4023, lng: 80.1336, confidence: 0.55 }, // GeoIndia guess ~350 m off
    learned: { lat: 27.3992, lng: 80.1334, drops: HOME_DROPS, riderNote: 'Green door, next to the ration shop' },
    confidence: 'L3',
    truePoint: { lat: 27.3992, lng: 80.1334 },
  },
  {
    id: 'A_REKHA_SHOP', customerId: 'existing', label: 'Shop', name: 'Rekha Yadav', phone: '+91 98XXX 41210',
    line1: 'Yadav General Store', area: 'Shiv Nagar',
    directions: 'Shiv mandir gali, second shop on the left',
    pincode: '241121', city: 'Hardoi', state: 'Uttar Pradesh', hubId: 'HUB_HARDOI',
    geoCell: { lat: 27.4349, lng: 80.1650, confidence: 0.7 },
    pin: { ...SHOP_PIN, digipin: encodeDigipin(SHOP_PIN.lat, SHOP_PIN.lng), source: 'gps', at: SEED_AT },
    confidence: 'L2',
    truePoint: SHOP_PIN, // ~5.8 km from the hub → far-zone run
  },
  {
    id: 'A_REKHA_HOSTEL', customerId: 'existing', label: 'Other', name: 'Arjun Yadav (son)', phone: '+91 88XXX 30917',
    line1: 'Room 214, Boys Hostel Block B', area: 'Kothrud',
    directions: 'Opposite MIT gate 2',
    pincode: '411038', city: 'Pune', state: 'Maharashtra', hubId: 'HUB_PUNE',
    geoCell: { lat: 18.5098, lng: 73.8052, confidence: 0.8 },
    confidence: 'L1',
    truePoint: { lat: 18.5102, lng: 73.8049 },
  },
];

export const SLOT_WINDOWS: { label: Exclude<SlotLabel, 'Any time'>; start: string; end: string }[] = [
  { label: 'Morning 9-12', start: '09:00', end: '12:00' },
  { label: 'Afternoon 12-4', start: '12:00', end: '16:00' },
  { label: 'Evening 4-8', start: '16:00', end: '20:00' },
];

/** Drops per window across the hub: per-rider capacity × riders (Hardoi 27, Pune 36). */
export function hubWindowCapacity(hubId: string): number {
  const hub = HUBS.find((h) => h.id === hubId)!;
  return hub.capacityPerWindow * RIDERS.filter((r) => r.hubId === hubId).length;
}

// Pre-filled "Full" windows: every 3rd calendar day, Hardoi's Evening and Pune's Morning window are full.
// Any 4 consecutive dates (the picker's range) therefore always show at least one Full window.
const FULL_WINDOW: Record<string, number> = { HUB_HARDOI: 2, HUB_PUNE: 0 };

/**
 * Deterministic starting bookings for a hub window, keyed by the *calendar date* (not "days from today"),
 * so a window that was Full when the customer ordered is still Full when they reschedule days later.
 */
export function seedConfirmed(hubId: string, date: string, windowIdx: number): number {
  const hub = HUBS.find((h) => h.id === hubId)!;
  const capacity = hubWindowCapacity(hubId);
  const effective = Math.floor(capacity * (1 - hub.bufferPct / 100));
  const day = dayjs(date).diff(dayjs('2026-01-01'), 'day');
  if (windowIdx === FULL_WINDOW[hubId] && day % 3 === 0) return effective;
  const fill = 0.35 + ((day * 7 + windowIdx * 11) % 30) / 100;
  return Math.min(Math.round(capacity * fill), effective - 1);
}

export function makeSlotInventory(start = dayjs().format('YYYY-MM-DD'), days = 5): SlotInventory[] {
  const rows: SlotInventory[] = [];
  for (const hub of HUBS) {
    for (let d = 1; d <= days; d++) {
      const date = dayjs(start).add(d, 'day').format('YYYY-MM-DD');
      SLOT_WINDOWS.forEach((w, i) => {
        rows.push({ hubId: hub.id, date, window: w.label, capacity: hubWindowCapacity(hub.id), reserved: 0, confirmed: seedConfirmed(hub.id, date, i) });
      });
    }
  }
  return rows;
}

/** 4 past delivered orders for the existing user (one is the lowest listing of the bedsheet cluster). */
export function makePastOrders(): Order[] {
  const past = (id: string, productId: string, addressId: string, daysAgo: number): Order => {
    const product = PRODUCTS.find((p) => p.id === productId)!;
    const placed = dayjs().subtract(daysAgo, 'day').hour(11).minute(20).second(0);
    const at = (d: number, h: number) => placed.add(d, 'day').hour(h).format('YYYY-MM-DDTHH:mm:ss');
    const promisedDate = placed.add(3, 'day').format('YYYY-MM-DD');
    return {
      id, customerId: 'existing',
      items: [{ productId, qty: 1, price: product.price }],
      total: product.price, payment: 'COD', addressId, hubId: 'HUB_HARDOI', promisedDate,
      slot: { date: promisedDate, window: 'Any time' },
      openBox: false, status: 'DELIVERED', homeCheck: 'yes',
      rescue: {
        pRto: 0.12, reasons: { availability: 0.05, timing: 0.03, address: 0.02, trust: 0.01, price: 0.01 },
        topReason: 'availability', band: 'low', holdout: false, modelVersion: 'rescue-v0-rules',
      },
      attempts: [],
      timeline: [
        { at: placed.format('YYYY-MM-DDTHH:mm:ss'), status: 'PLACED', note: 'Order placed' },
        { at: at(2, 8), status: 'AT_HUB', note: 'Reached Hardoi LMDC' },
        { at: at(2, 9), status: 'ACCEPTED', note: 'Accepted at hub' },
        { at: at(3, 10), status: 'OUT_FOR_DELIVERY', note: 'Out for delivery' },
        { at: at(3, 15), status: 'DELIVERED', note: 'Delivered' },
      ],
      createdAt: placed.format('YYYY-MM-DDTHH:mm:ss'),
      rescheduleCount: 0,
    };
  };
  return [
    past('418273645', 'P20', 'A_REKHA_HOME', 9),
    past('411902733', 'P14', 'A_REKHA_HOME', 18), // bedsheet cluster — bought the lowest listing
    past('406551208', 'P11', 'A_REKHA_SHOP', 27),
    past('402918374', 'P23', 'A_REKHA_HOME', 41),
  ];
}

// ---------------------------------------------------------------- background parcels (other shoppers)
// Each hub already holds the day's parcels from other customers, so route planning has real work to do:
// Hardoi has a far-zone cluster (241121, > 5 km) and enough COD cash to hit a rider's ₹15,000 limit.

type BgSpec = {
  id: string; name: string; hub: 'HUB_HARDOI' | 'HUB_PUNE'; pincode: string; area: string;
  at: [number, number]; confidence: Address['confidence']; delivered: number; refusals?: string[];
  items: [string, number][]; payment: 'COD' | 'UPI'; window: SlotLabel; home: Order['homeCheck'];
  failed?: number; // earlier failed delivery attempts (Refusals & RTO demo)
};

const BG: BgSpec[] = [
  // Hardoi — near (241001)
  { id: '701', name: 'Suman Verma', hub: 'HUB_HARDOI', pincode: '241001', area: 'Civil Lines', at: [27.4012, 80.1302], confidence: 'L3', delivered: 9, items: [['P19', 4]], payment: 'COD', window: 'Morning 9-12', home: 'yes' },
  { id: '702', name: 'Rajesh Gupta', hub: 'HUB_HARDOI', pincode: '241001', area: 'Nai Basti', at: [27.3902, 80.1318], confidence: 'L1', delivered: 2, items: [['P19', 4]], payment: 'COD', window: 'Morning 9-12', home: 'awaiting' },
  { id: '703', name: 'Anita Singh', hub: 'HUB_HARDOI', pincode: '241001', area: 'Sandi Road', at: [27.3871, 80.1189], confidence: 'L2', delivered: 5, items: [['P19', 3]], payment: 'COD', window: 'Morning 9-12', home: 'yes' },
  { id: '704', name: 'Mohd. Salim', hub: 'HUB_HARDOI', pincode: '241001', area: 'Kotwali Chowk', at: [27.3985, 80.1245], confidence: 'L1', delivered: 1, refusals: ['wrong_item'], items: [['P19', 4]], payment: 'COD', window: 'Afternoon 12-4', home: 'no_reply' },
  { id: '705', name: 'Pooja Mishra', hub: 'HUB_HARDOI', pincode: '241001', area: 'Ashok Nagar', at: [27.4065, 80.1172], confidence: 'L3', delivered: 14, items: [['P19', 5]], payment: 'COD', window: 'Afternoon 12-4', home: 'yes' },
  { id: '706', name: 'Ravi Kumar', hub: 'HUB_HARDOI', pincode: '241001', area: 'Bilgram Chungi', at: [27.3934, 80.1402], confidence: 'L0', delivered: 0, items: [['P19', 3]], payment: 'COD', window: 'Afternoon 12-4', home: 'awaiting' },
  { id: '707', name: 'Geeta Devi', hub: 'HUB_HARDOI', pincode: '241001', area: 'Railganj', at: [27.3842, 80.1291], confidence: 'L2', delivered: 7, items: [['P19', 4]], payment: 'COD', window: 'Evening 4-8', home: 'yes' },
  { id: '708', name: 'Arvind Tiwari', hub: 'HUB_HARDOI', pincode: '241001', area: 'Kachehri Road', at: [27.4101, 80.1265], confidence: 'L1', delivered: 3, items: [['P19', 4]], payment: 'COD', window: 'Evening 4-8', home: 'yes' },
  { id: '709', name: 'Neha Shukla', hub: 'HUB_HARDOI', pincode: '241001', area: 'Lakhnau Chungi', at: [27.3890, 80.1102], confidence: 'L3', delivered: 11, items: [['P19', 3]], payment: 'COD', window: 'Any time', home: 'yes' },
  { id: '710', name: 'Kamlesh Pal', hub: 'HUB_HARDOI', pincode: '241001', area: 'Gandhi Bhawan', at: [27.4032, 80.1388], confidence: 'L2', delivered: 6, items: [['P13', 1]], payment: 'UPI', window: 'Any time', home: 'awaiting' },
  // Hardoi — far zone (241121, ~6 km)
  { id: '711', name: 'Shabana Bano', hub: 'HUB_HARDOI', pincode: '241121', area: 'Shahabad Road', at: [27.4381, 80.1702], confidence: 'L1', delivered: 4, items: [['P05', 1]], payment: 'COD', window: 'Morning 9-12', home: 'yes' },
  { id: '712', name: 'Vijay Yadav', hub: 'HUB_HARDOI', pincode: '241121', area: 'Mallawan Road', at: [27.4412, 80.1598], confidence: 'L2', delivered: 8, items: [['P15', 1]], payment: 'COD', window: 'Afternoon 12-4', home: 'no_reply' },
  // Hardoi — repeated failures, for Refusals & RTO
  { id: '713', name: 'Ramesh Chandra', hub: 'HUB_HARDOI', pincode: '241001', area: 'Pihani Chungi', at: [27.4078, 80.1339], confidence: 'L0', delivered: 1, refusals: ['not_available'], items: [['P10', 1]], payment: 'COD', window: 'Any time', home: 'no_reply', failed: 3 },
  { id: '714', name: 'Sarita Maurya', hub: 'HUB_HARDOI', pincode: '241001', area: 'Mohalla Sarai', at: [27.3918, 80.1236], confidence: 'L1', delivered: 2, items: [['P18', 1]], payment: 'COD', window: 'Evening 4-8', home: 'no_reply', failed: 2 },
  // Pune
  { id: '721', name: 'Sneha Kulkarni', hub: 'HUB_PUNE', pincode: '411038', area: 'Paud Road', at: [18.5061, 73.8021], confidence: 'L3', delivered: 22, items: [['P07', 1]], payment: 'UPI', window: 'Morning 9-12', home: 'yes' },
  { id: '722', name: 'Amit Deshmukh', hub: 'HUB_PUNE', pincode: '411038', area: 'Karishma Society', at: [18.5019, 73.8154], confidence: 'L2', delivered: 6, items: [['P16', 1]], payment: 'COD', window: 'Morning 9-12', home: 'yes' },
  { id: '723', name: 'Priya Joshi', hub: 'HUB_PUNE', pincode: '411038', area: 'Mayur Colony', at: [18.5122, 73.8110], confidence: 'L1', delivered: 1, items: [['P09', 1]], payment: 'COD', window: 'Afternoon 12-4', home: 'awaiting' },
  { id: '724', name: 'Rahul Patil', hub: 'HUB_PUNE', pincode: '411029', area: 'Karve Nagar', at: [18.4921, 73.8198], confidence: 'L3', delivered: 15, items: [['P20', 1]], payment: 'UPI', window: 'Afternoon 12-4', home: 'yes' },
  { id: '725', name: 'Meera Iyer', hub: 'HUB_PUNE', pincode: '411029', area: 'Hingne', at: [18.4889, 73.8245], confidence: 'L2', delivered: 9, items: [['P17', 2]], payment: 'UPI', window: 'Evening 4-8', home: 'yes' },
  { id: '726', name: 'Tanvi Shah', hub: 'HUB_PUNE', pincode: '411038', area: 'Bhusari Colony', at: [18.5153, 73.7962], confidence: 'L0', delivered: 0, items: [['P12', 1]], payment: 'COD', window: 'Evening 4-8', home: 'no_reply' },
  { id: '727', name: 'Omkar Jadhav', hub: 'HUB_PUNE', pincode: '411029', area: 'Warje', at: [18.4852, 73.8110], confidence: 'L1', delivered: 3, items: [['P21', 1]], payment: 'COD', window: 'Any time', home: 'yes' },
];

/** Only these shoppers have a parcel at the hub (keeps the Hub screens short). The rest still exist as nearby shoppers for the Redirect Loop. */
const WITH_PARCEL = new Set(['701', '705', '713', '721', '724']);

export function makeBackground(): { customers: Customer[]; addresses: Address[]; orders: Order[] } {
  const customers: Customer[] = [];
  const addresses: Address[] = [];
  const orders: Order[] = [];
  const iso = (d: dayjs.Dayjs) => d.format('YYYY-MM-DDTHH:mm:ss');
  // Background parcels are due on each hub's promised day, the same day a demo order placed now lands on.
  const dueDate = (hub: string) => dayjs().add(hub === 'HUB_PUNE' ? 2 : 3, 'day').format('YYYY-MM-DD');

  for (const b of BG) {
    const custId = `bg_${b.id}`;
    const addrId = `A_BG_${b.id}`;
    const point = { lat: b.at[0], lng: b.at[1] };
    const pc = PINCODES[b.pincode];
    const customer: Customer = {
      id: custId, name: b.name, blurb: 'Background shopper', background: true, phone: '+91 9XXXX XXXXX', language: 'hi',
      deliveredOrders: b.delivered, pastRefusalReasons: b.refusals ?? [], whatsappOptIn: Number(b.id) % 2 === 1,
    };
    const address: Address = {
      id: addrId, customerId: custId, label: 'Home', name: b.name, phone: '+91 9XXXX XXXXX',
      line1: `House ${(Number(b.id) % 50) + 3}`, area: b.area, directions: '', pincode: b.pincode,
      city: pc.city, state: pc.state, hubId: b.hub,
      geoCell: { lat: point.lat + 0.0015, lng: point.lng - 0.001, confidence: 0.6 },
      pin: b.confidence === 'L2' ? { ...point, digipin: encodeDigipin(point.lat, point.lng), source: 'gps', at: SEED_AT } : undefined,
      learned: b.confidence === 'L3' ? { ...point, drops: [{ ...point, at: SEED_AT }, { ...point, at: SEED_AT }] } : undefined,
      confidence: b.confidence, truePoint: point,
    };
    const items = b.items.map(([productId, qty]) => ({ productId, qty, price: PRODUCTS.find((p) => p.id === productId)!.price }));
    const placed = dayjs().subtract(3, 'day').hour(10).minute(0).second(0);
    const base = {
      id: `7${b.id}${b.id}`.slice(0, 9).padEnd(9, '0'), customerId: custId, items,
      total: items.reduce((a, i) => a + i.price * i.qty, 0) - (b.payment === 'UPI' ? 15 : 0),
      payment: b.payment, addressId: addrId, hubId: b.hub, promisedDate: dueDate(b.hub),
      slot: { date: dueDate(b.hub), window: b.window }, openBox: false,
      status: (b.failed ? 'ATTEMPT_FAILED' : 'ACCEPTED') as Order['status'], homeCheck: b.home,
      attempts: Array.from({ length: b.failed ?? 0 }, (_, i) => ({
        at: iso(dayjs().subtract((b.failed ?? 0) - i, 'day').hour(17).minute(10).second(0)), riderId: 'R_IMRAN', arrived: true,
        callsMade: 2, doorMessageSent: true, result: 'failed' as const, reason: i % 2 ? 'Address not found' : 'Customer not reachable',
      })),
      timeline: [
        { at: iso(placed), status: 'PLACED' as const, note: 'Order placed' },
        { at: iso(dayjs().hour(7).minute(40).second(0)), status: 'AT_HUB' as const, note: 'Reached hub' },
        { at: iso(dayjs().hour(8).minute(5).second(0)), status: 'ACCEPTED' as const, note: 'Accepted at hub' },
      ],
      createdAt: iso(placed), rescheduleCount: 0, deliveryOtp: String(1000 + ((Number(b.id) * 7919) % 9000)),
    };
    const rescue = scoreOrder({ order: base, customer, address, hub: HUBS.find((h) => h.id === b.hub), products: PRODUCTS, festiveMode: false });
    customers.push(customer);
    addresses.push(address);
    if (WITH_PARCEL.has(b.id)) orders.push({ ...base, rescue });
  }
  return { customers, addresses, orders };
}
