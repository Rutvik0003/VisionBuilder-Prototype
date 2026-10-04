import { useState } from 'react';
import { ChevronRight, Delete, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useCurrentCustomer } from '../../store';
import { useUi } from '../../store/ui';
import { useNow } from '../../lib/time';
import {
  MAX_WRONG, SETTINGS_KEY, disableChildLock, enableChildLock, lockedFor, requestPinResetOtp, resetPinWithOtp, verifyPin,
} from '../../services/childLock';
import { Sheet } from './ui';

// ---------------------------------------------------------------- keypad

function PinPad({ length = 4, value, onChange, error }: { length?: number; value: string; onChange: (v: string) => void; error?: boolean }) {
  return (
    <div className="space-y-4">
      <div className={`flex justify-center gap-3 ${error ? 'animate-[shake_.3s]' : ''}`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 ${i < value.length ? (error ? 'border-danger bg-danger' : 'border-brand bg-brand') : 'border-gray-300'}`} />
        ))}
      </div>
      <div className="mx-auto grid max-w-[240px] grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => (
          k === '' ? <span key="blank" /> : (
            <button key={k} onClick={() => (k === 'del' ? onChange(value.slice(0, -1)) : value.length < length && onChange(value + k))}
              className="flex h-12 items-center justify-center rounded-xl bg-gray-100 text-lg font-semibold active:bg-gray-200">
              {k === 'del' ? <Delete size={18} /> : k}
            </button>
          )
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- set / change PIN

function NewPinFlow({ onDone }: { onDone: (pin: string) => void }) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const confirming = first.length === 4;
  return (
    <div className="space-y-3">
      <p className="text-center text-sm">{confirming ? 'Re-enter the PIN to confirm' : 'Choose a 4-digit PIN'}</p>
      <PinPad value={confirming ? second : first} error={mismatch} onChange={(v) => {
        setMismatch(false);
        if (!confirming) { setFirst(v); return; }
        setSecond(v);
        if (v.length === 4) {
          if (v === first) onDone(v);
          else { setMismatch(true); setTimeout(() => { setFirst(''); setSecond(''); setMismatch(false); }, 700); }
        }
      }} />
      {mismatch && <p className="text-center text-xs text-danger">PINs didn’t match. Start again.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- forgot PIN → OTP

function ResetFlow({ onDone }: { onDone: () => void }) {
  const customer = useCurrentCustomer();
  const showToast = useUi((s) => s.showToast);
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sentCode) {
    return (
      <div className="space-y-3 text-center">
        <KeyRound size={28} className="mx-auto text-brand" />
        <p className="text-sm">We’ll send a one-time code to your registered number <b>{customer.phone}</b>.</p>
        <button className="btn-primary w-full !py-3" onClick={() => { setSentCode(requestPinResetOtp(customer.id)); showToast('OTP sent by SMS'); }}>Send OTP</button>
      </div>
    );
  }
  if (!verified) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm">Enter the 6-digit code sent to {customer.phone}</p>
        <PinPad length={6} value={otp} error={!!error} onChange={(v) => { setError(null); setOtp(v); }} />
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        <button className="btn-primary w-full !py-3" disabled={otp.length !== 6} onClick={() => {
          // validate the code first; the new PIN is set in the next step with the same code
          const lock = customer.childLock;
          if (!lock?.otp || lock.otp.code !== otp) { setError('That code is wrong. Check the SMS and try again.'); setOtp(''); return; }
          if (lock.otp.expiresAt < Date.now()) { setError('Code expired. Send a new one.'); setSentCode(null); setOtp(''); return; }
          setVerified(true);
        }}>Verify</button>
        <p className="text-center text-[11px] text-ink-muted">Prototype: the SMS is in Messages. Code <span className="font-mono">{sentCode}</span></p>
      </div>
    );
  }
  return (
    <NewPinFlow onDone={(pin) => {
      const r = resetPinWithOtp(customer.id, otp, pin);
      if (r === 'ok') { showToast('New PIN set'); onDone(); }
      else { setError(r === 'expired' ? 'Code expired. Send a new one.' : 'Something went wrong. Try again.'); setVerified(false); setSentCode(null); setOtp(''); }
    }} />
  );
}

// ---------------------------------------------------------------- PIN gate (before ordering / turning off)

export function PinGateSheet({ open, title, onClose, onSuccess, verify = verifyPin, lockKey = SETTINGS_KEY }: {
  open: boolean; title: string; onClose: () => void; onSuccess: () => void;
  verify?: (customerId: string, pin: string, key?: string) => ReturnType<typeof verifyPin>;
  lockKey?: string; // which order attempt this PIN is for (a lockout only blocks that one)
}) {
  const isOrder = lockKey !== SETTINGS_KEY;
  useNow(1000); // live lockout countdown
  const customer = useCurrentCustomer();
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const locked = lockedFor(customer, lockKey);

  const close = () => { setPin(''); setMsg(null); setForgot(false); onClose(); };

  return (
    <Sheet open={open} onClose={close} title={forgot ? 'Reset child-lock PIN' : title}>
      <div className="space-y-4 p-4">
        {forgot ? <ResetFlow onDone={() => { setForgot(false); setMsg('PIN reset. Enter your new PIN.'); }} /> : locked > 0 ? (
          <div className="space-y-3 text-center">
            <LockKeyhole size={30} className="mx-auto text-danger" />
            <p className="text-sm font-semibold">Too many wrong PINs</p>
            {isOrder && <p className="text-[12px] text-ink-muted">Only this order is blocked. You can still order something else with the PIN.</p>}
            <p className="text-sm text-ink-muted">You can try again in <span className="font-mono font-bold text-ink">{Math.floor(locked / 60000)}:{String(Math.floor(locked / 1000) % 60).padStart(2, '0')}</span></p>
            <button className="text-sm font-semibold text-brand" onClick={() => setForgot(true)}>Forgot PIN?</button>
          </div>
        ) : (
          <>
            <p className="text-center text-sm text-ink-muted">Enter your 4-digit child-lock PIN</p>
            <PinPad value={pin} error={!!msg && !msg.startsWith('PIN reset')} onChange={(v) => {
              setMsg(null); setPin(v);
              if (v.length === 4) {
                const r = verify(customer.id, v, lockKey);
                if (r.ok) { setPin(''); onSuccess(); return; }
                setPin('');
                setMsg(r.lockedMs > 0 ? (isOrder ? 'This order is locked for 5 minutes.' : 'Locked for 5 minutes.') : `Wrong PIN. ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? '' : 's'} left.`);
              }
            }} />
            {msg && <p className={`text-center text-xs ${msg.startsWith('PIN reset') ? 'text-success' : 'text-danger'}`}>{msg}</p>}
            <button className="mx-auto block text-sm font-semibold text-brand" onClick={() => setForgot(true)}>Forgot PIN?</button>
            <p className="text-center text-[11px] text-ink-muted">{MAX_WRONG} wrong attempts lock {isOrder ? 'this order' : 'it'} for 5 minutes.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Wrap any "place order" action: asks for the PIN first when child lock is on. `key` identifies this order attempt. */
export function useChildLockGate() {
  const customer = useCurrentCustomer();
  const [pending, setPending] = useState<{ action: () => void; key: string } | null>(null);
  const guard = (action: () => void, key: string) => {
    if (!customer.childLock) action();
    else setPending({ action, key });
  };
  const gate = (
    <PinGateSheet open={!!pending} title="Child lock" lockKey={pending?.key} onClose={() => setPending(null)}
      onSuccess={() => { const p = pending; setPending(null); p?.action(); }} />
  );
  return { guard, gate };
}

// ---------------------------------------------------------------- Account → Settings

export function ChildLockSettings() {
  const customer = useCurrentCustomer();
  const showToast = useUi((s) => s.showToast);
  const [sheet, setSheet] = useState<'enable' | 'disable' | 'change' | 'forgot' | null>(null);
  const [changeVerified, setChangeVerified] = useState(false);
  const on = !!customer.childLock;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="text-brand"><ShieldCheck size={18} /></span>
        <span className="flex-1">
          <span className="block text-sm">Child PIN Lock</span>
          <span className="block text-[11px] text-ink-muted">{on ? 'PIN needed before every order' : 'Ask for a 4-digit PIN before placing an order'}</span>
        </span>
        <button onClick={() => setSheet(on ? 'disable' : 'enable')} aria-pressed={on} aria-label="Child PIN Lock"
          className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-brand' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>
      {on && (
        <>
          <button onClick={() => { setChangeVerified(false); setSheet('change'); }} className="flex w-full items-center gap-3 px-4 py-3 pl-11 text-left text-sm active:bg-gray-50">
            <span className="flex-1">Change PIN</span><ChevronRight size={16} className="text-ink-muted" />
          </button>
          <button onClick={() => setSheet('forgot')} className="flex w-full items-center gap-3 px-4 py-3 pl-11 text-left text-sm active:bg-gray-50">
            <span className="flex-1">Forgot PIN?</span><ChevronRight size={16} className="text-ink-muted" />
          </button>
        </>
      )}

      <Sheet open={sheet === 'enable'} onClose={() => setSheet(null)} title="Turn on child lock">
        <div className="p-4">
          <p className="mb-3 text-center text-[12px] text-ink-muted">Anyone placing an order on this account will need this PIN.</p>
          <NewPinFlow onDone={(pin) => { enableChildLock(customer.id, pin); setSheet(null); showToast('Child lock is on'); }} />
        </div>
      </Sheet>

      <PinGateSheet open={sheet === 'disable'} title="Turn off child lock" onClose={() => setSheet(null)}
        verify={disableChildLock} onSuccess={() => { setSheet(null); showToast('Child lock is off'); }} />

      <PinGateSheet open={sheet === 'change' && !changeVerified} title="Enter current PIN" onClose={() => setSheet(null)}
        onSuccess={() => setChangeVerified(true)} />
      <Sheet open={sheet === 'change' && changeVerified} onClose={() => setSheet(null)} title="New child-lock PIN">
        <div className="p-4"><NewPinFlow onDone={(pin) => { enableChildLock(customer.id, pin); setSheet(null); showToast('PIN changed'); }} /></div>
      </Sheet>

      <Sheet open={sheet === 'forgot'} onClose={() => setSheet(null)} title="Reset child-lock PIN">
        <div className="p-4"><ResetFlow onDone={() => setSheet(null)} /></div>
      </Sheet>
    </>
  );
}
