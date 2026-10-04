import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Crosshair } from 'lucide-react';
import { PhoneFrame } from '../../components/PhoneFrame';
import { PinMap } from '../../components/PinMap';
import { Wordmark } from '../../components/Wordmark';
import { useStore } from '../../store';
import type { LatLng } from '../../types';
import { useT } from '../../lib/strings';
import { encodeDigipin } from '../../services/digipin';
import { pinCheck, setRemotePin } from '../../services/addresses';

/** C2-F1 remote pin: a lightweight page opened from the WhatsApp link, e.g. by someone at the address. */
export function RemotePin() {
  const { token } = useParams();
  const address = useStore((s) => s.addresses.find((a) => a.id === token && !a.deleted));
  const t = useT();
  const [point, setPoint] = useState<LatLng | null>(address ? (address.pin ?? address.geoCell) : null);
  const [recenter, setRecenter] = useState(0);
  const [done, setDone] = useState(false);

  if (!address || !point) {
    return (
      <PhoneFrame>
        <div className="p-6"><Wordmark /><p className="mt-6 text-ink-muted">This pin link has expired or the address was removed.</p>
          <Link to="/customer/inbox" className="btn-outline mt-4">Back to Messages</Link></div>
      </PhoneFrame>
    );
  }

  const check = pinCheck(address.pincode, point);

  return (
    <PhoneFrame>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 bg-white px-4 py-3 shadow-sm"><Wordmark size="text-xl" /></header>
        {done ? (
          <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center">
            <CheckCircle2 size={56} className="text-success" />
            <div className="mt-3 text-lg font-bold">Pin saved</div>
            <div className="mt-1 font-mono text-brand">{encodeDigipin(point.lat, point.lng)}</div>
            <p className="mt-2 text-sm text-ink-muted">Riders will now come straight to this door for {address.label}, {address.area}.</p>
            <Link to="/customer/inbox" className="btn-primary mt-6">Back to Messages</Link>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white p-4">
            <div>
              <div className="text-[15px] font-semibold">{t('pinTitle')}</div>
              <div className="text-[12px] text-ink-muted">{address.label} · {address.line1}, {address.area}, {address.pincode}</div>
            </div>
            <PinMap value={point} onChange={setPoint} recenterKey={recenter} height={300} />
            <button className="btn-outline w-full" onClick={() => {
              const p = address.truePoint;
              setPoint({ lat: p.lat + (Math.random() - 0.5) * 0.0001, lng: p.lng + (Math.random() - 0.5) * 0.0001 });
              setRecenter((k) => k + 1);
            }}><Crosshair size={16} /> {t('useLocation')}</button>
            <div className="rounded-lg bg-brand-light/60 px-3 py-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{t('yourDigipin')}</div>
              <div className="font-mono text-xl font-bold tracking-wider text-brand">{encodeDigipin(point.lat, point.lng)}</div>
            </div>
            {check.outside && <div className="rounded-lg bg-red-50 p-2.5 text-[13px] text-danger">{t('pinOutside', { pincode: address.pincode })}</div>}
            <button className="btn-primary w-full !py-3" disabled={check.outside} onClick={() => { setRemotePin(address.id, point); setDone(true); }}>
              {t('confirmPin')}
            </button>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
