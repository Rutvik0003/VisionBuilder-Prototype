import { useState } from 'react';
import dayjs from 'dayjs';
import { Camera, Check, CircleCheck, OctagonAlert, PackageX, Repeat2, ScanLine, ShieldAlert, Timer, Undo2 } from 'lucide-react';
import type { Order } from '../../types';
import { rupees } from '../../lib/format';
import { useNow } from '../../lib/time';
import { useUi } from '../../store/ui';
import { FeatureTag } from '../../components/FeatureTag';
import {
  CHECKLIST, HARD_STOP_SECONDS, INSPECTION_SECONDS, REFUSAL_REASONS,
  abortOpenBox, acceptAfterInspection, refuseAfterInspection, startInspection, takeSealPhoto, toggleCheck,
} from '../../services/openbox';

const mmss = (s: number) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`;

/** C2-F3 open-box at the door: seal photo → timed inspection → accept, or refuse → reseal. */
export function OpenBoxFlow({ order, onDone, onBack }: { order: Order; onDone: () => void; onBack: () => void }) {
  useNow(1000); // tick the inspection timer
  const showToast = useUi((s) => s.showToast);
  const i = order.inspection ?? { checklist: {} };
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [damaged, setDamaged] = useState(false);
  const [itemPhoto, setItemPhoto] = useState(false);
  const [result, setResult] = useState<{ sealId: string; redirectEligible: boolean } | null>(null);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [otp, setOtp] = useState('');
  const [sealId, setSealId] = useState('');
  const otpOk = otp === order.deliveryOtp;

  const elapsed = i.startedAt ? dayjs().diff(dayjs(i.startedAt), 'second') : 0;
  const remaining = INSPECTION_SECONDS - elapsed;
  const hardStop = elapsed >= HARD_STOP_SECONDS;
  const checked = CHECKLIST.filter((c) => i.checklist[c]).length;
  const allChecked = checked === CHECKLIST.length;

  // ---- after reseal: show the seal + disposition
  if (result) {
    return (
      <div className="space-y-3 rounded-lg bg-gray-50 p-3 text-center">
        <PackageX size={30} className="mx-auto text-danger" />
        <div className="text-sm font-semibold">Resealed in tamper-evident bag</div>
        <div className="font-mono text-2xl font-bold tracking-widest text-ink">{result.sealId}</div>
        <div className="text-xs text-ink-muted">Reason: {reason}{damaged ? ' · damaged' : ''}</div>
        {result.redirectEligible
          ? <span className="chip bg-emerald-50 !px-3 !py-1 text-success"><Repeat2 size={13} /> Redirect Loop eligible (Grade A)</span>
          : <span className="chip bg-gray-100 !px-3 !py-1 text-ink-muted"><Undo2 size={13} /> Return to seller</span>}
        <button className="btn-primary w-full !py-3" onClick={onDone}>Next stop</button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand/30 bg-white p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">Open-box check <FeatureTag id="C2-F3" />
        <button className="ml-auto text-xs font-normal text-ink-muted" onClick={onBack}>Back</button>
      </div>

      {/* 1. Seal photo */}
      <Step n={1} title="Photo of the sealed parcel" done={!!i.sealPhotoAt}>
        {i.sealPhotoAt ? (
          <div className="flex items-center gap-2 rounded-lg bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_6px,#e5e7eb_6px,#e5e7eb_12px)] px-3 py-3 text-xs">
            <Camera size={16} className="text-ink-muted" /> Seal intact · photo {dayjs(i.sealPhotoAt).format('h:mm A')}
          </div>
        ) : (
          <button className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-gray-300 py-4 text-sm text-ink-muted hover:border-brand hover:text-brand"
            onClick={() => takeSealPhoto(order.id)}>
            <Camera size={22} /> Take seal photo
          </button>
        )}
      </Step>

      {/* 2. Timed inspection */}
      {i.sealPhotoAt && (
        <Step n={2} title="Customer inspects (no trying on)" done={!!i.startedAt}>
          {!i.startedAt ? (
            <button className="btn-primary w-full !py-2.5" onClick={() => startInspection(order.id)}><Timer size={16} /> Start inspection · 2:00</button>
          ) : (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold
              ${hardStop ? 'bg-red-100 text-danger' : remaining > 0 ? 'bg-emerald-50 text-success' : 'bg-amber-100 text-amber-800'}`}>
              <Timer size={16} />
              {hardStop ? 'Hard stop: ask the customer to decide now'
                : remaining > 0 ? <>Time left <span className="ml-auto font-mono text-lg">{mmss(remaining)}</span></>
                  : <>Time’s up · please wrap up <span className="ml-auto font-mono">+{mmss(-remaining)}</span></>}
            </div>
          )}
        </Step>
      )}

      {/* 3. Checklist */}
      {i.startedAt && (
        <Step n={3} title={`Checklist (${checked}/${CHECKLIST.length})`} done={checked === CHECKLIST.length}>
          <div className="grid grid-cols-1 gap-1">
            {CHECKLIST.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={!!i.checklist[c]} onChange={() => toggleCheck(order.id, c)} />
                {c}
              </label>
            ))}
          </div>
        </Step>
      )}

      {/* 4. Decision */}
      {i.startedAt && !refusing && (
        <div className="grid grid-cols-1 gap-2">
          {allChecked && <OtpField order={order} value={otp} onChange={setOtp} />}
          <button className="btn bg-success !py-3 text-white" disabled={!allChecked || !otpOk}
            onClick={() => {
              if (!acceptAfterInspection(order.id, undefined, true)) { showToast(`Tick all ${CHECKLIST.length} checks to confirm delivery`); return; }
              showToast('Delivered after open-box check · ₹13.5 earned'); onDone();
            }}>
            <CircleCheck size={16} /> Customer accepts · collect {rupees(order.total)}
          </button>
          {!allChecked && (
            <div className="-mt-1 text-center text-[11px] text-ink-muted">
              Tick all {CHECKLIST.length} checks, then enter the customer’s OTP. Something not right? Use <b>Customer refuses</b>.
            </div>
          )}
          <button className="btn border border-danger !py-3 text-danger" onClick={() => setRefusing(true)}><PackageX size={16} /> Customer refuses</button>
        </div>
      )}

      {refusing && (
        <div className="space-y-2 rounded-lg bg-red-50/60 p-2.5">
          <div className="text-xs font-semibold">Why is the customer refusing?</div>
          <div className="flex flex-wrap gap-1.5">
            {REFUSAL_REASONS.map((r) => (
              <button key={r} onClick={() => { setReason(r); if (r === 'Damaged') setDamaged(true); }}
                className={`chip !px-2.5 !py-1 ${reason === r ? 'bg-danger text-white' : 'bg-white'}`}>{r}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-danger" checked={damaged} disabled={reason === 'Damaged'} onChange={(e) => setDamaged(e.target.checked)} />
            Item is damaged
          </label>
          <button disabled={!reason || itemPhoto} onClick={() => setItemPhoto(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 bg-white py-2.5 text-sm text-ink-muted disabled:opacity-60">
            {itemPhoto ? <><Check size={15} className="text-success" /> Item photo taken</> : <><Camera size={15} /> Take item photo</>}
          </button>
          <div className="text-xs font-semibold">Reseal in tamper-evident bag</div>
          <div className="flex gap-2">
            <input value={sealId} onChange={(e) => setSealId(e.target.value.toUpperCase().slice(0, 12))} placeholder="Seal ID on the bag"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-brand" />
            <button className="btn-outline !py-1.5 text-xs" onClick={() => setSealId('TB-' + String(Math.floor(100000 + Math.random() * 900000)))}><ScanLine size={14} /> Scan</button>
          </div>
          <button className="btn w-full bg-danger !py-3 text-white" disabled={!reason || !itemPhoto || sealId.length < 4}
            onClick={() => setResult(refuseAfterInspection(order.id, reason!, damaged, sealId))}>
            <ShieldAlert size={16} /> Reseal in tamper-evident bag
          </button>
          <button className="w-full text-xs text-ink-muted" onClick={() => { setRefusing(false); setReason(null); setItemPhoto(false); }}>Back</button>
        </div>
      )}

      {/* Always available */}
      {!confirmAbort ? (
        <button className="flex w-full items-center justify-center gap-1.5 pt-1 text-xs font-semibold text-danger" onClick={() => setConfirmAbort(true)}>
          <OctagonAlert size={14} /> Abort for safety
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs">
          <span className="flex-1">Leave with the parcel sealed? The customer can pick a new time.</span>
          <button className="btn-ghost !py-1 text-xs" onClick={() => setConfirmAbort(false)}>No</button>
          <button className="btn bg-danger !py-1 text-xs text-white" onClick={() => { abortOpenBox(order.id); onDone(); }}>Abort</button>
        </div>
      )}
    </div>
  );
}

/** OTP the customer reads out at the door (D1.8). The helper fills it, since the customer isn't really there. */
export function OtpField({ order, value, onChange }: { order: Order; value: string; onChange: (v: string) => void }) {
  const ok = value === order.deliveryOtp;
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium">Delivery OTP from the customer</div>
      <div className="flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="4 digits"
          className={`w-28 rounded-lg border px-3 py-2 font-mono text-lg tracking-[0.3em] outline-none ${value.length === 4 ? (ok ? 'border-success' : 'border-danger') : 'border-gray-300'}`} />
        <button className="btn-ghost !py-1 text-xs" onClick={() => onChange(order.deliveryOtp ?? '')}>Customer reads it out</button>
      </div>
      {value.length === 4 && !ok && <div className="text-[11px] text-danger">That OTP doesn’t match. Ask the customer again.</div>}
      <div className="text-[11px] text-ink-muted">Demo: this customer’s OTP is <span className="font-mono font-semibold text-ink">{order.deliveryOtp}</span> (they see it on their order page).</div>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${done ? 'bg-success' : 'bg-ink'}`}>{done ? <Check size={11} /> : n}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
