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
  const [cancel, setCancel] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setCancel((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const keptTotal = lines.filter((l) => !cancel.has(l.key)).reduce((a, l) => a + l.amount, 0);
  const sellers = new Set(lines.map((l) => l.seller)).size;

  return (
    <Sheet open onClose={onClose} title={t('chooseItemsBtn')}>
      {lines.length === 0 ? (
        <div className="p-4 text-sm text-ink-muted">This order has already been confirmed or shipped.</div>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-[13px] text-ink-muted">
            Tap <b>Cancel</b> on anything you don’t want. The rest ships{sellers > 1 ? ` (${sellers} parcels from ${sellers} sellers, arriving together)` : ''}.
          </p>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {lines.map((l) => {
              const product = products.find((p) => p.id === l.productId);
              const off = cancel.has(l.key);
              return (
                <div key={l.key} className={`flex items-center gap-3 p-2.5 ${off ? 'bg-red-50/50' : ''}`}>
                  {product && <ProductImage product={product} className={`h-12 w-10 rounded-md ${off ? 'opacity-40' : ''}`} emojiSize="text-xl" />}
                  <div className={`min-w-0 flex-1 text-[13px] ${off ? 'text-ink-muted line-through' : ''}`}>
                    <div className="truncate font-medium">{l.title}{l.size ? ` · ${l.size}` : ''}{l.qty > 1 ? ` × ${l.qty}` : ''}</div>
                    <div className="text-[11px] text-ink-muted">{l.seller} · {rupees(l.amount)}</div>
                  </div>
                  <button onClick={() => toggle(l.key)} aria-pressed={!off}
                    className={`chip !px-3 !py-1.5 text-[12px] font-semibold ${off ? 'border border-gray-300 bg-white text-ink' : 'border border-danger/40 bg-white text-danger'}`}>
                    {off ? <><Check size={13} /> Keep</> : <><X size={13} /> Cancel</>}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Keeping {lines.length - cancel.size} of {lines.length} · pay on delivery</span>
            <b>{rupees(keptTotal)}</b>
          </div>
          <button className="btn-primary w-full !py-3" onClick={() => {
            const { kept, cancelled } = applyConfirmChoices(orderId, [...cancel], 'whatsapp');
            showToast(!kept.length ? t('ivrAllCancelled', { n: cancelled.length }) : !cancelled.length ? t('ivrAllConfirmed', { n: kept.length }) : `Keeping ${kept.length}, cancelled ${cancelled.length}`);
            onClose();
          }}>
            {cancel.size === 0 ? t('confirmAllBtn') : cancel.size === lines.length ? t('cancelAllBtn') : `Confirm ${lines.length - cancel.size}, cancel ${cancel.size}`}
          </button>
        </div>
      )}
    </Sheet>
  );
}
