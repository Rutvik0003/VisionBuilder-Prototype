import { test, expect } from '@playwright/test';
import { asCustomer, hubPublishRunFor, latestOrderId, orderById, resetDemo, riderWorkUntil, shooter, store, watchConsole } from './helpers';

// D. Redirect Loop — a parcel refused at the door is resold nearby (Existing User refuses; a nearby shopper buys)
test('D · Redirect loop', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'D-redirect');
  await resetDemo(page);

  // Setup: Rekha orders the kurti with open-box; it reaches her door
  await asCustomer(page, 'Existing User');
  await page.goto('/customer/product/P02');
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: /Open-box delivery/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  const id = await latestOrderId(page, 'existing');
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Confirm order' }).first().click();
  await page.goto('/transit');
  const row = page.locator('tr', { hasText: id });
  await row.getByRole('button', { name: 'Seller ships' }).click();
  await row.getByRole('button', { name: 'In transit' }).click();
  await row.getByRole('button', { name: 'Reached hub' }).click();
  await page.goto('/hub/HUB_HARDOI');
  await page.locator('div.flex', { hasText: 'Rekha Yadav' }).getByRole('button', { name: 'Scan in' }).first().click();
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Yes, I’ll be there' }).first().click();
  const riderId = await hubPublishRunFor(page, id);
  await page.goto(`/rider/${riderId}`);
  await page.getByRole('button', { name: /^Start / }).click();
  await riderWorkUntil(page, riderId, (cur) => cur?.id === id);

  // 1. Rider: customer refuses the open-box parcel → reason + photo → resealed with seal ID
  await page.goto(`/rider/${riderId}/stop/${id}`);
  await page.getByRole('button', { name: 'Arrived at stop' }).click();
  await page.getByRole('button', { name: 'Open-box check' }).click();
  await page.getByRole('button', { name: 'Take seal photo' }).click();
  await page.getByRole('button', { name: /Start inspection/ }).click();
  await page.getByRole('button', { name: 'Customer refuses' }).click();
  await page.getByRole('button', { name: 'Changed mind' }).click();
  await page.getByRole('button', { name: 'Take item photo' }).click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await expect(page.getByPlaceholder('Seal ID on the bag')).toHaveValue(/^TB-\d{6}$/);
  const sealId = await page.getByPlaceholder('Seal ID on the bag').inputValue();
  await shot('1-refusal-reason-photo-seal');
  await page.getByRole('button', { name: 'Reseal in tamper-evident bag' }).click();
  await expect(page.getByText(sealId)).toBeVisible();
  await shot('1b-resealed');

  // 2. Hub: quality check passes → Demand Score "High" → redirect shelf
  await page.goto('/hub/HUB_HARDOI?view=returns');
  await expect(page.getByText(`Seal ${sealId}`)).toBeVisible();
  await shot('2-hub-quality-check');
  await page.getByRole('button', { name: 'Submit QC' }).click();
  await expect(page.getByText('Demand Score: High')).toBeVisible();
  await expect(page.getByText(/On the redirect shelf until/)).toBeVisible();
  await shot('2b-demand-high-on-shelf');

  // 3. Top 5 nearby cart / wishlist shoppers nudged → one buys
  await page.getByRole('button', { name: 'Nudge top 5' }).click();
  await expect(page.getByRole('button', { name: /^Simulate: .* pays first$/ }).first()).toBeVisible();
  await shot('3-top-5-nudged');

  // The New User (no address yet) is a nearby demo shopper → gets the ping → Buy now → adds address → bought
  await expect(page.getByText('Demo account · buys from Messages on their phone')).toBeVisible();
  await asCustomer(page, 'New User');
  await page.goto('/customer/inbox');
  await expect(page.getByText(/Sealed, quality-checked, ships from near you/).first()).toBeVisible();
  await shot('3b-new-user-demand-ping');
  await page.getByRole('button', { name: 'Buy now' }).first().click();
  await expect(page).toHaveURL(/addresses\/new\?return=redirect:/);
  await page.getByLabel('Pincode').fill('241001');
  await page.getByRole('button', { name: 'Confirm pin' }).click();
  await page.getByLabel('Full name').fill('Kavita Patel');
  await page.getByLabel('House / flat / shop no.').fill('Patel Kirana Store');
  await page.getByLabel('Area, street, village').fill('Railway Ganj');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page).toHaveURL(/\/customer\/orders\//);
  await shot('3c-bought-delivered-tomorrow');
  await page.goto('/hub/HUB_HARDOI?view=returns');

  // 4. New invoice + label → next day's route → hub bonus +₹10
  await expect(page.getByText(/Sold to/)).toBeVisible();
  await expect(page.locator('div.bg-emerald-50', { hasText: 'Sold to' }).getByText('Kavita Patel')).toBeVisible();
  const s = await store(page);
  const refused = s.orders.find((o: { id: string }) => o.id === id);
  const fresh = await orderById(page, refused.refusal.redirect.newOrderId);
  expect(fresh.status).toBe('ACCEPTED');
  expect(fresh.slot.date > new Date().toISOString().slice(0, 10)).toBe(true);
  expect(s.events.some((e: { name: string }) => e.name === 'invoice_printed')).toBe(true);
  await expect(page.getByText('Hub bonus (₹10 per redirect)')).toBeVisible();
  await expect(page.locator('div.card', { hasText: 'Hub bonus' }).getByText('10', { exact: true })).toBeVisible();
  await shot('4-sold-bonus');
  await page.locator('div.bg-emerald-50', { hasText: 'Sold to' }).getByRole('button', { name: 'Label' }).click();
  await expect(page.getByText('VALMO')).toBeVisible();
  await shot('4b-new-label');
  await page.keyboard.press('Escape');
  await page.goto('/hub/HUB_HARDOI?view=returns');

  // 5. RTO parcel (Ramesh Chandra, 3 failed attempts) → Redirect Loop → not sold in 3 days → back to the seller
  const failedRow = page.locator('div.flex-wrap', { hasText: 'Ramesh Chandra' }).filter({ has: page.getByRole('button', { name: 'Mark RTO' }) });
  await failedRow.getByRole('button', { name: 'Mark RTO' }).click();
  const rtoCard = page.locator('div.rounded-lg.border', { hasText: 'RTO · original packaging' });
  await expect(rtoCard).toBeVisible();
  await rtoCard.getByRole('button', { name: 'Submit QC' }).click();
  await expect(rtoCard.getByText('Demand Score: High')).toBeVisible();
  await expect(rtoCard.getByText(/On the redirect shelf until/)).toBeVisible();
  await shot('5-rto-on-redirect-shelf');
  await rtoCard.getByRole('button', { name: /Not sold in 3 days → return to seller/ }).click();
  await expect(rtoCard.getByText(/Returning to the seller · Not sold in 3 days/)).toBeVisible();
  await shot('5b-rto-returned-after-3-days');
  noErrors();
});
