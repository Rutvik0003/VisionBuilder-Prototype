import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, CircleSlash, Clock4, Moon, PackageCheck, PhoneCall, Tag, Truck, Unlock, Warehouse } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store';
import type { Order } from '../../types';
import { fmtDate, fmtDateTime, rupees } from '../../lib/format';
import { markInTransit, reachedHub, reportTransitDelay, acceptDelay, sellerShips } from '../../services/flow';
import { canShip, cancelUnconfirmed, inQuietHours, placeConfirmCall, placeQueuedCall, releaseOrder } from '../../services/ivr';
import { useUi } from '../../store/ui';
import { FeatureTag } from '../../components/FeatureTag';
import { DesktopShell } from '../../components/DesktopShell';
import { LabelButton } from '../../components/ShippingLabel';

type Tab = 'orders' | 'confirm' | 'refusals' | 'redirect';
const PIPELINE: Order['status'][] = ['PLACED', 'SHIPPED', 'IN_TRANSIT', 'DELAYED_IN_TRANSIT'];

/** Seller / Transit simulator: stands in for seller packing, first mile, sorting and line-haul. */
export function TransitApp() {
  const orders = useStore(useShallow((s) => s.orders.filter((o) => PIPELINE.includes(o.status))));
  const allOrders = useStore((s) => s.orders);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'orders';
  const awaiting = orders.filter((o) => o.status === 'PLACED' && !canShip(o));
  const refusals = allOrders.filter((o) => o.status === 'REFUSED_AFTER_INSPECTION');
  const sales = allOrders.filter((o) => o.refusal?.redirect?.state === 'sold');

  const TABS: { id: Tab; label: string; n?: number }[] = [
    { id: 'orders', label: 'Orders', n: orders.length },
    { id: 'confirm', label: 'Awaiting confirmation', n: awaiting.length },
    { id: 'refusals', label: 'Open-box refusals', n: refusals.length },
    { id: 'redirect', label: 'Redirect sales', n: sales.length },
  ];

  return (
    <DesktopShell title="Seller / Transit simulator" sub="Stands in for seller packing, first mile, sorting and line-haul." back="/">
      <nav className="no-scrollbar mb-3 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setParams(t.id === 'orders' ? {} : { tab: t.id })}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${tab === t.id ? 'bg-brand text-white' : 'bg-white shadow-sm hover:bg-brand-light'}`}>
            {t.label}{!!t.n && <span className={`rounded-full px-1.5 text-[11px] font-bold ${tab === t.id ? 'bg-white/25' : 'bg-gray-100'}`}>{t.n}</span>}
          </button>
        ))}
      </nav>
      {tab === 'orders' && <OrdersTab orders={orders} />}
      {tab === 'confirm' && <ConfirmTab orders={awaiting} />}
      {tab === 'refusals' && <RefusalsTab orders={refusals} />}
      {tab === 'redirect' && <RedirectSalesTab orders={sales} />}
    </DesktopShell>
  );
}

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="card flex flex-col items-center py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand">{icon}</span>
      <div className="mt-3 font-semibold">{title}</div>
      <div className="text-sm text-ink-muted">{sub}</div>
    </div>
  );
}

function useNames() {
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const hubs = useStore((s) => s.hubs);
  return {
    customer: (o: Order) => customers.find((c) => c.id === o.customerId)!,
    product: (o: Order) => products.find((p) => p.id === o.items[0].productId)!,
    hub: (o: Order) => hubs.find((h) => h.id === o.hubId),
  };
}

const STATUS_CHIP: Partial<Record<Order['status'], [string, string]>> = {
  PLACED: ['With seller', 'bg-gray-100 text-ink'],
  SHIPPED: ['Shipped', 'bg-sky-50 text-sky-700'],
  IN_TRANSIT: ['In transit', 'bg-indigo-50 text-indigo-700'],
  DELAYED_IN_TRANSIT: ['Delayed · awaiting customer', 'bg-amber-50 text-amber-700'],
};

function DelayPicker({ label, onPick, disabled, tag }: { label: string; onPick: (days: number) => void; disabled?: boolean; tag?: string }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
        Late by
        {[1, 2, 3].map((d) => (
          <button key={d} className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-semibold hover:bg-amber-100"
            onClick={() => { onPick(d); setOpen(false); }}>{d}d</button>
        ))}
        <button className="px-1 text-ink-muted" onClick={() => setOpen(false)}>✕</button>
      </span>
    );
  }
  return (
    <button className="btn-ghost !py-1.5 text-xs text-amber-700" disabled={disabled} onClick={() => setOpen(true)}>
      <Clock4 size={14} /> {label} {tag && <FeatureTag id={tag} />}
    </button>
  );
}

