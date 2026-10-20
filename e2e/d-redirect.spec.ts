import { test, expect } from '@playwright/test';
import { asCustomer, hubPublishRunFor, latestOrderId, orderById, resetDemo, riderWorkUntil, shooter, store, watchConsole } from './helpers';

// D. Open-box refusal → back to the seller; RTO parcel (never opened) → Redirect Loop → resold nearby or returned
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

  // 2. Hub: an opened parcel can't be checked or resold → straight back to the seller (no Redirect Loop)
  await page.goto('/hub/HUB_HARDOI?view=returns');
  const refusedRow = page.locator('div.flex-wrap', { hasText: `Tamper bag ${sealId}` });
  await expect(refusedRow.getByText('Returning to seller')).toBeVisible();
  expect((await orderById(page, id)).refusal.redirect).toBeUndefined();
  await shot('2-refusal-back-to-seller');

  // 3. RTO parcel (Ramesh Chandra, 3 failed attempts, never opened) → packaging check from outside → Demand High → shelf
  const failedRow = page.locator('div.flex-wrap', { hasText: 'Ramesh Chandra' }).filter({ has: page.getByRole('button', { name: 'Mark RTO' }) });
  await failedRow.getByRole('button', { name: 'Mark RTO' }).click();
  const rtoCard = page.locator('div.rounded-lg.border', { hasText: 'RTO · original packaging' });
  await expect(rtoCard.getByText('Packaging check at the hub · parcel stays sealed')).toBeVisible();
  await expect(rtoCard.getByText('Seller seal intact?')).toBeVisible();
  await shot('3-rto-packaging-check');
  await rtoCard.getByRole('button', { name: 'Submit check' }).click();
  await expect(rtoCard.getByText('Demand Score: High')).toBeVisible();
  await expect(rtoCard.getByText(/On the redirect shelf until/)).toBeVisible();
  await shot('3b-demand-high-on-shelf');
  const rtoId = (await store(page)).orders.find((o: { status: string; customerId: string }) => o.status === 'RTO' && o.customerId === 'bg_713').id;

  // 4. Top 5 nearby cart / wishlist shoppers nudged; the New User (no address yet) gets the ping and buys
  await rtoCard.getByRole('button', { name: 'Nudge top 5' }).click();
  await expect(rtoCard.getByText('Demo account · buys from Messages on their phone')).toBeVisible();
  await shot('4-top-5-nudged');
  await asCustomer(page, 'New User');
  await page.goto('/customer/inbox');
  await expect(page.getByText(/Still in its original sealed pack/).first()).toBeVisible();
  await shot('4b-new-user-demand-ping');
  await page.getByRole('button', { name: 'Buy now' }).first().click();
  await expect(page).toHaveURL(/addresses\/new\?return=redirect:/);
  await page.getByLabel('Pincode').fill('241001');
  await page.getByRole('button', { name: 'Confirm pin' }).click();
  await page.getByLabel('Full name').fill('Kavita Patel');
  await page.getByLabel('House / flat / shop no.').fill('Patel Kirana Store');
  await page.getByLabel('Area, street, village').fill('Railway Ganj');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page).toHaveURL(/\/customer\/orders\//);
  await shot('4c-bought-delivered-tomorrow');

  // 5. New invoice + label → next day's route → hub bonus +₹10
  await page.goto('/hub/HUB_HARDOI?view=returns');
  const sold = page.locator('div.bg-emerald-50', { hasText: 'Sold to' });
  await expect(sold.getByText('Kavita Patel')).toBeVisible();
  const st = await store(page);
  const fresh = await orderById(page, st.orders.find((o: { id: string }) => o.id === rtoId).rto.redirect.newOrderId);
  expect(fresh.status).toBe('ACCEPTED');
  expect(fresh.slot.date > new Date().toISOString().slice(0, 10)).toBe(true);
  expect(st.events.some((e: { name: string }) => e.name === 'invoice_printed')).toBe(true);
  await expect(page.locator('div.card', { hasText: 'Hub bonus' }).getByText('10', { exact: true })).toBeVisible();
  await shot('5-sold-bonus');
  await sold.getByRole('button', { name: 'Label' }).click();
  await expect(page.getByText('VALMO')).toBeVisible();
  await shot('5b-new-label');

  // 6. Fresh start: the same RTO parcel is not sold within 3 days → back to the seller
  await resetDemo(page);
  await page.goto('/hub/HUB_HARDOI?view=returns');
  await page.locator('div.flex-wrap', { hasText: 'Ramesh Chandra' }).filter({ has: page.getByRole('button', { name: 'Mark RTO' }) })
    .getByRole('button', { name: 'Mark RTO' }).click();
  const card2 = page.locator('div.rounded-lg.border', { hasText: 'RTO · original packaging' });
  await card2.getByRole('button', { name: 'Submit check' }).click();
  await card2.getByRole('button', { name: /Not sold in 3 days → return to seller/ }).click();
  await expect(card2.getByText(/Returning to the seller · Not sold in 3 days/)).toBeVisible();
  await shot('6-rto-returned-after-3-days');
  noErrors();
});
