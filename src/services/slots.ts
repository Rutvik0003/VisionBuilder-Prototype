// C1-F1 slot inventory (PRD v3 §10.2).
//   effective = floor(capacity × (1 − bufferPct/100));  a window is open while confirmed + active holds < effective.
// Holds last 10 minutes (UI countdown) and confirm on Place order. Expired holds simply stop counting,
// so an abandoned checkout never leaks capacity. "Any time" never consumes a window.
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { useStore, type DataState } from '../store';
import type { SlotHold, SlotInventory, SlotLabel } from '../types';
import { SLOT_WINDOWS, hubWindowCapacity, seedConfirmed } from '../data/seed';

export const HOLD_MS = 10 * 60 * 1000;
export type Window = Exclude<SlotLabel, 'Any time'>;
export const WINDOWS: Window[] = SLOT_WINDOWS.map((w) => w.label);

const get = () => useStore.getState();

/** Existing inventory row, or a synthesized one for dates beyond the seeded 5 days. */
function row(s: Pick<DataState, 'slots'>, hubId: string, date: string, window: Window): SlotInventory {
  const found = s.slots.find((r) => r.hubId === hubId && r.date === date && r.window === window);
  if (found) return found;
  return { hubId, date, window, capacity: hubWindowCapacity(hubId), reserved: 0, confirmed: seedConfirmed(hubId, date, WINDOWS.indexOf(window)) };
}

const activeHolds = (holds: SlotHold[], now = Date.now()) => holds.filter((h) => h.expiresAt > now);

export interface WindowAvailability {
  window: Window;
  effective: number;
  used: number; // confirmed + active holds
  left: number;
  open: boolean;
}

/** Availability for one hub/date/window. `ignoreHoldId` lets the holder see their own hold as not blocking. */
export function availability(
  s: Pick<DataState, 'slots' | 'holds' | 'hubs'>, hubId: string, date: string, window: Window, ignoreHoldId?: string,
): WindowAvailability {
  const hub = s.hubs.find((h) => h.id === hubId)!;
  const r = row(s, hubId, date, window);
  const effective = Math.floor(r.capacity * (1 - hub.bufferPct / 100));
  const held = activeHolds(s.holds).filter((h) => h.id !== ignoreHoldId && h.hubId === hubId && h.date === date && h.window === window).length;
  const used = r.confirmed + held;
  return { window, effective, used, left: Math.max(0, effective - used), open: used < effective };
}

export function dayAvailability(s: Pick<DataState, 'slots' | 'holds' | 'hubs'>, hubId: string, date: string, ignoreHoldId?: string) {
  return WINDOWS.map((w) => availability(s, hubId, date, w, ignoreHoldId));
}

/** Date chips: the promised date and the next 3 days. */
export function slotDates(promisedDate: string, n = 4): string[] {
  return Array.from({ length: n }, (_, i) => dayjs(promisedDate).add(i, 'day').format('YYYY-MM-DD'));
}

// ---------------------------------------------------------------- holds

/** Place a 10-minute hold (replacing `previousHoldId`). Returns null if the window filled up meanwhile. */
export function placeHold(hubId: string, date: string, window: Window, previousHoldId?: string): SlotHold | null {
  const s = get();
  if (!availability(s, hubId, date, window, previousHoldId).open) return null;
  const hold: SlotHold = { id: nanoid(8), hubId, date, window, expiresAt: Date.now() + HOLD_MS };
  s.patch((st) => ({ holds: [...activeHolds(st.holds).filter((h) => h.id !== previousHoldId), hold] }));
  s.log('C1-F1', 'slot_reserved', 'customer', { hubId, date, window, holdMinutes: 10 });
  return hold;
}

export function releaseHold(holdId?: string) {
  if (!holdId) return;
  get().patch((st) => ({ holds: st.holds.filter((h) => h.id !== holdId) }));
}

export function holdOf(holdId?: string): SlotHold | undefined {
  return holdId ? get().holds.find((h) => h.id === holdId) : undefined;
}

/** Place order: the hold becomes a confirmed booking (never above effective capacity). */
export function confirmSlot(hubId: string, date: string, window: SlotLabel, holdId?: string): boolean {
  if (window === 'Any time') { releaseHold(holdId); return true; }
  const s = get();
  const hold = holdOf(holdId);
  const stillHeld = !!hold && hold.expiresAt > Date.now() && hold.date === date && hold.window === window;
  if (!stillHeld && !availability(s, hubId, date, window).open) return false;
  s.patch((st) => {
    const r = row(st, hubId, date, window);
    const exists = st.slots.includes(r);
    const updated = { ...r, confirmed: r.confirmed + 1 };
    return {
      slots: exists ? st.slots.map((x) => (x === r ? updated : x)) : [...st.slots, updated],
      holds: st.holds.filter((h) => h.id !== holdId),
    };
  });
  return true;
}

/** Reschedule an order's booking from one window to another (Change time / home-check change). */
export function moveBooking(hubId: string, from: { date: string; window: SlotLabel }, to: { date: string; window: SlotLabel }): boolean {
  const s = get();
  if (to.window !== 'Any time' && !(from.date === to.date && from.window === to.window) && !availability(s, hubId, to.date, to.window).open) {
    return false;
  }
  s.patch((st) => {
    let slots = st.slots;
    const bump = (date: string, window: SlotLabel, delta: number) => {
      if (window === 'Any time') return;
      const r = row({ slots }, hubId, date, window);
      const updated = { ...r, confirmed: Math.max(0, r.confirmed + delta) };
      slots = slots.includes(r) ? slots.map((x) => (x === r ? updated : x)) : [...slots, updated];
    };
    bump(from.date, from.window, -1);
    bump(to.date, to.window, +1);
    return { slots };
  });
  return true;
}
