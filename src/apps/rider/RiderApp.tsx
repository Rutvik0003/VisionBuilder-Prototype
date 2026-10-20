import { useState } from 'react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bike, Check, CircleCheck, DoorOpen, MapPin, MessageSquare, Navigation, PackageOpen, Phone, SkipForward, TriangleAlert, MapPinOff, UserX, WifiOff, PackageCheck } from 'lucide-react';
import { PhoneFrame } from '../../components/PhoneFrame';
import { OpenBoxFlow, OtpField } from './OpenBoxFlow';
import { DesktopShell } from '../../components/DesktopShell';
import { SwitchApp } from '../../components/SwitchApp';
import { PinMap, RIDER_PIN } from '../../components/PinMap';
import { FeatureTag } from '../../components/FeatureTag';
import { useStore } from '../../store';
import { useUi } from '../../store/ui';
import type { Order, RunId } from '../../types';
import { fmtDate, rupees } from '../../lib/format';
import { decodeDigipin, encodeDigipin } from '../../services/digipin';
import { CONFIDENCE_BADGE } from '../../services/addresses';
import { distanceM } from '../../services/geo';
import { FAR_ZONE_M, RUN_WINDOW, deliveryPoint } from '../../services/routing';
import {
  byRoute, sameStop, canMarkAttempt, markArrived, markAttempt, markDelivered, nextRunToStart, pendingStops, riderCalls, riderPosition, sendDoorMessage, skipStop, startRoute,
} from '../../services/delivery';

