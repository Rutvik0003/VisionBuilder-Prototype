import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff } from 'lucide-react';
import { useStore } from '../../store';
import { fmtDate, rupees } from '../../lib/format';
import { useT } from '../../lib/strings';
import { FeatureTag } from '../../components/FeatureTag';
import { homeYes } from '../../services/flow';
import { dropSiblings } from '../../services/orders';
import {
  applyConfirmChoices, arrivalText, cancelUnconfirmed, canCancelUnshipped, confirmCallMissed, confirmGroup, confirmLines, confirmOrder, endCall,
} from '../../services/ivr';

type Phase = 'ringing' | 'menu' | 'items' | 'qty' | 'ended';
const RING_TIMEOUT_MS = 30_000;

/**
 * Incoming automated call on the customer phone (shared store, so the hub/simulator can trigger it):
 *  • confirm — P1.4 order confirmation, ONE call for the whole checkout (all sellers):
 *      1 confirm all · 2 cancel all · 3 (several items) go item by item: 1 keep / 2 cancel · End
 *  • vaani   — T2.7 still-home call: 1 I'll be home · 2 change the day
 */
export function IvrCall() {
  const call = useStore((s) => s.call);
  // The screen keeps showing for a moment after the call ends ("Call ended"), but the call itself is cleared
  // from the store at once, so a reload never rings an already-answered call again.
  const [shown, setShown] = useState<typeof call>(null);
  useEffect(() => {
    if (!call) return;
    const id = setTimeout(() => setShown(call), Math.max(0, call.ringAt - Date.now()));
    return () => clearTimeout(id);
  }, [call]);
  if (!shown) return null;
  return <CallScreen key={`${shown.orderId}-${shown.ringAt}`} orderId={shown.orderId} kind={shown.kind} onClosed={() => setShown(null)} />;
}

