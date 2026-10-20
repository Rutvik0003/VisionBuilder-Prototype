import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { CalendarDays, Check, CircleHelp, MapPin, Package, Wallet } from 'lucide-react';
import { useStore } from '../../store';
import type { Order, OrderStatus } from '../../types';
import { fmtDate, fmtDateTime, rupees } from '../../lib/format';
import { CUSTOMER_STATUS, TIMELINE_STEPS, timelineStep } from '../../services/orders';
import { canChangeTime, deliveryWhen, homeYes } from '../../services/flow';
import { FeatureTag } from '../../components/FeatureTag';
import { EmptyState, PageHeader, ProductImage, Screen, StatusChip } from './ui';
import {
  AtHubCard, CancelFreeSheet, ChangeDaySheet, ConfirmedCard, DelayCard, DelayPickSheet, DirectionsSheet, HeldCard, HomeCheckCard,
  OpenBoxInfo, PlannedCard, WithSellerCard,
} from './OrderCards';
import { ConfidenceBadge } from './Account';
import { AttemptCard, CallSheet, LocationNudge, MessageSheet, MissedSheet, NotHomeSheet, ReplacementSheet, ReturnedCard, ShareLocationSheet, TrackingCard } from './DeliveryCards';
import { isApproximate } from '../../services/addresses';
import { Link } from 'react-router-dom';
import { useT } from '../../lib/strings';
import { RUN_CUTOFF, targetRun } from '../../services/routing';

/** X1: 3PL parcel out with the partner. Only the "Will you be home?" ping works; the rest is Valmo only. */
function PartnerCard({ order }: { order: Order }) {
  return (
    <section className="mx-3 space-y-2 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold"><Package size={16} className="text-brand" /> With our delivery partner (3PL) <FeatureTag id="X1" /></div>
      <div className="text-[13px]">Will you be home to receive it today?</div>
      {order.homeCheck === 'yes'
        ? <div className="flex items-center gap-1.5 text-sm font-medium text-success"><Check size={15} /> Thanks, the partner knows you’re home</div>
        : <button className="btn-primary w-full" onClick={() => homeYes([order.id])}>Yes, I’ll be home</button>}
      <div className="text-[11px] text-ink-muted">Live map, changing the time, “I’m not home” and open-box are <b>Valmo only</b>.</div>
    </section>
  );
}

const TERMINAL: OrderStatus[] = ['CANCELLED', 'REFUSED_AFTER_INSPECTION', 'RTO'];

