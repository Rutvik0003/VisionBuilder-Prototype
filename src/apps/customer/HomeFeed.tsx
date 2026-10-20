import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PackageOpen, Search, ShieldCheck, Truck, Wallet, Zap } from 'lucide-react';
import { useUi } from '../../store/ui';
import { buyRedirect, readyNearYou } from '../../services/redirect';
import { useCurrentCustomer, useDeliverTo, useStore } from '../../store';
import type { Address, Customer, Product } from '../../types';
import { discountPct, rupees } from '../../lib/format';
import { useT } from '../../lib/strings';
import { clusterInfo, openBoxEligible, suppressedClusters } from '../../services/catalog';
import { Wordmark } from '../../components/Wordmark';
import { SwitchApp } from '../../components/SwitchApp';
import { FeatureTag } from '../../components/FeatureTag';
import { BottomNav, CartButton, InboxButton, ProductImage, Rating, Screen, Sheet } from './ui';

const CATEGORIES: { id: 'all' | Product['category']; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '🛍️' },
  { id: 'fashion', label: 'Fashion', emoji: '👗' },
  { id: 'home', label: 'Home', emoji: '🏠' },
  { id: 'kitchen', label: 'Kitchen', emoji: '🍳' },
  { id: 'beauty', label: 'Beauty', emoji: '💄' },
];

export function ProductCard({ product, customer, address }: { product: Product; customer: Customer; address?: Address }) {
  const products = useStore((s) => s.products);
  const t = useT();
  const info = clusterInfo(product, products);
  const openBox = openBoxEligible(product, customer, address);
  return (
    <Link to={`/customer/product/${product.id}`} className="block bg-white active:bg-gray-50">
      <div className="relative">
        <ProductImage product={product} className="aspect-[4/5]" />
        <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
          {info.isLowest && (
            <span className="chip bg-success/95 !text-[10px] text-white shadow-sm">{t('lowestShort')} <FeatureTag id="C3-F1" /></span>
          )}
          {openBox && (
            <span className="chip bg-white/95 !text-[10px] text-brand shadow-sm"><PackageOpen size={11} /> {t('openBoxShort')} <FeatureTag id="C2-F3" /></span>
          )}
        </div>
      </div>
      <div className="space-y-1 p-2">
        <div className="truncate text-[13px] text-ink-muted">{product.title}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[16px] font-bold">{rupees(product.price)}</span>
          <span className="text-[11px] text-ink-muted line-through">{rupees(product.mrp)}</span>
          <span className="text-[11px] font-semibold text-success">{discountPct(product.price, product.mrp)}% off</span>
        </div>
        <div className="truncate text-[11px] text-ink-muted">{product.sellerName} · Free Delivery</div>
        <Rating value={product.rating} count={product.ratingCount} />
      </div>
    </Link>
  );
}

