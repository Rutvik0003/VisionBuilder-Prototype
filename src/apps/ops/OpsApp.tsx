import { useState } from 'react';
import dayjs from 'dayjs';
import { useStore } from '../../store';
import { DesktopShell } from '../../components/DesktopShell';

// Phase 9 builds the PeakPromise chart, controls and delay alerts. For now: the 21-day forecast table.
export function OpsApp() {
  const { hubs, forecast } = useStore();
  const [hubId, setHubId] = useState(hubs[0].id);
  const rows = forecast.filter((f) => f.hubId === hubId);
  const color = (b: number) => (b > 0.6 ? 'bg-red-100 text-danger' : b >= 0.3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-success');

  return (
    <DesktopShell title="Network Ops · PeakPromise" sub="21-day demand vs capacity" back="/"
      right={
        <select value={hubId} onChange={(e) => setHubId(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      }>
      <section className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="py-1">Date</th><th>Demand P50</th><th>Demand P90</th><th>Capacity</th><th>Bottleneck</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.date} className="border-t border-gray-100">
                <td className="py-1.5">{dayjs(f.date).format('ddd D MMM')}</td>
                <td>{f.demandP50}</td><td>{f.demandP90}</td><td>{f.capacity}</td>
                <td><span className={`chip ${color(f.bottleneck)}`}>{f.bottleneck.toFixed(2)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DesktopShell>
  );
}
