import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useShallow } from 'zustand/react/shallow';
import {
  Bike, Building2, ChevronRight, CircleCheck, Lock, MapPin, PhoneCall, Route, ScanLine, Undo2, X,
} from 'lucide-react';
import { useStore } from '../../store';
import type { Order, RunId } from '../../types';
import { fmtDate, fmtDateTime, rupees } from '../../lib/format';
import { hubAccept, markNoReply, releaseHold } from '../../services/flow';
import { ringVaani } from '../../services/ivr';
import { CONFIDENCE_BADGE, sendRemotePinLink } from '../../services/addresses';
import { REASON_LABEL, ACTION_LABEL, rescueAction } from '../../services/rescue';
import { RUNS, RUN_CUTOFF, RUN_WINDOW, hubDates, isLocked, planRun, runCandidates, runKey } from '../../services/routing';
import { pendingStops, resolveDispute } from '../../services/delivery';
import { reattemptTomorrow } from '../../services/openbox';
import { DesktopShell } from '../../components/DesktopShell';
import { FeatureTag } from '../../components/FeatureTag';
import { LabelButton } from '../../components/ShippingLabel';
import { RiskTab } from './RiskTab';
import { RunPlanner } from './RunPlanner';
import { RefusalsView } from './RefusalsView';
import { Empty, HOME_CHIP, HomeChip, RiskDot, Section, nextAction, slotShort } from './bits';

type View = 'inbound' | 'replies' | 'held' | 'routes' | 'live' | 'disputes' | 'returns' | 'risk';

export function HubPicker() {
  const { hubs, orders } = useStore();
  return (
    <DesktopShell title="Hub Manager" sub="Pick your last-mile hub" back="/" wide={false}>
      <div className="grid gap-3 sm:grid-cols-2">
        {hubs.map((h) => {
          const incoming = orders.filter((o) => o.hubId === h.id && o.status === 'AT_HUB').length;
          return (
            <Link key={h.id} to={`/hub/${h.id}`} className="card flex items-center gap-3 p-4 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light text-brand"><Building2 size={21} /></span>
              <span className="flex-1">
                <span className="block font-semibold">{h.name}</span>
                <span className="text-xs text-ink-muted">{h.tier} · pincodes {h.pincodes.join(', ')}</span>
              </span>
              {incoming > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{incoming} inbound</span>}
            </Link>
          );
        })}
      </div>
    </DesktopShell>
  );
}

const heldSince = (o: Order) => [...o.timeline].reverse().find((t) => t.status === 'HELD')?.at ?? o.createdAt;
const heldDays = (o: Order) => dayjs().diff(dayjs(heldSince(o)), 'day');
const isAddressNotFound = (o: Order) => o.status === 'ATTEMPT_FAILED' && o.attempts.at(-1)?.reason === 'Address not found';

export function HubConsole() {
  const { hubId } = useParams();
  const hubs = useStore((s) => s.hubs);
  const hub = hubs.find((h) => h.id === hubId) ?? hubs[0];
  const orders = useStore(useShallow((s) => s.orders.filter((o) => o.hubId === hub.id)));
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) ?? 'inbound';
  const [drawer, setDrawer] = useState<string | null>(null);
  const go = (v: View) => setParams(v === 'inbound' ? {} : { view: v });

  const tabs: { id: View; label: string; n?: number }[] = [
    { id: 'inbound', label: 'Inbound', n: orders.filter((o) => o.status === 'AT_HUB').length },
    { id: 'replies', label: 'Replies', n: orders.filter((o) => ['ACCEPTED', 'PLANNED'].includes(o.status) && o.homeCheck === 'awaiting').length },
    { id: 'held', label: 'Held', n: orders.filter((o) => o.status === 'HELD').length },
    { id: 'routes', label: 'Routes' },
    { id: 'live', label: 'Live' },
    { id: 'disputes', label: 'Disputes', n: orders.filter((o) => o.attempts.some((a) => a.dispute === 'open') || isAddressNotFound(o)).length },
    { id: 'returns', label: 'Returns / Redirect', n: orders.filter((o) => (o.status === 'REFUSED_AFTER_INSPECTION' && ['qc', 'shelf'].includes(o.refusal?.redirect?.state ?? 'qc')) || o.status === 'ATTEMPT_FAILED').length },
    { id: 'risk', label: 'Risk' },
  ];

  return (
    <DesktopShell title={hub.name} sub={`Hub Manager · ${hub.tier}`} back="/hub">
      <nav className="no-scrollbar -mt-2 mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((x) => (
          <button key={x.id} onClick={() => go(x.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${view === x.id ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {x.label}{!!x.n && <span className={`rounded-full px-1.5 text-[11px] font-bold ${view === x.id ? 'bg-brand text-white' : 'bg-red-100 text-danger'}`}>{x.n}</span>}
          </button>
        ))}
      </nav>

      {view === 'inbound' && <InboundView orders={orders} onOpen={setDrawer} />}
      {view === 'replies' && <RepliesView hubId={hub.id} onOpen={setDrawer} />}
      {view === 'held' && <HeldView orders={orders} onOpen={setDrawer} />}
      {view === 'routes' && <RoutesView hubId={hub.id} onOpen={setDrawer} />}
      {view === 'live' && <LiveView hubId={hub.id} />}
      {view === 'disputes' && <DisputesView orders={orders} onOpen={setDrawer} />}
      {view === 'returns' && <RefusalsView hubId={hub.id} onOpen={setDrawer} />}
      {view === 'risk' && <section className="card p-4"><RiskTab hub={hub} /></section>}

      {drawer && <OrderDrawer orderId={drawer} onClose={() => setDrawer(null)} />}
    </DesktopShell>
  );
}

