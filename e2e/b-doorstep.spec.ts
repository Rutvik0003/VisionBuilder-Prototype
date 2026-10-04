import { test, expect } from '@playwright/test';
import { OPEN_BOX_CHECKLIST, asCustomer, fmtDate, latestOrderId, resetDemo, shooter, store, watchConsole } from './helpers';

// B. Doorstep Layer — Existing User (Rekha Yadav)
test('B · Doorstep layer', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'B-doorstep');
  await resetDemo(page);

  // 1. Adds a shop address → drags pin → DIGIPIN shown → Confirm pin
  await asCustomer(page, 'Existing User');
  await page.goto('/customer/addresses');
  await page.getByRole('link', { name: 'Add new address' }).click();
  await page.getByLabel('Pincode').fill('241001');
  const marker = page.locator('.leaflet-marker-draggable').first();
  await expect(marker).toBeVisible();
  const before = await page.getByText(/^[2-9CFJKLMPT]{3}-[2-9CFJKLMPT]{3}-[2-9CFJKLMPT]{4}$/).first().textContent();
  const box = (await marker.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 30, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText('Pin moved by you')).toBeVisible();
  const after = await page.getByText(/^[2-9CFJKLMPT]{3}-[2-9CFJKLMPT]{3}-[2-9CFJKLMPT]{4}$/).first().textContent();
  expect(after).not.toBe(before);
  await shot('1-pin-dragged-digipin');
  await page.getByRole('button', { name: 'Confirm pin' }).click();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByLabel('Full name').fill('Rekha Yadav');
  await page.getByLabel('House / flat / shop no.').fill('Rekha Kirana, Shop 4');
  await page.getByLabel('Area, street, village').fill('Nai Basti Market');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('Rekha Kirana, Shop 4')).toBeVisible();
  await shot('1b-address-saved');

  // 2. COD order for "Floral Rayon Kurti" ₹499 with open-box, to the new shop address
  await page.goto('/customer/product/P02');
  await expect(page.getByText('₹499').first()).toBeVisible();
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await page.getByText('Rekha Kirana, Shop 4').click();
  await page.getByRole('button', { name: 'Continue' }).click(); // → Delivery
  await expect(page.getByText('When should we deliver?')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click(); // → Payment
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: /Open-box delivery/ }).click();
  await shot('2-open-box-opted');
  await page.getByRole('button', { name: 'Continue' }).click(); // → Summary
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  await shot('2b-order-placed');
  const id = await latestOrderId(page, 'existing');

  // Rekha is a medium-risk COD customer → she confirms on WhatsApp so the seller can ship
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Confirm order' }).first().click();

  // Seller & Transit → hub
  await page.goto('/transit');
  const row = page.locator('tr', { hasText: id });
  await row.getByRole('button', { name: 'Seller ships' }).click();
  await row.getByRole('button', { name: 'In transit' }).click();
  await row.getByRole('button', { name: 'Reached hub' }).click();

  // Hub scans in → ping → Rekha taps Yes
  await page.goto('/hub/HUB_HARDOI');
  await page.locator('div', { hasText: /^Rekha Yadav/ }).locator('..').getByRole('button', { name: 'Scan in' }).first().click();
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Yes, I’ll be there' }).first().click();

  // Hub plans + publishes the run
  const order = (await store(page)).orders.find((o: { id: string }) => o.id === id);
  await page.goto(`/hub/HUB_HARDOI?view=routes&date=${order.slot.date}`);
  await page.getByRole('button', { name: /Plan morning run/ }).click();
  await page.getByRole('button', { name: /Lock & publish/ }).click();
  const riderId = (await store(page)).orders.find((o: { id: string }) => o.id === id).route.riderId;

  // Rider starts, Rekha sends "Call me at the gate"
  await page.goto(`/rider/${riderId}`);
  await page.getByRole('button', { name: /^Start / }).click();
  await page.goto(`/customer/orders/${id}`);
  await page.getByRole('button', { name: 'Message rider' }).click();
  await page.getByRole('button', { name: 'Call me at the gate' }).click();

  // 3. Rider sees exact pin + note → Arrived at stop
  await page.goto(`/rider/${riderId}/stop/${id}`);
  await expect(page.getByText('From customer:')).toBeVisible();
  await expect(page.getByText('‘Call me at the gate’')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await shot('3-rider-pin-and-note');
  await page.getByRole('button', { name: 'Arrived at stop' }).click();

  // 4. Open-box: photo → 2-minute check → checklist 5/5 → Customer accepts · collect ₹499
  await page.getByRole('button', { name: 'Open-box check' }).click();
  await page.getByRole('button', { name: 'Take seal photo' }).click();
  await page.getByRole('button', { name: /Start inspection/ }).click();
  await expect(page.getByText('Time left')).toBeVisible();
  for (const c of OPEN_BOX_CHECKLIST) await page.getByLabel(c, { exact: true }).check();
  await expect(page.getByText('Checklist (5/5)')).toBeVisible();
  await page.getByRole('button', { name: 'Customer reads it out' }).click();
  await shot('4-open-box-checklist-5-of-5');
  await page.getByRole('button', { name: 'Customer accepts · collect ₹499' }).click();
  await expect.poll(async () => (await store(page)).orders.find((o: { id: string }) => o.id === id).status).toBe('DELIVERED');

  // 5. Address list shows "Verified by deliveries"
  await page.goto('/customer/addresses');
  const card = page.locator('div', { hasText: 'Rekha Kirana, Shop 4' }).last();
  await expect(page.getByText(/Verified by 1 delivery/)).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await shot('5-address-verified');
  noErrors();
  void fmtDate;
});
