import { useState } from 'react';
import dayjs from 'dayjs';
import { Bike, CalendarClock, CheckCircle2, Clock3, Hourglass, MapPinned, PackageOpen, Store, Warehouse } from 'lucide-react';
import { useStore } from '../../store';
import { useUi } from '../../store/ui';
import type { Order, SlotLabel } from '../../types';
import { fmtDate, rupees } from '../../lib/format';
import { useT } from '../../lib/strings';
import { FeatureTag } from '../../components/FeatureTag';
import {
  acceptDelay, addDirections, canCancelFree, canChangeTime, cancelForFree, changeDayTime, deliveryWhen, homeYes, payNow, rescheduleAfterDelay, rescheduleDates,
} from '../../services/flow';
import { UPI_DISCOUNT } from '../../services/orders';
import { Sheet } from './ui';

import { SlotPicker } from './SlotPicker';

function Card({ icon, tone = 'brand', children, tag }: { icon: React.ReactNode; tone?: 'brand' | 'success' | 'warning'; children: React.ReactNode; tag?: string }) {
  const tones = { brand: 'bg-brand-light text-brand', success: 'bg-emerald-50 text-success', warning: 'bg-amber-50 text-amber-600' };
  return (
    <section className="mx-3 rounded-xl bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>{icon}</span>
        <div className="min-w-0 flex-1">{children}</div>
        {tag && <FeatureTag id={tag} />}
      </div>
    </section>
  );
}

export function WithSellerCard() {
  return (
    <Card icon={<Store size={17} />}>
      <div className="text-sm font-semibold">Your order is with the seller</div>
      <div className="text-[12px] text-ink-muted">It’s being packed and shipped to your local delivery hub.</div>
    </Card>
  );
}

export function AtHubCard({ order }: { order: Order }) {
  const hub = useStore((s) => s.hubs.find((h) => h.id === order.hubId));
  return (
    <Card icon={<Warehouse size={17} />}>
      <div className="text-sm font-semibold">Reached {hub?.name ?? 'your local hub'}</div>
      <div className="text-[12px] text-ink-muted">Being sorted for delivery. We’ll check with you before it goes out.</div>
    </Card>
  );
}

/** C1-F2 — sent the moment the hub accepts the parcel. */
export function HomeCheckCard({ order, onChange, onDirections }: { order: Order; onChange: () => void; onDirections: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const when = deliveryWhen(order);
  return (
    <section className="mx-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-brand/30">
      <div className="flex items-start gap-3 bg-brand-light/60 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><CalendarClock size={17} /></span>
        <div className="flex-1 text-[14px] font-semibold leading-snug">{t('hcTitle', { when })}</div>
        <FeatureTag id="C1-F2" />
      </div>
      <div className="space-y-2 p-3">
        <button className="btn-primary w-full !py-2.5" onClick={() => { homeYes([order.id]); showToast(t('hcConfirmed', { when })); }}>
          {t('hcYes')}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline !py-2" disabled={!canChangeTime(order)} onClick={onChange}>{t('hcChange')}</button>
          <button className="btn-outline !py-2" onClick={onDirections}>{t('hcDirections')}</button>
        </div>
        {order.payment === 'COD' && <CashRow order={order} />}
      </div>
    </section>
  );
}

function CashRow({ order }: { order: Order }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2.5">
      <span className="flex-1 text-[12px] leading-snug text-ink-muted">{t('hcCash', { amount: rupees(order.total) })}</span>
      <button className="btn shrink-0 border border-success !px-2.5 !py-1.5 text-xs text-success hover:bg-emerald-50"
        onClick={() => { payNow(order.id); showToast(t('paidNow', { amount: rupees(order.total - UPI_DISCOUNT) })); }}>
        {t('hcPayNow')} · {rupees(order.total - UPI_DISCOUNT)}
      </button>
    </div>
  );
}

