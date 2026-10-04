import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Crosshair, Link2, MapPin, MapPinned, Pencil } from 'lucide-react';
import { useCurrentCustomer, useStore } from '../../store';
import type { AddressLabel, LatLng } from '../../types';
import { useT } from '../../lib/strings';
import { encodeDigipin } from '../../services/digipin';
import {
  type AddressDraft, type PinInput, KNOWN_PINCODES, draftGeo, pinCheck, resolvePincode, saveAddress, sendRemotePinLink,
} from '../../services/addresses';
import { updateCheckout } from '../../services/cart';
import { PinMap } from '../../components/PinMap';
import { FeatureTag } from '../../components/FeatureTag';
import { useUi } from '../../store/ui';
import { PageHeader, Screen } from './ui';

const LABELS: AddressLabel[] = ['Home', 'Shop', 'Other'];

/**
 * Add / edit address (C2-F1). New addresses and L0/L1 edits start on the map step; pinned/verified
 * addresses open on details with an "Adjust pin" option.
 * `?return=checkout` | `?return=product:<id>` controls where Save lands.
 */
export function AddressEditor() {
  const { addressId } = useParams();
  const [params] = useSearchParams();
  const ret = params.get('return') ?? '';
  const customer = useCurrentCustomer();
  const existing = useStore((s) => s.addresses.find((a) => a.id === addressId));
  const log = useStore((s) => s.log);
  const showToast = useUi((s) => s.showToast);
  const nav = useNavigate();
  const t = useT();

  const needsPin = !existing || existing.confidence === 'L0' || existing.confidence === 'L1';
  const [step, setStep] = useState<'pin' | 'details'>(needsPin || params.get('step') === 'pin' ? 'pin' : 'details');

  const [draft, setDraft] = useState<AddressDraft>(() => existing
    ? { label: existing.label, name: existing.name, phone: existing.phone, line1: existing.line1, area: existing.area,
        directions: existing.directions, pincode: existing.pincode, city: existing.city, state: existing.state }
    : { label: 'Home', name: customer.name, phone: customer.phone, line1: '', area: '', directions: '', pincode: '', city: '', state: '' });

  // GeoIndia guess + real door for this pincode (kept stable while the pincode doesn't change)
  const [geo, setGeo] = useState(() => existing
    ? { geoCell: existing.geoCell, truePoint: existing.truePoint }
    : null as ReturnType<typeof draftGeo>);
  const [pin, setPin] = useState<PinInput>(null);
  const [point, setPoint] = useState<LatLng | null>(existing ? (existing.pin ?? existing.learned ?? existing.geoCell) : null);
  const [recenter, setRecenter] = useState(0);
  const [remoteRequested, setRemoteRequested] = useState(false);
  const [touched, setTouched] = useState(false);

  const resolved = resolvePincode(draft.pincode);
  const check = point && resolved ? pinCheck(draft.pincode, point) : null;
  const digipin = useMemo(() => (point ? encodeDigipin(point.lat, point.lng) : ''), [point]);

  // When a new pincode resolves, start the pin at the GeoIndia guess for it.
  const onPincode = (pincode: string) => {
    const r = resolvePincode(pincode);
    setDraft((d) => ({ ...d, pincode, city: r?.city ?? '', state: r?.state ?? '' }));
    if (r && pincode !== existing?.pincode) {
      const g = draftGeo(pincode)!;
      setGeo(g);
      setPoint({ lat: g.geoCell.lat, lng: g.geoCell.lng });
      setPin(null);
      setRecenter((k) => k + 1);
    }
  };

  const shownRef = useRef(false);
  useEffect(() => {
    if (step === 'pin' && resolved && !shownRef.current) {
      shownRef.current = true;
      log('C2-F1', 'pin_step_shown', 'customer', { pincode: draft.pincode, geoIndiaConfidence: geo?.geoCell.confidence });
    }
  }, [step, resolved]); // eslint-disable-line react-hooks/exhaustive-deps

  const wasOutside = useRef(false);
  useEffect(() => {
    if (check?.outside && !wasOutside.current) log('C2-F1', 'pin_outside_pincode', 'customer', { distanceM: Math.round(check.distanceM) });
    wasOutside.current = !!check?.outside;
  }, [check?.outside]); // eslint-disable-line react-hooks/exhaustive-deps

  const useCurrentLocation = () => {
    if (!geo) return;
    // Simulated GPS: lands within ~8 m of the real door.
    const p = { lat: geo.truePoint.lat + (Math.random() - 0.5) * 0.00012, lng: geo.truePoint.lng + (Math.random() - 0.5) * 0.00012 };
    setPoint(p);
    setPin({ ...p, source: 'gps' });
    setRecenter((k) => k + 1);
    log('C2-F1', 'current_location_used', 'customer', { digipin: encodeDigipin(p.lat, p.lng) });
  };

  const onDrag = (p: LatLng) => {
    setPoint(p);
    setPin({ ...p, source: 'drag' });
    log('C2-F1', 'pin_dragged', 'customer', { digipin: encodeDigipin(p.lat, p.lng) });
  };

  const confirmPin = () => {
    if (!point) return;
    setPin((p) => p ?? { ...point, source: 'drag' });
    setStep('details');
  };

  const skipPin = () => {
    setPin(null);
    log('C2-F1', 'pin_skipped', 'customer', {});
    setStep('details');
  };

  const errors = {
    name: !draft.name.trim() && 'Enter a name',
    line1: !draft.line1.trim() && 'Enter house / flat / shop number',
    area: !draft.area.trim() && 'Enter area or street',
    pincode: !resolved && 'Enter a valid pincode',
  } as Record<string, string | false>;
  const valid = !Object.values(errors).some(Boolean);

  const save = () => {
    setTouched(true);
    if (!valid || !geo) return;
    const a = saveAddress(customer.id, draft, pin, geo, existing?.id);
    if (remoteRequested && !pin) sendRemotePinLink(a.id);
    showToast(existing ? 'Address updated' : 'Address saved');
    if (ret === 'checkout') { updateCheckout({ addressId: a.id }); nav('/customer/checkout', { replace: true }); }
    else if (ret.startsWith('product:')) nav(`/customer/product/${ret.slice(8)}`, { replace: true });
    else if (ret.startsWith('order:')) { log('C1-F2', 'check_directions', 'customer', { viaPin: !!pin }, ret.slice(6)); nav(`/customer/orders/${ret.slice(6)}`, { replace: true }); }
    else nav('/customer/addresses', { replace: true });
  };

  const title = existing ? 'Edit address' : 'Add delivery address';

  // ------------------------------------------------------------- pin step
  if (step === 'pin') {
    return (
      <Screen
        header={<PageHeader title={title} sub="Step 1 of 2 · Pin your door" />}
        footer={resolved && point ? (
          <div className="shrink-0 space-y-2 border-t border-gray-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline !py-3" onClick={skipPin}>{t('skipForNow')}</button>
              <button className="btn-primary !py-3" disabled={!!check?.outside} onClick={confirmPin}>{t('confirmPin')}</button>
            </div>
          </div>
        ) : undefined}
      >
        <div className="space-y-3 bg-white p-4">
          <Field label="Pincode" value={draft.pincode} inputMode="numeric" maxLength={6}
            onChange={(e) => onPincode(e.target.value.replace(/\D/g, ''))}
            error={draft.pincode.length === 6 && !resolved ? `Pincode not found. Prototype knows: ${KNOWN_PINCODES.join(', ')}` : false} />
          {!resolved && (
            <div className="flex flex-wrap gap-1 text-[11px] text-ink-muted">
              Try:
              {KNOWN_PINCODES.map((p) => {
                const r = resolvePincode(p)!;
                return <button key={p} className="chip bg-gray-100 hover:bg-brand-light" onClick={() => onPincode(p)}>{p} · {r.city}{r.hubId ? '' : ' (non-pilot)'}</button>;
              })}
            </div>
          )}
          {resolved && (
            <div className="text-[12px] text-ink-muted">
              {resolved.city}, {resolved.state}
              {!resolved.hubId && <span className="ml-1 text-amber-700">· outside the pilot area (standard delivery)</span>}
            </div>
          )}
        </div>

        {resolved && point && geo && (
          <div className="mt-2 space-y-3 bg-white p-4">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-semibold">{t('pinTitle')} <FeatureTag id="C2-F1" /></div>
              <div className="text-[12px] text-ink-muted">{t('pinSub')}</div>
            </div>
            <PinMap value={point} onChange={onDrag} recenterKey={recenter} height={250}
              accuracy={{ center: geo.geoCell, radiusM: 200 }} />
            <button className="btn-outline w-full" onClick={useCurrentLocation}><Crosshair size={16} /> {t('useLocation')}</button>

            <div className={`rounded-lg px-3 py-2.5 ${check?.outside ? 'bg-red-50' : 'bg-brand-light/60'}`}>
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{t('yourDigipin')}</div>
              <div className="font-mono text-xl font-bold tracking-wider text-brand">{digipin}</div>
              <div className="text-[11px] text-ink-muted">
                {pin?.source === 'gps' ? 'From your location' : pin ? 'Pin moved by you' : 'Approximate spot from your pincode. Move the pin to your door.'}
              </div>
            </div>
            {check?.outside && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-[13px] text-danger">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {t('pinOutside', { pincode: draft.pincode })}
              </div>
            )}
            <button className="flex items-center gap-1.5 text-[13px] font-medium text-brand" onClick={() => {
              setRemoteRequested(true); setPin(null); setStep('details');
            }}>
              <Link2 size={15} /> {t('notHereLink')}
            </button>
          </div>
        )}
      </Screen>
    );
  }

  // ------------------------------------------------------------- details step
  const set = (k: keyof AddressDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({ ...draft, [k]: e.target.value });
  const pinned = pin ?? (existing?.pin && existing.pincode === draft.pincode ? { ...existing.pin } : null);

  return (
    <Screen
      header={<PageHeader title={title} sub={needsPin ? 'Step 2 of 2 · Address details' : undefined}
        onBack={needsPin ? () => setStep('pin') : undefined} />}
      footer={
        <div className="shrink-0 border-t border-gray-200 bg-white p-3">
          <button className="btn-primary w-full !py-3" onClick={save}>Save address</button>
        </div>
      }
    >
      {/* Pin summary */}
      <div className="flex items-center gap-3 bg-white px-4 py-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${pinned || existing?.learned ? 'bg-emerald-50 text-success' : 'bg-amber-50 text-amber-600'}`}>
          {pinned || existing?.learned ? <MapPinned size={18} /> : <MapPin size={18} />}
        </span>
        <div className="min-w-0 flex-1 text-[13px]">
          {existing?.confidence === 'L3' && !pin
            ? <><b>Verified by {existing.learned?.drops.length} deliveries</b><div className="text-ink-muted">Riders already know this door.</div></>
            : pinned
              ? <><b>Pinned</b> · <span className="font-mono">{encodeDigipin(pinned.lat, pinned.lng)}</span></>
              : remoteRequested
                ? <><b>Pin link will be sent</b><div className="text-ink-muted">{t('remoteQueued')}</div></>
                : <><b>Not pinned</b><div className="text-ink-muted">The rider will use the address text.</div></>}
        </div>
        <button className="flex items-center gap-1 text-xs font-semibold text-brand" onClick={() => setStep('pin')}>
          <Pencil size={12} /> {pinned || existing?.learned ? 'Adjust pin' : 'Add pin'}
        </button>
      </div>

      <div className="mt-2 space-y-4 bg-white px-4 py-4">
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink-muted">Save as</span>
          <div className="flex gap-2">
            {LABELS.map((l) => (
              <button key={l} onClick={() => setDraft({ ...draft, label: l })}
                className={`rounded-full border px-4 py-1.5 text-sm ${draft.label === l ? 'border-brand bg-brand-light font-semibold text-brand' : 'border-gray-300'}`}>{l}</button>
            ))}
          </div>
        </div>
        <Field label="Full name" value={draft.name} onChange={set('name')} error={touched && errors.name} />
        <Field label="Phone number" value={draft.phone} onChange={set('phone')} inputMode="tel" />
        <Field label="House / flat / shop no." value={draft.line1} onChange={set('line1')} error={touched && errors.line1} />
        <Field label="Area, street, village" value={draft.area} onChange={set('area')} error={touched && errors.area} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Pincode" value={draft.pincode} readOnly onClick={() => setStep('pin')} />
          <Field label="City" value={draft.city} onChange={set('city')} />
          <Field label="State" value={draft.state} onChange={set('state')} />
        </div>
        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-[12px] font-medium text-ink-muted">{t('directionsLabel')} <FeatureTag id="C2-F1" /></span>
          <textarea value={draft.directions} onChange={set('directions')} rows={2} placeholder={t('dirPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand" />
        </label>
      </div>
    </Screen>
  );
}

function Field({ label, error, ...rest }: { label: string; error?: string | false } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink-muted">{label}</span>
      <input {...rest}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition read-only:bg-gray-50 focus:border-brand ${error ? 'border-danger' : 'border-gray-300'}`} />
      {error && <span className="mt-1 block text-[11px] text-danger">{error}</span>}
    </label>
  );
}
