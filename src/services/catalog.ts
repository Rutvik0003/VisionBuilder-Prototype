// C3-F1 identical-product clusters + C2-F3 open-box eligibility (pure helpers over the store).
import type { Address, Customer, Order, Product } from '../types';

const CLOSED: Order['status'][] = ['DELIVERED', 'CANCELLED', 'RTO', 'REFUSED_AFTER_INSPECTION'];

export interface ClusterInfo {
  listings: Product[]; // cheapest first
  min: number;
  sellers: number;
  multi: boolean; // more than one seller lists this identical item
  isLowest: boolean; // this listing is (joint) cheapest in a multi-seller cluster
}

export function clusterInfo(product: Product, products: Product[]): ClusterInfo {
  const listings = products.filter((p) => p.clusterId === product.clusterId).sort((a, b) => a.price - b.price);
  const min = listings[0].price;
  const multi = listings.length > 1;
  return { listings, min, sellers: listings.length, multi, isLowest: multi && product.price === min };
}

/** Clusters the customer has an undelivered order for — the feed hides them (post-order suppression). */
export function suppressedClusters(customerId: string, orders: Order[], products: Product[]): Set<string> {
  const ids = new Set<string>();
  for (const o of orders) {
    if (o.customerId !== customerId || CLOSED.includes(o.status)) continue;
    for (const it of o.items) {
      const p = products.find((x) => x.id === it.productId);
      if (p) ids.add(p.clusterId);
    }
  }
  return ids;
}

/**
 * C2-F3: open-box is shown to every customer whenever the category allows it (team decision; v3 limited it
 * to new users / past wrong-item refusals). It's independent of having an address: it's only hidden once the
 * chosen address is known to be outside the pilot hubs. COD is required at checkout.
 */
export function openBoxEligible(product: Product, _customer: Customer, address: Address | undefined): boolean {
  return product.openBoxCategory && (!address || !!address.hubId);
}