export function ConfirmedCard({ order, onChange }: { order: Order; onChange: () => void }) {
  const t = useT();
  return (
    <Card icon={<CheckCircle2 size={17} />} tone="success" tag="C1-F2">
      <div className="text-sm font-semibold">{t('hcConfirmed', { when: deliveryWhen(order) })}</div>
      {order.payment === 'COD'
        ? <div className="mt-2"><CashRow order={order} /></div>
        : <div className="text-[12px] text-ink-muted">Paid online. Nothing to pay at delivery.</div>}
      {canChangeTime(order) && <button className="mt-1.5 text-[13px] font-semibold text-brand" onClick={onChange}>{t('hcChange')}</button>}
    </Card>
  );
}

export function HeldCard({ order, onChange }: { order: Order; onChange: () => void }) {
  const t = useT();
  return (
    <Card icon={<Clock3 size={17} />} tone="warning" tag="C1-F2">
      <div className="text-sm font-semibold">{t('hcRescheduled', { when: deliveryWhen(order) })}</div>
      {canChangeTime(order) && <button className="mt-1.5 text-[13px] font-semibold text-brand" onClick={onChange}>{t('hcChange')}</button>}
    </Card>
  );
}

export function OpenBoxInfo() {
  return (
    <Card icon={<PackageOpen size={17} />} tag="C2-F3">
      <div className="text-sm font-semibold">Open-box delivery</div>
      <div className="text-[12px] text-ink-muted">You can check colour, design and size label before paying. No trying on.</div>
    </Card>
  );
}

// ---------------------------------------------------------------- sheets

export function ChangeDaySheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const dates = rescheduleDates(order);
  const [date, setDate] = useState(order.slot.date === order.promisedDate ? dates[1] : order.slot.date);
  const [window, setWindow] = useState<SlotLabel>(order.slot.window);

  return (
    <Sheet open={open} onClose={onClose} title={t('hcChange')}>
      <div className="space-y-4 p-4">
        {!canChangeTime(order) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This order can’t be rescheduled any more.</p>}
        <div className="text-[12px] text-ink-muted">{t('pickDay')}</div>
        <SlotPicker hubId={order.hubId!} dates={dates} value={{ date, window }}
          onPickDate={(d) => setDate(d)} onPickWindow={(w) => setWindow(w)}
          onFull={(d, w) => showToast(`${w} is full on ${dayjs(d).format('ddd, D MMM')}`)} />
        <button className="btn-primary w-full !py-3"
          disabled={!canChangeTime(order) || (date === order.slot.date && window === order.slot.window)} onClick={() => {
            if (!changeDayTime(order.id, date, window)) { showToast(t('slotJustFilled')); return; }
            showToast(t('hcRescheduled', { when: `${dayjs(date).format('ddd, D MMM')}${window !== 'Any time' ? `, ${window}` : ''}` }));
            onClose();
          }}>{t('confirmNewTime')}</button>
      </div>
    </Sheet>
  );
}

export function DirectionsSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const current = useStore((s) => s.addresses.find((a) => a.id === order.addressId)?.directions ?? '');
  const [text, setText] = useState(current);
  const chips = ['Blue gate', 'Shop front', '2nd floor', 'Call at the gate'];
  return (
    <Sheet open={open} onClose={onClose} title={t('directionsLabel')}>
      <div className="space-y-3 p-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t('dirPlaceholder')}
          className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-brand" />
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} onClick={() => setText(text ? `${text}, ${c}` : c)} className="chip bg-gray-100 !px-2.5 !py-1 hover:bg-brand-light">
              <MapPinned size={11} /> {c}
            </button>
          ))}
        </div>
        <button className="btn-primary w-full !py-3" disabled={!text.trim()} onClick={() => {
          addDirections(order.id, text.trim()); showToast(t('hcDirectionsSaved')); onClose();
        }}>{t('dirSave')}</button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- C1-F5 delay

