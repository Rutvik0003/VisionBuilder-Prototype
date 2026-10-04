import { test, expect } from '@playwright/test';
import { asCustomer, currentStop, fmtDate, hubPublishRunFor, latestOrderId, orderById, resetDemo, riderDoStop, riderWorkUntil, shooter, watchConsole } from './helpers';

// A. Timing Layer — New User (Kavita Patel), standing in for the slide's kirana owner
test('A · Timing layer', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'A-timing');
  await resetDemo(page);
  await asCustomer(page, 'New User');

  // New user has no address yet: add one (Hardoi)
  await page.goto('/customer/addresses/new');
  await page.getByLabel('Pincode').fill('241001');
  await page.getByRole('button', { name: 'Confirm pin' }).click();
  await page.getByLabel('Full name').fill('Kavita Patel');
  await page.getByLabel('House / flat / shop no.').fill('Patel Kirana Store');
  await page.getByLabel('Area, street, village').fill('Railway Ganj');
  await page.getByRole('button', { name: 'Save address' }).click();

  // 1. Checkout → Afternoon 12-4 on Saturday + COD "deliver on or after" Saturday → place order
  await page.goto('/customer/product/P05');
  const sizes = page.getByRole('button', { name: 'M', exact: true });
  if (await sizes.isVisible()) await sizes.click();
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await page.getByRole('button', { name: 'Continue' }).click(); // address → delivery
  await expect(page.getByText('When should we deliver?')).toBeVisible();
  await page.getByRole('button', { name: /^Sat/ }).first().click();
  await page.getByRole('button', { name: /^Afternoon/ }).click();
  await expect(page.getByText('Slot held for you')).toBeVisible();
  await shot('1-slot-afternoon-saturday');
  await page.getByRole('button', { name: 'Continue' }).click(); // → payment
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: /^Sat \d+$/ }).click();
  await shot('1b-cod-deliver-on-or-after');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  const id = await latestOrderId(page, 'new');
  const placed = await orderById(page, id);
  expect(placed.slot.window).toBe('Afternoon 12-4');
  await page.goto('/customer/inbox');
  const confirm = page.getByRole('button', { name: 'Confirm order' }).first();
  if (await confirm.isVisible()) await confirm.click(); // first COD order → confirmation asked

  // 2. Transit → "Seller missed dispatch" (1 day) → WhatsApp delay → customer picks another time
  await page.goto('/transit');
  const row = page.locator('tr', { hasText: id });
  await row.getByRole('button', { name: /Seller missed dispatch/ }).click();
  await row.getByRole('button', { name: '1d', exact: true }).click();
  await page.goto('/customer/inbox');
  await expect(page.getByText(/instead of/).first()).toBeVisible();
  await shot('2-delay-whatsapp');
  await page.getByRole('button', { name: 'Pick another time' }).first().click();
  await page.getByRole('button', { name: /^Afternoon/ }).click();
  await page.getByRole('button', { name: 'Confirm new time' }).click();
  await expect.poll(async () => (await orderById(page, id)).status).toBe('PLACED');
  await shot('2b-new-time-picked');

  // Seller ships → transit → hub
  await page.goto('/transit');
  await row.getByRole('button', { name: 'Seller ships' }).click();
  await row.getByRole('button', { name: 'In transit' }).click();
  await row.getByRole('button', { name: 'Reached hub' }).click();

  // 3. Hub scans in → "Will you be home?" ping → Yes
  await page.goto('/hub/HUB_HARDOI');
  await page.locator('div.flex', { hasText: 'Kavita Patel' }).getByRole('button', { name: 'Scan in' }).first().click();
  await page.goto('/customer/inbox');
  await expect(page.getByText(/Will you be home\?/).first()).toBeVisible();
  await shot('3-home-ping');
  await page.getByRole('button', { name: 'Yes, I’ll be there' }).first().click();

  // 4. Hub plans + publishes the afternoon run → rider starts → live map + "is 10 min away"
  const riderId = await hubPublishRunFor(page, id);
  await page.goto(`/rider/${riderId}`);
  await page.getByRole('button', { name: /^Start / }).click();
  await riderWorkUntil(page, riderId, (cur) => cur?.id === id);
  await page.goto(`/customer/orders/${id}`);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.goto('/customer/inbox');
  const away = page.getByText(/is 10 min away/).first();
  await away.scrollIntoViewIfNeeded();
  await expect(away).toBeVisible();
  await shot('4-rider-10-min-away');
  await page.goto(`/customer/orders/${id}`);
  await shot('4b-live-tracking');

  // 5. "I'm not home" → stop skipped, new slot, no failed attempt
  await page.getByRole('button', { name: 'I’m not home' }).click();
  await page.getByRole('button', { name: 'Confirm new time' }).click();
  await shot('5-not-home-rescheduled');
  const cur = await currentStop(page, riderId);
  expect(cur?.id).toBe(id);
  await page.goto(`/rider/${riderId}/stop/${id}`);
  await expect(page.getByText('Customer not home, skip.')).toBeVisible();
  await shot('5b-rider-skip');
  await riderDoStop(page, riderId, cur!);
  const afterSkip = await orderById(page, id);
  expect(afterSkip.attempts.length).toBe(0);
  await riderWorkUntil(page, riderId, () => false); // finish today's run

  // 6. Next day: run published → rider reaches the address, calls → delivered on the first attempt
  const rider2 = await hubPublishRunFor(page, id);
  await page.goto(`/rider/${rider2}`);
  await page.getByRole('button', { name: /^Start / }).click();
  await riderWorkUntil(page, rider2, (c) => c?.id === id);
  await page.goto(`/rider/${rider2}/stop/${id}`);
  await page.getByRole('button', { name: 'Arrived at stop' }).click();
  await page.getByRole('button', { name: 'Call customer' }).click();
  await page.getByRole('button', { name: 'Delivered', exact: true }).click();
  await page.getByRole('button', { name: 'Customer reads it out' }).click();
  await shot('6-rider-delivery-otp');
  await page.getByRole('button', { name: /Confirm delivery/ }).click();
  const done = await orderById(page, id);
  expect(done.status).toBe('DELIVERED');
  expect(done.attempts.filter((a: { result: string }) => a.result !== 'delivered').length).toBe(0); // first attempt, no failures
  await page.goto(`/customer/orders/${id}`);
  await expect(page.getByText(/Delivered on/)).toBeVisible();
  await shot('6b-delivered-first-attempt');
  noErrors();
  void fmtDate;
});
