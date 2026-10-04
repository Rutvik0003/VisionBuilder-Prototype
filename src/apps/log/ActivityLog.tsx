import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import type { Actor } from '../../types';
import { DesktopShell } from '../../components/DesktopShell';

const FEATURE_COLORS: Record<string, string> = {
  C1: 'bg-sky-100 text-sky-800',
  C2: 'bg-emerald-100 text-emerald-800',
  C3: 'bg-amber-100 text-amber-800',
  CO: 'bg-brand-light text-brand', // CORE
};
const featureColor = (id: string) => FEATURE_COLORS[id.slice(0, 2)] ?? 'bg-gray-100 text-gray-700';

const ACTORS: Actor[] = ['customer', 'transit', 'hub', 'rider', 'ops', 'system'];

export function ActivityLog() {
  const { events, clearLog } = useStore();
  const [feature, setFeature] = useState('');
  const [actor, setActor] = useState<Actor | ''>('');
  const [order, setOrder] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const features = useMemo(() => Array.from(new Set(events.map((e) => e.featureId))).sort(), [events]);
  const rows = events.filter((e) =>
    (!feature || e.featureId === feature) && (!actor || e.actor === actor) && (!order || (e.orderId ?? '').includes(order.trim())));

  return (
    <DesktopShell title="Activity Log" sub={`${events.length} events · newest first`} back="/"
      right={!confirmClear
        ? <button className="btn-ghost text-danger" disabled={!events.length} onClick={() => setConfirmClear(true)}><Trash2 size={15} /> Clear log</button>
        : <span className="flex items-center gap-1 text-sm">Clear all events?
            <button className="btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
            <button className="btn bg-danger text-white" onClick={() => { clearLog(); setConfirmClear(false); }}>Clear</button>
          </span>}>
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <select value={feature} onChange={(e) => setFeature(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">All features</option>
            {features.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select value={actor} onChange={(e) => setActor(e.target.value as Actor | '')} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">All actors</option>
            {ACTORS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="Order id"
            className="w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          {(feature || actor || order) && <button className="btn-ghost text-xs" onClick={() => { setFeature(''); setActor(''); setOrder(''); }}>Clear filters</button>}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-ink-muted">
              <tr><th className="px-2 py-2">Time</th><th className="px-2">Actor</th><th className="px-2">Feature</th><th className="px-2">Event</th><th className="px-2">Order</th><th className="px-2">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-ink-muted">No events yet. Place an order as a customer to see features fire here.</td></tr>
              )}
              {rows.map((e) => (
                <tr key={e.id} className="align-top hover:bg-gray-50">
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-ink-muted">{dayjs(e.at).format('D MMM, HH:mm:ss')}</td>
                  <td className="px-2 py-2 text-xs capitalize">{e.actor}</td>
                  <td className="px-2 py-2"><span className={`chip font-mono ${featureColor(e.featureId)}`}>{e.featureId}</span></td>
                  <td className="px-2 py-2 font-mono text-xs font-medium">{e.name}</td>
                  <td className="px-2 py-2 font-mono text-xs">{e.orderId ? `#${e.orderId}` : ''}</td>
                  <td className="max-w-[320px] break-all px-2 py-2 font-mono text-[11px] text-ink-muted">
                    {Object.keys(e.payload).length ? JSON.stringify(e.payload) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DesktopShell>
  );
}
