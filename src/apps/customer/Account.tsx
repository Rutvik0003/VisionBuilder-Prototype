import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ChevronRight, Globe, MapPin, MapPinOff, Package, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useAddresses, useCurrentCustomer, useStore } from '../../store';
import { useUi } from '../../store/ui';
import type { Address } from '../../types';
import { CONFIDENCE_BADGE, addressInUse, deleteAddress, removePin, setDefaultAddress } from '../../services/addresses';
import { FeatureTag } from '../../components/FeatureTag';
import { BottomNav, EmptyState, PageHeader, Screen, Sheet } from './ui';
import { ChildLockSettings } from './ChildLock';

export function Account() {
  const customer = useCurrentCustomer();
  const addressCount = useAddresses(customer.id).length;
  const { lang, setLang, setAccount } = useStore();
  const [switching, setSwitching] = useState(false);
  const nav = useNavigate();
  const other = customer.id === 'existing' ? 'new' : 'existing';

  return (
    <Screen header={<PageHeader title="Account" back="/customer" />} footer={<BottomNav />}>
      <section className="flex items-center gap-3 bg-white px-4 py-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
          {customer.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </span>
        <div>
          <div className="font-semibold">{customer.name}</div>
          <div className="text-[13px] text-ink-muted">{customer.phone}</div>
          <span className="chip mt-1 bg-gray-100 text-ink-muted">{customer.id === 'existing' ? 'Existing user' : 'New user'}</span>
        </div>
      </section>
      <nav className="mt-2 divide-y divide-gray-100 bg-white">
        <Row to="/customer/orders" icon={<Package size={18} />} label="My Orders" />
        <Row to="/customer/addresses" icon={<MapPin size={18} />} label="Addresses" hint={`${addressCount}`} />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-brand"><Globe size={18} /></span>
          <span className="flex-1 text-sm">Language</span>
          <div className="flex overflow-hidden rounded-md border border-gray-300 text-xs">
            {(['en', 'hi'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-2.5 py-1 ${lang === l ? 'bg-brand text-white' : 'bg-white'}`}>{l === 'en' ? 'English' : 'हिंदी'}</button>
            ))}
          </div>
        </div>
      </nav>

      <div className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Settings</div>
      <nav className="divide-y divide-gray-100 bg-white">
        <ChildLockSettings />
        <button onClick={() => setSwitching(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50">
          <span className="text-brand"><ArrowLeftRight size={18} /></span>
          <span className="flex-1 text-sm">Switch account</span>
          <ChevronRight size={17} className="text-ink-muted" />
        </button>
      </nav>

      <Sheet open={switching} onClose={() => setSwitching(false)} title="Switch account">
        <div className="space-y-2 p-4">
          <p className="text-sm text-ink-muted">Sign in as the {other === 'new' ? 'New User (Kavita, no address yet)' : 'Existing User (Rekha, 3 saved addresses)'}?</p>
          <button className="btn-primary w-full !py-3" onClick={() => { setAccount(other); setSwitching(false); nav('/customer'); }}>
            Switch to {other === 'new' ? 'New User' : 'Existing User'}
          </button>
        </div>
      </Sheet>
    </Screen>
  );
}

function Row({ to, icon, label, hint }: { to: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50">
      <span className="text-brand">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      <ChevronRight size={17} className="text-ink-muted" />
    </Link>
  );
}

export function ConfidenceBadge({ a }: { a: Address }) {
  const b = CONFIDENCE_BADGE[a.confidence];
  return <span className={`chip ${b.tone}`}>{b.text(a)} <FeatureTag id={a.confidence === 'L3' ? 'C2-F2' : 'C2-F1'} /></span>;
}

export function AddressBook() {
  const customer = useCurrentCustomer();
  const addresses = useAddresses(customer.id);
  const showToast = useUi((s) => s.showToast);
  const [toDelete, setToDelete] = useState<Address | null>(null);
  const [toUnpin, setToUnpin] = useState<Address | null>(null);
  const blocked = toDelete ? addressInUse(toDelete.id) : false;

  return (
    <Screen
      header={<PageHeader title="Addresses" back="/customer/account" />}
      footer={
        <div className="shrink-0 border-t border-gray-200 bg-white p-3">
          <Link to="/customer/addresses/new" className="btn-outline w-full !py-3"><Plus size={16} /> Add new address</Link>
        </div>
      }
    >
      {addresses.length === 0 ? (
        <EmptyState icon={<MapPin />} title="No saved addresses" sub="Add an address to see delivery dates and check out faster." />
      ) : (
        <div className="space-y-2 p-3">
          {addresses.map((a) => {
            const isDefault = customer.defaultAddressId === a.id;
            return (
              <div key={a.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="p-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="chip bg-gray-100 font-semibold text-ink">{a.label}</span>
                    {isDefault && <span className="chip bg-brand text-white">Default</span>}
                    <ConfidenceBadge a={a} />
                  </div>
                  <div className="mt-1.5 font-semibold">{a.name}</div>
                  <div className="text-ink-muted">{a.line1}, {a.area}, {a.city} – {a.pincode}</div>
                  {a.directions && <div className="mt-0.5 text-[12px] text-ink-muted">🧭 {a.directions}</div>}
                  {!a.hubId && <div className="mt-0.5 text-[11px] text-amber-700">Outside the pilot area · standard delivery</div>}
                </div>
                <div className="flex divide-x divide-gray-100 border-t border-gray-100 text-xs font-semibold">
                  <Link to={`/customer/addresses/${a.id}/edit`} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-brand hover:bg-brand-light/50"><Pencil size={13} /> Edit</Link>
                  <button onClick={() => setToDelete(a)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-danger hover:bg-red-50"><Trash2 size={13} /> Delete</button>
                  {!isDefault && (
                    <button onClick={() => { setDefaultAddress(customer.id, a.id); showToast('Default address updated'); }}
                      className="flex flex-1 items-center justify-center gap-1 py-2.5 text-ink hover:bg-gray-50"><Star size={13} /> Set default</button>
                  )}
                  {(a.confidence === 'L2' || a.confidence === 'L3') && (
                    <button onClick={() => setToUnpin(a)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-ink-muted hover:bg-gray-50"><MapPinOff size={13} /> Remove pin</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!toDelete} onClose={() => setToDelete(null)} title="Delete this address?">
        {toDelete && (
          <div className="space-y-4 p-4">
            <p className="text-sm text-ink-muted">{toDelete.label} · {toDelete.line1}, {toDelete.area}, {toDelete.city} – {toDelete.pincode}</p>
            {blocked ? (
              <>
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This address has an order on the way. You can delete it after delivery.</p>
                <button className="btn-outline w-full !py-3" onClick={() => setToDelete(null)}>OK</button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-outline !py-3" onClick={() => setToDelete(null)}>Cancel</button>
                <button className="btn bg-danger !py-3 text-white" onClick={() => { deleteAddress(toDelete.id); setToDelete(null); showToast('Address deleted'); }}>Delete</button>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={!!toUnpin} onClose={() => setToUnpin(null)} title="Remove saved pin?">
        {toUnpin && (
          <div className="space-y-4 p-4">
            <p className="text-sm text-ink-muted">
              {toUnpin.confidence === 'L3'
                ? 'Riders have learned this door from past deliveries. Removing it means the next rider will rely on the address text.'
                : 'The rider will rely on the address text instead of your pin.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline !py-3" onClick={() => setToUnpin(null)}>Cancel</button>
              <button className="btn-primary !py-3" onClick={() => { removePin(toUnpin.id); setToUnpin(null); showToast('Pin removed'); }}>Remove</button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
