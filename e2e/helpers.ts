import { expect, type Page } from '@playwright/test';
import fs from 'node:fs';

/** Fail the walkthrough on any console error or uncaught page error. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return () => expect(errors, 'console errors').toEqual([]);
}

export function shooter(page: Page, walkthrough: string) {
  fs.mkdirSync(`screenshots/${walkthrough}`, { recursive: true });
  return async (step: string) => {
    // let product photos / map tiles finish loading and fade in
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/${walkthrough}/${step}.png` });
  };
}

/** "Reset demo" in the sidebar: every walkthrough starts from the seed. */
export async function resetDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary', { name: 'Switch interface' }).getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
}

/** Switch the customer phone to an account from the sidebar, then open its home screen. */
export async function asCustomer(page: Page, who: 'Existing User' | 'New User') {
  await page.getByRole('complementary', { name: 'Switch interface' }).getByRole('button', { name: new RegExp(who) }).click();
  await page.goto('/customer');
  await expect(page).toHaveURL(/\/customer$/);
}

/** Read the persisted store (to find ids; all actions go through the UI). */
export async function store(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('meesho-dice-demo') ?? '{}').state);
}

export async function latestOrderId(page: Page, customerId: string) {
  const s = await store(page);
  return s.orders.find((o: { customerId: string }) => o.customerId === customerId).id as string;
}

/** "Wed, 30 Sep" (same as the app's fmtDate). */
export function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })}, ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
}

export const OPEN_BOX_CHECKLIST = ['Correct item', 'Colour / design', 'Size label', 'Quantity', 'No damage'];

type O = { id: string; status: string; openBox?: boolean; customerId: string; route?: { riderId: string; date: string; run: string; seq: number }; visit?: { skipRequested?: boolean; outcome?: string } };
const RUN_ORDER = ['Morning', 'Afternoon', 'Evening'];
const ON_ROUTE = ['PLANNED', 'OUT_FOR_DELIVERY', 'ARRIVING_SOON'];

/** The rider's current stop (same rule as the rider app). */
export async function currentStop(page: Page, riderId: string): Promise<O | undefined> {
  const s = await store(page);
  const rider = s.riders.find((r: { id: string }) => r.id === riderId);
  const ids: string[] = [...new Set<string>(rider.routeOrderIds)];
  return ids.map((id) => s.orders.find((o: O) => o.id === id) as O)
    .filter((o) => o && o.route?.riderId === riderId && (ON_ROUTE.includes(o.status) || (o.visit?.skipRequested && !o.visit.outcome)))
    .sort((a, b) => a.route!.date.localeCompare(b.route!.date) || RUN_ORDER.indexOf(a.route!.run) - RUN_ORDER.indexOf(b.route!.run) || a.route!.seq - b.route!.seq)
    .find((o) => o.status !== 'PLANNED');
}

/** Rider delivers one stop through the rider app (arrive → open-box or delivered → OTP), or skips it if asked. */
export async function riderDoStop(page: Page, riderId: string, o: O) {
  await page.goto(`/rider/${riderId}/stop/${o.id}`);
  const skip = page.getByRole('button', { name: 'Skip stop' });
  if (await skip.isVisible()) { await skip.click(); return; }
  await page.getByRole('button', { name: 'Arrived at stop' }).click();
  if (o.openBox) {
    await page.getByRole('button', { name: 'Open-box check' }).click();
    await page.getByRole('button', { name: 'Take seal photo' }).click();
    await page.getByRole('button', { name: /Start inspection/ }).click();
    for (const c of OPEN_BOX_CHECKLIST) await page.getByLabel(c, { exact: true }).check();
    await page.getByRole('button', { name: 'Customer reads it out' }).click();
    await page.getByRole('button', { name: /^Customer accepts/ }).click();
  } else {
    await page.getByRole('button', { name: 'Delivered', exact: true }).click();
    await page.getByRole('button', { name: 'Customer reads it out' }).click();
    await page.getByRole('button', { name: /Confirm delivery/ }).click();
  }
  await expect(page).toHaveURL(new RegExp(`/rider/${riderId}$`));
}

/** Work through the rider's stops until `done` is true (or the run is finished). */
export async function riderWorkUntil(page: Page, riderId: string, done: (cur: O | undefined) => boolean) {
  for (let i = 0; i < 40; i++) {
    const cur = await currentStop(page, riderId);
    if (done(cur) || !cur) return;
    await riderDoStop(page, riderId, cur);
  }
}

/** Which run a parcel goes in (same rule as the planner). */
export function runFor(o: { slot: { window: string }; homeCheck: string }) {
  if (o.slot.window.startsWith('Morning')) return 'morning';
  if (o.slot.window.startsWith('Afternoon')) return 'afternoon';
  if (o.slot.window.startsWith('Evening')) return 'evening';
  return o.homeCheck === 'yes' || o.homeCheck === 'change_requested' ? 'morning' : 'afternoon';
}

export async function orderById(page: Page, id: string) {
  return (await store(page)).orders.find((o: { id: string }) => o.id === id);
}

/** Hub: plan + lock & publish the run that holds this order. */
export async function hubPublishRunFor(page: Page, id: string) {
  const o = await orderById(page, id);
  await page.goto(`/hub/HUB_HARDOI?view=routes&date=${o.slot.date}`);
  await page.getByRole('button', { name: new RegExp(`Plan ${runFor(o)} run`) }).click();
  await page.getByRole('button', { name: /Lock & publish/ }).click();
  return (await orderById(page, id)).route.riderId as string;
}
