import type { CartItem, Payment } from '../../types';
import { rupees } from '../../lib/format';
import { priceSummary } from '../../services/orders';

export function PriceDetails({ items, payment }: { items: CartItem[]; payment?: Payment }) {
  const s = priceSummary(items, payment);
  const count = items.reduce((a, i) => a + i.qty, 0);
  return (
    <section className="bg-white px-4 py-3 text-sm">
      <div className="mb-2 font-semibold">Price Details ({count} item{count > 1 ? 's' : ''})</div>
      <div className="space-y-1.5">
        <Row label="Total MRP" value={rupees(s.mrp)} />
        <Row label="Discount on MRP" value={`− ${rupees(s.discount)}`} green />
        <Row label="Delivery charges" value="FREE" green />
        {s.upiDiscount > 0 && <Row label="UPI discount" value={`− ${rupees(s.upiDiscount)}`} green />}
      </div>
      <div className="mt-2 flex justify-between border-t border-dashed border-gray-300 pt-2 font-bold">
        <span>Order Total</span><span>{rupees(s.total)}</span>
      </div>
      <div className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-center text-xs font-medium text-success">
        Yay! You're saving {rupees(s.discount + s.upiDiscount)} on this order
      </div>
    </section>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={green ? 'font-medium text-success' : ''}>{value}</span>
    </div>
  );
}
