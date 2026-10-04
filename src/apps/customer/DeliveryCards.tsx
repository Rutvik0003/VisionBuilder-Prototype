import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Bike, Check, Crosshair, MessageSquare, PackageOpen, Phone, PhoneOff, RefreshCw, TriangleAlert, UserX } from 'lucide-react';
import { pinFromGps } from '../../services/addresses';
import { useChildLockGate } from './ChildLock';
import { orderLockKey } from '../../services/childLock';
import { useNavigate } from 'react-router-dom';
import { rupees } from '../../lib/format';
import { closeRefusedOrder, orderReplacement } from '../../services/openbox';
import { sizesFor } from './ProductPage';
import { useStore } from '../../store';
import { useUi } from '../../store/ui';
import type { Order, SlotLabel } from '../../types';
import { useT } from '../../lib/strings';
import { useNow } from '../../lib/time';
import { PinMap, RIDER_PIN } from '../../components/PinMap';
import { FeatureTag } from '../../components/FeatureTag';
import {
  attemptMissed, customerCallsRider, customerMessagesRider, customerNotHome, disputeAttempt, etaRange, pendingStops, riderPosition, stopsAway,
} from '../../services/delivery';
import { deliveryPoint } from '../../services/routing';
import { SlotPicker } from './SlotPicker';
import { ProductImage, Sheet } from './ui';

/** C1-F3 live tracking (OUT_FOR_DELIVERY / ARRIVING_SOON). */
export function TrackingCard({ order, onCall, onMessage, onNotHome }: { order: Order; onCall: () => void; onMessage: () => void; onNotHome: () => void }) {
  const t = useT();
  useNow(60_000); // T3.2: location + ETA refresh every 60 s (simulated)
  const state = useStore();
  const rider = state.riders.find((r) => r.id === order.route?.riderId);
  const address = state.addresses.find((a) => a.id === order.addressId)!;
  const away = stopsAway(state, order);
  const total = rider ? pendingStops(state, rider.id).length : 0;
  const [a, b] = etaRange(Math.max(0, away));
  const soon = order.status === 'ARRIVING_SOON';
  useEffect(() => { state.log('C1-F3', 'map_opened', 'customer', {}, order.id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="mx-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-success/30">
      <div className="flex items-start gap-3 bg-emerald-50 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-white"><Bike size={17} /></span>
        <div className="flex-1">
          <div className="text-[14px] font-semibold leading-snug">{soon ? t('trackSoon') : t('trackTitle', { a, b })}</div>
          <div className="text-[12px] text-ink-muted">
            {away === 0 ? t('trackNext') : t('trackStop', { k: away + 1, n: total })} · {rider?.name} · {t('trackUpdated')}
          </div>
        </div>
        <FeatureTag id="C1-F3" />
      </div>
      {rider && <PinMap value={deliveryPoint(address)} height={170} zoom={14} connect extra={[{ point: riderPosition(state, rider.id), icon: RIDER_PIN }]} />}
      {order.deliveryOtp && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-[12px]">
          <span className="text-ink-muted">Delivery OTP</span>
          <span className="font-mono text-base font-bold tracking-[0.3em] text-brand">{order.deliveryOtp}</span>
          <span className="ml-auto text-[11px] text-ink-muted">Share only at the door</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 p-3">
        <button className="btn-outline !px-1 !py-2 text-xs" onClick={onCall}><Phone size={14} /> {t('callRider')}</button>
        <button className="btn-outline !px-1 !py-2 text-xs" onClick={onMessage}><MessageSquare size={14} /> {t('messageRider')}</button>
        <button className="btn border border-gray-300 !px-1 !py-2 text-xs text-ink" onClick={onNotHome}><UserX size={14} /> {t('notHome')}</button>
      </div>
    </section>
  );
}

/** C1-F4 masked call. */
export function CallSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const rider = useStore((s) => s.riders.find((r) => r.id === order.route?.riderId));
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!open) return;
    customerCallsRider(order.id);
    setConnected(false);
    const id = setTimeout(() => setConnected(true), 1400);
    return () => clearTimeout(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onClose={onClose} title={t('callRider')}>
      <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
        <span className={`flex h-20 w-20 items-center justify-center rounded-full ${connected ? 'bg-success' : 'animate-pulse bg-brand'} text-white`}><Phone size={32} /></span>
        <div className="mt-3 text-lg font-semibold">{rider?.name ?? 'Rider'}</div>
        <div className="text-sm text-ink-muted">{connected ? 'Connected' : t('callingTitle') + '…'}</div>
        <div className="mt-2 rounded-full bg-gray-100 px-3 py-1 text-[11px] text-ink-muted">{t('callingSub')} <FeatureTag id="C1-F4" /></div>
        <button className="btn mt-6 bg-danger !px-6 !py-3 text-white" onClick={onClose}><PhoneOff size={16} /> {t('endCall')}</button>
      </div>
    </Sheet>
  );
}

/** C1-F4 quick-reply message to the rider. */
export function MessageSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const replies = [t('quick1'), t('quick2'), t('quick3')];
  const [text, setText] = useState('');
  const send = (msg: string) => {
    if (!msg.trim()) return;
    customerMessagesRider(order.id, msg.trim());
    setText('');
    showToast('Sent to rider');
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('messageRider')}>
      <div className="space-y-2 p-4">
        {/* conversation, oldest first */}
        {(order.chat ?? []).map((m, i) => (
          <div key={i} className={`w-fit max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.from === 'customer' ? 'ml-auto rounded-tr-sm bg-brand-light' : 'rounded-tl-sm bg-gray-100'}`}>
            {m.text}
          </div>
        ))}
        <div className="pt-2 text-[12px] text-ink-muted">Quick replies <FeatureTag id="C1-F4" /></div>
        <div className="flex flex-wrap gap-1.5">
          {replies.map((r) => (
            <button key={r} className="chip border border-brand/40 bg-white !px-3 !py-1.5 text-brand hover:bg-brand-light" onClick={() => send(r)}>{r}</button>
          ))}
        </div>
        <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder={t('msgPlaceholder')}
            className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-brand" />
          <button type="submit" className="btn-primary !rounded-full !px-4" disabled={!text.trim()}>Send</button>
        </form>
        <div className="text-[11px] text-ink-muted">{t('callingSub')}</div>
      </div>
    </Sheet>
  );
}

