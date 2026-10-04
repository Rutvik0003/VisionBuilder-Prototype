import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Bell, Check, CheckCheck, MapPinned, MessageCircle, PhoneIncoming } from 'lucide-react';
import { useCurrentCustomer, useStore } from '../../store';
import { useUi } from '../../store/ui';
import type { Channel, Message, Order } from '../../types';
import { fmtDate, fmtDateTime, rupees } from '../../lib/format';
import { useT } from '../../lib/strings';
import { acceptDelay, canChangeTime, deliveryWhen, homeYes, parseAction, payNow } from '../../services/flow';
import { UPI_DISCOUNT } from '../../services/orders';
import { disputeAttempt } from '../../services/delivery';
import { closeRefusedOrder } from '../../services/openbox';
import { cancelUnconfirmed, confirmOrder, payUpiToShip } from '../../services/ivr';
import { startCheckout } from '../../services/cart';
import { buyRedirect } from '../../services/redirect';
import { ShareLocationSheet } from './DeliveryCards';
import { FeatureTag } from '../../components/FeatureTag';
import { BottomNav, EmptyState, PageHeader, Screen } from './ui';

const FILTERS: { id: 'all' | Channel; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'push', label: 'App' },
  { id: 'voice', label: 'Calls' },
];

/** Is this message button still actionable for the orders' current state? */
function buttonLive(action: string, orders: Order[]) {
  const { kind, orderIds } = parseAction(action);
  const os = orders.filter((o) => orderIds.includes(o.id));
  if (!os.length) return false;
  if (kind === 'check_yes') return os.some((o) => ['ACCEPTED', 'PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'].includes(o.status) && o.homeCheck !== 'yes');
  if (kind === 'check_change') return os.some(canChangeTime);
  if (kind === 'check_directions') return os.some((o) => ['ACCEPTED', 'HELD', 'PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'].includes(o.status));
  if (kind === 'pay_now') return os.some((o) => o.payment === 'COD' && ['ACCEPTED', 'HELD', 'PLANNED'].includes(o.status));
  if (kind.startsWith('delay_')) return os.some((o) => o.status === 'DELAYED_IN_TRANSIT');
  if (kind === 'call_rider' || kind === 'not_home') return os.some((o) => ['OUT_FOR_DELIVERY', 'ARRIVING_SOON'].includes(o.status));
  if (kind.startsWith('attempt_')) return os.some((o) => o.status === 'ATTEMPT_FAILED');
  if (kind === 'replace' || kind === 'close_refused') return os.some((o) => !!o.refusal && !o.refusal.customerChoice);
  if (kind === 'ivr_confirm' || kind === 'ivr_cancel') return os.some((o) => o.status === 'PLACED' && !!o.confirm && ['awaiting', 'never_reached'].includes(o.confirm.state));
  if (kind === 'pay_upi_ship') return os.some((o) => o.status === 'PLACED' && o.payment === 'COD' && o.confirm?.state === 'never_reached');
  if (kind === 'reorder') return os.length > 0;
  if (kind === 'redirect_buy') return os.some((o) => o.refusal?.redirect?.state === 'shelf');
  return false;
}

