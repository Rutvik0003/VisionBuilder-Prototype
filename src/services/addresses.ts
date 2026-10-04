// Address book + C2-F1 pin logic.
import { customAlphabet } from 'nanoid';
import { useStore } from '../store';
import type { AccountId, Address, AddressLabel, LatLng } from '../types';
import { PINCODES, hubIdForPincode } from '../data/seed';
import { encodeDigipin } from './digipin';
import { distanceM } from './geo';
import { nowIso } from '../lib/time';
import { ACTIVE_STATUSES } from './orders';

const addrId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const get = () => useStore.getState();

export const PIN_MAX_DISTANCE_M = 3000;

export function resolvePincode(pincode: string) {
  const c = PINCODES[pincode];
  return c ? { ...c, hubId: hubIdForPincode(pincode) } : null;
}

export const KNOWN_PINCODES = Object.keys(PINCODES);

/** Small random offset in degrees (~±300 m). */
const jitter = (m = 0.006) => (Math.random() - 0.5) * m;

/** A GeoIndia-style guess and a "real door" near the pincode centre, for a brand-new address. */
export function draftGeo(pincode: string): { geoCell: Address['geoCell']; truePoint: LatLng } | null {
  const c = PINCODES[pincode];
  if (!c) return null;
  return {
    geoCell: { lat: c.lat + jitter(), lng: c.lng + jitter(), confidence: 0.4 },
    truePoint: { lat: c.lat + jitter(), lng: c.lng + jitter() },
  };
}

export function pinCheck(pincode: string, point: LatLng) {
  const c = PINCODES[pincode];
  const d = c ? distanceM(point, c) : 0;
  return { distanceM: d, outside: !!c && d > PIN_MAX_DISTANCE_M };
}

export interface AddressDraft {
  label: AddressLabel;
  name: string;
  phone: string;
  line1: string;
  area: string;
  directions: string;
  pincode: string;
  city: string;
  state: string;
}

export type PinInput = { lat: number; lng: number; source: 'gps' | 'drag' | 'remote' } | null;

const makePin = (p: NonNullable<PinInput>) => ({ lat: p.lat, lng: p.lng, digipin: encodeDigipin(p.lat, p.lng), source: p.source, at: nowIso() });

/** Create (no id) or update an address. Pinned → L2; otherwise L1 (GeoIndia cell). Learned L3 is kept. */
export function saveAddress(
  customerId: AccountId, draft: AddressDraft, pin: PinInput, geo: { geoCell: Address['geoCell']; truePoint: LatLng }, existingId?: string,
): Address {
  const s = get();
  const hubId = hubIdForPincode(draft.pincode);
  const prev = existingId ? s.addresses.find((a) => a.id === existingId) : undefined;
  const pincodeChanged = prev && prev.pincode !== draft.pincode;

  const address: Address = {
    ...(prev ?? {}),
    ...draft,
    id: prev?.id ?? `A_${addrId()}`,
    customerId,
    hubId,
    geoCell: pincodeChanged || !prev ? geo.geoCell : prev.geoCell,
    truePoint: pincodeChanged || !prev ? geo.truePoint : prev.truePoint,
    pin: pin ? makePin(pin) : pincodeChanged ? undefined : prev?.pin,
    learned: pincodeChanged ? undefined : prev?.learned,
    confidence: 'L1',
  };
  address.confidence = address.learned && address.learned.drops.length >= 2 ? 'L3' : address.pin ? 'L2' : 'L1';

  s.patch((st) => ({
    addresses: prev ? st.addresses.map((a) => (a.id === address.id ? address : a)) : [...st.addresses, address],
    // First address becomes the default.
    customers: st.customers.map((c) => (c.id === customerId && !c.defaultAddressId ? { ...c, defaultAddressId: address.id } : c)),
    deliverTo: { ...st.deliverTo, [customerId]: address.id },
  }));
  s.log('CORE', prev ? 'address_edited' : 'address_added', 'customer', { pincode: address.pincode, hubId, confidence: address.confidence });
  if (pin) s.log('C2-F1', 'pin_confirmed', 'customer', { source: pin.source, digipin: address.pin!.digipin });
  return address;
}

/** Blocked while an active order is going to this address. */
export function addressInUse(addressId: string): boolean {
  return get().orders.some((o) => o.addressId === addressId && ACTIVE_STATUSES.includes(o.status));
}

export function deleteAddress(addressId: string): boolean {
  if (addressInUse(addressId)) return false;
  const s = get();
  const a = s.addresses.find((x) => x.id === addressId)!;
  s.patch((st) => {
    const remaining = st.addresses.filter((x) => x.customerId === a.customerId && !x.deleted && x.id !== addressId);
    return {
      addresses: st.addresses.map((x) => (x.id === addressId ? { ...x, deleted: true } : x)),
      customers: st.customers.map((c) => (c.id === a.customerId && c.defaultAddressId === addressId
        ? { ...c, defaultAddressId: remaining[0]?.id } : c)),
      deliverTo: st.deliverTo[a.customerId] === addressId ? { ...st.deliverTo, [a.customerId]: undefined } : st.deliverTo,
      checkout: st.checkout?.addressId === addressId ? { ...st.checkout, addressId: undefined } : st.checkout,
    };
  });
  s.log('CORE', 'address_deleted', 'customer', {});
  return true;
}

export function setDefaultAddress(customerId: AccountId, addressId: string) {
  const s = get();
  s.patch((st) => ({
    customers: st.customers.map((c) => (c.id === customerId ? { ...c, defaultAddressId: addressId } : c)),
    deliverTo: { ...st.deliverTo, [customerId]: addressId },
  }));
  s.log('CORE', 'address_set_default', 'customer', {});
}

