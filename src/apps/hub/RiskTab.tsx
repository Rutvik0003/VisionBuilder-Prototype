import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ShieldAlert } from 'lucide-react';
import { useStore } from '../../store';
import type { Hub, RescueReason } from '../../types';
import { ACTION_LABEL, REASON_LABEL, rescueAction } from '../../services/rescue';
import { ACTIVE_STATUSES } from '../../services/orders';

const REASONS = Object.keys(REASON_LABEL) as RescueReason[];
const BAND_TONE = { low: 'bg-emerald-50 text-success', medium: 'bg-amber-50 text-amber-700', high: 'bg-red-50 text-danger' };

/** C3-F2: hub-only view of the rescue engine. Customers never see any of this. */
export function RiskTab({ hub }: { hub: Hub }) {
  const orders = useStore(useShallow((s) => s.orders.filter((o) => o.hubId === hub.id && ACTIVE_STATUSES.includes(o.status))));
  const customers = useStore((s) => s.customers);
  const [reason, setReason] = useState<RescueReason | ''>('');
  const rows = orders.filter((o) => !reason || o.rescue.topReason === reason).sort((a, b) => b.rescue.pRto - a.rescue.pRto);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-ink-muted">Top reason:</span>
        <button onClick={() => setReason('')} className={`chip !px-2.5 !py-1 ${!reason ? 'bg-brand text-white' : 'bg-gray-100'}`}>All ({orders.length})</button>
        {REASONS.map((r) => {
          const n = orders.filter((o) => o.rescue.topReason === r).length;
          return (
            <button key={r} onClick={() => setReason(r)} className={`chip !px-2.5 !py-1 ${reason === r ? 'bg-brand text-white' : 'bg-gray-100'}`}>
              {REASON_LABEL[r]} ({n})
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-muted"><ShieldAlert size={13} /> Hub only · never shown to customers</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-2 py-2">Order</th><th className="px-2">Customer</th><th className="px-2">Status</th>
              <th className="px-2">p(RTO)</th><th className="px-2">Band</th><th className="px-2">Top reason</th>
              <th className="px-2">Reason mix</th><th className="px-2">Action</th><th className="px-2">Holdout</th><th className="px-2">Model</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-ink-muted">No active orders.</td></tr>}
            {rows.map((o) => {
              const r = o.rescue;
              const c = customers.find((x) => x.id === o.customerId)!;
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 font-mono text-xs">#{o.id}</td>
                  <td className="px-2">{c.name}{!c.background && <span className="chip ml-1 bg-brand !text-[9px] text-white">Demo</span>}</td>
                  <td className="px-2 text-xs">{o.status.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="px-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full ${r.band === 'high' ? 'bg-danger' : r.band === 'medium' ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(100, r.pRto * 100 / 0.85)}%` }} />
                      </div>
                      <span className="font-mono text-xs">{r.pRto.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-2"><span className={`chip ${BAND_TONE[r.band]}`}>{r.band}</span></td>
                  <td className="px-2 font-medium">{REASON_LABEL[r.topReason]}</td>
                  <td className="px-2">
                    <div className="flex h-3 w-28 overflow-hidden rounded" title={REASONS.map((k) => `${REASON_LABEL[k]} ${r.reasons[k].toFixed(2)}`).join(' · ')}>
                      {REASONS.map((k, i) => (
                        <div key={k} style={{ width: `${(r.reasons[k] / REASONS.reduce((a, x) => a + r.reasons[x], 0)) * 100}%`, background: ['#0B84C6', '#F59E0B', '#5E1A47', '#D32F2F', '#038D63'][i] }} />
                      ))}
                    </div>
                  </td>
                  <td className="px-2 text-xs">{ACTION_LABEL[rescueAction(r, o.openBox)]}</td>
                  <td className="px-2 text-xs">{r.holdout ? <span className="chip bg-gray-200">Holdout</span> : '—'}</td>
                  <td className="px-2 font-mono text-[11px] text-ink-muted">{r.modelVersion}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-muted">
        {REASONS.map((k, i) => (
          <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: ['#0B84C6', '#F59E0B', '#5E1A47', '#D32F2F', '#038D63'][i] }} />{REASON_LABEL[k]}</span>
        ))}
      </div>
    </div>
  );
}
