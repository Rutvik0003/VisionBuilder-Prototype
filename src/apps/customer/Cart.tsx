import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCurrentCustomer, useStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { rupees } from '../../lib/format';
import { setCartQty, startCheckout } from '../../services/cart';
import { lineItems, priceSummary } from '../../services/orders';
import { EmptyState, PageHeader, ProductImage, Screen } from './ui';
import { PriceDetails } from './PriceDetails';

export function Cart() {
  const customer = useCurrentCustomer();
  const items = useStore(useShallow((s) => s.cart[customer.id] ?? []));
  useStore((s) => s.products); // re-render if catalogue changes
  const nav = useNavigate();
  const lines = lineItems(items);
  const summary = priceSummary(items);

  if (lines.length === 0) {
    return (
      <Screen header={<PageHeader title="Cart" />}>
        <EmptyState icon={<ShoppingCart />} title="Your cart is empty" sub="Just relax, let us help you find some first-class products"
          action={<Link to="/customer" className="btn-primary">Start Shopping</Link>} />
      </Screen>
    );
  }

  return (
    <Screen
      header={<PageHeader title="Cart" sub={`${lines.length} item${lines.length > 1 ? 's' : ''}`} />}
      footer={
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-white p-3">
          <div>
            <div className="text-lg font-bold">{rupees(summary.total)}</div>
            <div className="text-[11px] font-medium text-success">You save {rupees(summary.discount)}</div>
          </div>
          <button className="btn-primary !px-8 !py-3" onClick={() => { startCheckout(customer.id, items, 'cart'); nav('/customer/checkout'); }}>
            Continue
          </button>
        </div>
      }
    >
      <div className="space-y-2 py-2">
        {lines.map((l) => (
          <div key={l.productId} className="flex gap-3 bg-white p-3">
            <Link to={`/customer/product/${l.productId}`}>
              <ProductImage product={l.product} className="h-24 w-20 shrink-0 rounded-lg" emojiSize="text-4xl" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{l.product.title}</div>
              <div className="text-[11px] text-ink-muted">{l.product.sellerName}{l.size ? ` · Size ${l.size}` : ''}</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-bold">{rupees(l.product.price)}</span>
                <span className="text-[11px] text-ink-muted line-through">{rupees(l.product.mrp)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-gray-300">
                  <button className="px-2 py-1" onClick={() => setCartQty(customer.id, l.productId, l.qty - 1)} aria-label="Decrease"><Minus size={14} /></button>
                  <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                  <button className="px-2 py-1 disabled:opacity-30" disabled={l.qty >= 5} onClick={() => setCartQty(customer.id, l.productId, l.qty + 1)} aria-label="Increase"><Plus size={14} /></button>
                </div>
                <button className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger" onClick={() => setCartQty(customer.id, l.productId, 0)}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        <PriceDetails items={items} />
      </div>
    </Screen>
  );
}