/** Remove saved pin and learned point: the address falls back to the GeoIndia cell (L1). */
export function removePin(addressId: string) {
  const s = get();
  const a = s.addresses.find((x) => x.id === addressId)!;
  s.patch((st) => ({
    addresses: st.addresses.map((x) => (x.id === addressId ? { ...x, pin: undefined, learned: undefined, confidence: 'L1' } : x)),
  }));
  if (a.pin) s.log('C2-F1', 'pin_removed', 'customer', {});
  if (a.learned) s.log('C2-F2', 'learned_point_deleted', 'customer', { drops: a.learned.drops.length });
}

// ---------------------------------------------------------------- remote pin link (C2-F1)

export function sendRemotePinLink(addressId: string) {
  const s = get();
  const a = s.addresses.find((x) => x.id === addressId)!;
  const hi = s.lang === 'hi';
  s.sendMessage({
    customerId: a.customerId, channel: 'whatsapp', featureId: 'C2-F1',
    text: hi
      ? `अपने ${a.label} पते (${a.area}, ${a.pincode}) पर पहुँचकर यह लिंक खोलें और दरवाज़े पर पिन लगाएँ। इससे राइडर आपको आसानी से ढूँढ पाएगा।`
      : `Open this link when you're at your ${a.label} address (${a.area}, ${a.pincode}) and drop a pin on your door. It helps the rider find you.`,
    buttons: [],
    link: { label: hi ? 'पिन लगाएँ' : 'Pin my location', href: `/pin/${a.id}` },
  });
  s.log('C2-F1', 'remote_link_sent', 'customer', {});
}

export function setRemotePin(addressId: string, point: LatLng) {
  const s = get();
  s.patch((st) => ({
    addresses: st.addresses.map((a) => (a.id === addressId
      ? { ...a, pin: makePin({ ...point, source: 'remote' }), confidence: a.confidence === 'L3' ? 'L3' : 'L2' }
      : a)),
    messages: st.messages.map((m) => (m.link?.href === `/pin/${addressId}` ? { ...m, answered: 'Pinned' } : m)),
  }));
  s.log('C2-F1', 'remote_pin_set', 'customer', { digipin: encodeDigipin(point.lat, point.lng) });
}

export const CONFIDENCE_BADGE: Record<Address['confidence'], { text: (a: Address) => string; tone: string }> = {
  L3: { text: (a) => { const n = a.learned?.drops.length ?? 2; return `Verified by ${n} deliver${n === 1 ? 'y' : 'ies'}`; }, tone: 'bg-emerald-50 text-success' },
  L2: { text: (a) => `Pinned · ${a.pin?.digipin ?? ''}`, tone: 'bg-sky-50 text-sky-700' },
  L1: { text: () => 'Approximate', tone: 'bg-amber-50 text-amber-700' },
  L0: { text: () => 'Pincode only', tone: 'bg-gray-100 text-ink-muted' },
};

// ---------------------------------------------------------------- one-tap GPS pin (C2-F1 follow-up)

/** Address the rider can't place precisely: no customer pin and not yet verified by deliveries. */
export const isApproximate = (a: Address) => !a.pin && a.confidence !== 'L3';

/** Ask once per address for the exact location (sent after an order to an approximate address). */
export function sendLocationPing(addressId: string, orderId?: string) {
  const s = get();
  const a = s.addresses.find((x) => x.id === addressId)!;
  if (!isApproximate(a)) return;
  const already = s.messages.some((m) => m.featureId === 'C2-F1' && !m.answered && m.buttons.some((b) => b.action === `share_location:${addressId}`));
  if (already) return;
  const hi = s.lang === 'hi';
  s.sendMessage({
    customerId: a.customerId, orderId, channel: 'whatsapp', featureId: 'C2-F1',
    text: hi
      ? `आपके ${a.label} पते (${a.area}, ${a.pincode}) की सटीक लोकेशन हमारे पास नहीं है। एक टैप में अपनी मौजूदा लोकेशन भेजें ताकि राइडर सीधे आपके दरवाज़े तक पहुँचे।`
      : `We don’t have the exact location for your ${a.label} address (${a.area}, ${a.pincode}). Share your current location in one tap so the rider comes straight to your door.`,
    buttons: [{ label: hi ? 'मेरी लोकेशन भेजें' : 'Share my location', action: `share_location:${addressId}` }],
  });
  s.log('C2-F1', 'location_ping_sent', 'system', { confidence: a.confidence }, orderId);
}

/** Use the phone's GPS (simulated: within ~5 m of the real door) to pin the address → DIGIPIN, L2. */
export function pinFromGps(addressId: string): string {
  const s = get();
  const a = s.addresses.find((x) => x.id === addressId)!;
  const j = () => (Math.random() - 0.5) * 0.00008;
  const point = { lat: a.truePoint.lat + j(), lng: a.truePoint.lng + j() };
  const pin = makePin({ ...point, source: 'gps' });
  s.patch((st) => ({
    addresses: st.addresses.map((x) => (x.id === addressId ? { ...x, pin, confidence: x.confidence === 'L3' ? 'L3' : 'L2' } : x)),
    messages: st.messages.map((m) => (m.buttons.some((b) => b.action === `share_location:${addressId}`) && !m.answered ? { ...m, answered: `Location shared · ${pin.digipin}` } : m)),
  }));
  s.log('C2-F1', 'gps_location_shared', 'customer', { digipin: pin.digipin }, undefined);
  return pin.digipin;
}
