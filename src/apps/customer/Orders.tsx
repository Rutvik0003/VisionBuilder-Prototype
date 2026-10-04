import { Link } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import { useCurrentCustomer, useStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { fmtDate, rupees } from '../../lib/format';
import { BottomNav, EmptyState, PageHeader, ProductImage, Screen, StatusChip } from './ui';

export function Orders() {
  const customer = useCurrentCustomer();
  const orders = useStore(useShallow((s) => s.orders.filter((o) => o.customerId === customer.id)));
  const products = useStore((s) => s.products);

  return (
    <Screen
      header={<PageHeader title="My Orders" back="/customer" />}
      footer={<BottomNav />}
    >
      {orders.length === 0 ? (
        <EmptyState icon={<Package />} title="No orders yet" sub="Orders you place will show up here."
          action={<Link to="/customer" className="btn-primary">Start Shopping</Link>} />
      ) : (
        <div className="space-y-2 py-2">
          {orders.map((o) => {
            const first = products.find((p) => p.id === o.items[0].productId)!;
            const more = o.items.length - 1;
            const done = o.status === 'DELIVERED';
            return (
              <Link key={o.id} to={`/customer/orders/${o.id}`} className="flex gap-3 bg-white p-3 active:bg-gray-50">
                <ProductImage product={first} className="h-20 w-16 shrink-0 rounded-lg" emojiSize="text-3xl" />
                <div className="min-w-0 flex-1">
                  <StatusChip status={o.status} />
                  <div className="mt-1 truncate text-sm">{first.title}{more > 0 ? ` + ${more} more` : ''}</div>
                  <div className="text-[12px] text-ink-muted">
                    {done ? 'Delivered' : `Arriving by ${fmtDate(o.promisedDate)}`} · {rupees(o.total)}
                  </div>
                </div>
                <ChevronRight size={18} className="self-center text-ink-muted" />
              </Link>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