function NewSlotSheet({ order, open, onClose, title, sub, onConfirm }: {
  order: Order; open: boolean; onClose: () => void; title: string; sub?: string; onConfirm: (date: string, window: SlotLabel) => void;
}) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const from = dayjs(order.slot.date).isAfter(dayjs(), 'day') ? dayjs(order.slot.date).add(1, 'day') : dayjs().add(1, 'day');
  const dates = Array.from({ length: 4 }, (_, i) => from.add(i, 'day').format('YYYY-MM-DD'));
  const [date, setDate] = useState(dates[0]);
  const [window, setWindow] = useState<SlotLabel>('Any time');
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4 p-4">
        {sub && <p className="text-[13px] text-ink-muted">{sub}</p>}
        {order.hubId && (
          <SlotPicker hubId={order.hubId} dates={dates} value={{ date, window }} onPickDate={setDate} onPickWindow={setWindow}
            onFull={(d, w) => showToast(`${w} is full on ${dayjs(d).format('ddd, D MMM')}`)} />
        )}
        <button className="btn-primary w-full !py-3" onClick={() => { onConfirm(date, window); onClose(); }}>{t('confirmNewTime')}</button>
      </div>
    </Sheet>
  );
}

export function NotHomeSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  return (
    <NewSlotSheet order={order} open={open} onClose={onClose} title={t('notHomeTitle')} sub={t('notHomeSub')}
      onConfirm={(d, w) => { customerNotHome(order.id, d, w); showToast(t('hcRescheduled', { when: dayjs(d).format('ddd, D MMM') })); }} />
  );
}

export function MissedSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  return (
    <NewSlotSheet order={order} open={open} onClose={onClose} title={t('attemptMissed')}
      onConfirm={(d, w) => { attemptMissed(order.id, d, w); showToast(t('hcRescheduled', { when: dayjs(d).format('ddd, D MMM') })); }} />
  );
}

