import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff } from 'lucide-react';
import { useStore } from '../../store';
import { fmtDate, rupees } from '../../lib/format';
import { useT } from '../../lib/strings';
import { FeatureTag } from '../../components/FeatureTag';
import { homeYes } from '../../services/flow';
import { cancelUnconfirmed, canCancelUnshipped, confirmCallMissed, confirmOrder, endCall } from '../../services/ivr';

type Phase = 'ringing' | 'menu' | 'ended';
const RING_TIMEOUT_MS = 30_000;

/**
 * Incoming automated call on the customer phone (shared store, so the hub/simulator can trigger it):
 *  • confirm — P1.4 order confirmation: 1 confirm · 2 cancel · End
 *  • vaani   — T2.7 still-home call: 1 I'll be home · 2 change the day
 */
export function IvrCall() {
  const call = useStore((s) => s.call);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (!call) return;
    const id = setTimeout(() => setVisible(true), Math.max(0, call.ringAt - Date.now()));
    return () => clearTimeout(id);
  }, [call]);
  if (!call || !visible) return null;
  return <CallScreen key={`${call.orderId}-${call.ringAt}`} orderId={call.orderId} kind={call.kind} />;
}

function CallScreen({ orderId, kind }: { orderId: string; kind: 'confirm' | 'vaani' }) {
  const t = useT();
  const nav = useNavigate();
  const order = useStore((s) => s.orders.find((o) => o.id === orderId));
  const customer = useStore((s) => s.customers.find((c) => c.id === order?.customerId));
  const product = useStore((s) => s.products.find((p) => p.id === order?.items[0].productId));
  const log = useStore((s) => s.log);
  const [phase, setPhase] = useState<Phase>('ringing');
  const [lines, setLines] = useState<{ who: 'ivr' | 'you'; text: string }[]>([]);
  const [secs, setSecs] = useState(0);
  const [decided, setDecided] = useState(false);

  const missed = () => {
    if (kind === 'confirm') confirmCallMissed(orderId);
    else log('C1-F2', 'vaani_call_missed', 'system', {}, orderId); // the Vaani voice message is already in Messages
    endCall();
  };

  useEffect(() => {
    if (phase !== 'ringing') return;
    const id = setTimeout(missed, RING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'menu') return;
    const id = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  if (!order || !customer || !product) return null;
  const say = (text: string, who: 'ivr' | 'you' = 'ivr') => setLines((l) => [...l, { who, text }]);
  const finish = (text: string, after?: () => void) => {
    say(text); setDecided(true); setPhase('ended');
    setTimeout(() => { endCall(); after?.(); }, 1800);
  };

  const answer = () => {
    log(kind === 'confirm' ? 'P1' : 'C1-F2', kind === 'confirm' ? 'ivr_call_answered' : 'vaani_call_answered', 'customer', {}, orderId);
    setPhase('menu');
    setLines([{
      who: 'ivr',
      text: kind === 'confirm'
        ? t('ivrScriptConfirm', { name: customer.name.split(' ')[0], item: product.title, amount: rupees(order.total), when: fmtDate(order.slot.date) })
        : t('ivrScriptVaani', { when: fmtDate(order.slot.date) }),
    }]);
  };

  const press = (key: string) => {
    say(`You pressed ${key}`, 'you');
    if (kind === 'confirm') {
      if (key === '1') { confirmOrder(orderId, 'call'); finish(t('ivrConfirmed')); }
      else if (key === '2') {
        if (!canCancelUnshipped(orderId)) { say('This order has already shipped, so it can’t be cancelled on this call.'); return; }
        cancelUnconfirmed(orderId, 'call'); finish(t('ivrCancelled'));
      }
    } else {
      if (key === '1') { homeYes([orderId]); log('C1-F2', 'vaani_pressed_1', 'customer', {}, orderId); finish(t('hcConfirmed', { when: fmtDate(order.slot.date) })); }
      else if (key === '2') { log('C1-F2', 'vaani_pressed_2', 'customer', {}, orderId); finish('Let’s pick a new day.', () => nav(`/customer/orders/${orderId}?sheet=change`)); }
    }
  };

  const hangUp = () => { if (!decided) missed(); else endCall(); };
  const caller = kind === 'confirm' ? t('ivrCaller') : t('vaaniCaller');

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-gradient-to-b from-brand-light to-white text-ink">
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-2xl font-bold lowercase text-white shadow-md">m</span>
        <div className="mt-3 text-lg font-semibold">{caller} <FeatureTag id={kind === 'confirm' ? 'P1' : 'C1-F2'} /></div>
        <div className="text-sm text-ink-muted">
          {phase === 'ringing' ? t('ivrIncoming') : phase === 'ended' ? 'Call ended' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
        </div>
        <div className="mt-1 text-xs text-ink-muted/70">Order #{order.id}</div>
      </div>

      {phase === 'ringing' ? (
        <div className="mt-auto flex justify-around px-10 pb-16">
          <CallButton color="bg-danger" label={t('ivrDecline')} onClick={missed}><PhoneOff size={26} /></CallButton>
          <CallButton color="bg-success animate-pulse" label={t('ivrAnswer')} onClick={answer}><Phone size={26} /></CallButton>
        </div>
      ) : (
        <>
          <div className="mt-5 flex-1 space-y-2 overflow-y-auto px-4">
            {lines.map((l, i) => (
              <div key={i} className={`w-fit max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-snug ${l.who === 'ivr' ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'ml-auto bg-brand text-white'}`}>{l.text}</div>
            ))}
          </div>
          {phase === 'menu' && (
            <div className="grid grid-cols-2 gap-4 px-16 pt-3">
              {['1', '2'].map((k) => (
                <button key={k} onClick={() => press(k)} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl font-semibold text-ink shadow-sm ring-1 ring-gray-200 hover:bg-brand-light">{k}</button>
              ))}
            </div>
          )}
          <div className="flex justify-center pb-8 pt-4">
            <CallButton color="bg-danger" label="End" onClick={hangUp}><PhoneOff size={24} /></CallButton>
          </div>
        </>
      )}
    </div>
  );
}

function CallButton({ color, label, onClick, children }: { color: string; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 text-xs text-ink-muted">
      <span className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md ${color}`}>{children}</span>
      {label}
    </button>
  );
}
