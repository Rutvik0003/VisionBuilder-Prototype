// Data models — Combined PRD v3 §6. Extra UI-only fields are noted in ASSUMPTIONS.md.

export type Tier = 'metro' | 'tier2' | 'tier3';
export type Payment = 'COD' | 'UPI';
export type Confidence = 'L0' | 'L1' | 'L2' | 'L3'; // pincode | GeoIndia cell | customer pin | verified by ≥2 deliveries
export type AccountId = 'existing' | 'new';
export type Lang = 'en' | 'hi';
export type LatLng = { lat: number; lng: number };
export type Actor = 'customer' | 'transit' | 'hub' | 'rider' | 'ops' | 'system';

export interface Product {
  id: string;
  title: string;
  category: 'fashion' | 'home' | 'kitchen' | 'beauty';
  image: string; // emoji fallback tile
  photo: string; // /products/<slug>.jpg — falls back to the emoji tile if missing
  tint: string;
  description: string;
  clusterId: string; // identical-product group (C3-F1)
  price: number;
  mrp: number;
  sellerId: string;
  sellerName: string;
  rating: number;
  ratingCount: number;
  openBoxCategory: boolean;
}

export interface Customer {
  id: string; // 'existing' | 'new' for the two demo accounts; bg_* for background customers at the hubs
  background?: boolean; // other shoppers whose parcels fill the hub (not selectable in the Launcher)
  name: string;
  blurb: string;
  phone: string;
  language: Lang;
  deliveredOrders: number;
  pastRefusalReasons: string[];
  defaultAddressId?: string;
  childLock?: ChildLock; // PIN required before placing an order
  whatsappOptIn?: boolean; // R1.10: WhatsApp nudges only for opted-in shoppers
  redirectNudgedAt?: string; // R1.10: max 1 redirect nudge per buyer per week
}

/** Child lock (Account → Settings). The PIN is only stored hashed. */
export interface ChildLock {
  pinHash: string;
  failed: number; // wrong PINs since the last success / lockout
  lockedUntil?: number; // epoch ms; ordering blocked until then
  otp?: { code: string; expiresAt: number }; // forgot-PIN reset code sent to the registered phone
}

export type AddressLabel = 'Home' | 'Shop' | 'Other';

export interface Address {
  id: string;
  customerId: string;
  label: AddressLabel;
  name: string;
  phone: string;
  line1: string;
  area: string;
  directions: string; // landmark / directions for the rider
  pincode: string;
  city: string;
  state: string;
  hubId: string | null; // null = not served by a pilot hub
  geoCell: { lat: number; lng: number; confidence: number }; // GeoIndia guess 0-1
  pin?: { lat: number; lng: number; digipin: string; source: 'gps' | 'drag' | 'remote'; at: string };
  learned?: { lat: number; lng: number; drops: { lat: number; lng: number; at: string }[]; riderNote?: string };
  confidence: Confidence;
  truePoint: LatLng; // where the door really is — simulated GPS and rider arrival use this
  deleted?: boolean; // soft delete: hidden from the customer, kept for past orders
}

export type SlotLabel = 'Morning 9-12' | 'Afternoon 12-4' | 'Evening 4-8' | 'Any time';

export interface SlotInventory {
  hubId: string;
  date: string; // YYYY-MM-DD
  window: Exclude<SlotLabel, 'Any time'>;
  capacity: number;
  reserved: number;
  confirmed: number;
}

export type OrderStatus =
  | 'PLACED'            // customer placed; with seller
  | 'SHIPPED'           // seller shipped / picked up (first mile)
  | 'IN_TRANSIT'        // line-haul to the last-mile hub
  | 'DELAYED_IN_TRANSIT'// transit delay reported (C1-F5)
  | 'AT_HUB'            // fulfilment complete; waiting for hub manager to accept
  | 'ACCEPTED'          // hub accepted; still-home ping sent (C1-F2)
  | 'HELD'              // customer asked for another day/time
  | 'PLANNED'           // assigned to a rider route (C3-F3)
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVING_SOON'     // ≤ 2 stops away (C1-F3)
  | 'DELIVERED'
  | 'ATTEMPT_FAILED'
  | 'REFUSED_AFTER_INSPECTION'
  | 'CANCELLED'
  | 'RTO';