export function DelayCard({ order, onPick, onCancel }: { order: Order; onPick: () => void; onCancel: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  if (!order.delay) return null;
  const { oldDate, newDate } = order.delay;
  const freeCancel = canCancelFree(order); // T4.4: only before the seller ships
  return (
    <section className="mx-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-amber-300">
      <div className="flex items-start gap-3 bg-amber-50 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"><Hourglass size={17} /></span>
        <div className="flex-1">
          <div className="text-[14px] font-semibold">{t('delayTitle')}</div>
          <div className="text-[13px] text-ink-muted">{t('delayMessage', { newDate: fmtDate(newDate), oldDate: fmtDate(oldDate) })}</div>
        </div>
        <FeatureTag id="C1-F5" />
      </div>
      <div className="space-y-2 p-3">
        <button className="btn-primary w-full !py-2.5"
          onClick={() => { acceptDelay(order.id); showToast(t('hcConfirmed', { when: fmtDate(newDate) })); }}>
          {t('delayOk', { day: dayjs(newDate).format('ddd') })}
        </button>
        <div className={`grid gap-2 ${freeCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button className="btn-outline !py-2" onClick={onPick}>{t('delayPick')}</button>
          {freeCancel && (
            <button className="btn border border-danger !py-2 text-danger" onClick={onCancel}>
              {t('delayCancel')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function DelayPickSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const start = order.delay?.newDate ?? order.slot.date;
  const dates = Array.from({ length: 4 }, (_, i) => dayjs(start).add(i, 'day').format('YYYY-MM-DD'));
  const [date, setDate] = useState(start);
  const [window, setWindow] = useState<SlotLabel>(order.slot.window);
  return (
    <Sheet open={open} onClose={onClose} title={t('delayPick')}>
      <div className="space-y-4 p-4">
        {order.hubId ? (
          <SlotPicker hubId={order.hubId} dates={dates} value={{ date, window }} onPickDate={setDate} onPickWindow={setWindow}
            onFull={(d, w) => showToast(`${w} is full on ${dayjs(d).format('ddd, D MMM')}`)} />
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {dates.map((d) => (
              <button key={d} onClick={() => setDate(d)} className={`rounded-lg border py-2 text-center text-sm ${date === d ? 'border-brand bg-brand-light text-brand' : 'border-gray-200'}`}>
                {dayjs(d).format('ddd D')}
              </button>
            ))}
          </div>
        )}
        <button className="btn-primary w-full !py-3" onClick={() => {
          if (!rescheduleAfterDelay(order.id, date, window)) { showToast(t('slotJustFilled')); return; }
          showToast(t('hcRescheduled', { when: dayjs(date).format('ddd, D MMM') }));
          onClose();
        }}>{t('confirmNewTime')}</button>
      </div>
    </Sheet>
  );
}

export function CancelFreeSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  return (
    <Sheet open={open} onClose={onClose} title={t('delayCancel')}>
      <div className="space-y-4 p-4">
        <p className="text-sm text-ink-muted">{t('delayCancelConfirm')}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline !py-3" onClick={onClose}>{t('keepOrder')}</button>
          <button className="btn bg-danger !py-3 text-white" disabled={!canCancelFree(order)}
            onClick={() => { cancelForFree(order.id); showToast(t('delayCancelled')); onClose(); }}>{t('delayCancel')}</button>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- planned (rider assigned)

export function PlannedCard({ order }: { order: Order }) {
  const t = useT();
  const rider = useStore((s) => s.riders.find((r) => r.id === order.route?.riderId));
  return (
    <Card icon={<Bike size={17} />} tone="success" tag="C3-F3">
      <div className="text-sm font-semibold">{t('plannedTitle', { rider: rider?.name ?? 'Our rider', when: deliveryWhen(order) })}</div>
      <div className="text-[12px] text-ink-muted">{t('plannedSub')}</div>
    </Card>
  );
}
