import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ArrowRightLeft, Bike, Lock, Trash2, TriangleAlert } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store';
import type { Hub, Order, RoutePlan } from '../../types';
import { rupees } from '../../lib/format';
import { OPEN_BOX_MIN, cluster6, deliveryPoint, discardPlan, lockAndPublish, moveStop, runKey } from '../../services/routing';
import { FeatureTag } from '../../components/FeatureTag';
import { HomeChip } from './bits';

export const LANE_COLORS = ['#5E1A47', '#0B84C6', '#038D63', '#F59E0B'];
const HUB_ICON = L.divIcon({
  className: '', iconSize: [30, 22], iconAnchor: [15, 11],
  html: '<div style="width:30px;height:22px;border-radius:6px;background:#1F1F1F;color:#fff;display:flex;align-items:center;justify-content:center;font:700 10px system-ui;box-shadow:0 1px 4px rgba(0,0,0,.4)">HUB</div>',
});
const UNASSIGNED_TEXT = { over_capacity: 'Riders full', cash_limit: 'Cash limit' };
const MOVE_REASONS = ['Rider knows the area', 'Balance load', 'Customer request'];

/** The draft plan for one run: map, rider lanes, unassigned, Lock & publish. */
export function RunPlanner({ hub, plan, onOpen }: { hub: Hub; plan: RoutePlan; onOpen: (orderId: string) => void }) {
  const orders = useStore((s) => s.orders);
  const riders = useStore(useShallow((s) => s.riders.filter((r) => r.hubId === hub.id)));
  const key = runKey(plan.hubId, plan.date, plan.run);
  const byId = (id: string) => orders.find((o) => o.id === id)!;
  const lanes = plan.lanes.filter((l) => l.orderIds.length > 0);
  const stops = lanes.reduce((a, l) => a + l.orderIds.length, 0);
  const expected = lanes.reduce((a, l) => a + l.expectedDrops, 0);

  return (
    <div className="space-y-3 rounded-xl border border-brand/30 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="font-semibold">{plan.run} run plan <FeatureTag id="C3-F3" /></div>
        <span className="text-sm text-ink-muted">
          {stops} stop{stops === 1 ? '' : 's'} · {lanes.length} rider{lanes.length === 1 ? '' : 's'} · {lanes.reduce((a, l) => a + l.km, 0).toFixed(1)} km · ~{expected.toFixed(1)} successful drops expected
          {plan.carryOver.length > 0 && <> · <b className="text-ink">{plan.carryOver.length} carried over</b></>}
        </span>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost text-ink-muted" onClick={() => discardPlan(key)}><Trash2 size={15} /> Discard</button>
          <button className="btn-primary" disabled={stops === 0} onClick={() => lockAndPublish(key)}><Lock size={15} /> Lock &amp; publish</button>
        </div>
      </div>

      <RouteMap hub={hub} plan={plan} />

      <div className="grid gap-3 lg:grid-cols-3">
        {plan.lanes.map((lane, i) => {
          const rider = riders.find((r) => r.id === lane.riderId)!;
          return (
            <div key={lane.riderId} className="overflow-hidden rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: `3px solid ${LANE_COLORS[i % 4]}` }}>
                <Bike size={15} style={{ color: LANE_COLORS[i % 4] }} />
                <span className="font-semibold">{rider.name}</span>
                {lane.farZone && <span className="chip bg-amber-100 text-amber-800">Far zone</span>}
                <span className="ml-auto text-xs text-ink-muted">{lane.orderIds.length} stops · {lane.km} km{lane.minutes ? ` · ~${lane.minutes} min` : ''} · {rupees(lane.codTotal)} COD</span>
              </div>
              <ol>
                {lane.orderIds.length === 0 && <li className="px-3 pb-3 text-xs text-ink-muted">No stops this run</li>}
                {lane.orderIds.map((id, k) => (
                  <StopRow key={id} hub={hub} planKey={key} order={byId(id)} seq={k + 1} currentRider={lane.riderId}
                    carried={plan.carryOver.includes(id)} onOpen={onOpen} />
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      {plan.unassigned.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/50">
          <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-danger">
            <TriangleAlert size={15} /> {plan.unassigned.length} parcel{plan.unassigned.length > 1 ? 's' : ''} won’t fit this run
            <span className="font-normal text-ink-muted">· they carry over to the next run automatically, or move one to a rider</span>
          </div>
          <ol>
            {plan.unassigned.map((u) => (
              <StopRow key={u.orderId} hub={hub} planKey={key} order={byId(u.orderId)} currentRider="unassigned"
                reason={UNASSIGNED_TEXT[u.reason]} onOpen={onOpen} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function StopRow({ hub, planKey, order, seq, currentRider, reason, carried, onOpen }: {
  hub: Hub; planKey: string; order: Order; seq?: number; currentRider: string; reason?: string; carried?: boolean; onOpen: (id: string) => void;
}) {
  const customer = useStore((s) => s.customers.find((c) => c.id === order.customerId)!);
  const address = useStore((s) => s.addresses.find((a) => a.id === order.addressId)!);
  const riders = useStore(useShallow((s) => s.riders.filter((r) => r.hubId === hub.id)));
  const [moving, setMoving] = useState(false);
  const [to, setTo] = useState('');
  const [why, setWhy] = useState('');

  return (
    <li className="border-t border-gray-100 px-3 py-2 text-[13px]">
      <div className="flex items-center gap-2">
        {seq !== undefined && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">{seq}</span>}
        <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(order.id)}>
          <span className="block truncate font-medium hover:text-brand">
            {customer.name}{!customer.background && <span className="chip ml-1 bg-brand !text-[9px] text-white">Demo</span>}
          </span>
          <span className="block truncate text-[11px] text-ink-muted">{address.area} · {order.slot.window === 'Any time' ? 'Any time' : order.slot.window.split(' ')[1]} · <span className="font-mono" title="DIGIPIN-6 cluster">{cluster6(deliveryPoint(address))}</span>{order.openBox ? ` · open-box +${OPEN_BOX_MIN} min` : ''}</span>
        </button>
        {carried && <span className="chip bg-sky-50 !text-[10px] text-sky-700" title="Carried over from an earlier run or day">Carried</span>}
        {reason ? <span className="chip bg-red-100 !text-[10px] font-semibold text-danger">{reason}</span> : <HomeChip o={order} />}
        <button className="rounded p-1 text-ink-muted hover:bg-gray-100 hover:text-brand" title="Move stop" onClick={() => setMoving(!moving)}>
          <ArrowRightLeft size={14} />
        </button>
      </div>
      {moving && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-gray-50 p-2">
          <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs">
            <option value="">Move to rider…</option>
            {riders.filter((r) => r.id !== currentRider).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-1">
            {MOVE_REASONS.map((m) => (
              <button key={m} onClick={() => setWhy(m)} className={`chip !text-[10px] ${why === m ? 'bg-brand text-white' : 'bg-white text-ink'}`}>{m}</button>
            ))}
          </div>
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (required)" className="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
          <button className="btn-primary w-full !py-1 text-xs" disabled={!to || !why.trim()}
            onClick={() => { moveStop(planKey, order.id, to, why); setMoving(false); }}>Move stop</button>
        </div>
      )}
    </li>
  );
}

function RouteMap({ hub, plan }: { hub: Hub; plan: RoutePlan }) {
  const orders = useStore((s) => s.orders);
  const addresses = useStore((s) => s.addresses);
  const point = (id: string) => {
    const o = orders.find((x) => x.id === id)!;
    return deliveryPoint(addresses.find((a) => a.id === o.addressId)!);
  };
  const bounds = useMemo(() => {
    const pts = [...plan.lanes.flatMap((l) => l.orderIds), ...plan.unassigned.map((u) => u.orderId)].map(point);
    return L.latLngBounds([[hub.lat, hub.lng], ...pts.map((p) => [p.lat, p.lng] as [number, number])]).pad(0.15);
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative isolate z-0 h-[280px] overflow-hidden rounded-lg border border-gray-200">
      <MapContainer bounds={bounds} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[hub.lat, hub.lng]} icon={HUB_ICON} />
        {plan.lanes.map((lane, i) => {
          const pts = lane.orderIds.map(point);
          const color = LANE_COLORS[i % 4];
          return (
            <span key={lane.riderId}>
              {pts.length > 0 && (
                <Polyline positions={[[hub.lat, hub.lng], ...pts.map((p) => [p.lat, p.lng] as [number, number])]}
                  pathOptions={{ color, weight: 3, opacity: 0.8, dashArray: lane.farZone ? '6 6' : undefined }} />
              )}
              {pts.map((p, k) => (
                <CircleMarker key={lane.orderIds[k]} center={[p.lat, p.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }}>
                  <Tooltip direction="top">Stop {k + 1}</Tooltip>
                </CircleMarker>
              ))}
            </span>
          );
        })}
        {plan.unassigned.map((u) => {
          const p = point(u.orderId);
          return (
            <CircleMarker key={u.orderId} center={[p.lat, p.lng]} radius={7} pathOptions={{ color: '#D32F2F', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
              <Tooltip direction="top">Won’t fit this run</Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