export type HomeCheck = 'not_sent' | 'awaiting' | 'yes' | 'change_requested' | 'no_reply';

export type RescueReason = 'availability' | 'timing' | 'address' | 'trust' | 'price';

export interface RescueScore {
  pRto: number;
  reasons: Record<RescueReason, number>;
  topReason: RescueReason;
  band: 'low' | 'medium' | 'high';
  holdout: boolean;
  modelVersion: 'rescue-v0-rules';
}

export interface Attempt {
  at: string;
  riderId: string;
  arrived: boolean;
  callsMade: number;
  doorMessageSent: boolean;
  result: 'delivered' | 'failed' | 'refused_after_inspection';
  reason?: string;
  disputed?: boolean;
  dispute?: 'open' | 'valid' | 'invalid'; // C2-F4 "no one came" resolution
}

export interface Order {
  id: string;
  customerId: string;
  items: { productId: string; qty: number; price: number; size?: string }[];
  total: number;
  payment: Payment;
  addressId: string;
  hubId: string | null;
  promisedDate: string;
  slot: { date: string; window: SlotLabel };
  deliverOnOrAfter?: string; // COD cash day (C1-F1)
  needBy?: string; // occasion date (C1-F1/F5)
  openBox: boolean; // C2-F3, fixed at checkout
  status: OrderStatus;
  homeCheck: HomeCheck;
  rescue: RescueScore;
  route?: { riderId: string; seq: number; date: string; run: RunId };
  visit?: Visit; // current stop visit (rider app, C2-F4)
  chat?: { from: 'customer' | 'rider'; text: string; at: string }[]; // C1-F4 masked messages
  arrivingNotified?: boolean; // C1-F3 "about 10 minutes away" sent once
  attempts: Attempt[];
  sealId?: string;
  inspection?: Inspection; // C2-F3 open-box at the door
  refusal?: Refusal; // C2-F3 refused after inspection
  rto?: { at: string; reason: string }; // returned to origin
  replacementFor?: string; // this order replaces one refused at the door (C2-F3)
  redirectOf?: string; // R1: this order buys a parcel refused nearby
  ivr?: 'ringing' | 'confirmed' | 'cancelled' | 'missed'; // order-confirmation IVR call after placing
  delay?: { oldDate: string; newDate: string; source: 'transit' | 'peak'; cause?: 'missed_dispatch' | 'transit'; prevStatus?: OrderStatus };
  confirm?: OrderConfirm; // P1 IVR order confirmation (risk-flagged COD orders)
  deliveryOtp?: string; // 4-digit OTP the customer reads out at the door
  pingPriority?: boolean; // never reached on confirmation → flagged for the still-home ping
  timeline: { at: string; status: OrderStatus; note: string }[];
  // prototype bookkeeping
  createdAt: string;
  rescheduleCount: number;
}

/** Delivery runs of a day; each is planned, locked and published separately. */
export type RunId = 'Morning' | 'Afternoon' | 'Evening';

/** P1: risk-flagged COD orders must be confirmed (WhatsApp → call → second call) before the seller ships. */
export interface OrderConfirm {
  risk: 'medium' | 'high';
  reasons: string[];
  state: 'awaiting' | 'confirmed' | 'cancelled' | 'never_reached' | 'released';
  calls: number; // calls placed so far (max 2)
  queued?: boolean; // call queued for 9 am (quiet hours)
}

/** C2-F3 open-box inspection at the door. The timer is UI-only; startedAt lets it survive navigation. */
export interface Inspection {
  sealPhotoAt?: string;
  startedAt?: string;
  checklist: Record<string, boolean>;
  outcome?: 'accepted' | 'refused' | 'aborted';
}

export interface Refusal {
  at: string;
  reason: string;
  damaged: boolean;
  itemPhotoAt: string;
  sealId: string; // TB-XXXXXX tamper bag
  redirectEligible: boolean; // Changed mind + no damage → can go to the next buyer instead of back to the seller
  disposition?: 'return_to_seller' | 'redirect';
  customerChoice?: 'replacement' | 'closed'; // what the customer chose after refusing
  redirect?: Redirect; // R1 Redirect Loop
  replacementOrderId?: string;
}

