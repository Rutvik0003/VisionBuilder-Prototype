import { useStore } from '../store';
import type { AccountId, CartItem, CheckoutDraft } from '../types';
import { releaseHold } from './slots';

export function addToCart(customerId: AccountId, productId: string, size?: string) {
  const s = useStore.getState();
  s.patch((st) => {
    const list = st.cart[customerId] ?? [];
    const existing = list.find((i) => i.productId === productId);
    const next = existing
      ? list.map((i) => (i.productId === productId ? { ...i, qty: Math.min(i.qty + 1, 5), size: size ?? i.size } : i))
      : [...list, { productId, qty: 1, size }];
    return { cart: { ...st.cart, [customerId]: next } };
  });
  s.log('CORE', 'add_to_cart', 'customer', { productId });
}

export function setCartQty(customerId: AccountId, productId: string, qty: number) {
  useStore.getState().patch((st) => ({
    cart: {
      ...st.cart,
      [customerId]: (st.cart[customerId] ?? [])
        .map((i) => (i.productId === productId ? { ...i, qty } : i))
        .filter((i) => i.qty > 0),
    },
  }));
}

export function startCheckout(customerId: AccountId, items: CartItem[], source: CheckoutDraft['source'], addressId?: string) {
  const s = useStore.getState();
  releaseHold(s.checkout?.holdId); // an abandoned checkout's slot hold goes back to the pool
  s.patch(() => ({ checkout: { customerId, items, source, step: 'address', addressId } }));
  s.log('CORE', 'checkout_started', 'customer', { source, items: items.length });
}

export function updateCheckout(patch: Partial<CheckoutDraft>) {
  useStore.getState().patch((st) => ({ checkout: st.checkout ? { ...st.checkout, ...patch } : null }));
}
