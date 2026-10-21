import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useStore } from '../../store';
import { useUi } from '../../store/ui';
import { rupees } from '../../lib/format';
import { useT } from '../../lib/strings';
import { applyConfirmChoices, confirmGroup, confirmLines } from '../../services/ivr';
import { ProductImage, Sheet } from './ui';

/** P1 "Keep some, cancel some": one checkout (possibly several sellers), choose item by item before it ships. */
export function ConfirmItemsSheet({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  useStore((s) => s.orders); // re-render if the orders change while open
  const products = useStore((s) => s.products);
  const showToast = useUi((s) => s.showToast);
  const t = useT();
  const group = confirmGroup(orderId);
  const lines = confirmLines(group);
  // pieces to cancel per line: one piece = Cancel / Keep, 2+ pieces = − / + how many to keep
  const [cancel, setCancel] = useState<Record<string, number>>({});
  const cq = (key: string) => cancel[key] ?? 0;
  const setKeep = (key: string, qty: number, keep: number) => setCancel((c) => ({ ...c, [key]: qty - Math.max(0, Math.min(qty, keep)) }));
  const pieces = lines.reduce((a, l) => a + l.qty, 0);
  const cancelledPieces = lines.reduce((a, l) => a + cq(l.key), 0);
  const keptPieces = pieces - cancelledPieces;
  const keptTotal = lines.reduce((a, l) => a + l.price * (l.qty - cq(l.key)), 0);
  const sellers = new Set(lines.map((l) => l.seller)).size;
  const sameDay = new Set(group.map((o) => o.slot.date)).size <= 1;

  return (
    <Sheet open onClose={onClose} title={t('chooseItemsBtn')}>
      {lines.length === 0 ? (
        <div className="p-4 text-sm text-ink-muted">This order has already been confirmed or shipped.</div>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-[13px] text-ink-muted">
            Tap <b>Cancel</b> on anything you don’t want{lines.some((l) => l.qty > 1) ? <>, or use <b>− / +</b> to keep fewer</> : null}. The rest ships{sellers > 1 ? ` (${sellers} parcels from ${sellers} sellers, ${sameDay ? 'arriving together' : 'each arriving on its own day'})` : ''}.
          </p>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {lines.map((l) => {
              const product = products.find((p) => p.id === l.productId);
              const keep = l.qty - cq(l.key);
              const off = keep === 0;
              return (
                <div key={l.key} className={`flex items-center gap-3 p-2.5 ${off ? 'bg-red-50/50' : ''}`}>
                  {product && <ProductImage product={product} className={`h-12 w-10 rounded-md ${off ? 'opacity-40' : ''}`} emojiSize="text-xl" />}
                  <div className={`min-w-0 flex-1 text-[13px] ${off ? 'text-ink-muted line-through' : ''}`}>
                    <div className="truncate font-medium">{l.title}{l.size ? ` · ${l.size}` : ''}{l.qty > 1 ? ` × ${l.qty}` : ''}</div>
                    <div className="text-[11px] text-ink-muted">{l.seller} · {rupees(l.price)}{l.qty > 1 ? ' each' : ''}</div>
                  </div>
                  {l.qty > 1 ? (
                    <div className="flex shrink-0 flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <button className="h-7 w-7 rounded-full border border-gray-300 bg-white text-base leading-none disabled:opacity-40" disabled={keep === 0}
                          aria-label={`Keep fewer ${l.title}`} onClick={() => setKeep(l.key, l.qty, keep - 1)}>−</button>
                        <b className="w-4 text-center text-sm">{keep}</b>
                        <button className="h-7 w-7 rounded-full border border-gray-300 bg-white text-base leading-none disabled:opacity-40" disabled={keep === l.qty}
                          aria-label={`Keep more ${l.title}`} onClick={() => setKeep(l.key, l.qty, keep + 1)}>+</button>
                      </div>
                      <span className="text-[10px] text-ink-muted">keep {keep} of {l.qty}</span>
                    </div>
                  ) : (
                    <button onClick={() => setKeep(l.key, 1, off ? 1 : 0)} aria-pressed={!off}
                      className={`chip !px-3 !py-1.5 text-[12px] font-semibold ${off ? 'border border-gray-300 bg-white text-ink' : 'border border-danger/40 bg-white text-danger'}`}>
                      {off ? <><Check size={13} /> Keep</> : <><X size={13} /> Cancel</>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Keeping {keptPieces} of {pieces} · pay on delivery</span>
            <b>{rupees(keptTotal)}</b>
          </div>
          <button className="btn-primary w-full !py-3" onClick={() => {
            applyConfirmChoices(orderId, cancel, 'whatsapp');
            showToast(!keptPieces ? t('ivrAllCancelled', { n: pieces }) : !cancelledPieces ? t('ivrAllConfirmed', { n: pieces }) : `Keeping ${keptPieces}, cancelled ${cancelledPieces}`);
            onClose();
          }}>
            {cancelledPieces === 0 ? t('confirmAllBtn') : keptPieces === 0 ? t('cancelAllBtn') : `Confirm ${keptPieces}, cancel ${cancelledPieces}`}
          </button>
        </div>
      )}
    </Sheet>
  );
}