/** R1 Redirect Loop: a refused, resealed parcel resold to a nearby shopper instead of travelling back to the seller. */
export interface Redirect {
  state: 'qc' | 'shelf' | 'sold' | 'returned';
  qc?: { rightItem: boolean; undamaged: boolean; sealIntact: boolean; passed: boolean };
  demand?: { score: 'High' | 'Medium' | 'Low'; inputs: { cartsWishlists: number; searches7d: number; sales30to90d: number; season: string } };
  holdDays?: number; // learned per category (0 = return at once)
  holdUntil?: string;
  nudged: { top: string[]; next: string[] }; // customer ids (top 5, then next 5)
  buyerId?: string;
  newOrderId?: string;
  price?: number;
  returnReason?: string;
}

/** What happened at the door on the current attempt (C2-F4 verified attempt). */
export interface Visit {
  arrived: boolean;
  callsMade: number;
  doorMessageSent: boolean;
  skipRequested?: boolean; // customer tapped "I'm not home"
  outcome?: 'delivered' | 'failed' | 'skipped' | 'refused';
}

export interface Rider {
  id: string;
  name: string;
  hubId: string;
  vehicle: 'bike';
  cashLimit: number;
  earningsToday: number;
  routeOrderIds: string[];
  currentIndex: number; // index of the stop the rider is heading to
  started: boolean;
  progressAt?: string; // last time the rider started a run or finished a stop (drives the simulated position)
}

export interface Hub {
  id: string;
  name: string;
  tier: Tier;
  lat: number;
  lng: number;
  pincodes: string[];
  capacityPerWindow: number; // per rider
  bufferPct: number;
}

export type Channel = 'whatsapp' | 'push' | 'voice';

export interface Message {
  id: string;
  customerId: string;
  orderId?: string;
  channel: Channel;
  featureId: string;
  text: string;
  buttons: { label: string; action: string }[];
  link?: { label: string; href: string };
  answered?: string;
  read: boolean;
  at: string;
}

export interface EventLog {
  id: string;
  at: string;
  featureId: string;
  name: string;
  actor: Actor;
  orderId?: string;
  payload: Record<string, unknown>;
}

export interface ForecastDay {
  hubId: string;
  date: string;
  demandP50: number;
  demandP90: number;
  capacity: number;
  bottleneck: number;
}

export interface CartItem {
  productId: string;
  qty: number;
  size?: string;
}

export type CheckoutStep = 'address' | 'delivery' | 'payment' | 'review';

export interface CheckoutDraft {
  customerId: AccountId;
  items: CartItem[];
  source: 'cart' | 'buynow';
  step: CheckoutStep;
  addressId?: string;
  payment?: Payment;
  slot?: { date: string; window: SlotLabel }; // C1-F1
  holdId?: string; // active 10-minute slot hold
  needBy?: string; // "Need it by a date?"
  deliverOnOrAfter?: string; // COD cash day
  openBox?: boolean; // customer opted in to open-box delivery (C2-F3)
}

/** A 10-minute checkout hold on one slot window (counts against capacity until it expires or confirms). */
export interface SlotHold {
  id: string;
  hubId: string;
  date: string;
  window: Exclude<SlotLabel, 'Any time'>;
  expiresAt: number; // epoch ms
}

/** C3-F3 route plan for one hub (draft until published). */
export interface RouteLane {
  riderId: string;
  orderIds: string[]; // in stop order
  km: number;
  expectedDrops: number; // Σ(1 − pRto)
  codTotal: number;
  minutes?: number; // ETA for the whole lane (P3.5)
  farZone: boolean;
}

export interface RoutePlan {
  hubId: string;
  date: string;
  run: RunId;
  carryOver: string[]; // order ids carried from an earlier run / day (assigned first)
  createdAt: string;
  lanes: RouteLane[];
  unassigned: { orderId: string; reason: 'over_capacity' | 'cash_limit' }[];
  overrides: { orderId: string; from: string; to: string; reason: string }[];
}
