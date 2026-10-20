import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, ChevronRight, MapPinPlus, PackageOpen, Plus, RotateCcw, ShoppingCart, Store, Tags, Truck, Wallet } from 'lucide-react';
import { useAddresses, useCurrentCustomer, useDeliverTo, useStore } from '../../store';
import { useUi } from '../../store/ui';
import { discountPct, fmtDate, rupees } from '../../lib/format';
import { useT } from '../../lib/strings';
import { addToCart, startCheckout } from '../../services/cart';
import { promisedDateFor } from '../../services/orders';
import { clusterInfo, openBoxEligible } from '../../services/catalog';
import { FeatureTag } from '../../components/FeatureTag';
import { CartButton, EmptyState, PageHeader, ProductImage, Rating, Screen, Sheet } from './ui';
import type { Product } from '../../types';

export function sizesFor(p: Product): string[] | null {
  if (p.category !== 'fashion') return null;
  if (/saree|dupatta/i.test(p.title)) return ['Free Size'];
  if (/kids/i.test(p.title)) return ['2-3Y', '4-5Y', '6-7Y', '8-9Y'];
  return ['S', 'M', 'L', 'XL', 'XXL'];
}

export function ProductPage() {
  const { productId } = useParams();
  const products = useStore((s) => s.products);
  const product = products.find((p) => p.id === productId);
  const customer = useCurrentCustomer();
  const addresses = useAddresses(customer.id);
  const address = useDeliverTo(customer.id);
  const { log, patch } = useStore();
  const showToast = useUi((s) => s.showToast);
  const nav = useNavigate();
  const t = useT();
  const sizes = product ? sizesFor(product) : null;
  const [size, setSize] = useState<string | undefined>(sizes?.length === 1 ? sizes[0] : undefined);
  const [sizeError, setSizeError] = useState(false);
  const [sheet, setSheet] = useState<'compare' | 'address' | null>(null);

  const info = product ? clusterInfo(product, products) : null;
  const openBox = product ? openBoxEligible(product, customer, address) : false;

  // Feature impressions (once per product view)
  useEffect(() => {
    if (!product || !info) return;
    if (info.isLowest) log('C3-F1', 'lowest_badge_shown', 'system', { productId: product.id, clusterId: product.clusterId });
    if (openBox) log('C2-F3', 'openbox_badge_shown', 'system', { productId: product.id });
  }, [product?.id, address?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product || !info) {
    return <Screen header={<PageHeader title="Product" />}><EmptyState icon={<Store />} title="Product not found" /></Screen>;
  }

  const promised = address ? promisedDateFor(address, [product.sellerId]) : null; // includes the seller's extra days
  const needSize = () => { if (sizes && !size) { setSizeError(true); return true; } return false; };

  const onAdd = () => { if (needSize()) return; addToCart(customer.id, product.id, size); showToast('Added to cart'); };
  const onBuy = () => {
    if (needSize()) return;
    startCheckout(customer.id, [{ productId: product.id, qty: 1, size }], 'buynow', address?.id);
    nav('/customer/checkout');
  };

  const switchTo = (p: Product) => {
    log('C3-F1', 'switched_listing', 'customer', { from: product.id, to: p.id, saved: product.price - p.price });
    setSheet(null);
    nav(`/customer/product/${p.id}`, { replace: true });
    if (p.price < product.price) showToast(`Switched · you save ${rupees(product.price - p.price)}`);
  };

  return (
    <Screen
      header={<PageHeader title={product.title} sub={product.sellerName} right={<CartButton />} />}
      footer={
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-200 bg-white p-3">
          <button className="btn-outline !py-3" onClick={onAdd}><ShoppingCart size={17} /> Add to Cart</button>
          <button className="btn-primary !py-3" onClick={onBuy}>Buy Now</button>
        </div>
      }
    >
      <ProductImage product={product} className="aspect-square" emojiSize="text-[120px]" />

      <section className="bg-white px-4 pb-4 pt-3">
        <h1 className="text-[15px] text-ink-muted">{product.title}</h1>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{rupees(product.price)}</span>
          <span className="text-sm text-ink-muted line-through">{rupees(product.mrp)}</span>
          <span className="text-sm font-semibold text-success">{discountPct(product.price, product.mrp)}% off</span>
        </div>
        <div className="mt-2"><Rating value={product.rating} count={product.ratingCount} /></div>

        {/* C3-F1 price transparency */}
        {info.isLowest && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-success">
            <BadgeCheck size={16} /> {t('lowestBadge')} <FeatureTag id="C3-F1" />
          </div>
        )}
        {info.multi && !info.isLowest && (
          <button onClick={() => { setSheet('compare'); log('C3-F1', 'compare_opened', 'customer', { productId: product.id, sellers: info.sellers }); }}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-success/40 bg-emerald-50/60 px-3 py-2 text-left text-[13px]">
            <Tags size={16} className="shrink-0 text-success" />
            <span className="flex-1 font-semibold text-success">{t('sameItemFrom', { min: rupees(info.min), n: info.sellers })}</span>
            <FeatureTag id="C3-F1" />
            <ChevronRight size={16} className="text-success" />
          </button>
        )}

        {/* Delivery line — never an estimate without an address */}
        {address && promised ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[13px]">
            <Truck size={16} className="shrink-0 text-success" />
            <span className="flex-1"><b>{t('deliveryByTo', { date: fmtDate(promised), label: address.label, pincode: address.pincode })}</b></span>
            <button className="shrink-0 text-xs font-semibold text-brand" onClick={() => setSheet('address')}>{t('change')}</button>
          </div>
        ) : (
          <Link to={`/customer/addresses/new?return=product:${product.id}`}
            className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-brand bg-brand-light/50 px-3 py-2.5">
            <MapPinPlus size={18} className="shrink-0 text-brand" />
            <span className="flex-1 text-[13px] font-semibold text-brand">{t('addAddressForDate')}</span>
            <ChevronRight size={16} className="text-brand" />
          </Link>
        )}

        {/* C2-F3 open-box */}
        {openBox && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-brand-light/60 px-3 py-2 text-[13px]">
            <PackageOpen size={16} className="mt-0.5 shrink-0 text-brand" />
            <span className="flex-1">{t('openBoxBadge')}</span>
            <FeatureTag id="C2-F3" />
          </div>
        )}
      </section>

      {sizes && (
        <section className="mt-2 bg-white px-4 py-3">
          <div className="text-sm font-semibold">Select Size</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button key={s} onClick={() => { setSize(s); setSizeError(false); }}
                className={`min-w-12 rounded-full border px-3 py-1.5 text-sm transition ${size === s ? 'border-brand bg-brand-light font-semibold text-brand' : 'border-gray-300'}`}>{s}</button>
            ))}
          </div>
          {sizeError && <div className="mt-2 text-xs text-danger">Please select a size</div>}
        </section>
      )}

      <section className="mt-2 grid grid-cols-3 gap-2 bg-white px-4 py-3 text-center text-[11px] text-ink-muted">
        <div className="flex flex-col items-center gap-1"><Wallet size={18} className="text-brand" />Cash on Delivery</div>
        <div className="flex flex-col items-center gap-1"><RotateCcw size={18} className="text-brand" />7-day returns</div>
        <div className="flex flex-col items-center gap-1"><Truck size={18} className="text-brand" />Free Delivery</div>
      </section>

      <section className="mt-2 bg-white px-4 py-3">
        <div className="text-sm font-semibold">Product Details</div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{product.description}</p>
      </section>

      <section className="mb-2 mt-2 flex items-center gap-3 bg-white px-4 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand"><Store size={18} /></span>
        <div className="flex-1">
          <div className="text-[13px] text-ink-muted">Sold by</div>
          <div className="font-semibold">{product.sellerName}</div>
        </div>
        <Rating value={Math.min(4.6, product.rating + 0.1)} />
      </section>

      {/* C3-F1 compare sheet */}
      <Sheet open={sheet === 'compare'} onClose={() => setSheet(null)} title={t('compareTitle')}>
        <div className="p-4">
          <p className="mb-3 text-[12px] text-ink-muted">{t('compareSub', { n: info.sellers })}</p>
          <div className="space-y-2">
            {info.listings.map((p) => {
              const current = p.id === product.id;
              const lowest = p.price === info.min;
              return (
                <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${current ? 'border-brand bg-brand-light/40' : 'border-gray-200'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-bold">{rupees(p.price)}</span>
                      {lowest && <span className="chip bg-emerald-50 !text-[10px] text-success">{t('lowestShort')}</span>}
                    </div>
                    <div className="truncate text-[12px] font-medium">{p.sellerName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                      <Rating value={p.rating} />
                      {promised && <span>by {fmtDate(promised)}</span>}
                      {openBoxEligible(p, customer, address) && <span className="text-brand">Open-box</span>}
                    </div>
                  </div>
                  {current
                    ? <span className="text-xs font-semibold text-brand">{t('viewing')}</span>
                    : <button className="btn-primary !px-4 !py-1.5 text-xs" onClick={() => switchTo(p)}>{t('switchBtn')}</button>}
                </div>
              );
            })}
          </div>
        </div>
      </Sheet>

      {/* Deliver-to picker */}
      <Sheet open={sheet === 'address'} onClose={() => setSheet(null)} title={t('deliverTo')}>
        <div className="space-y-2 p-4">
          {addresses.map((a) => (
            <button key={a.id} onClick={() => { patch((s) => ({ deliverTo: { ...s.deliverTo, [customer.id]: a.id } })); setSheet(null); }}
              className={`block w-full rounded-xl border p-3 text-left text-[13px] ${a.id === address?.id ? 'border-brand ring-1 ring-brand' : 'border-gray-200'}`}>
              <span className="chip bg-gray-100 font-semibold">{a.label}</span>
              <div className="mt-1 text-ink-muted">{a.line1}, {a.area}, {a.city} – {a.pincode}</div>
            </button>
          ))}
          <Link to={`/customer/addresses/new?return=product:${product.id}`} className="btn-outline w-full"><Plus size={15} /> Add new address</Link>
        </div>
      </Sheet>
    </Screen>
  );
}
