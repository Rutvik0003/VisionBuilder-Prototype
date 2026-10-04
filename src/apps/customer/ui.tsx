import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Home, MessageCircle, Package, ShoppingCart, Star, User, X } from 'lucide-react';
import { SwitchApp } from '../../components/SwitchApp';
import { useBack } from '../../components/useBack';
import { useCurrentCustomer, useStore } from '../../store';
import type { OrderStatus, Product } from '../../types';
import { CUSTOMER_STATUS } from '../../services/orders';

/** Full-height screen: fixed header, scrolling body, optional fixed footer. */
export function Screen({ header, footer, children, className = '' }: {
  header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className={`min-h-0 flex-1 overflow-y-auto ${className}`}>{children}</div>
      {footer}
    </div>
  );
}

/**
 * Sub-page header: back arrow (previous screen, or `back` / customer home when there's no history),
 * title, optional actions, and the Switch-app icon.
 */
export function PageHeader({ title, sub, right, back, onBack }: {
  title: string; sub?: string; right?: ReactNode; back?: string; onBack?: () => void;
}) {
  const goBack = useBack(back ?? '/customer');
  return (
    <header className="z-10 flex h-14 shrink-0 items-center gap-1 border-b border-gray-100 bg-white px-1.5">
      <button className="rounded-full p-2 hover:bg-gray-100" onClick={() => (onBack ? onBack() : goBack())} aria-label="Back">
        <ArrowLeft size={20} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{title}</div>
        {sub && <div className="truncate text-[11px] text-ink-muted">{sub}</div>}
      </div>
      {right}
      <SwitchApp />
    </header>
  );
}

export function CartButton() {
  const customer = useCurrentCustomer();
  const count = useStore((s) => (s.cart[customer.id] ?? []).reduce((a, i) => a + i.qty, 0));
  const nav = useNavigate();
  return (
    <button className="relative rounded-full p-2 hover:bg-gray-100" onClick={() => nav('/customer/cart')} aria-label="Cart">
      <ShoppingCart size={21} />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{count}</span>
      )}
    </button>
  );
}

export function InboxButton() {
  const customer = useCurrentCustomer();
  const unread = useStore((s) => s.messages.filter((m) => m.customerId === customer.id && !m.read).length);
  const nav = useNavigate();
  return (
    <button className="relative rounded-full p-2 hover:bg-gray-100" onClick={() => nav('/customer/inbox')} aria-label="Messages">
      <Bell size={20} />
      {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />}
    </button>
  );
}

const NAV = [
  { to: '/customer', label: 'Home', icon: Home, end: true },
  { to: '/customer/orders', label: 'My Orders', icon: Package },
  { to: '/customer/inbox', label: 'Messages', icon: MessageCircle },
  { to: '/customer/account', label: 'Account', icon: User },
];

export function BottomNav() {
  return (
    <nav className="grid shrink-0 grid-cols-4 border-t border-gray-200 bg-white pb-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => `flex flex-col items-center gap-0.5 pb-1 pt-2 text-[10px] font-medium ${isActive ? 'text-brand' : 'text-ink-muted'}`}>
          {({ isActive }) => (
            <>
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Product photo with emoji-tile fallback when the file isn't there yet. */
export function ProductImage({ product, className = '', emojiSize = 'text-6xl' }: { product: Product; className?: string; emojiSize?: string }) {
  // Emoji tile renders underneath; the photo fades in only once it has actually loaded.
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`} style={{ background: product.tint }}>
      {state !== 'loaded' && <span className={`${emojiSize} drop-shadow-sm`}>{product.image}</span>}
      {state !== 'failed' && (
        <img src={product.photo} alt="" loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setState('loaded')} onError={() => setState('failed')} />
      )}
    </div>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  const color = value >= 4 ? 'bg-success' : value >= 3.5 ? 'bg-[#23BB75]' : 'bg-warning';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-0.5 rounded-full ${color} px-1.5 py-px text-[11px] font-semibold text-white`}>
        {value.toFixed(1)} <Star size={9} fill="currentColor" />
      </span>
      {count !== undefined && <span className="text-[11px] text-ink-muted">({count.toLocaleString('en-IN')})</span>}
    </span>
  );
}

const TONES = {
  brand: 'bg-brand-light text-brand',
  success: 'bg-emerald-50 text-success',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-danger',
  muted: 'bg-gray-100 text-ink-muted',
};

export function StatusChip({ status }: { status: OrderStatus }) {
  const { label, tone } = CUSTOMER_STATUS[status];
  return <span className={`chip ${TONES[tone]}`}>{label}</span>;
}

/** Bottom sheet inside the phone frame. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85%] animate-[slideUp_.2s_ease-out] overflow-y-auto rounded-t-2xl bg-white">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <div className="font-semibold">{title}</div>
          <button className="rounded-full p-1 hover:bg-gray-100" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-light text-brand">{icon}</div>
      <div className="font-semibold">{title}</div>
      {sub && <div className="mt-1 text-sm text-ink-muted">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>
      {right}
    </div>
  );
}
