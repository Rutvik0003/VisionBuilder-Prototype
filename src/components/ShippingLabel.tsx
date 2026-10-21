import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { itemsLabel } from '../services/catalog';
import QRCode from 'qrcode';
import { Printer, X } from 'lucide-react';
import { useStore } from '../store';
import type { Order } from '../types';
import { fmtDate, rupees } from '../lib/format';
import { encodeDigipin } from '../services/digipin';
import { deliveryPoint } from '../services/routing';
import { FeatureTag } from './FeatureTag';

/** X2 · Shipping label preview with DIGIPIN + QR (Valmo and 3PL alike). */
export function ShippingLabel({ order, onClose }: { order: Order; onClose: () => void }) {
  const customer = useStore((s) => s.customers.find((c) => c.id === order.customerId)!);
  const address = useStore((s) => s.addresses.find((a) => a.id === order.addressId)!);
  const hub = useStore((s) => s.hubs.find((h) => h.id === order.hubId));
  const products = useStore((s) => s.products);
  const product = products.find((p) => p.id === order.items[0].productId)!;
  const point = deliveryPoint(address);
  // Only pinned (L2) or delivery-verified (L3) addresses have a real DIGIPIN; otherwise the rider uses the address text.
  const hasPin = !!address.pin || !!address.learned;
  const digipin = hasPin ? encodeDigipin(point.lat, point.lng) : '';
  const [qr, setQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(hasPin ? `MEESHO|${order.id}|${digipin}|${point.lat.toFixed(6)},${point.lng.toFixed(6)}` : `MEESHO|${order.id}|NO-PIN|${address.pincode}`, { margin: 1, width: 180 })
      .then(setQr).catch(() => setQr(''));
  }, [order.id, digipin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Rendered on <body>: opened from a table cell, it must not inherit that cell's nowrap / right alignment.
    createPortal(<div className="fixed inset-0 z-[700] flex items-center justify-center whitespace-normal bg-black/40 p-4 text-left" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <span className="font-semibold">Shipping label</span> <FeatureTag id="X2" />
          <button className="ml-auto rounded-full p-1 hover:bg-gray-100" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="break-words rounded-lg border-2 border-ink p-3 font-mono text-[12px]">
          <div className="flex items-center justify-between border-b border-dashed border-gray-400 pb-2">
            <span className="text-base font-bold">{hub ? 'VALMO' : '3PL PARTNER'}</span>
            <span>{order.payment === 'COD' ? `COD ${rupees(order.total)}` : 'PREPAID'}</span>
          </div>
          <div className="flex gap-3 py-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-[10px] uppercase text-gray-500">Deliver to</div>
              <div className="font-bold">{customer.name}</div>
              <div>{address.line1}, {address.area}</div>
              <div>{address.city} – {address.pincode}</div>
              <div className="text-[10px] text-gray-600">Ph: {customer.phone} (masked)</div>
            </div>
            {qr ? <img src={qr} alt="QR code with DIGIPIN" className="h-24 w-24 shrink-0" /> : <div className="h-24 w-24 shrink-0 bg-gray-100" />}
          </div>
          {hasPin ? (
            <div className="rounded bg-gray-900 px-2 py-1.5 text-center text-white">
              <div className="text-[9px] uppercase tracking-widest text-white/60">DIGIPIN</div>
              <div className="text-lg font-bold tracking-widest">{digipin}</div>
            </div>
          ) : (
            <div className="rounded border border-dashed border-gray-400 px-2 py-1.5 text-center text-gray-600">
              <div className="text-[9px] uppercase tracking-widest">DIGIPIN</div>
              <div className="text-[12px] font-bold">NOT SET · use the address above</div>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-dashed border-gray-400 pt-2">
            <span>#{order.id}</span>
            <span>{hub ? `${hub.name} · ${fmtDate(order.slot.date)}` : fmtDate(order.slot.date)}</span>
          </div>
          <div className="mt-1 text-[10px] text-gray-600">{itemsLabel(order, products)} · sold by {product.sellerName}</div>
          {order.openBox && <div className="mt-1 text-[10px] font-bold">OPEN-BOX · CHECK BEFORE PAY</div>}
          {order.redirectOf && <div className="mt-1 text-[10px] font-bold">REDIRECT RESALE · NEW INVOICE (was #{order.redirectOf})</div>}
        </div>
        <button className="btn-primary mt-3 w-full" onClick={onClose}><Printer size={15} /> Print (simulated)</button>
      </div>
    </div>, document.body)
  );
}

export function LabelButton({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost !py-1 text-[11px] text-ink-muted" onClick={() => setOpen(true)}><Printer size={12} /> Label</button>
      {open && <ShippingLabel order={order} onClose={() => setOpen(false)} />}
    </>
  );
}