function Timeline({ order }: { order: Order }) {
  const current = timelineStep(order.status);
  const whenReached = (statuses: OrderStatus[]) => order.timeline.find((t) => statuses.includes(t.status))?.at;
  return (
    <ol className="relative">
      {TIMELINE_STEPS.map((s, i) => {
        const done = i < current || (i === current && order.status === 'DELIVERED');
        const active = i === current && !done;
        const at = i === 0 ? order.createdAt : i === 1 ? undefined : whenReached(s.statuses);
        const last = i === TIMELINE_STEPS.length - 1;
        return (
          <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className={`absolute left-[11px] top-6 h-[calc(100%-18px)] w-0.5 ${i < current ? 'bg-success' : 'bg-gray-200'}`} />}
            <span className={`z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full
              ${done ? 'bg-success text-white' : active ? 'border-2 border-success bg-white' : 'border-2 border-gray-300 bg-white'}`}>
              {done && <Check size={13} strokeWidth={3} />}
              {active && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />}
            </span>
            <div className="pt-0.5">
              <div className={`text-sm ${done || active ? 'font-semibold' : 'text-ink-muted'}`}>{s.label}</div>
              <div className="text-[11px] text-ink-muted">
                {at && (done || active) ? fmtDateTime(at) : last && !done ? `Expected ${deliveryWhen(order)}` : ''}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetails() {
  const { orderId } = useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  const products = useStore((s) => s.products);
  const address = useStore((s) => s.addresses.find((a) => a.id === order?.addressId));
  const allOrders = useStore((s) => s.orders);
  const returnedPart = order?.returnedPart ? allOrders.find((o) => o.id === order.returnedPart) : undefined;
  const [params, setParams] = useSearchParams();
  const t = useT();
  const nav = useNavigate();
  // T2.5: Add directions → door-pin flow (map + DIGIPIN + directions), back to this order afterwards
  const goPin = () => nav(`/customer/addresses/${order?.addressId}/edit?step=pin&return=order:${order?.id}`);
  const sheet = params.get('sheet'); // 'change' | 'directions' — also opened from Messages buttons
  const openSheet = (name: string | null) => setParams(name ? { sheet: name } : {}, { replace: true });

  if (!order) {
    return <Screen header={<PageHeader title="Order" back="/customer/orders" />}><EmptyState icon={<Package />} title="Order not found" /></Screen>;
  }

  const terminal = TERMINAL.includes(order.status);
  const headline = order.status === 'DELIVERED'
    ? `Delivered on ${fmtDate(order.timeline.at(-1)!.at)}`
    : terminal ? `${order.status === 'REFUSED_AFTER_INSPECTION' ? 'Returned at the door' : order.status === 'RTO' ? 'Returned to the seller' : CUSTOMER_STATUS[order.status].label} on ${fmtDate(order.timeline.at(-1)!.at)}`
      : `Arriving ${dayjs(order.slot.date).format('dddd, D MMM')}`;

  // One primary card, by status (precedence: delay > home check > tracking > attempt — later phases add the rest)
  const primary = (() => {
    switch (order.status) {
      case 'DELAYED_IN_TRANSIT': return <DelayCard order={order} onPick={() => openSheet('delay')} onCancel={() => openSheet('cancel')} />;
      case 'PLACED': return <WithSellerCard />;
      case 'PLANNED':
        // Still waiting for a reply after routes are published: they can still answer (or move the day).
        return order.homeCheck === 'awaiting' || order.homeCheck === 'no_reply'
          ? <HomeCheckCard order={order} onChange={() => openSheet('change')} onDirections={goPin} />
          : <PlannedCard order={order} />;
      case 'OUT_FOR_DELIVERY': case 'ARRIVING_SOON':
        if (!order.hubId) return <PartnerCard order={order} />;
        return <TrackingCard order={order} onCall={() => openSheet('call')} onMessage={() => openSheet('message')} onNotHome={() => openSheet('nothome')} />;
      case 'ATTEMPT_FAILED': return <AttemptCard order={order} onMissed={() => openSheet('missed')} />;
      case 'REFUSED_AFTER_INSPECTION': case 'RTO': return <ReturnedCard order={order} onReplace={() => openSheet('replace')} />;
      case 'DELIVERED': return returnedPart ? <ReturnedCard order={returnedPart} partOf={order} onReplace={() => nav(`/customer/orders/${returnedPart.id}?sheet=replace`)} /> : null;
      case 'AT_HUB': return <AtHubCard order={order} />;
      case 'ACCEPTED':
        return order.homeCheck === 'awaiting' || order.homeCheck === 'no_reply'
          ? <HomeCheckCard order={order} onChange={() => openSheet('change')} onDirections={goPin} />
          : <ConfirmedCard order={order} onChange={() => openSheet('change')} />;
      case 'HELD': return <HeldCard order={order} onChange={() => openSheet('change')} />;
      default: return null;
    }
  })();

  return (
    <Screen header={<PageHeader title="Order Details" sub={`#${order.id}`} back="/customer/orders" />}>
      <div className="space-y-2 py-2">
        <section className="bg-white px-4 py-4">
          <StatusChip status={order.status} />
          {order.groupId && allOrders.filter((o) => o.groupId === order.groupId && o.id !== order.id).map((o) => (
            <Link key={o.id} to={`/customer/orders/${o.id}`} className="ml-2 chip bg-gray-100 text-ink-muted">Ordered together with #{o.id}</Link>
          ))}
          {order.returnedPart && <Link to={`/customer/orders/${order.returnedPart}`} className="ml-2 chip bg-amber-50 text-amber-800">Some items returned at the door · #{order.returnedPart}</Link>}
          {order.returnedFrom && <Link to={`/customer/orders/${order.returnedFrom}`} className="ml-2 chip bg-gray-100 text-ink-muted">Returned from order #{order.returnedFrom}</Link>}
          {order.replacementFor && (
            <Link to={`/customer/orders/${order.replacementFor}`} className="ml-2 chip bg-sky-50 text-sky-700">{t('replacementFor', { id: order.replacementFor })}</Link>
          )}
          <div className="mt-1.5 text-lg font-bold">{headline}</div>
          {!terminal && order.status !== 'DELIVERED' && (
            <div className="mt-2 flex items-center gap-2 text-[13px]">
              <CalendarDays size={15} className="text-brand" />
              <span className="flex-1">Delivery slot: <b>{fmtDate(order.slot.date)} · {order.slot.window}</b></span>
              {canChangeTime(order) && <button className="text-xs font-semibold text-brand" onClick={() => openSheet('change')}>Change time</button>}
            </div>
          )}
          {order.hubId && canChangeTime(order) && ['AT_HUB', 'ACCEPTED', 'HELD'].includes(order.status) && (
            <div className="mt-1 pl-6 text-[11px] text-ink-muted">You can change this until {RUN_CUTOFF[targetRun(order)]} on {fmtDate(order.slot.date)}, when the {targetRun(order).toLowerCase()} delivery run is planned.</div>
          )}
          {!terminal && order.status !== 'DELIVERED' && order.deliverOnOrAfter && (
            <div className="mt-1 space-y-0.5 pl-6 text-[12px] text-ink-muted">
              {order.deliverOnOrAfter && <div>Cash ready from {fmtDate(order.deliverOnOrAfter)}</div>}
            </div>
          )}
        </section>

        {primary}
        {address && order.hubId && isApproximate(address) && !terminal && order.status !== 'DELIVERED' && (
          <LocationNudge addressId={address.id} onShare={() => openSheet('location')} />
        )}
        {order.openBox && !terminal && order.status !== 'DELIVERED' && <OpenBoxInfo />}

        {!terminal && (
          <section className="bg-white px-4 py-4">
            <Timeline order={order} />
          </section>
        )}

        <section className="bg-white px-4 py-3">
          <div className="mb-2 text-sm font-semibold">Items</div>
          {order.items.map((it) => {
            const p = products.find((x) => x.id === it.productId)!;
            return (
              <div key={it.productId} className="flex items-center gap-3 py-1.5">
                <ProductImage product={p} className="h-16 w-14 rounded-md" emojiSize="text-2xl" />
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="truncate">{p.title}</div>
                  <div className="text-ink-muted">{p.sellerName} · Qty {it.qty}{it.size ? ` · ${it.size}` : ''}</div>
                </div>
                <div className="text-sm font-semibold">{rupees(it.price * it.qty)}</div>
              </div>
            );
          })}
        </section>

        {address && (
          <section className="bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              <MapPin size={15} className="text-brand" /> Delivering to {address.label}
              <ConfidenceBadge a={address} />
            </div>
            <div className="mt-1 text-[13px] text-ink-muted">
              {address.name}<br />{address.line1}, {address.area}<br />{address.city}, {address.state} – {address.pincode}
              {address.directions && <><br /><span className="text-ink">🧭 {address.directions}</span></>}
            </div>
          </section>
        )}

        <section className="flex items-center justify-between bg-white px-4 py-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold"><Wallet size={15} className="text-brand" />
            {order.payment === 'COD' ? 'Cash on Delivery' : 'Paid via UPI'}
          </div>
          <div className="text-right">
            <div className="font-bold">{rupees(order.total)}</div>
            <div className="text-[11px] text-ink-muted">{order.payment === 'COD' && order.status !== 'DELIVERED' ? 'to pay at delivery' : 'total'}</div>
          </div>
        </section>

        <section className="flex items-center gap-2 bg-white px-4 py-3 text-sm text-ink-muted">
          <CircleHelp size={16} /> Need help with this order?
          <span className="ml-auto text-[11px]">Placed {fmtDateTime(order.createdAt)}</span>
        </section>
      </div>
      <ChangeDaySheet key={'c' + String(sheet === 'change')} order={order} open={sheet === 'change'} onClose={() => openSheet(null)} />
      <DirectionsSheet key={'d' + String(sheet === 'directions')} order={order} open={sheet === 'directions'} onClose={() => openSheet(null)} />
      <DelayPickSheet key={'p' + String(sheet === 'delay')} order={order} open={sheet === 'delay'} onClose={() => openSheet(null)} />
      <CancelFreeSheet order={order} open={sheet === 'cancel'} onClose={() => openSheet(null)} />
      <CallSheet order={order} open={sheet === 'call'} onClose={() => openSheet(null)} />
      {address && <ShareLocationSheet addressId={address.id} open={sheet === 'location'} onClose={() => openSheet(null)} />}
      {order.refusal && <ReplacementSheet key={'r' + String(sheet === 'replace')} order={order} open={sheet === 'replace'} onClose={() => openSheet(null)} />}
      <MessageSheet order={order} open={sheet === 'message'} onClose={() => openSheet(null)} />
      <NotHomeSheet key={'n' + String(sheet === 'nothome')} order={order} open={sheet === 'nothome'} onClose={() => openSheet(null)} />
      <MissedSheet key={'m' + String(sheet === 'missed')} order={order} open={sheet === 'missed'} onClose={() => openSheet(null)} />
    </Screen>
  );
}