export function RiderPicker() {
  const { riders, hubs } = useStore();
  return (
    <DesktopShell title="Rider" sub="Pick a rider" wide={false}>
      {hubs.map((h) => (
        <div key={h.id} className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{h.name}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {riders.filter((r) => r.hubId === h.id).map((r) => (
              <Link key={r.id} to={`/rider/${r.id}`} className="card flex items-center gap-3 p-3 hover:shadow-md">
                <Bike className="text-brand" size={20} />
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-ink-muted">{new Set(r.routeOrderIds).size ? `${new Set(r.routeOrderIds).size} stops published` : 'No route yet'}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </DesktopShell>
  );
}

function RiderHeader({ title, sub, back }: { title: string; sub?: React.ReactNode; back: string }) {
  return (
    <header className="flex shrink-0 items-start gap-1 bg-ink px-2 pb-3 pt-2 text-white">
      <Link to={back} className="rounded-full p-2 hover:bg-white/10" aria-label="Back"><ArrowLeft size={20} /></Link>
      <div className="min-w-0 flex-1 pt-1">
        <div className="truncate text-lg font-semibold leading-tight">{title}</div>
        {sub && <div className="mt-0.5 text-xs text-white/70">{sub}</div>}
      </div>
      <SwitchApp dark />
    </header>
  );
}

type StopState = { label: string; tone: string };
function stopState(o: Order): StopState {
  if (o.visit?.outcome === 'delivered') return { label: 'Delivered', tone: 'bg-emerald-50 text-success' };
  if (o.visit?.outcome === 'failed') return { label: 'Attempted', tone: 'bg-red-50 text-danger' };
  if (o.visit?.outcome === 'skipped') return { label: 'Skipped', tone: 'bg-gray-100 text-ink-muted' };
  if (o.visit?.outcome === 'refused') return { label: 'Refused · resealed', tone: 'bg-red-50 text-danger' };
  if (o.visit?.skipRequested) return { label: `Rescheduled · skip`, tone: 'bg-amber-100 text-amber-800' };
  if (o.homeCheck === 'yes' || o.homeCheck === 'change_requested') return { label: 'Confirmed', tone: 'bg-emerald-50 text-success' };
  return { label: 'Unconfirmed', tone: 'bg-gray-100 text-ink-muted' };
}

// ================================================================= route home

export function RiderApp() {
  const { riderId } = useParams();
  const state = useStore();
  const rider = state.riders.find((r) => r.id === riderId);
  const hub = state.hubs.find((h) => h.id === rider?.hubId);
  const showToast = useUi((s) => s.showToast);
  if (!rider || !hub) return <div className="p-6">Rider not found. <Link className="text-brand" to="/rider">Pick a rider</Link></div>;

  const mine = [...new Set(rider.routeOrderIds)].map((id) => state.orders.find((o) => o.id === id)!).filter((o) => o?.route?.riderId === rider.id).sort(byRoute);
  const pending = pendingStops(state, rider.id);
  const current = pending.find((o) => o.status !== 'PLANNED'); // first stop actually out for delivery
  const next = nextRunToStart(state, rider.id);
  const groups = new Map<string, Order[]>();
  for (const o of mine) {
    const k = `${o.route!.date}|${o.route!.run}`;
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }

  return (
    <PhoneFrame dark>
      <RiderHeader back="/rider" title={`Namaste, ${rider.name}`}
        sub={<>{hub.name} · Stops {pending.length} · Earnings today <b className="text-white">{rupees(rider.earningsToday)}</b> (paid on delivery)</>} />
      <div className="flex-1 overflow-y-auto">
        {mine.length === 0 ? (
          <div className="px-8 py-16 text-center text-sm text-ink-muted">
            <Bike size={36} className="mx-auto mb-3 text-gray-300" />
            Your hub hasn’t published today’s route yet.
          </div>
        ) : (
          <>
            <div className="bg-white p-3">
              {current ? (
                <Link to={`/rider/${rider.id}/stop/${current.id}`} className="flex items-center gap-3 rounded-xl bg-brand px-4 py-3 text-white">
                  <Navigation size={18} />
                  <span className="flex-1">
                    <span className="block text-[11px] uppercase tracking-wide text-white/70">Next stop</span>
                    <span className="block font-semibold">{state.customers.find((c) => c.id === current.customerId)?.name}</span>
                  </span>
                  <span className="text-sm">Open →</span>
                </Link>
              ) : next ? (
                <button className="btn-primary w-full !py-3" onClick={() => { if (!startRoute(rider.id)) showToast('No stops to start'); }}>
                  <Navigation size={17} /> Start {fmtDate(next.date)} · {next.run} run · {next.stops.length} stops
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 font-semibold text-success"><CircleCheck size={18} /> All runs complete</div>
              )}
            </div>

            {[...groups.entries()].map(([k, list]) => {
              const [date, run] = k.split('|') as [string, RunId];
              return (
                <div key={k} className="mt-2">
                  <div className="flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    <span>{run} run · {RUN_WINDOW[run].split(' ')[1]}</span><span>{fmtDate(date)} · {list.length} stops</span>
                  </div>
                  <ol className="divide-y divide-gray-100 bg-white">
                    {list.map((o) => {
                      const c = state.customers.find((x) => x.id === o.customerId)!;
                      const a = state.addresses.find((x) => x.id === o.addressId)!;
                      const st = stopState(o);
                      const isCurrent = current?.id === o.id;
                      const done = !!o.visit?.outcome;
                      return (
                        <li key={o.id}>
                          <Link to={`/rider/${rider.id}/stop/${o.id}`}
                            className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? 'bg-brand-light/60' : ''} ${done ? 'opacity-50' : ''}`}>
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isCurrent ? 'bg-brand' : done ? 'bg-gray-400' : 'bg-ink'}`}>
                              {done ? <Check size={14} /> : o.route!.seq}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{c.name.split(' ')[0]}</span>
                              <span className="block truncate text-xs text-ink-muted">{a.area}</span>
                            </span>
                            <span className="flex flex-col items-end gap-1">
                              <span className={`chip !text-[10px] ${st.tone}`}>{st.label}</span>
                              <span className="text-[11px] font-semibold">{o.payment === 'COD' ? rupees(o.total) : <span className="font-normal text-ink-muted">Prepaid</span>}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </>
        )}
      </div>
    </PhoneFrame>
  );
}

// ================================================================= stop detail

const NOTE_CHIPS = ['Blue gate', 'Shop front', '2nd floor'];
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(to.lng - from.lng)) * Math.cos(r(to.lat));
  const x = Math.cos(r(from.lat)) * Math.sin(r(to.lat)) - Math.sin(r(from.lat)) * Math.cos(r(to.lat)) * Math.cos(r(to.lng - from.lng));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

export function RiderStop() {
  const { riderId, orderId } = useParams();
  const state = useStore();
  const nav = useNavigate();
  const showToast = useUi((s) => s.showToast);
  const [mode, setMode] = useState<'none' | 'deliver' | 'openbox'>('none');
  const [note, setNote] = useState<string | undefined>();
  const [otp, setOtp] = useState('');
  const [offline, setOffline] = useState(false);
  const rider = state.riders.find((r) => r.id === riderId);
  const o = state.orders.find((x) => x.id === orderId);
  if (!rider || !o) return <div className="p-6">Stop not found.</div>;

  const c = state.customers.find((x) => x.id === o.customerId)!;
  const a = state.addresses.find((x) => x.id === o.addressId)!;
  const hub = state.hubs.find((h) => h.id === rider.hubId)!;
  const point = deliveryPoint(a);
  const digipin = encodeDigipin(point.lat, point.lng);
  const riderAt = riderPosition(state, rider.id);
  const v = o.visit;
  // Other parcels for this door in this run (e.g. one checkout split by seller): one stop, one OTP, one handover.
  const together = sameStop(o, state);
  const handOver = together.filter((x) => !x.openBox); // open-box parcels still get their own check
  const codDue = [o, ...handOver].reduce((a, x) => a + (x.payment === 'COD' ? x.total : 0), 0);
  const done = !!v?.outcome;
  const skipOnly = !!v?.skipRequested && !done;
  const active = !done && !skipOnly && ['OUT_FOR_DELIVERY', 'ARRIVING_SOON'].includes(o.status);
  const isNext = pendingStops(state, rider.id).find((x) => x.status !== 'PLANNED')?.id === o.id;
  const farZone = distanceM(hub, point) > FAR_ZONE_M;
  const back = `/rider/${rider.id}`;
  const conf = a.confidence === 'L3' ? CONFIDENCE_BADGE.L3.text(a) : a.confidence === 'L2' ? 'Pinned' : 'Approximate';
  const canAttempt = canMarkAttempt(v);
  const whyLocked = !v?.arrived ? 'Tap “Arrived at stop” first: you must be at the pin.' : 'Call twice or send “I’m at your door” first.';
  const fromCustomer = (o.chat ?? []).filter((m) => m.from === 'customer');

  const attempt = (reason: 'Address not found' | 'Customer unavailable') => {
    if (!markAttempt(o.id, reason)) { showToast(whyLocked); return; }
    showToast(reason === 'Address not found' ? 'Marked: address not found (sent to hub for review)' : 'Marked: customer unavailable');
    nav(back);
  };

  return (
    <PhoneFrame dark>
      <RiderHeader back={back} title={isNext ? 'Next delivery' : `Stop ${o.route?.seq ?? ''}`}
        sub={<>{c.name} · Stop {o.route?.seq} · {o.route?.run} run · {o.route && o.slot.date < o.route.date ? 'carried over' : o.slot.window}</>} />
      <div className="flex-1 space-y-2 overflow-y-auto pb-3">
        {skipOnly && (
          <div className="flex items-center gap-3 bg-amber-100 px-4 py-3 text-amber-900">
            <TriangleAlert size={18} />
            <div className="flex-1 text-sm"><b>Customer not home, skip.</b>
              <div className="text-xs">Rescheduled to {fmtDate(o.slot.date)}{o.slot.window !== 'Any time' ? `, ${o.slot.window}` : ''}. Keep the parcel; it goes out again on that day. Not a failed attempt.</div></div>
            <button className="btn bg-amber-600 !py-1.5 text-xs text-white" onClick={() => { skipStop(o.id); nav(back); }}><SkipForward size={14} /> Skip stop</button>
          </div>
        )}
        {done && (
          <div className={`px-4 py-3 text-sm font-semibold ${v!.outcome === 'delivered' ? 'bg-emerald-50 text-success' : 'bg-gray-100 text-ink-muted'}`}>
            {v!.outcome === 'delivered' ? 'Delivered ✓' : v!.outcome === 'failed' ? 'Attempt recorded' : v!.outcome === 'refused' ? `Refused after inspection · sealed ${o.sealId} · take it back to the hub, it goes to the seller` : 'Skipped'}
          </div>
        )}
        {o.status === 'PLANNED' && <div className="bg-sky-50 px-4 py-2 text-xs text-sky-800">Start this run from the stop list to begin.</div>}
        {together.length > 0 && !done && !skipOnly && (
          <div className="flex items-start gap-2 bg-sky-50 px-4 py-2.5 text-[12px] text-sky-900">
            <PackageCheck size={16} className="mt-0.5 shrink-0" />
            <div><b>Same door: {together.length + 1} parcels for {c.name}</b> ({[o, ...together].map((x) => '#' + x.id).join(', ')}).
              {handOver.length > 0 && ' Hand them over together, with one OTP.'}
              {together.some((x) => x.openBox) && ' The open-box parcel needs its own check after this one.'}</div>
          </div>
        )}

        <div className="bg-white">
          {offline ? (
            <div className="flex h-[190px] flex-col items-center justify-center gap-1 bg-gray-100 px-6 text-center">
              <WifiOff size={22} className="text-ink-muted" />
              <div className="text-xs text-ink-muted">No network · map unavailable</div>
              {(() => {
                const d = decodeDigipin(digipin);
                return (
                  <>
                    <div className="text-[13px] font-semibold">DIGIPIN decoded on the phone</div>
                    <div className="font-mono text-xs">{d.lat.toFixed(5)}, {d.lng.toFixed(5)}</div>
                    <div className="text-xs text-ink">{(distanceM(riderAt, d) / 1000).toFixed(2)} km {bearing(riderAt, d)} of you</div>
                  </>
                );
              })()}
            </div>
          ) : (
            <PinMap value={point} height={190} zoom={15} extra={[{ point: riderAt, icon: RIDER_PIN }]} />
          )}
          <div className="space-y-1.5 p-3 text-[13px]">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-brand" />
              <span className="font-mono font-semibold tracking-wide text-brand">{digipin}</span>
              <span className={`chip !text-[10px] ${CONFIDENCE_BADGE[a.confidence].tone}`}>{conf}</span>
              <FeatureTag id="C2-F1" />
              <label className="ml-auto flex items-center gap-1 text-[11px] text-ink-muted">
                <input type="checkbox" className="accent-brand" checked={offline} onChange={(e) => setOffline(e.target.checked)} /> No network
              </label>
            </div>
            <div>{a.line1}, {a.area}, {a.pincode}</div>
            {a.directions && <div className="text-ink-muted">Landmark: {a.directions}</div>}
            {a.learned?.riderNote && <div className="text-ink-muted">Rider note: {a.learned.riderNote} <FeatureTag id="C2-F2" /></div>}
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="chip bg-amber-50 font-semibold text-amber-700">{codDue > 0 ? `Collect ${rupees(codDue)}` : 'Prepaid'}</span>
              {o.openBox && <span className="chip bg-brand-light text-brand"><PackageOpen size={11} /> Open-box</span>}
              {farZone && <span className="chip bg-amber-100 text-amber-800">Far zone</span>}
              <span className={`chip ${stopState(o).tone}`}>{stopState(o).label}</span>
            </div>
          </div>
        </div>

        {fromCustomer.length > 0 && (
          <div className="mx-3 rounded-xl bg-white p-3">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-ink-muted"><MessageSquare size={12} /> From customer: <FeatureTag id="C1-F4" /></div>
            {fromCustomer.map((m, i) => <div key={i} className="text-sm">‘{m.text}’ <span className="text-[10px] text-ink-muted">{dayjs(m.at).format('h:mm A')}</span></div>)}
          </div>
        )}

        {active && (
          <div className="mx-3 space-y-2 rounded-xl bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline !py-2.5" onClick={() => showToast(riderCalls(o.id) ? 'Customer answered (masked call)' : 'No answer (masked call)')}>
                <Phone size={15} /> Call customer
              </button>
              <button className="btn-outline !py-2.5" disabled={v?.doorMessageSent} onClick={() => { sendDoorMessage(o.id); showToast('“I’m at your door” sent'); }}>
                <MessageSquare size={15} /> {v?.doorMessageSent ? 'Door msg sent' : 'I’m at your door'}
              </button>
            </div>
            <div className="text-center text-[11px] text-ink-muted">Calls made: {v?.callsMade ?? 0} · number masked via Meesho <FeatureTag id="C1-F4" /></div>
            {!v?.arrived
              ? <button className="btn-primary w-full !py-3" onClick={() => markArrived(o.id)}><DoorOpen size={17} /> Arrived at stop</button>
              : <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-sm font-medium text-success"><Check size={15} /> Arrived at the pin <FeatureTag id="C2-F4" /></div>}

            {v?.arrived && mode === 'none' && (
              o.openBox
                ? <button className="btn-accent w-full !py-3" onClick={() => setMode('openbox')}><PackageOpen size={16} /> Open-box check</button>
                : <button className="btn bg-success w-full !py-3 text-white" onClick={() => setMode('deliver')}><CircleCheck size={16} /> Delivered</button>
            )}

            {mode === 'openbox' && <OpenBoxFlow order={o} onDone={() => nav(back)} onBack={() => setMode('none')} />}

            {mode === 'deliver' && (
              <div className="space-y-2 rounded-lg bg-gray-50 p-2.5">
                <OtpField order={o} value={otp} onChange={setOtp} />
                <div className="text-xs font-medium">Add a note for the next rider (optional) <FeatureTag id="C2-F2" /></div>
                <div className="flex flex-wrap gap-1.5">
                  {NOTE_CHIPS.map((n) => (
                    <button key={n} onClick={() => setNote(note === n ? undefined : n)} className={`chip !px-2.5 !py-1 ${note === n ? 'bg-brand text-white' : 'bg-white'}`}>{n}</button>
                  ))}
                </div>
                <button className="btn bg-success w-full !py-3 text-white" disabled={otp !== o.deliveryOtp}
                  onClick={() => { markDelivered(o.id, note, true); showToast('Delivered · ₹13.5 earned'); nav(back); }}>
                  {codDue > 0 ? `Collected ${rupees(codDue)} · Confirm delivery` : 'Confirm delivery'}
                </button>
                <button className="w-full text-xs text-ink-muted" onClick={() => setMode('none')}>Back</button>
              </div>
            )}

            {/* D1.11 geofence + contact rule; P3.7 rider flags a failing stop */}
            {mode !== 'openbox' && (
              <div className="space-y-1 border-t border-gray-100 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn border border-danger !py-2 text-xs text-danger" disabled={!canAttempt} onClick={() => attempt('Address not found')}>
                    <MapPinOff size={14} /> Address not found
                  </button>
                  <button className="btn border border-danger !py-2 text-xs text-danger" disabled={!canAttempt} onClick={() => attempt('Customer unavailable')}>
                    <UserX size={14} /> Customer unavailable
                  </button>
                </div>
                {!canAttempt && <div className="text-center text-[11px] font-medium text-danger">{whyLocked} <FeatureTag id="C2-F4" /></div>}
              </div>
            )}
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
