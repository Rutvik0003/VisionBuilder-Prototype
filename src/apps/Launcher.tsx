import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Bike, Building2, LineChart, RotateCcw, Tag, Truck, UserPlus, UserRound } from 'lucide-react';
import { useStore } from '../store';
import type { AccountId } from '../types';
import { Wordmark } from '../components/Wordmark';

const FLOW = [
  'Customer places an order',
  'Seller & Transit: Seller ships → In transit → Reached hub',
  'Hub Manager: Scan in (sends “Will you be home?”)',
  'Customer replies',
  'Hub plans routes → Rider delivers',
];

export function Launcher() {
  const { orders, hubs, riders, showTags, setShowTags, setAccount, resetDemo } = useStore();
  const customers = useStore((s) => s.customers).filter((c) => !c.background);
  const nav = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [riderOpen, setRiderOpen] = useState(false);
  const withSeller = orders.filter((o) => ['PLACED', 'SHIPPED', 'IN_TRANSIT', 'DELAYED_IN_TRANSIT'].includes(o.status)).length;
  const incoming = orders.filter((o) => o.status === 'AT_HUB').length;

  const openCustomer = (id: AccountId) => { setAccount(id); nav('/customer'); };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Wordmark size="text-3xl" />
      <h1 className="mt-3 text-2xl font-semibold">Delivery orchestration prototype</h1>
      <p className="mt-1 max-w-2xl text-ink-muted">
        Pick who you are. Every step happens when someone presses a button in one of these apps; nothing moves on its own.
      </p>

      <Section title="Customer">
        {customers.map((c) => {
          const existing = c.id === 'existing';
          return (
            <Tile key={c.id} onClick={() => openCustomer(c.id as AccountId)} icon={existing ? <UserRound size={22} /> : <UserPlus size={22} />}
              title={existing ? 'Existing User' : 'New User'} sub={`${c.name} · ${c.blurb}`} />
          );
        })}
      </Section>

      <Section title="Operations">
        <Tile onClick={() => nav('/transit')} icon={<Truck size={22} />} title="Seller & Transit"
          sub="Ship, move to the hub, or report a delay" badge={withSeller} />
        <div className="relative">
          <Tile onClick={() => setHubOpen(!hubOpen)} icon={<Building2 size={22} />} title="Hub Manager"
            sub="Scan in parcels, follow up, plan routes" badge={incoming} />
          {hubOpen && <Picker items={hubs.map((h) => ({ to: `/hub/${h.id}`, label: h.name, sub: `${h.tier} · ${h.pincodes.join(', ')}` }))} />}
        </div>
        <div className="relative">
          <Tile onClick={() => setRiderOpen(!riderOpen)} icon={<Bike size={22} />} title="Rider" sub="Run the route stop by stop" />
          {riderOpen && <Picker items={riders.map((r) => ({ to: `/rider/${r.id}`, label: r.name, sub: hubs.find((h) => h.id === r.hubId)!.name }))} />}
        </div>
        <Tile onClick={() => nav('/ops')} icon={<LineChart size={22} />} title="Network Ops" sub="PeakPromise festive forecast" />
        <Tile onClick={() => nav('/log')} icon={<Activity size={22} />} title="Activity Log" sub="Every feature event, with feature ID" />
      </Section>

      <Section title="How an order moves">
        <ol className="col-span-full flex flex-wrap items-center gap-2 text-sm">
          {FLOW.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span>{f}
              </span>
              {i < FLOW.length - 1 && <span className="text-ink-muted">→</span>}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Settings">
        <div className="card col-span-full flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} />
            <Tag size={15} className="text-brand" /> Show feature tags
            <span className="text-xs text-ink-muted">(e.g. C1-F2 next to each feature)</span>
          </label>
          {!confirmReset ? (
            <button className="btn ml-auto border border-danger text-danger hover:bg-red-50" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={15} /> Reset demo
            </button>
          ) : (
            <div className="ml-auto flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm">
              <span>Reset all orders, addresses, messages and the log?</span>
              <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn bg-danger text-white" onClick={() => { resetDemo(); setConfirmReset(false); }}>Reset</button>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Tile({ icon, title, sub, onClick, badge }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className="card group relative flex w-full items-start gap-3 p-4 text-left transition hover:shadow-md">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold group-hover:text-brand">{title}</span>
        <span className="block text-xs text-ink-muted">{sub}</span>
      </span>
      {!!badge && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{badge}</span>}
    </button>
  );
}

function Picker({ items }: { items: { to: string; label: string; sub: string }[] }) {
  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="block px-4 py-2.5 hover:bg-brand-light">
          <span className="block text-sm font-medium">{i.label}</span>
          <span className="block text-xs text-ink-muted">{i.sub}</span>
        </Link>
      ))}
    </div>
  );
}
