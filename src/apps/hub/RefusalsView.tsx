import { useEffect, useState } from 'react';
import { itemsLabel } from '../../services/catalog';
import { useShallow } from 'zustand/react/shallow';
import { Camera, CalendarPlus, ClipboardCheck, Clock3, IndianRupee, PackageX, Repeat2, Send, Undo2 } from 'lucide-react';
import { useUi } from '../../store/ui';
import { LabelButton } from '../../components/ShippingLabel';
import { BONUS_PER_REDIRECT, redirectOf, HARD_CAP_DAYS, buyRedirect, enforceHoldCap, hubBonus, nearbyMatches, nudgeNext5, nudgeTop5, returnFromShelf, runQualityCheck } from '../../services/redirect';
import { useStore } from '../../store';
import type { Order } from '../../types';
import { fmtDate, fmtDateTime, rupees } from '../../lib/format';
import { RTO_AFTER_ATTEMPTS, failedAttempts, markRTO, reattemptTomorrow } from '../../services/openbox';
import { FeatureTag } from '../../components/FeatureTag';
import { Empty, Section } from './bits';

/** Hub → Refusals & RTO: open-box refusals, repeated failures, and what the orchestration layer saved. */
export function RefusalsView({ hubId, onOpen }: { hubId: string; onOpen: (id: string) => void }) {
  const orders = useStore(useShallow((s) => s.orders.filter((o) => o.hubId === hubId)));
  const events = useStore((s) => s.events);
  const customers = useStore((s) => s.customers);
  const productsAll = useStore((s) => s.products);
  const ids = new Set(orders.map((o) => o.id));
  useEffect(() => { enforceHoldCap(); }, []);
  const name = (o: Order) => customers.find((c) => c.id === o.customerId)?.name ?? '';

  const refused = orders.filter((o) => o.status === 'REFUSED_AFTER_INSPECTION');
  // Redirect Loop: RTO parcels only (never opened). Open-box refusals were opened, so they go back to the seller.
  const loop = orders.filter((o) => o.status === 'RTO').sort((a, b) => (b.rto?.at ?? '').localeCompare(a.rto?.at ?? ''));
  const failed = orders.filter((o) => o.status === 'ATTEMPT_FAILED').sort((a, b) => failedAttempts(b) - failedAttempts(a));
  const rto = orders.filter((o) => o.status === 'RTO');
  const count = (name: string) => events.filter((e) => e.name === name && e.orderId && ids.has(e.orderId)).length;

  const saved = [
    { label: 'Cancelled before the last mile', n: count('reverse_trip_avoided'), hint: 'Delay alert → free cancel' },
    { label: 'Rescheduled instead of failing', n: count('check_change') + count('not_home_tapped') + count('attempt_rescheduled'), hint: 'Home check, “I’m not home”, missed it' },
    { label: 'Parcels redirected', n: loop.filter((o) => redirectOf(o)?.state === 'sold').length, hint: 'Redirect Loop, no trip back to the seller' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {saved.map((x) => (
          <div key={x.label} className="card p-3" title={x.hint}>
            <div className="text-2xl font-bold text-success">{x.n}</div>
            <div className="text-xs text-ink-muted">{x.label}</div>
          </div>
        ))}
        <div className="card p-3"><div className="text-2xl font-bold">{refused.length}</div><div className="text-xs text-ink-muted">Returned at the door</div></div>
        <div className="card p-3"><div className="text-2xl font-bold text-danger">{rto.length}</div><div className="text-xs text-ink-muted">RTO taken</div></div>
        <div className="card p-3"><div className="flex items-center text-2xl font-bold text-brand"><IndianRupee size={20} />{hubBonus(hubId)}</div><div className="text-xs text-ink-muted">Hub bonus (₹{BONUS_PER_REDIRECT} per redirect)</div></div>
      </div>

      <Section n={1} title="RTO parcels → Redirect Loop" sub="Never opened: the seller's seal is still on. Check the packaging from the outside (don't open it). If local demand is High, offer it to nearby shoppers who saved this exact item for up to 3 days. First to pay gets it tomorrow; not sold → back to the seller." right={<FeatureTag id="R1" />}>
        {loop.length === 0 ? <Empty text="No RTO parcels. They appear here when you mark a failed delivery RTO (below)." /> : (
          <div className="space-y-2">{loop.map((o) => <RedirectCard key={o.id} o={o} onOpen={onOpen} />)}</div>
        )}
      </Section>

      <Section n={2} title="Open-box refusals → back to the seller" sub="Opened at the door and resealed in a tamper bag, so they can't be checked or resold. They go straight back to the seller." right={<FeatureTag id="C2-F3" />}>
        {refused.length === 0 ? <Empty text="No refusals. They appear here when a customer refuses during an open-box check." /> : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {refused.map((o) => {
              const r = o.refusal!;
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_5px,#e5e7eb_5px,#e5e7eb_10px)]" title="Item photo">
                    <Camera size={15} className="text-ink-muted" />
                  </span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(o.id)}>
                    <div className="truncate font-medium hover:text-brand">{customers.find((c) => c.id === o.customerId)?.name} · {itemsLabel(o, productsAll)}</div>
                    <div className="text-xs text-ink-muted">Refused: {r.reason}{r.damaged ? ' · damaged' : ''} · {fmtDateTime(r.at)}</div>
                  </button>
                  <span className="chip bg-gray-100 font-mono font-semibold">Tamper bag {r.sealId}</span>
                  {r.customerChoice === 'replacement' && <span className="chip bg-sky-50 text-sky-700">Customer ordered a replacement · #{r.replacementOrderId}</span>}
                  {r.customerChoice === 'closed' && <span className="chip bg-gray-100 text-ink-muted">Customer closed the order</span>}
                  <span className="chip bg-ink text-white"><Undo2 size={12} /> Returning to seller</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section n={3} title="Failed deliveries" sub={`Re-attempt tomorrow, or mark RTO once a parcel has failed ${RTO_AFTER_ATTEMPTS} times.`} right={<FeatureTag id="C2-F4" />}>
        {failed.length === 0 ? <Empty text="No failed deliveries." /> : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {failed.map((o) => {
              const n = failedAttempts(o);
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(o.id)}>
                    <div className="truncate font-medium hover:text-brand">{name(o)}</div>
                    <div className="text-xs text-ink-muted">{o.attempts.at(-1)?.reason} · {o.payment === 'COD' ? `COD ${rupees(o.total)}` : 'Prepaid'}</div>
                  </button>
                  <span className="flex items-center gap-1" title={`${n} failed attempts`}>
                    {Array.from({ length: RTO_AFTER_ATTEMPTS }, (_, k) => (
                      <span key={k} className={`h-2.5 w-2.5 rounded-full ${k < n ? 'bg-danger' : 'bg-gray-200'}`} />
                    ))}
                    <span className="ml-1 text-xs text-ink-muted">{n}/{RTO_AFTER_ATTEMPTS}</span>
                  </span>
                  <button className="btn-outline !py-1 text-xs" disabled={n >= RTO_AFTER_ATTEMPTS} onClick={() => reattemptTomorrow(o.id)}>
                    <CalendarPlus size={13} /> Re-attempt tomorrow
                  </button>
                  <button className="btn !py-1 text-xs text-white bg-danger" disabled={n < RTO_AFTER_ATTEMPTS} onClick={() => markRTO(o.id)}
                    title={n < RTO_AFTER_ATTEMPTS ? `Needs ${RTO_AFTER_ATTEMPTS} failed attempts` : 'Return to seller'}>
                    <PackageX size={13} /> Mark RTO
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

    </div>
  );
}

/** R1 Redirect Loop for one RTO parcel: packaging check → demand score → nudges → first to pay, or back to the seller. */
function RedirectCard({ o, onOpen }: { o: Order; onOpen: (id: string) => void }) {
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const allOrders = useStore((s) => s.orders);
  const showToast = useUi((s) => s.showToast);
  const r = o.refusal;
  const [qc, setQc] = useState({ sealIntact: true, labelMatches: true, boxUndamaged: true });
  const rd = redirectOf(o);
  const p = products.find((x) => x.id === o.items[0].productId)!;
  const name = (id?: string) => customers.find((c) => c.id === id)?.name ?? '';
  const matches = rd?.state === 'shelf' ? nearbyMatches(o.id) : [];
  const nudged = [...(rd?.nudged.top ?? []), ...(rd?.nudged.next ?? [])];
  const newOrder = rd?.newOrderId ? allOrders.find((x) => x.id === rd.newOrderId) : undefined;

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_5px,#e5e7eb_5px,#e5e7eb_10px)]" title="Item photo">
          <Camera size={15} className="text-ink-muted" />
        </span>
        <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(o.id)}>
          <div className="truncate font-medium hover:text-brand">{name(o.customerId)} · {itemsLabel(o, products)}</div>
          <div className="text-xs text-ink-muted">{r ? <>Refused: {r.reason}{r.damaged ? ' · damaged' : ''} · {fmtDateTime(r.at)}</> : <>RTO after {failedAttempts(o)} failed attempts · {o.rto?.reason} · {o.rto && fmtDateTime(o.rto.at)}</>}</div>
        </button>
        {r ? <span className="chip bg-gray-100 font-mono font-semibold">Seal {r.sealId}</span> : <span className="chip bg-red-50 font-semibold text-danger">RTO · original packaging</span>}
        {r?.customerChoice === 'replacement' && <span className="chip bg-sky-50 text-sky-700">Customer ordered a replacement · #{r.replacementOrderId}</span>}
        {r?.customerChoice === 'closed' && <span className="chip bg-gray-100 text-ink-muted">Customer closed the order</span>}
      </div>

      {(!rd || rd.state === 'qc') && (
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="mb-2 text-xs font-semibold">Packaging check at the hub · parcel stays sealed <FeatureTag id="R1" /></div>
          <div className="flex flex-wrap gap-4">
            {([['sealIntact', 'Seller seal intact?'], ['labelMatches', 'Label matches the order?'], ['boxUndamaged', 'Box undamaged (no dents, tears or water)?']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={qc[k]} onChange={(e) => setQc({ ...qc, [k]: e.target.checked })} /> {label}
              </label>
            ))}
            <button className="btn-primary ml-auto !py-1.5 text-xs" onClick={() => runQualityCheck(o.id, qc)}><ClipboardCheck size={14} /> Submit check</button>
          </div>
          <div className="mt-1.5 text-[11px] text-ink-muted">Check from the outside only; don’t open it. All three OK → scored for local demand. High → redirect shelf for up to 3 days. Anything else → back to the seller.</div>
        </div>
      )}

      {rd?.demand && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`chip !px-2.5 !py-1 font-semibold ${rd.demand.score === 'High' ? 'bg-emerald-50 text-success' : rd.demand.score === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-ink-muted'}`}>
            Demand Score: {rd.demand.score}
          </span>
          <span className="text-ink-muted">{rd.demand.inputs.cartsWishlists} nearby carts / wishlists · {rd.demand.inputs.searches7d} searches (7 days) · {rd.demand.inputs.sales30to90d} sales (30–90 days) · {rd.demand.inputs.season}</span>
        </div>
      )}

      {rd?.state === 'shelf' && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-light px-3 py-2 text-xs text-brand">
            <Clock3 size={14} /> On the redirect shelf until <b>{fmtDate(rd.holdUntil!)}</b> · hold window {rd.holdDays} day{rd.holdDays === 1 ? '' : 's'} for {p.category} (cap {HARD_CAP_DAYS} days)
            <button className="btn-ghost ml-auto !py-1 text-xs" onClick={() => returnFromShelf(o.id, `Not sold in ${rd.holdDays} days`)}><Undo2 size={13} /> Not sold in {rd.holdDays} days → return to seller</button>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
              Nearby shoppers with this exact item saved · sold at {rupees(p.price)} (listing price)
              <span className="ml-auto flex gap-1.5">
                <button className="btn-outline !py-1 text-xs" disabled={rd.nudged.top.length > 0}
                  onClick={() => showToast(`Nudged ${nudgeTop5(o.id).length} shoppers`)}><Send size={13} /> Nudge top 5</button>
                <button className="btn-outline !py-1 text-xs" disabled={rd.nudged.top.length === 0 || rd.nudged.next.length > 0}
                  onClick={() => showToast(`Nudged ${nudgeNext5(o.id).length} more shoppers`)}><Send size={13} /> Nudge next 5 (a few hours later)</button>
              </span>
            </div>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {matches.slice(0, 10).map((m, i) => {
                const wasNudged = nudged.includes(m.customer.id);
                return (
                  <div key={m.customer.id} className={`flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs ${m.recentRefusal ? 'opacity-50' : ''}`}>
                    <span className="w-5 text-ink-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{m.customer.name}{!m.customer.background && <span className="chip ml-1 bg-brand !text-[9px] text-white">Demo</span>}</span>
                    <span className="text-ink-muted">In {m.source} · added {m.addedDaysAgo}d ago · {m.revisits} revisits · {m.deliveries} deliveries</span>
                    {m.recentRefusal && <span className="chip bg-red-50 text-danger">Recent refusal · skipped</span>}
                    {m.nudgedThisWeek && !wasNudged && <span className="chip bg-gray-100 text-ink-muted">Nudged this week</span>}
                    {wasNudged && <span className="chip bg-emerald-50 text-success">Nudged{m.customer.whatsappOptIn ? ' · push + WhatsApp' : ' · push'}</span>}
                    {wasNudged && !m.customer.background && <span className="chip bg-brand-light text-brand">Demo account · buys from Messages on their phone</span>}
                    {wasNudged && m.customer.background && (
                      <button className="btn-primary !py-0.5 text-[11px]" onClick={() => { if (buyRedirect(o.id, m.customer.id)) showToast(`${m.customer.name} paid first · new order created`); }}>
                        Simulate: {m.customer.name.split(' ')[0]} pays first
                      </button>
                    )}
                  </div>
                );
              })}
              {matches.length === 0 && <div className="px-3 py-2 text-xs text-ink-muted">No nearby shoppers have this item saved.</div>}
            </div>
          </div>
        </>
      )}

      {rd?.state === 'sold' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-success">
          <Repeat2 size={14} /> Sold to <b>{name(rd.buyerId)}</b> for {rupees(rd.price ?? 0)} · new order #{rd.newOrderId} on tomorrow’s route · first order closed · +₹{BONUS_PER_REDIRECT} hub bonus
          {newOrder && <span className="ml-auto"><LabelButton order={newOrder} /></span>}
        </div>
      )}
      {rd?.state === 'returned' && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs text-ink-muted"><Undo2 size={14} /> Returning to the seller · {rd.returnReason}</div>
      )}
    </div>
  );
}
