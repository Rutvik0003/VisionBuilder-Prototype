// Child lock: a 4-digit PIN before any order is placed (team request).
//  • 3 wrong PINs → ordering locked for 5 minutes.
//  • Forgot PIN → a one-time code to the registered phone (shown in Messages here) → set a new PIN; clears the lock.
//  • Turning it off needs the PIN (or the OTP reset).
import { useStore } from '../store';
import type { ChildLock, Customer } from '../types';

export const MAX_WRONG = 3;
export const LOCKOUT_MS = 5 * 60 * 1000;
export const OTP_TTL_MS = 5 * 60 * 1000;

const get = () => useStore.getState();
const lockOf = (customerId: string) => get().customers.find((c) => c.id === customerId)?.childLock;

/** Prototype hash (djb2, salted per customer) so the PIN is never stored in plain text. */
function hashPin(customerId: string, pin: string) {
  let h = 5381;
  for (const ch of `${customerId}:${pin}:meesho-child-lock`) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h.toString(16);
}

function setLock(customerId: string, lock: ChildLock | undefined) {
  get().patch((st) => ({ customers: st.customers.map((c) => (c.id === customerId ? { ...c, childLock: lock } : c)) }));
}

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);
export const childLockOn = (c: Customer) => !!c.childLock;
export const lockedFor = (c: Customer) => Math.max(0, (c.childLock?.lockedUntil ?? 0) - Date.now());

export function enableChildLock(customerId: string, pin: string) {
  if (!isValidPin(pin)) return;
  setLock(customerId, { pinHash: hashPin(customerId, pin), failed: 0 });
  get().log('CORE', 'child_lock_enabled', 'customer', {});
}

export type VerifyResult = { ok: true } | { ok: false; attemptsLeft: number; lockedMs: number };

/** Check the PIN. The third wrong attempt locks ordering for 5 minutes. */
export function verifyPin(customerId: string, pin: string): VerifyResult {
  const lock = lockOf(customerId);
  if (!lock) return { ok: true };
  const now = Date.now();
  if (lock.lockedUntil && lock.lockedUntil > now) return { ok: false, attemptsLeft: 0, lockedMs: lock.lockedUntil - now };
  if (hashPin(customerId, pin) === lock.pinHash) {
    setLock(customerId, { ...lock, failed: 0, lockedUntil: undefined });
    get().log('CORE', 'child_lock_pin_ok', 'customer', {});
    return { ok: true };
  }
  const failed = lock.failed + 1;
  if (failed >= MAX_WRONG) {
    const lockedUntil = now + LOCKOUT_MS;
    setLock(customerId, { ...lock, failed: 0, lockedUntil });
    get().log('CORE', 'child_lock_locked_out', 'customer', { minutes: LOCKOUT_MS / 60000 });
    // P2.4: tell the account owner on WhatsApp, so they know someone tried to order
    get().sendMessage({
      customerId, channel: 'whatsapp', featureId: 'P2', buttons: [],
      text: `Someone entered the wrong Child PIN 3 times on your Meesho app at ${new Date(now).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}. Ordering is paused for 5 minutes. If this wasn’t you or your family, you can reset the PIN from Account → Child PIN Lock.`,
    });
    get().log('P2', 'owner_alert_sent', 'system', { channel: 'whatsapp' });
    return { ok: false, attemptsLeft: 0, lockedMs: LOCKOUT_MS };
  }
  setLock(customerId, { ...lock, failed });
  get().log('CORE', 'child_lock_pin_wrong', 'customer', { attemptsLeft: MAX_WRONG - failed });
  return { ok: false, attemptsLeft: MAX_WRONG - failed, lockedMs: 0 };
}

/** Turning child lock off requires the current PIN. */
export function disableChildLock(customerId: string, pin: string): VerifyResult {
  const r = verifyPin(customerId, pin);
  if (r.ok) {
    setLock(customerId, undefined);
    get().log('CORE', 'child_lock_disabled', 'customer', {});
  }
  return r;
}

/** Forgot PIN: send a 6-digit one-time code to the registered phone (an SMS; shown in Messages in the prototype). */
export function requestPinResetOtp(customerId: string): string {
  const lock = lockOf(customerId);
  const customer = get().customers.find((c) => c.id === customerId)!;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  if (lock) setLock(customerId, { ...lock, otp: { code, expiresAt: Date.now() + OTP_TTL_MS } });
  get().sendMessage({
    customerId, channel: 'push', featureId: 'CORE', buttons: [],
    text: `SMS to ${customer.phone}: ${code} is your Meesho OTP to reset your child-lock PIN. It expires in 5 minutes. Don’t share it with anyone.`,
  });
  get().log('CORE', 'child_lock_otp_sent', 'customer', {});
  return code;
}

/** Verify the OTP and set a new PIN. Clears wrong attempts and any lockout. */
export function resetPinWithOtp(customerId: string, otp: string, newPin: string): 'ok' | 'bad_otp' | 'expired' | 'bad_pin' {
  const lock = lockOf(customerId);
  if (!lock?.otp) return 'bad_otp';
  if (lock.otp.expiresAt < Date.now()) return 'expired';
  if (lock.otp.code !== otp.trim()) {
    get().log('CORE', 'child_lock_otp_wrong', 'customer', {});
    return 'bad_otp';
  }
  if (!isValidPin(newPin)) return 'bad_pin';
  setLock(customerId, { pinHash: hashPin(customerId, newPin), failed: 0 });
  get().log('CORE', 'child_lock_pin_reset', 'customer', {});
  return 'ok';
}