function OrdersTab({ orders }: { orders: Order[] }) {
  const n = useNames();
  if (orders.length === 0) return <Empty icon={<Truck size={24} />} title="No orders with sellers or in transit" sub="Place an order in the customer app; it shows up here." />;
  return (
    <div className="card overflow-x-auto p-4">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-ink-muted">
          <tr><th className="px-2 py-2">Order</th><th className="px-2">Customer</th><th className="px-2">Item</th><th className="px-2">Payment</th><th className="px-2">Destination</th><th className="px-2">Delivery</th><th className="px-2">Status</th><th className="px-2" /></tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((o) => {
            const c = n.customer(o), p = n.product(o), hub = n.hub(o);
            const chip = STATUS_CHIP[o.status]!;
            const blocked = o.status === 'PLACED' && !canShip(o);
            return (
              <tr key={o.id} className="align-top hover:bg-gray-50">
                <td className="px-2 py-3"><div className="font-mono text-xs">#{o.id}</div><div className="text-[11px] text-ink-muted">{fmtDateTime(o.createdAt)}</div></td>
                <td className="px-2 py-3">{c.name}<div className="text-[11px] text-ink-muted">{c.id === 'existing' ? 'Existing user' : 'New user'}</div></td>
                <td className="max-w-[200px] px-2 py-3">
                  <div className="truncate">{p.title}</div><div className="text-[11px] text-ink-muted">{p.sellerName}</div>
                  {o.replacementFor && <span className="chip bg-sky-50 !text-[10px] text-sky-700">Replacement for #{o.replacementFor}</span>}
                  {o.openBox && <span className="chip bg-brand-light !text-[10px] text-brand">Open-box</span>}
                </td>
                <td className="px-2 py-3">{o.payment === 'COD' ? <span className="chip bg-amber-50 text-amber-700">COD {rupees(o.total)}</span> : <span className="chip bg-emerald-50 text-success">Prepaid {rupees(o.total)}</span>}</td>
                <td className="px-2 py-3">{hub ? <>{hub.name}<div className="text-[11px] text-success">Valmo</div></> : <span className="chip bg-gray-100 text-ink-muted">3PL partner</span>}</td>
                <td className="px-2 py-3">
                  {fmtDate(o.slot.date)}
                  {o.delay && o.status === 'DELAYED_IN_TRANSIT' && <div className="text-[11px] font-medium text-amber-700">→ {fmtDate(o.delay.newDate)}</div>}
                  {o.needBy && <div className="text-[11px] text-ink-muted">Needed by {fmtDate(o.needBy)}</div>}
                </td>
                <td className="px-2 py-3">
                  <span className={`chip ${chip[1]}`}>{chip[0]}</span>
                  {blocked && <div className="mt-1"><span className="chip bg-red-50 text-danger">Awaiting confirmation</span></div>}
                  {o.confirm?.state === 'confirmed' && <div className="mt-1"><span className="chip bg-emerald-50 !text-[10px] text-success">Customer confirmed</span></div>}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    {o.status === 'PLACED' && <>
                      <button className="btn-primary !py-1.5 text-xs" disabled={blocked} title={blocked ? 'Waiting for the customer to confirm (or release it)' : undefined}
                        onClick={() => sellerShips(o.id)}><PackageCheck size={14} /> Seller ships</button>
                      <DelayPicker label="Seller missed dispatch" tag="C1-F5" onPick={(d) => reportTransitDelay(o.id, d, 'missed_dispatch')} />
                    </>}
                    {o.status === 'SHIPPED' && <>
                      <button className="btn-primary !py-1.5 text-xs" onClick={() => markInTransit(o.id)}><Truck size={14} /> In transit</button>
                      <DelayPicker label="Transit delay" tag="C1-F5" onPick={(d) => reportTransitDelay(o.id, d, 'transit')} />
                    </>}
                    {o.status === 'IN_TRANSIT' && <>
                      <button className="btn-primary !py-1.5 text-xs" onClick={() => reachedHub(o.id)}><Warehouse size={14} /> Reached hub</button>
                      <DelayPicker label="Transit delay" tag="C1-F5" onPick={(d) => reportTransitDelay(o.id, d, 'transit')} />
                    </>}
                    {o.status === 'DELAYED_IN_TRANSIT' && (
                      <button className="btn-ghost !py-1.5 text-xs" onClick={() => acceptDelay(o.id)} title="No reply from the customer: continue on the new date">
                        Continue on new date
                      </button>
                    )}
                    <LabelButton order={o} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmTab({ orders }: { orders: Order[] }) {
  const n = useNames();
  const showToast = useUi((s) => s.showToast);
  const quiet = inQuietHours();
  if (orders.length === 0) return <Empty icon={<PhoneCall size={24} />} title="Nothing awaiting confirmation" sub="Risk-flagged COD orders wait here until the customer confirms (or you release them)." />;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-ink-muted shadow-sm">
        <Moon size={14} /> No automated calls between 9 pm and 9 am. {quiet ? <b className="text-amber-700">Quiet hours now: calls are queued for 9 am.</b> : 'Calls go out now.'}
        <FeatureTag id="P1" />
      </div>
      {orders.map((o) => {
        const c = n.customer(o), p = n.product(o), cf = o.confirm!;
        const call = () => {
          const r = placeConfirmCall(o.id);
          showToast(r === 'queued' ? 'Quiet hours: call queued for 9 am' : r === 'ringing' ? `Calling ${c.name.split(' ')[0]}… (open the customer app)` : 'No call needed');
        };
        return (
          <div key={o.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{c.name} · {p.title} · {rupees(o.total)} COD <span className="font-mono text-xs text-ink-muted">#{o.id}</span></div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className={`chip ${cf.risk === 'high' ? 'bg-red-50 text-danger' : 'bg-amber-50 text-amber-700'}`}>{cf.risk} risk</span>
                {cf.reasons.map((r) => <span key={r} className="chip bg-gray-100 text-ink-muted">{r}</span>)}
                <span className="chip bg-sky-50 text-sky-700">
                  {cf.state === 'never_reached' ? 'Never reached · held' : `WhatsApp sent · ${cf.calls} call${cf.calls === 1 ? '' : 's'}`}{cf.queued ? ' · call queued for 9 am' : ''}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cf.state === 'awaiting' && cf.calls === 0 && !cf.queued && <button className="btn-outline !py-1.5 text-xs" onClick={call}><PhoneCall size={13} /> No tap in 10 min → Meesho calls</button>}
              {cf.state === 'awaiting' && cf.calls === 1 && !cf.queued && <button className="btn-outline !py-1.5 text-xs" onClick={call}><PhoneCall size={13} /> 3 hours later → second call</button>}
              {cf.queued && <button className="btn-outline !py-1.5 text-xs" onClick={() => { placeQueuedCall(o.id); showToast('9 am: calling now'); }}><PhoneCall size={13} /> 9 am → place queued call</button>}
              {cf.state === 'never_reached' && <button className="btn !py-1.5 text-xs text-white bg-danger" onClick={() => cancelUnconfirmed(o.id, 'seller')}><CircleSlash size={13} /> Cancel before dispatch</button>}
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => releaseOrder(o.id)}><Unlock size={13} /> Release</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RefusalsTab({ orders }: { orders: Order[] }) {
  const n = useNames();
  if (orders.length === 0) return <Empty icon={<Camera size={24} />} title="No open-box refusals" sub="When a customer refuses at the door, the rider's photos and seal ID appear here." />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {orders.map((o) => {
        const r = o.refusal!;
        const state = r.redirect?.state;
        return (
          <div key={o.id} className="card flex gap-3 p-3 text-sm">
            <div className="flex gap-1.5">
              {['Seal', 'Item'].map((k) => (
                <span key={k} className="flex h-16 w-16 flex-col items-center justify-center rounded-md bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_5px,#e5e7eb_5px,#e5e7eb_10px)] text-[10px] text-ink-muted">
                  <Camera size={15} />{k} photo
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{n.product(o).title}</div>
              <div className="text-xs text-ink-muted">{n.customer(o).name} · {r.reason}{r.damaged ? ' · damaged' : ''} · {fmtDateTime(r.at)}</div>
              <div className="mt-1 font-mono text-xs font-semibold">Seal {r.sealId}</div>
              <span className="chip mt-1 bg-gray-100 text-ink-muted">
                {state === 'sold' ? 'Resold nearby (redirect)' : state === 'shelf' ? 'On hub redirect shelf' : state === 'returned' ? `Returning to you · ${r.redirect?.returnReason}` : 'At hub · quality check pending'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RedirectSalesTab({ orders }: { orders: Order[] }) {
  const n = useNames();
  const customers = useStore((s) => s.customers);
  if (orders.length === 0) return <Empty icon={<Tag size={24} />} title="No redirect sales yet" sub="Refused parcels resold to nearby shoppers on your listing show up here." />;
  return (
    <div className="card divide-y divide-gray-100 p-2">
      {orders.map((o) => {
        const r = o.refusal!.redirect!;
        return (
          <div key={o.id} className="flex flex-wrap items-center gap-3 px-2 py-2.5 text-sm">
            <Tag size={16} className="text-success" />
            <span className="min-w-0 flex-1 truncate">{n.product(o).title} · sold on your listing to {customers.find((c) => c.id === r.buyerId)?.name}</span>
            <span className="font-semibold">{rupees(r.price ?? 0)}</span>
            <span className="font-mono text-xs text-ink-muted">new order #{r.newOrderId} · was #{o.id}</span>
          </div>
        );
      })}
    </div>
  );
}