function CallScreen({ orderId, kind, onClosed }: { orderId: string; kind: 'confirm' | 'vaani'; onClosed: () => void }) {
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
  // Snapshot the checkout when the call starts, so the item list doesn't shift while we cancel items.
  const [group] = useState(() => (kind === 'confirm' ? confirmGroup(orderId) : []));
  const items = confirmLines(group);
  const pieces = items.reduce((a, l) => a + l.qty, 0);
  const multi = pieces > 1; // several items, or 2+ of one item
  const groupIds = group.map((o) => o.id);
  const [itemIdx, setItemIdx] = useState(0);
  const [cancel, setCancel] = useState<Record<string, number>>({}); // pieces to cancel per line
  const itemName = (i: number) => `${items[i].title}${items[i].size ? ` (${items[i].size})` : ''}`;
  const itemPrompt = (i: number) => (items[i].qty > 1
    ? t('ivrItemPromptQty', { i: i + 1, n: items.length, item: itemName(i), qty: items[i].qty, amount: rupees(items[i].amount) })
    : t('ivrItemPrompt', { i: i + 1, n: items.length, item: itemName(i), amount: rupees(items[i].amount) }));
  /** Keys shown on the call keypad for the current question. */
  const keys = phase === 'qty' ? Array.from({ length: items[itemIdx].qty - 1 }, (_, k) => String(k + 1))
    : phase === 'items' ? (items[itemIdx].qty > 1 ? ['1', '2', '3'] : ['1', '2'])
      : kind === 'confirm' && multi ? ['1', '2', '3'] : ['1', '2'];

  const missed = () => {
    if (kind === 'confirm') confirmCallMissed(orderId);
    else log('C1-F2', 'vaani_call_missed', 'system', {}, orderId); // the Vaani voice message is already in Messages
    endCall();
    onClosed();
  };

  useEffect(() => {
    if (phase !== 'ringing') return;
    const id = setTimeout(missed, RING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'menu' && phase !== 'items' && phase !== 'qty') return;
    const id = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  if (!order || !customer || !product) return null;
  const say = (text: string, who: 'ivr' | 'you' = 'ivr') => setLines((l) => [...l, { who, text }]);
  const finish = (text: string, after?: () => void) => {
    say(text); setDecided(true); setPhase('ended');
    endCall(); // answered: clear it now
    setTimeout(() => { onClosed(); after?.(); }, 1800);
  };

  const answer = () => {
    log(kind === 'confirm' ? 'P1' : 'C1-F2', kind === 'confirm' ? 'ivr_call_answered' : 'vaani_call_answered', 'customer', {}, orderId);
    setPhase('menu');
    setLines([{
      who: 'ivr',
      text: kind !== 'confirm'
        ? t('ivrScriptVaani', { when: fmtDate(order.slot.date) })
        : multi
          ? t('ivrScriptConfirmMulti', {
            name: customer.name.split(' ')[0], n: pieces, when: arrivalText(group),
            amount: rupees(group.reduce((a, o) => a + o.total, 0)), list: items.map((_, i) => `${itemName(i)}${items[i].qty > 1 ? ` × ${items[i].qty}` : ''} for ${rupees(items[i].amount)}`).join(', '),
          })
          : t('ivrScriptConfirm', { name: customer.name.split(' ')[0], item: product.title, amount: rupees(order.total), when: fmtDate(order.slot.date) }),
    }]);
  };

  const press = (key: string) => {
    say(`You pressed ${key}`, 'you');
    if (kind === 'confirm' && (phase === 'items' || phase === 'qty')) {
      const line = items[itemIdx];
      // item by item: 1 keep (all) · 2 cancel (all) · 3 keep only some → how many to keep
      if (phase === 'items' && key === '3' && line.qty > 1) { setPhase('qty'); say(t('ivrQtyPrompt', { qty: line.qty, max: line.qty - 1 })); return; }
      const cancelHere = phase === 'qty' ? line.qty - Number(key) : key === '2' ? line.qty : 0;
      const next = { ...cancel, [line.key]: cancelHere };
      setCancel(next);
      if (itemIdx + 1 < items.length) { setItemIdx(itemIdx + 1); setPhase('items'); say(itemPrompt(itemIdx + 1)); return; }
      const { kept, cancelled } = applyConfirmChoices(orderId, next, 'call');
      const name = (l: (typeof kept)[number]) => `${l.title}${l.qty > 1 ? ` × ${l.qty}` : ''}`;
      const keptN = kept.reduce((a, l) => a + l.qty, 0);
      const cancelledN = cancelled.reduce((a, l) => a + l.qty, 0);
      finish(!keptN ? t('ivrAllCancelled', { n: cancelledN }) : !cancelledN ? t('ivrAllConfirmed', { n: keptN })
        : t('choiceDone', { kept: kept.map(name).join(', '), cancelled: cancelled.map(name).join(', ') }));
    } else if (kind === 'confirm') {
      if (key === '1') { confirmOrder(groupIds, 'call'); finish(multi ? t('ivrAllConfirmed', { n: pieces }) : t('ivrConfirmed')); }
      else if (key === '2') {
        if (!canCancelUnshipped(orderId)) { say('This order has already shipped, so it can’t be cancelled on this call.'); return; }
        cancelUnconfirmed(groupIds, 'call'); finish(multi ? t('ivrAllCancelled', { n: pieces }) : t('ivrCancelled'));
      } else if (key === '3' && multi) { setPhase('items'); setItemIdx(0); setCancel({}); say(itemPrompt(0)); }
    } else {
      // Vaani: "yes" covers every parcel for this door that day
      if (key === '1') { homeYes([orderId, ...dropSiblings(order, ['ACCEPTED', 'PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON']).map((o) => o.id)]); log('C1-F2', 'vaani_pressed_1', 'customer', {}, orderId); finish(t('hcConfirmed', { when: fmtDate(order.slot.date) })); }
      else if (key === '2') { log('C1-F2', 'vaani_pressed_2', 'customer', {}, orderId); finish('Let’s pick a new day.', () => nav(`/customer/orders/${orderId}?sheet=change`)); }
    }
  };

  const hangUp = () => { if (!decided) missed(); else { endCall(); onClosed(); } };
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
          {(phase === 'menu' || phase === 'items' || phase === 'qty') && (
            <div className={`grid gap-4 pt-3 ${keys.length >= 3 ? 'grid-cols-3 px-10' : 'grid-cols-2 px-16'}`}>
              {keys.map((k) => (
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