export function Inbox() {
  const customer = useCurrentCustomer();
  const messages = useStore(useShallow((s) => s.messages.filter((m) => m.customerId === customer.id)));
  const orders = useStore((s) => s.orders);
  const patch = useStore((s) => s.patch);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [shareFor, setShareFor] = useState<string | null>(null);
  const nav = useNavigate();
  const t = useT();
  const showToast = useUi((s) => s.showToast);

  // Opening Messages marks everything read.
  useEffect(() => {
    if (messages.some((m) => !m.read)) {
      patch((s) => ({ messages: s.messages.map((m) => (m.customerId === customer.id ? { ...m, read: true } : m)) }));
    }
  }, [messages, customer.id, patch]);

  const run = (action: string) => {
    const { kind, orderIds } = parseAction(action);
    const first = orders.find((o) => o.id === orderIds[0])!;
    if (kind === 'check_yes') { homeYes(orderIds); showToast(t('hcConfirmed', { when: deliveryWhen(first) })); }
    else if (kind === 'pay_now') { orderIds.forEach(payNow); showToast(t('paidNow', { amount: rupees(first.total - UPI_DISCOUNT) })); }
    else if (kind === 'share_location') setShareFor(orderIds[0]); // id is the address id
    else if (kind === 'ivr_confirm') { confirmOrder(orderIds[0], 'whatsapp'); showToast(t('ivrConfirmed')); }
    else if (kind === 'ivr_cancel') { cancelUnconfirmed(orderIds[0], 'whatsapp'); showToast(t('ivrCancelled')); }
    else if (kind === 'pay_upi_ship') { payUpiToShip(orderIds[0]); showToast(t('paidNow', { amount: rupees(first.total - UPI_DISCOUNT) })); }
    else if (kind === 'reorder') {
      startCheckout(first.customerId as 'existing' | 'new', first.items.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size })), 'buynow', first.addressId);
      nav('/customer/checkout');
    }
    else if (kind === 'redirect_buy') {
      const fresh = buyRedirect(orderIds[0], customer.id);
      if (!fresh) { showToast(t('redirectGone')); return; }
      const title = useStore.getState().products.find((p) => p.id === fresh.items[0].productId)?.title ?? '';
      showToast(t('redirectBought', { item: title }));
      nav(`/customer/orders/${fresh.id}`);
    }
    else if (kind === 'replace') nav(`/customer/orders/${orderIds[0]}?sheet=replace`);
    else if (kind === 'close_refused') { closeRefusedOrder(orderIds[0]); showToast(t('closedLine')); }
    else if (kind === 'attempt_here') { disputeAttempt(orderIds[0]); showToast(t('attemptHereDone')); }
    else if (kind === 'call_rider' || kind === 'not_home' || kind === 'attempt_missed') nav(`/customer/orders/${orderIds[0]}?sheet=${kind === 'call_rider' ? 'call' : kind === 'not_home' ? 'nothome' : 'missed'}`);
    else if (kind === 'delay_ok') { acceptDelay(orderIds[0]); showToast(t('hcConfirmed', { when: fmtDate(first.delay!.newDate) })); }
    else if (kind === 'delay_pick' || kind === 'delay_cancel') nav(`/customer/orders/${orderIds[0]}?sheet=${kind === 'delay_pick' ? 'delay' : 'cancel'}`);
    else if (kind === 'check_directions') nav(`/customer/addresses/${first.addressId}/edit?step=pin&return=order:${first.id}`);
    else nav(`/customer/orders/${orderIds[0]}?sheet=change`);
  };

  const shown = [...messages].reverse().filter((m) => filter === 'all' || m.channel === filter);

  return (
    <Screen header={<PageHeader title="Messages" sub="Meesho Delivery" back="/customer" />} footer={<BottomNav />} className="bg-[#EFE7DD]">
      <div className="no-scrollbar sticky top-0 z-10 flex gap-1.5 overflow-x-auto bg-white px-3 py-2 shadow-sm">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`chip !px-3 !py-1 ${filter === f.id ? 'bg-brand text-white' : 'bg-gray-100 text-ink'}`}>{f.label}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="bg-page"><EmptyState icon={<MessageCircle />} title="No messages yet" sub="Delivery updates about your orders will appear here." /></div>
      ) : (
        <div className="space-y-3 px-3 py-4">
          {shown.map((m) => <Bubble key={m.id} m={m} orders={orders} onAction={run}
            onOpen={() => m.orderId && orders.find((o) => o.id === m.orderId)?.customerId === customer.id && nav(`/customer/orders/${m.orderId}`)} />)}
        </div>
      )}
      {shareFor && <ShareLocationSheet addressId={shareFor} open onClose={() => setShareFor(null)} />}
    </Screen>
  );
}

function Bubble({ m, orders, onAction, onOpen }: { m: Message; orders: Order[]; onAction: (a: string) => void; onOpen: () => void }) {
  if (m.channel === 'voice') {
    return (
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-sky-700"><PhoneIncoming size={15} /> Meesho voice call (Vaani) <FeatureTag id={m.featureId} /></div>
        <p className="mt-1.5 text-[13px] italic text-ink-muted">{m.text}</p>
        <Buttons m={m} orders={orders} onAction={onAction} />
        <div className="mt-1 text-right text-[10px] text-ink-muted">{fmtDateTime(m.at)}</div>
      </div>
    );
  }
  if (m.channel === 'push') {
    return (
      <button onClick={onOpen} className="flex w-full items-start gap-2 rounded-xl bg-white/80 p-3 text-left shadow-sm">
        <Bell size={16} className="mt-0.5 shrink-0 text-brand" />
        <div className="flex-1">
          <div className="text-[13px]">{m.text}</div>
          <div className="mt-0.5 text-[10px] text-ink-muted">{fmtDateTime(m.at)}{m.orderId ? ` · Order #${m.orderId}` : ''}</div>
        </div>
      </button>
    );
  }
  return (
    <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-white p-3 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#128C7E]">Meesho Delivery ✓ <FeatureTag id={m.featureId} /></div>
      <p className="whitespace-pre-line text-[13px] leading-snug">{m.text}</p>
      {m.orderId && <button onClick={onOpen} className="mt-1 text-[11px] text-ink-muted underline">Order #{m.orderId}</button>}
      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink-muted">{fmtDateTime(m.at)} <CheckCheck size={12} className="text-sky-500" /></div>
      {m.link && (
        <div className="-mx-3 -mb-3 mt-2 border-t border-gray-100">
          {m.answered
            ? <div className="flex items-center justify-center gap-1 py-2 text-[13px] text-success"><Check size={14} /> {m.answered}</div>
            : <Link to={m.link.href} className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-[#0B84C6]"><MapPinned size={14} /> {m.link.label}</Link>}
        </div>
      )}
      <Buttons m={m} orders={orders} onAction={onAction} />
    </div>
  );
}

function Buttons({ m, orders, onAction }: { m: Message; orders: Order[]; onAction: (a: string) => void }) {
  if (m.buttons.length === 0) return null;
  return (
    <div className="-mx-3 -mb-3 mt-2 divide-y divide-gray-100 border-t border-gray-100">
      {m.answered && (
        <div className="flex items-center justify-center gap-1 bg-emerald-50/60 py-1.5 text-[12px] text-success"><Check size={13} /> You replied: {m.answered}</div>
      )}
      {m.buttons.map((b) => {
        const live = b.action.startsWith('share_location:') ? !m.answered : buttonLive(b.action, orders);
        return (
          <button key={b.action} disabled={!live} onClick={() => onAction(b.action)}
            className="block w-full py-2 text-center text-[13px] font-medium text-[#0B84C6] disabled:text-gray-300">
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