export function HomeFeed() {
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const customer = useCurrentCustomer();
  const address = useDeliverTo(customer.id);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]['id']>('all');

  // C3-F1 post-order suppression: hide clusters with an undelivered order.
  const hidden = useMemo(() => suppressedClusters(customer.id, orders, products), [customer.id, orders, products]);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products.filter((p) =>
      !hidden.has(p.clusterId) &&
      (cat === 'all' || p.category === cat) &&
      (!query || p.title.toLowerCase().includes(query) || p.category.includes(query)));
  }, [products, q, cat, hidden]);

  return (
    <Screen
      header={
        <header className="z-10 shrink-0 bg-white px-3 pb-2 pt-2 shadow-sm">
          <div className="flex items-center justify-between">
            <Wordmark />
            <div className="flex items-center">
              <InboxButton />
              <CartButton />
              <SwitchApp />
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-brand">
            <Search size={16} className="text-ink-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for sarees, kurtis, bedsheets…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted" />
          </label>
        </header>
      }
      footer={<BottomNav />}
    >
      <div className="no-scrollbar flex gap-3 overflow-x-auto bg-white px-3 py-3">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className="flex shrink-0 flex-col items-center gap-1">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl transition ${cat === c.id ? 'bg-brand-light ring-2 ring-brand' : 'bg-gray-100'}`}>{c.emoji}</span>
            <span className={`text-[11px] ${cat === c.id ? 'font-semibold text-brand' : 'text-ink'}`}>{c.label}</span>
          </button>
        ))}
      </div>

      {!q && cat === 'all' && (
        <div className="bg-white px-3 pb-3">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand to-accent p-4 text-white">
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/80">Hi {customer.name.split(' ')[0]}</div>
            <div className="mt-0.5 text-lg font-bold leading-tight">Festive Fashion Sale</div>
            <div className="text-sm text-white/90">Sarees & kurtis from ₹199</div>
            <span className="absolute -right-2 -top-1 text-7xl opacity-90">🪔</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-ink-muted">
            <div className="flex flex-col items-center gap-1 rounded-lg bg-gray-50 py-2"><Truck size={16} className="text-brand" />Free delivery</div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-gray-50 py-2"><Wallet size={16} className="text-brand" />Cash on delivery</div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-gray-50 py-2"><ShieldCheck size={16} className="text-brand" />Easy returns</div>
          </div>
        </div>
      )}

      {!q && cat === 'all' && <ReadyNearYou customerId={customer.id} hubId={address?.hubId} />}

      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="text-[15px] font-semibold">{q ? `Results for “${q}”` : 'Products for You'}</h2>
        <span className="text-[11px] text-ink-muted">{visible.length} items</span>
      </div>
      {visible.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-ink-muted">No products match. Try another search.</div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-gray-200">
          {visible.map((p) => <ProductCard key={p.id} product={p} customer={customer} address={address} />)}
        </div>
      )}
    </Screen>
  );
}

/** R1.6: sealed, quality-checked parcels on this hub's redirect shelf — delivered tomorrow, first to pay gets it. */
function ReadyNearYou({ customerId, hubId }: { customerId: string; hubId?: string | null }) {
  useStore((s) => s.orders); // re-render when a shelf item sells
  const products = useStore((s) => s.products);
  const t = useT();
  const nav = useNavigate();
  const showToast = useUi((s) => s.showToast);
  const [buying, setBuying] = useState<string | null>(null);
  const items = readyNearYou(customerId, hubId);
  if (items.length === 0) return null;
  const sel = items.find((o) => o.id === buying);
  const selProduct = sel && products.find((p) => p.id === sel.items[0].productId)!;
  return (
    <div className="mt-2 bg-white px-3 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold"><Zap size={16} className="text-accent" /> {t('readyNear')} <FeatureTag id="R1" /></div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {items.map((o) => {
          const p = products.find((x) => x.id === o.items[0].productId)!;
          return (
            <button key={o.id} onClick={() => setBuying(o.id)} className="w-36 shrink-0 overflow-hidden rounded-lg border border-gray-200 text-left">
              <ProductImage product={p} className="h-28 w-full" emojiSize="text-4xl" />
              <div className="p-2">
                <div className="truncate text-xs">{p.title}{o.items[0].size ? ` · ${o.items[0].size}` : ''}</div>
                <div className="text-sm font-bold">{rupees(p.price)}</div>
                <div className="flex items-center gap-1 text-[10px] text-success"><ShieldCheck size={11} /> Original sealed pack</div>
              </div>
            </button>
          );
        })}
      </div>
      <Sheet open={!!sel} onClose={() => setBuying(null)} title={t('readyNear')}>
        {sel && selProduct && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <ProductImage product={selProduct} className="h-20 w-16 rounded-md" emojiSize="text-3xl" />
              <div className="text-sm">
                <div>{selProduct.title}{sel.items[0].size ? ` · Size ${sel.items[0].size}` : ''}</div>
                <div className="text-xs text-ink-muted">Sold by {selProduct.sellerName}</div>
                <div className="mt-1 font-bold">{rupees(selProduct.price)} · pay by UPI</div>
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-success">Still in its original sealed pack, checked at your local hub. Delivered tomorrow. Only one available: first to pay gets it.</div>
            <button className="btn-accent w-full !py-3" onClick={() => {
              const fresh = buyRedirect(sel.id, customerId);
              setBuying(null);
              if (!fresh) { showToast(t('redirectGone')); return; }
              showToast(t('redirectBought', { item: selProduct.title }));
              nav(`/customer/orders/${fresh.id}`);
            }}>{t('redirectBuy')} · {rupees(selProduct.price)}</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
