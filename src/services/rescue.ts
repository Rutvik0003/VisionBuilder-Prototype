// C3-F2 Rescue engine, rule-based v0 (PRD v3 §10.3). Pure: no store access, so the seed can use it too.
// Hub-only: customers never see any of this.
import type { Address, Customer, Hub, Order, Product, RescueReason, RescueScore } from '../types';

const CONFIDENCE_RISK: Record<Address['confidence'], number> = { L0: 0.25, L1: 0.15, L2: 0.04, L3: 0.02 };

export interface RescueInput {
  order: Pick<Order, 'id' | 'payment' | 'slot' | 'needBy' | 'deliverOnOrAfter' | 'homeCheck' | 'items'>;
  customer: Pick<Customer, 'deliveredOrders' | 'pastRefusalReasons'>;
  address: Pick<Address, 'confidence'>;
  hub?: Pick<Hub, 'tier'>;
  products: Product[];
  festiveMode: boolean;
}

/** Stable 0–99 bucket from the order id → 10% holdout (scored and logged, no targeted action). */
export function holdoutBucket(orderId: string): number {
  let h = 0;
  for (const ch of orderId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100;
}

export function scoreOrder({ order, customer, address, hub, products, festiveMode }: RescueInput): RescueScore {
  const cod = order.payment === 'COD' ? 1 : 0;
  const has = (r: string) => customer.pastRefusalReasons.includes(r);

  // "bought listing not lowest in its cluster"
  const notLowest = order.items.some((it) => {
    const p = products.find((x) => x.id === it.productId);
    if (!p) return false;
    const cluster = products.filter((x) => x.clusterId === p.clusterId);
    return cluster.length > 1 && p.price > Math.min(...cluster.map((x) => x.price));
  });

  const reasons: Record<RescueReason, number> = {
    availability: 0.10 + 0.12 * cod + 0.10 * +(order.slot.window === 'Any time') + 0.08 * +(hub?.tier !== 'metro')
      + 0.10 * +has('not_available') - 0.10 * +(order.homeCheck === 'yes'),
    timing: 0.05 + 0.10 * +!!order.needBy + 0.08 * +festiveMode + 0.06 * +(cod === 1 && !order.deliverOnOrAfter),
    address: 0.05 + CONFIDENCE_RISK[address.confidence],
    trust: 0.03 + 0.12 * +(cod === 1 && customer.deliveredOrders < 3) + 0.08 * +(has('wrong_item') || has('not_as_shown')),
    price: 0.02 + 0.10 * +notLowest,
  };
  for (const k of Object.keys(reasons) as RescueReason[]) reasons[k] = Math.round(Math.max(0, reasons[k]) * 1000) / 1000;

  const pRto = Math.min(0.85, 1 - (Object.values(reasons) as number[]).reduce((p, r) => p * (1 - r), 1));
  const topReason = (Object.keys(reasons) as RescueReason[]).reduce((a, b) => (reasons[b] > reasons[a] ? b : a));
  const band = pRto < 0.2 ? 'low' : pRto < 0.35 ? 'medium' : 'high';

  return {
    pRto: Math.round(pRto * 1000) / 1000, reasons, topReason, band,
    holdout: holdoutBucket(order.id) < 10, modelVersion: 'rescue-v0-rules',
  };
}

export type RescueAction = 'none' | 'still_home_check' | 'slot_suggest' | 'pin_request' | 'open_box' | 'price_reassure';

/** Policy by top reason (band ≥ medium, not holdout). Never cancels an order or removes COD. */
export function rescueAction(score: RescueScore, openBox: boolean): RescueAction {
  if (score.holdout || score.band === 'low') return 'none';
  switch (score.topReason) {
    case 'availability': return 'still_home_check';
    case 'timing': return 'slot_suggest';
    case 'address': return 'pin_request';
    case 'trust': return openBox ? 'open_box' : 'still_home_check';
    case 'price': return 'price_reassure';
  }
}

export const REASON_LABEL: Record<RescueReason, string> = {
  availability: 'Availability', timing: 'Timing', address: 'Address', trust: 'Trust', price: 'Price',
};

export const ACTION_LABEL: Record<RescueAction, string> = {
  none: '—', still_home_check: 'Home check', slot_suggest: 'Suggest slot', pin_request: 'Ask for pin',
  open_box: 'Open-box', price_reassure: 'Price reassurance',
};