// ================================================================= shared date picker (Replies, Routes)

function useHubDate(hubId: string) {
  const state = useStore(useShallow((s) => ({ orders: s.orders, runs: s.runs, plans: s.plans })));
  const [params, setParams] = useSearchParams();
  const dates = hubDates(state as Parameters<typeof hubDates>[0], hubId);
  const date = params.get('date') ?? dates[0] ?? dayjs().add(1, 'day').format('YYYY-MM-DD');
  const picker = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-ink-muted">Delivery date</span>
      {(dates.length ? dates : [date]).map((d) => (
        <button key={d} onClick={() => setParams({ view: params.get('view') ?? 'inbound', date: d })}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${d === date ? 'bg-ink text-white' : 'bg-white shadow-sm hover:bg-gray-50'}`}>
          {fmtDate(d)}
        </button>
      ))}
    </div>
  );
  return { date, picker };
}

// ================================================================= tabs

function InboundView({ orders, onOpen }: { orders: Order[]; onOpen: (id: string) => void }) {
  const incoming = orders.filter((o) => o.status === 'AT_HUB');
  const onTheWay = orders.filter((o) => ['SHIPPED', 'IN_TRANSIT', 'DELAYED_IN_TRANSIT'].includes(o.status));
  return (
    <div className="space-y-4">
      <Section title="Inbound parcels" sub="Scanning a parcel in sends the customer “Will you be home?” on WhatsApp straight away." right={<FeatureTag id="C1-F2" />}>
        {incoming.length > 0 && (
          <div className="mb-3 flex justify-end">
            <button className="btn-primary" onClick={() => hubAccept(incoming.map((o) => o.id))}><ScanLine size={16} /> Scan in all ({incoming.length})</button>
          </div>
        )}
        {incoming.length === 0
          ? <Empty text="Nothing waiting. Parcels appear here when Seller & Transit marks them “Reached hub”." />
          : <OrderTable rows={incoming} onOpen={onOpen} action={(o) => <button className="btn-outline !py-1 text-xs" onClick={() => hubAccept([o.id])}><ScanLine size={13} /> Scan in</button>} />}
      </Section>
      {onTheWay.length > 0 && (
        <Section title="On the way to this hub" sub="Shipped by the seller, not here yet.">
          <OrderTable rows={onTheWay} onOpen={onOpen} action={(o) => <span className="text-xs text-ink-muted">{o.status === 'DELAYED_IN_TRANSIT' ? 'Delayed' : o.status === 'SHIPPED' ? 'Shipped' : 'In transit'}</span>} />
        </Section>
      )}
    </div>
  );
}

function RepliesView({ hubId, onOpen }: { hubId: string; onOpen: (id: string) => void }) {
  const { date, picker } = useHubDate(hubId);
  const orders = useStore(useShallow((s) => s.orders.filter((o) => o.hubId === hubId)));
  const dayOrders = orders.filter((o) => o.slot.date === date && ['ACCEPTED', 'HELD', 'PLANNED'].includes(o.status));
  // Riskiest first: that's who the hub should chase before the cut-off.
  const chase = dayOrders.filter((o) => ['ACCEPTED', 'PLANNED'].includes(o.status) && (o.homeCheck === 'awaiting' || o.homeCheck === 'no_reply'))
    .sort((a, b) => b.rescue.pRto - a.rescue.pRto);
  const count = (h: Order['homeCheck']) => dayOrders.filter((o) => o.homeCheck === h).length;
  return (
    <div>
      {picker}
      <Section title={`“Will you be home?” replies for ${fmtDate(date)}`}
        sub={<>Riskiest first, so chase from the top. No reply never cancels: a picked window still goes in that run; <b>Any time + no reply → Afternoon run</b>.</>}
        right={<FeatureTag id="C1-F2" />}>
        <div className="mb-3 flex flex-wrap gap-2">
          {(['yes', 'change_requested', 'awaiting', 'no_reply'] as const).map((h) => (
            <span key={h} className={`chip !px-3 !py-1 text-sm ${HOME_CHIP[h].tone}`}>{HOME_CHIP[h].text} · {count(h)}</span>
          ))}
        </div>
        {chase.length === 0
          ? <div className="text-sm text-ink-muted">Everyone for this date has replied.</div>
          : <OrderTable rows={chase} onOpen={onOpen} action={(o) => o.homeCheck === 'awaiting'
              ? <button className="btn-ghost !py-1 text-xs" onClick={() => { markNoReply(o.id); ringVaani(o.id); }}><PhoneCall size={13} /> Trigger automated call</button>
              : <span className="text-[11px] text-ink-muted">Automated call placed</span>} />}
      </Section>
    </div>
  );
}

function HeldView({ orders, onOpen }: { orders: Order[]; onOpen: (id: string) => void }) {
  const customers = useStore((s) => s.customers);
  const rows = orders.filter((o) => o.status === 'HELD').sort((a, b) => a.slot.date.localeCompare(b.slot.date));
  return (
    <Section title="Held parcels" sub="They rejoin automatically when the run for their release date is planned. Held more than 3 days → escalate." right={<FeatureTag id="C1-F2" />}>
      {rows.length === 0 ? <Empty text="No parcels on hold." /> : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-ink-muted">
              <tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Release date</th><th className="px-3 py-2">Held</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((o) => {
                const age = heldDays(o);
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2"><button className="font-medium hover:text-brand" onClick={() => onOpen(o.id)}>{customers.find((c) => c.id === o.customerId)?.name}</button>
                      <div className="font-mono text-[11px] text-ink-muted">#{o.id}</div></td>
                    <td className="px-3 py-2 text-xs">{o.homeCheck === 'change_requested' ? 'Customer (asked for a new day)' : 'Hub'}</td>
                    <td className="px-3 py-2">{fmtDate(o.slot.date)} · {o.slot.window}</td>
                    <td className="px-3 py-2">
                      <span className={age > 3 ? 'font-semibold text-danger' : 'text-ink-muted'}>{age === 0 ? 'Since today' : `${age} day${age === 1 ? '' : 's'}`}</span>
                      {age > 3 && <span className="chip ml-2 bg-red-100 text-danger">Escalate</span>}
                    </td>
                    <td className="px-3 py-2 text-right"><button className="btn-ghost !py-1 text-xs" onClick={() => releaseHold(o.id)}>Release now</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function RoutesView({ hubId, onOpen }: { hubId: string; onOpen: (id: string) => void }) {
  const state = useStore(useShallow((s) => ({ orders: s.orders, runs: s.runs, plans: s.plans, riders: s.riders, hubs: s.hubs, customers: s.customers })));
  const hub = state.hubs.find((h) => h.id === hubId)!;
  const orders = state.orders.filter((o) => o.hubId === hubId);
  const { date, picker } = useHubDate(hubId);
  const [openRun, setOpenRun] = useState<RunId | null>(null);
  return (
    <div>
      {picker}
      <Section title="Delivery runs" sub="Plan each run before its cut-off, then lock & publish to riders. Leftovers carry to the next run." right={<FeatureTag id="C3-F3" />}>
        <div className="grid gap-3 md:grid-cols-3">
          {RUNS.map((run) => {
            const key = runKey(hubId, date, run);
            const locked = isLocked(state, hubId, date, run);
            const plan = state.plans[key];
            const { orders: cand, carry } = runCandidates(state, hubId, date, run);
            const published = orders.filter((o) => o.route?.date === date && o.route.run === run);
            const heldBack = cand.filter((o) => o.status === 'HELD').length;
            return (
              <div key={run} className={`rounded-xl border p-3 ${openRun === run ? 'border-brand ring-1 ring-brand' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{run}</span>
                  <span className="text-xs text-ink-muted">{RUN_WINDOW[run].split(' ')[1]}</span>
                  <span className="ml-auto text-[11px] text-ink-muted">cut-off {RUN_CUTOFF[run]}</span>
                </div>
                {locked ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-success"><Lock size={14} /> Locked · {published.length} stops published</div>
                ) : (
                  <div className="mt-2 text-sm">
                    <b>{cand.length}</b> parcel{cand.length === 1 ? '' : 's'}
                    <span className="text-ink-muted">
                      {' '}· {cand.filter((o) => o.homeCheck === 'yes' || o.homeCheck === 'change_requested').length} confirmed
                      {carry.length > 0 && ` · ${carry.length} carried over`}
                      {heldBack > 0 && ` · ${heldBack} returning from hold`}
                    </span>
                  </div>
                )}
                {!locked && (
                  <div className="mt-3 flex gap-2">
                    {plan
                      ? <button className="btn-outline flex-1 !py-1.5 text-xs" onClick={() => setOpenRun(openRun === run ? null : run)}>{openRun === run ? 'Hide plan' : 'View plan'}</button>
                      : <button className="btn-primary flex-1 !py-1.5 text-xs" disabled={cand.length === 0}
                          onClick={() => { planRun(hubId, date, run); setOpenRun(run); }}><Route size={14} /> Plan {run.toLowerCase()} run</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {openRun && state.plans[runKey(hubId, date, openRun)] && (
          <div className="mt-3"><RunPlanner hub={hub} plan={state.plans[runKey(hubId, date, openRun)]!} onOpen={onOpen} /></div>
        )}
      </Section>
    </div>
  );
}

function LiveView({ hubId }: { hubId: string }) {
  const state = useStore(useShallow((s) => ({ orders: s.orders, riders: s.riders, customers: s.customers, runs: s.runs, plans: s.plans })));
  const riders = state.riders.filter((r) => r.hubId === hubId);
  return (
    <Section title="Riders live" sub="Progress once a rider starts the route. Open a rider to see their stops." right={<FeatureTag id="C3-F3" />}>
      <div className="grid gap-2 md:grid-cols-3">
        {riders.map((r) => {
          const pending = pendingStops(state as Parameters<typeof pendingStops>[0], r.id);
          const mine = [...new Set(r.routeOrderIds)].map((id) => state.orders.find((o) => o.id === id)!).filter((o) => o?.route?.riderId === r.id);
          const done = mine.filter((o) => o.visit?.outcome === 'delivered').length;
          const failed = mine.filter((o) => o.visit?.outcome === 'failed').length;
          const current = pending.find((o) => o.status !== 'PLANNED');
          const currentName = current ? state.customers.find((c) => c.id === current.customerId)?.name : null;
          return (
            <Link key={r.id} to={`/rider/${r.id}`} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
              <Bike size={18} className={r.started ? 'text-success' : 'text-ink-muted'} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.name}</div>
                <div className="truncate text-xs text-ink-muted">
                  {mine.length === 0 ? 'No stops yet' : current ? `Heading to ${currentName}` : pending.length ? `${pending.length} stops · run not started` : 'All runs complete'}
                </div>
              </div>
              {mine.length > 0 && <span className="text-xs text-ink-muted">✓{done} {failed > 0 && <span className="text-danger">✗{failed}</span>} · {pending.length} left</span>}
              <ChevronRight size={15} className="text-ink-muted" />
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

// ================================================================= compact table + drawer

function OrderTable({ rows, onOpen, action }: { rows: Order[]; onOpen: (id: string) => void; action?: (o: Order) => React.ReactNode }) {
  const customers = useStore((s) => s.customers);
  const addresses = useStore((s) => s.addresses);
  return (
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
      {rows.map((o) => {
        const c = customers.find((x) => x.id === o.customerId)!;
        const a = addresses.find((x) => x.id === o.addressId)!;
        return (
          <div key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50">
            <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(o.id)}>
              <span className="block truncate font-medium hover:text-brand">
                {c.name}{!c.background && <span className="chip ml-1 bg-brand !text-[9px] text-white">Demo</span>}
              </span>
              <span className="block truncate text-xs text-ink-muted">{a.area}, {a.pincode}</span>
            </button>
            <span className="hidden w-44 shrink-0 truncate text-xs text-ink-muted sm:block">{slotShort(o)}</span>
            <span className="w-28 shrink-0"><HomeChip o={o} /></span>
            <span className="hidden w-44 shrink-0 md:block"><RiskDot o={o} /></span>
            <span className="flex w-36 shrink-0 justify-end">{action?.(o)}</span>
          </div>
        );
      })}
    </div>
  );
}

function OrderDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const o = useStore((s) => s.orders.find((x) => x.id === orderId)!);
  const c = useStore((s) => s.customers.find((x) => x.id === o.customerId)!);
  const a = useStore((s) => s.addresses.find((x) => x.id === o.addressId)!);
  const products = useStore((s) => s.products);
  const rider = useStore((s) => s.riders.find((r) => r.id === o.route?.riderId));
  const badge = CONFIDENCE_BADGE[a.confidence];
  const r = o.rescue;
  return (
    <>
      <div className="fixed inset-0 z-[600] bg-black/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-[601] flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <div className="flex-1">
            <div className="font-semibold">{c.name}</div>
            <div className="font-mono text-xs text-ink-muted">#{o.id} · {o.status.replace(/_/g, ' ').toLowerCase()}</div>
          </div>
          <button className="rounded-full p-1.5 hover:bg-gray-100" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <Block title="Delivery">
            <Row k="Slot" v={slotShort(o)} />
            <Row k="Home check" v={<HomeChip o={o} />} />
            <Row k="Payment" v={o.payment === 'COD' ? `COD ${rupees(o.total)}` : `Prepaid ${rupees(o.total)}`} />
            {o.openBox && <Row k="Open-box" v="Yes" />}
            {o.needBy && <Row k="Needed by" v={fmtDate(o.needBy)} />}
            {o.deliverOnOrAfter && <Row k="Cash ready from" v={fmtDate(o.deliverOnOrAfter)} />}
            {rider && o.route && <Row k="Rider" v={`${rider.name} · ${o.route.run} run · stop ${o.route.seq}`} />}
            {o.refusal && <Row k="Refused at door" v={`${o.refusal.reason} · seal ${o.refusal.sealId}${o.refusal.redirectEligible ? ' · Redirect eligible' : ''}`} />}
            {o.rto && <Row k="RTO" v={o.rto.reason} />}
          </Block>
          <Block title="Address">
            <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 text-brand" />
              <div>{a.line1}, {a.area}, {a.city} – {a.pincode}
                {a.directions && <div className="text-xs text-ink-muted">🧭 {a.directions}</div>}</div>
            </div>
            <span className={`chip mt-1 ${badge.tone}`}>{a.confidence} · {badge.text(a)}</span>
          </Block>
          <Block title="Items">
            {o.items.map((it) => <div key={it.productId}>{products.find((p) => p.id === it.productId)?.title} × {it.qty}</div>)}
          </Block>
          <Block title="Rescue engine (hub only)">
            <Row k="p(RTO)" v={`${r.pRto.toFixed(2)} · ${r.band}`} />
            <Row k="Top reason" v={REASON_LABEL[r.topReason]} />
            <Row k="Next best action" v={<b>{nextAction(o)}</b>} />
            <Row k="Policy action" v={ACTION_LABEL[rescueAction(r, o.openBox)]} />
            {r.holdout && <Row k="Holdout" v="Yes (10% control group)" />}
          </Block>
          {o.attempts.length > 0 && (
            <Block title="Attempts">
              {o.attempts.map((t, i) => (
                <div key={i} className="text-xs">{fmtDateTime(t.at)} · {t.result}{t.reason ? ` · ${t.reason}` : ''} · calls {t.callsMade}{t.doorMessageSent ? ' · door msg' : ''}{t.dispute ? ` · dispute ${t.dispute}` : ''}</div>
              ))}
            </Block>
          )}
          <Block title="Timeline">
            {[...o.timeline].reverse().map((t, i) => (
              <div key={i} className="flex gap-2 text-xs"><span className="w-32 shrink-0 text-ink-muted">{fmtDateTime(t.at)}</span><span>{t.note}</span></div>
            ))}
          </Block>
        </div>
        <footer className="flex gap-2 border-t border-gray-100 p-3">
          {o.status === 'AT_HUB' && <button className="btn-primary flex-1" onClick={() => hubAccept([o.id])}><CircleCheck size={15} /> Scan in</button>}
          {['ACCEPTED', 'PLANNED'].includes(o.status) && o.homeCheck === 'awaiting' && <button className="btn-outline flex-1" onClick={() => { markNoReply(o.id); ringVaani(o.id); }}><PhoneCall size={15} /> Trigger automated call</button>}
          {r.topReason === 'address' && a.confidence !== 'L3' && !['DELIVERED', 'CANCELLED', 'RTO'].includes(o.status) && (
            <button className="btn-outline flex-1" onClick={() => { sendRemotePinLink(a.id); }}><MapPin size={15} /> Send pin request</button>
          )}
          {o.status === 'HELD' && <button className="btn-outline flex-1" onClick={() => releaseHold(o.id)}><Undo2 size={15} /> Release now</button>}
          <LabelButton order={o} />
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </footer>
      </aside>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><span className="text-ink-muted">{k}</span><span className="text-right">{v}</span></div>;
}

// ================================================================= disputes

function DisputesView({ orders, onOpen }: { orders: Order[]; onOpen: (id: string) => void }) {
  const rows = orders.filter((o) => o.attempts.some((a) => a.dispute));
  const notFound = orders.filter(isAddressNotFound);
  const riders = useStore((s) => s.riders);
  const customers = useStore((s) => s.customers);
  const addresses = useStore((s) => s.addresses);
  return (
    <div className="space-y-4">
      <Section title="“No one came” disputes" sub="Evidence from the rider app. There is never an automatic penalty." right={<FeatureTag id="C2-F4" />}>
        {rows.length === 0 ? <Empty text="No disputes." /> : (
          <div className="space-y-2">
            {rows.map((o) => {
              const att = [...o.attempts].reverse().find((a) => a.dispute)!;
              const rider = riders.find((r) => r.id === att.riderId);
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(o.id)}>
                    <div className="font-medium">{customers.find((c) => c.id === o.customerId)?.name} <span className="font-mono text-xs text-ink-muted">#{o.id}</span></div>
                    <div className="text-xs text-ink-muted">{rider?.name} · {fmtDateTime(att.at)} · {att.reason}</div>
                  </button>
                  <div className="flex gap-1.5 text-xs">
                    <Evidence ok={att.arrived} text="Arrived (geofence)" />
                    <Evidence ok={att.callsMade >= 2} text={`${att.callsMade} calls`} />
                    <Evidence ok={att.doorMessageSent} text="Door message" />
                  </div>
                  {att.dispute === 'open' ? (
                    <div className="flex gap-1.5">
                      <button className="btn-outline !py-1 text-xs" onClick={() => resolveDispute(o.id, true)}>Customer is right</button>
                      <button className="btn-ghost !py-1 text-xs" onClick={() => resolveDispute(o.id, false)}>Rider is right</button>
                    </div>
                  ) : <span className="chip bg-gray-100">{att.dispute === 'valid' ? 'Resolved · customer right' : 'Resolved · rider right'}</span>}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="“Address not found” for review" sub="Rider was at the pin and tried to reach the customer. Ask the customer to drop a fresh pin, then re-attempt." right={<FeatureTag id="C2-F1" />}>
        {notFound.length === 0 ? <Empty text="No “Address not found” attempts." /> : (
          <div className="space-y-2">
            {notFound.map((o) => {
              const att = o.attempts.at(-1)!;
              const a = addresses.find((x) => x.id === o.addressId)!;
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(o.id)}>
                    <div className="font-medium">{customers.find((c) => c.id === o.customerId)?.name} <span className="font-mono text-xs text-ink-muted">#{o.id}</span></div>
                    <div className="text-xs text-ink-muted">{riders.find((r) => r.id === att.riderId)?.name} · {fmtDateTime(att.at)} · {a.area}, {a.pincode} · {a.confidence}</div>
                  </button>
                  <div className="flex gap-1.5 text-xs">
                    <Evidence ok={att.arrived} text="Arrived (geofence)" />
                    <Evidence ok={att.callsMade >= 2 || att.doorMessageSent} text={`${att.callsMade} calls${att.doorMessageSent ? ' · door msg' : ''}`} />
                  </div>
                  <button className="btn-outline !py-1 text-xs" onClick={() => sendRemotePinLink(a.id)}><MapPin size={13} /> Send pin request</button>
                  <button className="btn-ghost !py-1 text-xs" onClick={() => reattemptTomorrow(o.id)}>Re-attempt tomorrow</button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Evidence({ ok, text }: { ok: boolean; text: string }) {
  return <span className={`chip ${ok ? 'bg-emerald-50 text-success' : 'bg-red-50 text-danger'}`}>{ok ? '✓' : '✗'} {text}</span>;
}
