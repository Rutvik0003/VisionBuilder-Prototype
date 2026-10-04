import { Link, useParams } from 'react-router-dom';
import { Check, MessageCircle, Truck } from 'lucide-react';
import { useT } from '../../lib/strings';
import { useStore } from '../../store';
import { fmtDate, rupees } from '../../lib/format';
import { PageHeader, Screen } from './ui';
import { deliveryWhen } from '../../services/flow';

export function OrderPlaced() {
  const { orderId } = useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  const t = useT();
  if (!order) return null;

  return (
    <Screen
      header={<PageHeader title="Order confirmed" back="/customer" />}
      footer={
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-200 bg-white p-3">
          <Link to="/customer" className="btn-outline !py-3">Continue shopping</Link>
          <Link to={`/customer/orders/${order.id}`} className="btn-primary !py-3">View order</Link>
        </div>
      }
    >
      <div className="flex flex-col items-center bg-white px-6 pb-8 pt-10 text-center">
        <span className="flex h-20 w-20 animate-[pop_.45s_ease-out] items-center justify-center rounded-full bg-success text-white shadow-lg shadow-success/30">
          <Check size={40} strokeWidth={3} />
        </span>
        <h1 className="mt-5 text-xl font-bold">Order placed!</h1>
        <p className="mt-1 text-sm text-ink-muted">Order #{order.id}</p>
      </div>
      <div className="mx-3 mt-3 space-y-3 rounded-xl bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-success"><Truck size={19} /></span>
          <div>
            <div className="text-[12px] text-ink-muted">{order.hubId ? 'Your delivery slot' : 'Arriving by'}</div>
            <div className="font-semibold">{deliveryWhen(order)}{order.hubId && order.slot.window === 'Any time' ? ' · Any time' : ''}</div>
            {order.needBy && <div className="text-[12px] text-ink-muted">Needed by {fmtDate(order.needBy)}</div>}
            {order.deliverOnOrAfter && <div className="text-[12px] text-ink-muted">Cash ready from {fmtDate(order.deliverOnOrAfter)}</div>}
          </div>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-3 text-sm">
          <span className="text-ink-muted">{order.payment === 'COD' ? 'Pay on delivery' : 'Paid via UPI'}</span>
          <span className="font-bold">{rupees(order.total)}</span>
        </div>
      </div>
      {order.confirm && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900">
          <MessageCircle size={16} className="mt-0.5 shrink-0" /> {t('confirmPlaced')}
        </div>
      )}
      <p className="mx-6 mt-4 text-center text-[11px] text-ink-muted">Next in the demo: open <b>Seller / Transit</b> from the launcher{order.confirm ? ' once the order is confirmed' : ''}.</p>
    </Screen>
  );
}
