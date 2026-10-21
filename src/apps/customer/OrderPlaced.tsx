import { Link, useParams } from 'react-router-dom';
import { Check, MessageCircle, Package, Truck } from 'lucide-react';
import { useT } from '../../lib/strings';
import { useStore } from '../../store';
import { fmtDate, rupees } from '../../lib/format';
import { PageHeader, ProductImage, Screen } from './ui';
import { deliveryWhen } from '../../services/flow';

export function OrderPlaced() {
  const { orderId } = useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  const allOrders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const t = useT();
  if (!order) return null;
  // A cart with several sellers is placed as one order per seller (one parcel each), confirmed once.
  const group = order.groupId ? allOrders.filter((o) => o.groupId === order.groupId) : [order];
  const total = group.reduce((a, o) => a + o.total, 0);
  const multi = group.length > 1;
  const sameDay = new Set(group.map((o) => o.slot.date)).size === 1;
  const visits = new Set(group.map((o) => `${o.slot.date}|${o.slot.window}`)).size; // parcels on the same day and time = one visit

  return (
    <Screen
      header={<PageHeader title="Order confirmed" back="/customer" />}
      footer={
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-200 bg-white p-3">
          <Link to="/customer" className="btn-outline !py-3">Continue shopping</Link>
          <Link to={multi ? '/customer/orders' : `/customer/orders/${order.id}`} className="btn-primary !py-3">{multi ? 'View orders' : 'View order'}</Link>
        </div>
      }
    >
      <div className="flex flex-col items-center bg-white px-6 pb-8 pt-10 text-center">
        <span className="flex h-20 w-20 animate-[pop_.45s_ease-out] items-center justify-center rounded-full bg-success text-white shadow-lg shadow-success/30">
          <Check size={40} strokeWidth={3} />
        </span>
        <h1 className="mt-5 text-xl font-bold">Order placed!</h1>
        <p className="mt-1 text-sm text-ink-muted">{multi ? `${group.length} parcels · ${group.map((o) => '#' + o.id).join(', ')}` : `Order #${order.id}`}</p>
      </div>
      <div className="mx-3 mt-3 space-y-3 rounded-xl bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-success"><Truck size={19} /></span>
          <div>
            <div className="text-[12px] text-ink-muted">{order.hubId ? (multi ? (sameDay ? 'Your delivery slot (all parcels together)' : `${visits} deliver${visits === 1 ? 'y' : 'ies'}, as you chose`) : 'Your delivery slot') : 'Arriving by'}</div>
            <div className="font-semibold">{sameDay ? <>{deliveryWhen(order)}{order.hubId && order.slot.window === 'Any time' ? ' · Any time' : ''}</> : [...new Set(group.map((o) => fmtDate(o.slot.date)))].join(' and ')}</div>
            {order.deliverOnOrAfter && <div className="text-[12px] text-ink-muted">Cash ready from {fmtDate(order.deliverOnOrAfter)}</div>}
          </div>
        </div>
        {multi && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            {group.map((o, i) => {
              const p = products.find((x) => x.id === o.items[0].productId)!;
              return (
                <Link key={o.id} to={`/customer/orders/${o.id}`} className="flex items-center gap-3">
                  <ProductImage product={p} className="h-12 w-10 rounded-md" emojiSize="text-xl" />
                  <div className="min-w-0 flex-1 text-[13px]">
                    <div className="flex items-center gap-1 font-medium"><Package size={13} className="text-brand" /> Parcel {i + 1} · {p.sellerName}</div>
                    <div className="truncate text-[12px] text-ink-muted">{o.items.map((it) => products.find((x) => x.id === it.productId)?.title).join(', ')}</div>
                    {!sameDay && <div className="text-[11px] font-medium text-success">{fmtDate(o.slot.date)} · {o.slot.window}</div>}
                  </div>
                  <span className="text-sm font-semibold">{rupees(o.total)}</span>
                </Link>
              );
            })}
          </div>
        )}
        <div className="flex justify-between border-t border-gray-100 pt-3 text-sm">
          <span className="text-ink-muted">{order.payment === 'COD' ? 'Pay on delivery' : 'Paid via UPI'}</span>
          <span className="font-bold">{rupees(total)}</span>
        </div>
      </div>
      {order.confirm && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900">
          <MessageCircle size={16} className="mt-0.5 shrink-0" /> {multi ? (sameDay ? t('confirmPlacedMulti', { n: group.length }) : t('confirmPlacedSplit', { n: group.length, dates: [...new Set(group.map((o) => fmtDate(o.slot.date)))].join(' and ') })) : t('confirmPlaced')}
        </div>
      )}
      {!order.confirm && multi && (
        <div className="mx-3 mt-3 rounded-xl bg-sky-50 p-3 text-[13px] text-sky-900">Your items come from {group.length} sellers, so they ship as {group.length} parcels{sameDay ? ' and arrive together' : ', each on its own day'}.</div>
      )}
      <p className="mx-6 mt-4 text-center text-[11px] text-ink-muted">Next in the demo: open <b>Seller &amp; Transit</b> in the sidebar{order.confirm ? ' once the order is confirmed' : ''}.</p>
    </Screen>
  );
}
