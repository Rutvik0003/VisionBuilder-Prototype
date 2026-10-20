import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  BadgeCheck, Banknote, CalendarDays, Check, CircleCheck, Loader2, MapPin, PackageOpen, Plus,
  Smartphone, Truck, Wallet,
} from 'lucide-react';
import { useAddresses, useCurrentCustomer, useDeliverTo, useStore } from '../../store';
import type { Address, CheckoutStep, Payment, SlotLabel } from '../../types';
import { useUi } from '../../store/ui';
import { fmtDate, rupees } from '../../lib/format';
import { updateCheckout } from '../../services/cart';
import { SlotUnavailableError, UPI_DISCOUNT, lineItems, placeOrder, priceSummary, promisedDateFor } from '../../services/orders';
import { placeHold, releaseHold, slotDates } from '../../services/slots';
import { HoldTimer, SlotPicker } from './SlotPicker';
import { afterOrderPlaced } from '../../services/ivr';
import { useChildLockGate } from './ChildLock';
import { orderLockKey } from '../../services/childLock';
import { clusterInfo, openBoxEligible } from '../../services/catalog';
import { useT } from '../../lib/strings';
import { FeatureTag } from '../../components/FeatureTag';
import { ConfidenceBadge } from './Account';
import { PageHeader, ProductImage, Screen } from './ui';
import { PriceDetails } from './PriceDetails';

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: 'address', label: 'Address' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Summary' },
];

const STEP_TITLES: Record<CheckoutStep, string> = {
  address: 'Select Address',
  delivery: 'Delivery',
  payment: 'Payment Method',
  review: 'Order Summary',
};

function Stepper({ current, onJump }: { current: CheckoutStep; onJump: (s: CheckoutStep) => void }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex shrink-0 items-center bg-white px-4 pb-3 pt-1">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center last:flex-none">
          <button disabled={i > idx} onClick={() => onJump(s.id)} className="flex flex-col items-center gap-1 disabled:cursor-default">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition
              ${i < idx ? 'bg-brand text-white' : i === idx ? 'border-2 border-brand bg-white text-brand' : 'border-2 border-gray-300 bg-white text-gray-400'}`}>
              {i < idx ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-[10px] ${i <= idx ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{s.label}</span>
          </button>
          {i < STEPS.length - 1 && <span className={`mx-1 mb-4 h-0.5 flex-1 rounded ${i < idx ? 'bg-brand' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );
}

export function AddressCard({ a, selected, onSelect }: { a: Address; selected?: boolean; onSelect?: () => void }) {
  return (
    <button onClick={onSelect} disabled={!onSelect}
      className={`block w-full rounded-xl border bg-white p-3 text-left transition ${selected ? 'border-brand ring-1 ring-brand' : 'border-gray-200'}`}>
      <div className="flex items-start gap-2">
        {onSelect && (
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-brand' : 'border-gray-300'}`}>
            {selected && <span className="h-2 w-2 rounded-full bg-brand" />}
          </span>
        )}
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip bg-gray-100 font-semibold text-ink">{a.label}</span>
            <ConfidenceBadge a={a} />
          </div>
          <div className="mt-1 font-semibold">{a.name}</div>
          <div className="text-ink-muted">{a.line1}, {a.area}</div>
          <div className="text-ink-muted">{a.city}, {a.state} – {a.pincode}</div>
          {a.directions && <div className="mt-0.5 text-[12px] text-ink-muted">🧭 {a.directions}</div>}
          {!a.hubId && <div className="mt-1 text-[11px] text-amber-700">Outside the pilot area · standard delivery</div>}
        </div>
      </div>
    </button>
  );
}

function PayOption({ selected, onSelect, icon, title, sub, badge }: {
  selected: boolean; onSelect: () => void; icon: React.ReactNode; title: string; sub: string; badge?: string;
}) {
  return (
    <button onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition ${selected ? 'border-brand ring-1 ring-brand' : 'border-gray-200'}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">{icon}</span>
      <span className="flex-1">
        <span className="flex items-center gap-2 font-semibold">{title}
          {badge && <span className="chip bg-emerald-50 text-success">{badge}</span>}
        </span>
        <span className="block text-[12px] text-ink-muted">{sub}</span>
      </span>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${selected ? 'border-brand' : 'border-gray-300'}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
    </button>
  );
}