/** C2-F4 attempt notice. */
export function AttemptCard({ order, onMissed }: { order: Order; onMissed: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const last = order.attempts.at(-1);
  if (!last) return null;
  return (
    <section className="mx-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-danger/30">
      <div className="flex items-start gap-3 bg-red-50 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger text-white"><TriangleAlert size={17} /></span>
        <div className="flex-1 text-[14px] font-semibold leading-snug">{t('attemptMsg', { time: dayjs(last.at).format('h:mm A') })}</div>
        <FeatureTag id="C2-F4" />
      </div>
      <div className="grid grid-cols-1 gap-2 p-3">
        <button className="btn-primary !py-2.5" onClick={onMissed}><Check size={15} /> {t('attemptMissed')}</button>
        <button className="btn-outline !py-2.5" onClick={() => { disputeAttempt(order.id); showToast(t('attemptHereDone')); }}>{t('attemptHere')}</button>
      </div>
    </section>
  );
}

/** Terminal: returned at the door after open-box inspection (C2-F3), or returned to the seller (RTO). */
export function ReturnedCard({ order, onReplace }: { order: Order; onReplace: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const nav = useNavigate();
  const refused = order.status === 'REFUSED_AFTER_INSPECTION';
  const r = order.refusal;
  return (
    <section className="mx-3 overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex gap-3 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-ink-muted"><UserX size={17} /></span>
        <div className="flex-1">
          <div className="text-sm font-semibold">{refused ? t('refusedTitle') : t('rtoTitle')}</div>
          <div className="text-[12px] text-ink-muted">{refused ? t('refusedSub', { reason: r?.reason ?? '' }) : t('rtoSub')}</div>
        </div>
        <FeatureTag id={refused ? 'C2-F3' : 'C2-F4'} />
      </div>

      {refused && r && !r.customerChoice && (
        <div className="grid grid-cols-1 gap-2 border-t border-gray-100 p-3">
          <button className="btn-primary !py-2.5" onClick={onReplace}>
            <RefreshCw size={15} /> {t(r.reason === 'Changed mind' ? 'orderAgain' : 'getCorrectItem')}
          </button>
          <button className="btn-outline !py-2.5" onClick={() => { closeRefusedOrder(order.id); showToast(t('closedLine')); }}>
            {t('closeOrder')}
          </button>
        </div>
      )}
      {r?.customerChoice === 'replacement' && r.replacementOrderId && (
        <button className="flex w-full items-center gap-2 border-t border-gray-100 bg-emerald-50 px-3 py-2.5 text-left text-[13px] font-medium text-success"
          onClick={() => nav(`/customer/orders/${r.replacementOrderId}`)}>
          <Check size={15} /> {t('replacedLine')} · #{r.replacementOrderId} <span className="ml-auto">View →</span>
        </button>
      )}
      {r?.customerChoice === 'closed' && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5 text-[13px] text-ink-muted">{t('closedLine')}</div>
      )}
    </section>
  );
}

/** Pick the size (fashion) and place a linked replacement order. */
export function ReplacementSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const product = useStore((s) => s.products.find((p) => p.id === order.items[0].productId)!);
  const sizes = sizesFor(product);
  const current = order.items[0].size;
  const [size, setSize] = useState<string | undefined>(current);
  const [busy, setBusy] = useState(false);
  const { guard, gate } = useChildLockGate();
  const sizeProblem = order.refusal?.reason === 'Wrong size label';
  return (
    <Sheet open={open} onClose={onClose} title={t(order.refusal?.reason === 'Changed mind' ? 'orderAgain' : 'replaceTitle')}>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <ProductImage product={product} className="h-16 w-14 rounded-md" emojiSize="text-2xl" />
          <div className="min-w-0 flex-1 text-[13px]">
            <div className="truncate font-medium">{product.title}</div>
            <div className="text-ink-muted">{product.sellerName}</div>
            <div className="font-semibold">{rupees(order.items[0].price * order.items[0].qty)}</div>
          </div>
        </div>
        {sizes && sizes.length > 1 && (
          <div>
            <div className="mb-1.5 text-[13px] font-semibold">{sizeProblem ? 'Pick the size you need' : 'Size'}</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((sz) => (
                <button key={sz} onClick={() => setSize(sz)}
                  className={`min-w-12 rounded-full border px-3 py-1.5 text-sm ${size === sz ? 'border-brand bg-brand-light font-semibold text-brand' : 'border-gray-300'}`}>
                  {sz}{sz === current ? ' (last time)' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="rounded-lg bg-brand-light/50 p-3 text-[12px] text-ink-muted"><PackageOpen size={13} className="mr-1 inline text-brand" />{t('replaceSub')}</p>
        <button className="btn-primary w-full !py-3" disabled={busy} onClick={() => guard(async () => {
          setBusy(true);
          const fresh = await orderReplacement(order.id, size);
          setBusy(false);
          onClose();
          if (fresh) nav(`/customer/orders/${fresh.id}`);
        }, orderLockKey([{ productId: order.items[0].productId, size }]))}>
          {busy ? 'Placing…' : t('replaceBtn')}
        </button>
        {gate}
      </div>
    </Sheet>
  );
}

/** C2-F1 follow-up: approximate address → share the phone's GPS location in one tap (after a permission prompt). */
export function ShareLocationSheet({ addressId, open, onClose }: { addressId: string; open: boolean; onClose: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const address = useStore((s) => s.addresses.find((a) => a.id === addressId));
  if (!address) return null;
  return (
    <Sheet open={open} onClose={onClose} title={t('shareLocTitle')}>
      <div className="space-y-4 p-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand"><Crosshair size={26} /></span>
        <p className="text-sm">{t('shareLocAsk')}</p>
        <p className="text-[12px] text-ink-muted">{address.label} · {address.line1}, {address.area}, {address.pincode}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline !py-3" onClick={onClose}>{t('shareLocDeny')}</button>
          <button className="btn-primary !py-3" onClick={() => { const d = pinFromGps(addressId); showToast(t('shareLocDone', { digipin: d })); onClose(); }}>{t('shareLocAllow')}</button>
        </div>
      </div>
    </Sheet>
  );
}

export function LocationNudge({ addressId, onShare }: { addressId: string; onShare: () => void }) {
  const t = useT();
  return (
    <section className="mx-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <Crosshair size={18} className="shrink-0 text-amber-600" />
      <div className="flex-1 text-[12px] leading-snug text-amber-900">{t('shareLocNudge')} <FeatureTag id="C2-F1" /></div>
      <button className="btn shrink-0 bg-brand !px-3 !py-1.5 text-xs text-white" onClick={onShare} data-address={addressId}>{t('shareLocBtn')}</button>
    </section>
  );
}
