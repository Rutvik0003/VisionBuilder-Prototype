import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { clearInterfaceHistory, lastVisit, recordVisit, sectionOf } from '../lib/interfaceHistory';
import { useShallow } from 'zustand/react/shallow';
import { Bike, Building2, ChevronsLeft, ChevronsRight, RotateCcw, Tag, Truck, UserPlus, UserRound } from 'lucide-react';
import { useStore } from '../store';
import type { AccountId } from '../types';
import { pendingStops } from '../services/delivery';

// Always-on switcher between the stakeholder interfaces (replaces the Launcher page).
// Every app reads the same live store, so switching shows that interface's up-to-date screen.
// Each interface keeps its own history (src/lib/interfaceHistory): switching reopens its last screen, and the
// in-app back arrow steps back inside the interface you're in, never into the one you came from.

const COLLAPSE_KEY = 'meesho-sidebar-collapsed';
const read = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: fine */ } };


export function Sidebar() {
  const loc = useLocation();
  const nav = useNavigate();
  const { account, setAccount, customers, hubs, riders, orders, messages, showTags, setShowTags, resetDemo } = useStore(useShallow((s) => ({
    account: s.account, setAccount: s.setAccount, customers: s.customers, hubs: s.hubs, riders: s.riders, orders: s.orders,
    messages: s.messages, showTags: s.showTags, setShowTags: s.setShowTags, resetDemo: s.resetDemo,
  })));
  const [collapsed, setCollapsed] = useState(() => read(COLLAPSE_KEY, false));
  const [confirmReset, setConfirmReset] = useState(false);
  const here = sectionOf(loc.pathname, account);

  // record every screen change in its interface's own history (only when the screen changes, so switching the
  // customer account doesn't file the old account's screen under the new one)
  const navType = useNavigationType();
  useEffect(() => {
    const section = sectionOf(loc.pathname, useStore.getState().account);
    if (section) recordVisit(section, loc.pathname + loc.search, navType === 'REPLACE');
  }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (section: string, fallback: string) => nav(lastVisit(section) ?? fallback);
  const openCustomer = (id: AccountId) => {
    if (id !== account) setAccount(id);
    go(`customer:${id}`, '/customer');
  };

  // live counts, so you can see where something is waiting
  const unread = (id: string) => messages.filter((m) => m.customerId === id && !m.read).length;
  const withSeller = orders.filter((o) => ['PLACED', 'SHIPPED', 'IN_TRANSIT', 'DELAYED_IN_TRANSIT'].includes(o.status)).length;
  const inbound = (hubId: string) => orders.filter((o) => o.hubId === hubId && o.status === 'AT_HUB').length;
  const stops = (riderId: string) => pendingStops({ orders, riders }, riderId).length;
  const demo = customers.filter((c) => !c.background);

  return (
    <aside className={`sticky top-0 flex h-[100dvh] shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] ${collapsed ? 'w-14' : 'w-60'}`} aria-label="Switch interface">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 px-3">
        {!collapsed && <span className="text-xl font-bold lowercase tracking-tight text-brand">meesho</span>}
        {!collapsed && <span className="rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand">DICE prototype</span>}
        <button onClick={() => { setCollapsed(!collapsed); write(COLLAPSE_KEY, !collapsed); }}
          className="ml-auto rounded-md p-1.5 text-ink-muted hover:bg-gray-100" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
        </button>
      </div>

      <nav className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <Group title="Customer" collapsed={collapsed}>
          {demo.map((c) => (
            <Item key={c.id} collapsed={collapsed} active={here === `customer:${c.id}`} onClick={() => openCustomer(c.id as AccountId)}
              icon={c.id === 'existing' ? <UserRound size={17} /> : <UserPlus size={17} />}
              label={c.id === 'existing' ? 'Existing User' : 'New User'} sub={c.name} badge={unread(c.id)} />
          ))}
        </Group>

        <Group title="Seller" collapsed={collapsed}>
          <Item collapsed={collapsed} active={here === 'transit'} onClick={() => go('transit', '/transit')}
            icon={<Truck size={17} />} label="Seller & Transit" sub="Ship · transit · delays" badge={withSeller} />
        </Group>

        <Group title="Hub Manager" collapsed={collapsed}>
          {hubs.map((h) => (
            <Item key={h.id} collapsed={collapsed} active={here === `hub:${h.id}`} onClick={() => go(`hub:${h.id}`, `/hub/${h.id}`)}
              icon={<Building2 size={17} />} label={h.name} sub={h.pincodes.join(', ')} badge={inbound(h.id)} />
          ))}
        </Group>

        <Group title="Rider" collapsed={collapsed}>
          {hubs.map((h) => (
            <div key={h.id} className="space-y-0.5">
              {!collapsed && <div className="px-2 pt-1 text-[10px] text-ink-muted">{h.name}</div>}
              {riders.filter((r) => r.hubId === h.id).map((r) => (
                <Item key={r.id} collapsed={collapsed} active={here === `rider:${r.id}`} onClick={() => go(`rider:${r.id}`, `/rider/${r.id}`)}
                  icon={<Bike size={17} />} label={r.name} badge={stops(r.id)} badgeTone="neutral" />
              ))}
            </div>
          ))}
        </Group>
      </nav>

      <div className="shrink-0 space-y-2 border-t border-gray-100 p-2">
        {!collapsed && (
          <label className="flex cursor-pointer items-center gap-2 px-2 text-xs text-ink-muted">
            <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} />
            <Tag size={13} /> Show feature tags
          </label>
        )}
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} title="Reset demo"
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 ${collapsed ? 'px-0' : ''}`}>
            <RotateCcw size={14} /> {!collapsed && 'Reset demo'}
          </button>
        ) : (
          <div className="space-y-1.5 rounded-lg bg-red-50 p-2 text-[11px]">
            {!collapsed && <div>Reset all orders, addresses, messages?</div>}
            <div className="flex gap-1.5">
              <button className="flex-1 rounded-md bg-white py-1 font-medium" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="flex-1 rounded-md bg-danger py-1 font-semibold text-white" onClick={() => {
                resetDemo(); clearInterfaceHistory(); setConfirmReset(false); nav('/customer');
              }}>Reset</button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Group({ title, collapsed, children }: { title: string; collapsed: boolean; children: ReactNode }) {
  return (
    <div>
      {collapsed ? <div className="mx-2 mb-1 border-t border-gray-100" /> : <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{title}</div>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Item({ icon, label, sub, badge, badgeTone = 'brand', active, collapsed, onClick }: {
  icon: ReactNode; label: string; sub?: string; badge?: number; badgeTone?: 'brand' | 'neutral'; active: boolean; collapsed: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={collapsed ? `${label}${sub ? ` · ${sub}` : ''}` : undefined} aria-current={active ? 'page' : undefined}
      className={`relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${active ? 'bg-brand text-white' : 'text-ink hover:bg-brand-light'}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${active ? 'bg-white/15' : 'bg-gray-100 text-brand'}`}>{icon}</span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{label}</span>
          {sub && <span className={`block truncate text-[11px] ${active ? 'text-white/70' : 'text-ink-muted'}`}>{sub}</span>}
        </span>
      )}
      {!!badge && (
        <span className={`${collapsed ? 'absolute -right-0.5 -top-0.5' : ''} min-w-5 rounded-full px-1.5 text-center text-[10px] font-bold leading-5
          ${active ? 'bg-white text-brand' : badgeTone === 'brand' ? 'bg-accent text-white' : 'bg-gray-200 text-ink'}`}>{badge}</span>
      )}
    </button>
  );
}