export function Checkout() {
  const draft = useStore((s) => s.checkout);
  const customer = useCurrentCustomer();
  const addresses = useAddresses(customer.id);
  const deliverTo = useDeliverTo(customer.id);
  const products = useStore((s) => s.products);
  const holds = useStore((s) => s.holds);
  const log = useStore((s) => s.log);
  const showToast = useUi((s) => s.showToast);
  const nav = useNavigate();
  const t = useT();
  const [placing, setPlacing] = useState(false);
  const [holdExpired, setHoldExpired] = useState(false);
  const { guard, gate } = useChildLockGate();

  // No saved address (e.g. a new user) → straight to Add Address, which returns here.
  const noAddress = !!draft && draft.customerId === customer.id && draft.step === 'address' && addresses.length === 0;
  useEffect(() => { if (noAddress) nav('/customer/addresses/new?return=checkout', { replace: true }); }, [noAddress, nav]);
  // Default the selection to the product page's "deliver to" address.
  useEffect(() => { if (draft && !draft.addressId && deliverTo) updateCheckout({ addressId: deliverTo.id }); }, [draft, deliverTo]);

  const address = draft ? addresses.find((a) => a.id === draft.addressId) : undefined;
  const promised = address ? promisedDateFor(address) : null;
  const pilot = !!address?.hubId;
  const slot = draft?.slot ?? (promised ? { date: promised, window: 'Any time' as SlotLabel } : undefined);

  // C1-F1 impression
  const stepShownFor = useRef<string | null>(null);
  useEffect(() => {
    if (draft?.step === 'delivery' && pilot && stepShownFor.current !== address!.id) {
      stepShownFor.current = address!.id;
      log('C1-F1', 'slot_step_shown', 'customer', { hubId: address!.hubId, promisedDate: promised });
    }
  }, [draft?.step, pilot, address?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft || draft.customerId !== customer.id) return <Navigate to="/customer/cart" replace />;

  const step = draft.step;
  const lines = lineItems(draft.items);
  // Open-box is offered on COD when a category allows it; it only applies if the customer switches it on.
  const openBoxAvailable = draft.payment === 'COD' && lines.some((l) => openBoxEligible(l.product, customer, address));
  const openBox = openBoxAvailable && !!draft.openBox;
  const bestPrice = lines.filter((l) => clusterInfo(l.product, products).isLowest);
  const summary = priceSummary(draft.items, draft.payment);
  const hold = holds.find((h) => h.id === draft.holdId && h.expiresAt > Date.now());
  const dates = promised ? slotDates(promised) : [];

  const go = (s: CheckoutStep) => updateCheckout({ step: s });

  // ---- slot handlers ----
  const setSlot = (date: string, window: SlotLabel) => {
    setHoldExpired(false);
    if (window === 'Any time' || !pilot) {
      releaseHold(draft.holdId);
      updateCheckout({ slot: { date, window }, holdId: undefined });
      return true;
    }
    const h = placeHold(address!.hubId!, date, window, draft.holdId);
    if (!h) {
      log('C1-F1', 'slot_full_seen', 'customer', { date, window });
      showToast(t('slotJustFilled'));
      return false;
    }
    updateCheckout({ slot: { date, window }, holdId: h.id });
    log('C1-F1', 'slot_selected', 'customer', { date, window });
    return true;
  };

  const pickDate = (date: string) => {
    // keep the window if it's still open that day, else fall back to Any time
    if (slot && slot.window !== 'Any time' && setSlot(date, slot.window)) return;
    setSlot(date, 'Any time');
  };

  const pickCashDay = (day?: string) => {
    updateCheckout({ deliverOnOrAfter: day });
    if (day && slot && slot.date < day) {
      if (!(slot.window !== 'Any time' && setSlot(day, slot.window))) setSlot(day, 'Any time');
      showToast(t('cashDayMoved', { date: fmtDate(day) }));
    }
  };

  const canContinue =
    step === 'address' ? !!address :
    step === 'payment' ? !!draft.payment : true;

  const next = async () => {
    if (step === 'address') {
      if (!draft.slot || draft.slot.date < promised!) updateCheckout({ slot: { date: promised!, window: 'Any time' } });
      go('delivery');
    } else if (step === 'delivery') go('payment');
    else if (step === 'payment') go('review');
    else guard(() => { void placeNow(); }, orderLockKey(lines.map((l) => ({ productId: l.product.id, size: l.size })))); // child lock: PIN first; a lockout blocks only this order
  };

  const placeNow = async () => {
    {
      setPlacing(true);
      try {
        const orders = await placeOrder({
          customerId: customer.id, items: draft.items, address: address!, payment: draft.payment!, fromCart: draft.source === 'cart',
          slot, holdId: draft.holdId, deliverOnOrAfter: draft.deliverOnOrAfter, openBox,
        });
        afterOrderPlaced(orders.map((o) => o.id)); // one confirmation for the whole checkout
        nav(`/customer/order-placed/${orders[0].id}`, { replace: true });
      } catch (e) {
        setPlacing(false);
        if (e instanceof SlotUnavailableError) {
          showToast(t('slotJustFilled'));
          updateCheckout({ step: 'delivery', slot: { date: slot!.date, window: 'Any time' }, holdId: undefined });
        } else throw e;
      }
    }
  };

  const back = () => {
    const i = STEPS.findIndex((s) => s.id === step);
    if (i === 0) nav(-1); else go(STEPS[i - 1].id);
  };

  const slotLine = slot ? `${fmtDate(slot.date)} · ${slot.window === 'Any time' ? 'Any time' : slot.window}` : '';

  return (
    <Screen
      header={
        <div className="shrink-0 bg-white shadow-sm">
          <PageHeader title={STEP_TITLES[step]} onBack={back} />
          <Stepper current={step} onJump={go} />
        </div>
      }
      footer={
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-white p-3">
          <div>
            <div className="text-lg font-bold">{rupees(summary.total)}</div>
            <div className="text-[11px] text-ink-muted">Order total</div>
          </div>
          <button className="btn-primary min-w-40 !py-3" disabled={!canContinue || placing} onClick={next}>
            {placing ? <><Loader2 size={16} className="animate-spin" /> Placing…</> : step === 'review' ? 'Place Order' : 'Continue'}
          </button>
        </div>
      }
    >
      <div className="space-y-2 py-2">
        {step === 'address' && (
          <section className="space-y-2 px-3">
            <div className="flex items-center justify-between pt-1">
              <div className="text-sm font-semibold">Delivery address</div>
              <Link to="/customer/addresses/new?return=checkout" className="flex items-center gap-1 text-sm font-semibold text-brand"><Plus size={15} /> Add new</Link>
            </div>
            {addresses.map((a) => (
              <AddressCard key={a.id} a={a} selected={a.id === draft.addressId} onSelect={() => {
                if (a.id === draft.addressId) return;
                releaseHold(draft.holdId); // a different address may be a different hub
                updateCheckout({ addressId: a.id, slot: undefined, holdId: undefined });
              }} />
            ))}
          </section>
        )}

        {step === 'delivery' && promised && slot && (
          pilot ? (
            <>
              <section className="space-y-4 bg-white px-4 py-4">
                <div>
                  <div className="flex items-center gap-2 text-[16px] font-bold">{t('slotTitle')} <FeatureTag id="C1-F1" /></div>
                  <div className="text-[12px] text-ink-muted">{t('slotSub')}</div>
                </div>
                <SlotPicker hubId={address!.hubId!} dates={dates} value={slot} ignoreHoldId={draft.holdId} resetOnFull={false}
                  onPickDate={pickDate} onPickWindow={(w) => setSlot(slot.date, w)}
                  onFull={(date, window) => { log('C1-F1', 'slot_full_seen', 'customer', { date, window }); showToast(`${window} is full on ${fmtDate(date)}`); }} />
                {hold && <HoldTimer key={hold.id} expiresAt={hold.expiresAt} onExpire={() => {
                  releaseHold(hold.id); updateCheckout({ holdId: undefined }); setHoldExpired(true);
                  log('C1-F1', 'slot_expired', 'system', { date: hold.date, window: hold.window });
                }} />}
                {holdExpired && !hold && <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{t('slotExpired')}</div>}
              </section>

            </>
          ) : (
            <section className="mx-3 rounded-xl bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Truck size={17} className="text-success" /> Standard delivery via partner · FREE</div>
              <div className="mt-1 text-[13px] text-ink-muted">{t('slotNotPilot', { date: fmtDate(promised) })}</div>
              <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-ink-muted">Choosing a time slot, open-box, live tracking and changing the time are <b>Valmo only</b>. Our partner still asks “Will you be home?” before delivery. <FeatureTag id="X1" /></div>
            </section>
          )
        )}

        {step === 'payment' && (
          <section className="space-y-2 px-3">
            <div className="pt-1 text-sm font-semibold">Select payment method</div>
            <PayOption selected={draft.payment === 'COD'} onSelect={() => updateCheckout({ payment: 'COD' as Payment })}
              icon={<Banknote size={19} />} title="Cash on Delivery" sub="Pay by cash or UPI when your order arrives" />
            <PayOption selected={draft.payment === 'UPI'} onSelect={() => updateCheckout({ payment: 'UPI' as Payment })}
              icon={<Smartphone size={19} />} title="Pay online (UPI)" sub="GPay, PhonePe, Paytm & more" badge={`Save ${rupees(UPI_DISCOUNT)}`} />

            {draft.payment === 'COD' && promised && (
              <div className="rounded-xl bg-white p-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold"><Wallet size={16} className="text-brand" /> {t('cashDayTitle')} <FeatureTag id="C1-F1" /></div>
                <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                  <button onClick={() => pickCashDay(undefined)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-[12px] ${!draft.deliverOnOrAfter ? 'border-brand bg-brand-light font-semibold text-brand' : 'border-gray-300'}`}>
                    {t('cashDayAny')}
                  </button>
                  {slotDates(promised, 5).map((d) => (
                    <button key={d} onClick={() => pickCashDay(d)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-[12px] ${draft.deliverOnOrAfter === d ? 'border-brand bg-brand-light font-semibold text-brand' : 'border-gray-300'}`}>
                      {dayjs(d).format('ddd D')}
                    </button>
                  ))}
                </div>
                {draft.deliverOnOrAfter && <div className="mt-1.5 text-[11px] text-ink-muted">We’ll deliver on or after {fmtDate(draft.deliverOnOrAfter)}.</div>}
              </div>
            )}

            {draft.payment === 'COD' && address && !address.hubId && lines.some((l) => l.product.openBoxCategory) && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3 text-[12px] text-ink-muted">{t('openBoxOpt')}: <b>Valmo only</b>. Not available for this address. <FeatureTag id="X1" /></div>
            )}
            {openBoxAvailable && (
              <button onClick={() => {
                  updateCheckout({ openBox: !draft.openBox });
                  log('C2-F3', draft.openBox ? 'openbox_opted_out' : 'openbox_opted_in', 'customer', {});
                }}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-[13px] transition ${draft.openBox ? 'border-brand bg-brand-light/60 ring-1 ring-brand' : 'border-gray-200 bg-white'}`}>
                <PackageOpen size={18} className="mt-0.5 shrink-0 text-brand" />
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-semibold">{t('openBoxOpt')} <FeatureTag id="C2-F3" /></span>
                  <span className="block text-[12px] text-ink-muted">{t('openBoxOptSub')}</span>
                </span>
                <span className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${draft.openBox ? 'bg-brand' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${draft.openBox ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
            )}
          </section>
        )}

        {step === 'review' && address && promised && slot && (
          <>
            <section className="bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold"><MapPin size={15} className="text-brand" /> Delivering to</div>
                <button className="text-xs font-semibold text-brand" onClick={() => go('address')}>Change</button>
              </div>
              <div className="mt-1 text-[13px] text-ink-muted">{address.label} · {address.name} · {address.line1}, {address.area}, {address.city} – {address.pincode}</div>
            </section>
            <section className="bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold"><CalendarDays size={15} className="text-brand" /> {pilot ? slotLine : `Arriving by ${fmtDate(promised)}`}</div>
                {pilot && <button className="text-xs font-semibold text-brand" onClick={() => go('delivery')}>Change</button>}
              </div>
              {hold && <div className="mt-1 text-[11px] text-success">Slot held for you</div>}
              {draft.payment === 'COD' && draft.deliverOnOrAfter && <div className="mt-0.5 text-[12px] text-ink-muted">Cash ready from {fmtDate(draft.deliverOnOrAfter)}</div>}
            </section>
            {bestPrice.length > 0 && (
              <section className="flex items-center gap-2 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-success">
                <BadgeCheck size={16} /> {t('bestPrice')} <FeatureTag id="C3-F1" />
              </section>
            )}
            {new Set(lines.map((l) => l.product.sellerId)).size > 1 && (
              <section className="flex items-start gap-2 bg-sky-50 px-4 py-2.5 text-[13px] text-sky-900">
                <Truck size={16} className="mt-0.5 shrink-0" />
                <span>These items are from {new Set(lines.map((l) => l.product.sellerId)).size} sellers, so they come as {new Set(lines.map((l) => l.product.sellerId)).size} parcels, together on the same day. You confirm them once.</span>
              </section>
            )}
            {openBox && (
              <section className="flex items-center gap-2 bg-brand-light/60 px-4 py-2.5 text-[13px] text-brand">
                <PackageOpen size={16} /> Open-box delivery on this order <FeatureTag id="C2-F3" />
              </section>
            )}
            <section className="bg-white px-4 py-3">
              {lines.map((l) => (
                <div key={l.productId} className="mt-2 flex items-center gap-3 first:mt-0">
                  <ProductImage product={l.product} className="h-16 w-14 rounded-md" emojiSize="text-2xl" />
                  <div className="min-w-0 flex-1 text-[13px]">
                    <div className="truncate">{l.product.title}</div>
                    <div className="text-ink-muted">{l.product.sellerName} · Qty {l.qty}{l.size ? ` · ${l.size}` : ''}</div>
                    <div className="font-semibold">{rupees(l.product.price * l.qty)}</div>
                  </div>
                </div>
              ))}
            </section>
            <section className="flex items-center justify-between bg-white px-4 py-3 text-sm">
              <span className="flex items-center gap-1.5 font-semibold"><CircleCheck size={15} className="text-success" /> {draft.payment === 'COD' ? 'Cash on Delivery' : 'UPI'}</span>
              <button className="text-xs font-semibold text-brand" onClick={() => go('payment')}>Change</button>
            </section>
            <PriceDetails items={draft.items} payment={draft.payment} />
          </>
        )}
      </div>
      {gate}
    </Screen>
  );
}
