import { test, expect } from '@playwright/test';
import { asCustomer, resetDemo, shooter, store, watchConsole } from './helpers';

// "Reset demo" returns every walkthrough to its starting state (runs last, after A–D have changed everything).
test('Reset demo restores the seed', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'reset');
  const summary = (s: { orders: { id: string; status: string }[]; addresses: unknown[]; messages: unknown[]; events: unknown[]; runs: object; customers: { childLock?: unknown }[] }) => ({
    orders: s.orders.map((o) => `${o.status}`).sort().join(','),
    orderCount: s.orders.length,
    addresses: s.addresses.length,
    messages: s.messages.length,
    events: s.events.length,
    runs: Object.keys(s.runs).length,
    childLocks: s.customers.filter((c) => c.childLock).length,
  });
  // Dirty the demo through the UI: an order (with its messages), a child lock and a published run
  await resetDemo(page);
  await asCustomer(page, 'Existing User');
  await page.goto('/customer/account');
  await page.getByRole('button', { name: 'Child PIN Lock' }).click();
  for (const d of '12341234') await page.locator('div.absolute.inset-0.z-40').getByRole('button', { name: d, exact: true }).click();
  await page.goto('/hub/HUB_HARDOI?view=routes');
  await page.getByRole('button', { name: /Plan morning run/ }).click();
  await page.getByRole('button', { name: /Lock & publish/ }).click();
  const dirty = summary(await store(page));
  await resetDemo(page);
  const clean = summary(await store(page));
  expect(clean.runs).toBe(0);
  expect(clean.childLocks).toBe(0);
  expect(dirty).not.toEqual(clean);
  await page.reload();
  await resetDemo(page);
  expect(summary(await store(page))).toEqual(clean); // the same starting state every time
  await shot('launcher-after-reset');
  noErrors();
});
