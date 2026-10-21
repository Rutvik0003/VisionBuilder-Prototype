import { test, expect, type Page } from '@playwright/test';
import { asCustomer, hubPublishRunFor, orderById, resetDemo, riderWorkUntil, shooter, store, watchConsole } from './helpers';

type O = { id: string; groupId?: string; status: string; slot: { date: string }; items: { productId: string; qty: number }[]; total: number; rescheduleCount: number; returnedPart?: string };

async function addToCart(page: Page, productId: string) {
  await page.goto(`/customer/product/${productId}`);
  await page.getByRole('button', { name: 'Add to Cart' }).click();
}
async function checkoutCod(page: Page, openBox = false) {
  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Cash on Delivery').first().click();
  if (openBox) await page.getByRole('button', { name: /Open-box delivery/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  const leadId = page.url().split('/').pop()!;
  const s = await store(page);
  const lead = s.orders.find((o: O) => o.id === leadId);
  const ids: string[] = lead.groupId ? s.orders.filter((o: O) => o.groupId === lead.groupId).map((o: O) => o.id) : [leadId];
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: /^Confirm (all|order)$/ }).last().click();
  return ids;
}
const row = (page: Page, id: string) => page.locator('tr').filter({ has: page.getByText('#' + id, { exact: true }) });

test('Edge · prepaid open-box parcel, 2 of one item: keep 1 + the other item, return 1 → refund', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'J-edge-cases');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');
  await addToCart(page, 'P15');
  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Increase' }).first().click(); // 2 × curtains
  await addToCart(page, 'P17'); // + cushion covers, same seller → one parcel
  const [id] = await checkoutCod(page, true);
  expect((await orderById(page, id)).items.map((i: { qty: number }) => i.qty)).toEqual([2, 1]);

  await page.goto('/transit');
  await row(page, id).getByRole('button', { name: 'Seller ships' }).click();
  await row(page, id).getByRole('button', { name: 'In transit' }).click();
  await row(page, id).getByRole('button', { name: 'Reached hub' }).click();
  await page.goto('/hub/HUB_HARDOI');
  await page.getByRole('button', { name: /Scan in all/ }).click();
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Pay now' }).last().click(); // prepaid by UPI (₹15 off)
  await page.getByRole('button', { name: 'Yes, I’ll be there' }).last().click();
  expect((await orderById(page, id)).total).toBe(459 * 2 + 249 - 15);

  const riderId = await hubPublishRunFor(page, id);
  await page.goto(`/rider/${riderId}`);
  await page.getByRole('button', { name: /^Start / }).click();
  await riderWorkUntil(page, riderId, (cur) => cur?.id === id);
  await page.goto(`/rider/${riderId}/stop/${id}`);
  await page.getByRole('button', { name: 'Arrived at stop' }).click();
  await page.getByRole('button', { name: 'Open-box check' }).click();
  await page.getByRole('button', { name: 'Take seal photo' }).click();
  await page.getByRole('button', { name: /Start inspection/ }).click();
  await page.getByRole('button', { name: 'Customer refuses' }).click();
  await page.locator('label', { hasText: 'Cushion Covers' }).locator('input').uncheck(); // keeps the cushion covers
  await page.getByRole('button', { name: /Return fewer Blackout Door Curtains/ }).click(); // returns 1 of 2 curtains
  await expect(page.getByText(/keeps 1/)).toBeVisible();
  await page.getByRole('button', { name: 'Colour/design different' }).click();
  await page.getByRole('button', { name: 'Take item photo' }).click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('button', { name: 'Customer reads it out' }).click();
  await shot('2-prepaid-return-one-of-two');
  await page.getByRole('button', { name: 'Reseal returned items · deliver the rest · refund ₹459' }).click();

  const kept = await orderById(page, id);
  expect(kept.status).toBe('DELIVERED');
  expect(kept.items.map((i: { productId: string; qty: number }) => `${i.productId}×${i.qty}`)).toEqual(['P15×1', 'P17×1']);
  expect(kept.total).toBe(459 + 249 - 15);
  const back = await orderById(page, kept.returnedPart);
  expect(back.items.map((i: { productId: string; qty: number }) => `${i.productId}×${i.qty}`)).toEqual(['P15×1']);
  expect(back.refusal.refund.amount).toBe(459);
  await page.goto('/customer/inbox');
  await expect(page.getByText(/₹459 will be refunded to your UPI in 2–3 days/)).toBeVisible();
  await page.goto(`/customer/orders/${id}`);
  await expect(page.getByText(/₹459 will be refunded to your UPI/)).toBeVisible();
  await shot('3-customer-refund');
  noErrors();
});

test('Edge · two tabs stay in sync (no overwriting)', async ({ page, context }) => {
  const noErrors = watchConsole(page);
  await resetDemo(page);
  await asCustomer(page, 'Existing User');
  const transit = await context.newPage();
  await transit.goto('/transit'); // second tab, already open

  // Tab 1 places an order → tab 2 shows it without a reload
  await page.goto('/customer/product/P20');
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Pay online (UPI)' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  const id = page.url().split('/').pop()!;
  await expect(row(transit, id)).toBeVisible();

  // Tab 2 ships it → tab 1 sees it, and tab 1's next action doesn't undo it
  await row(transit, id).getByRole('button', { name: 'Seller ships' }).click();
  await page.goto(`/customer/orders/${id}`);
  await expect(page.getByText('Shipped').first()).toBeVisible();
  await page.goto('/customer/account');
  await page.getByRole('button', { name: 'हिंदी' }).click(); // any change in tab 1
  await page.getByRole('button', { name: 'English' }).click();
  expect((await orderById(transit, id)).status).toBe('SHIPPED');
  await transit.close();
  noErrors();
});

/** Cart → COD → place (no confirmation tap). Returns the lead order id. */
async function placeCodNoConfirm(page: Page) {
  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  return page.url().split('/').pop()!;
}

test('Edge · confirmation on WhatsApp: keep 1 of 2 with − / +', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'J-edge-cases');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');
  await addToCart(page, 'P15');
  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Increase' }).first().click(); // 2 × curtains
  await addToCart(page, 'P17');
  const id = await placeCodNoConfirm(page);

  await page.goto('/customer/inbox');
  await expect(page.getByText(/Confirm your order: 3 items/)).toBeVisible();
  await page.getByRole('button', { name: 'Keep some, cancel some' }).last().click();
  await page.getByRole('button', { name: 'Keep fewer Blackout Door Curtains (Set of 2)' }).click();
  await expect(page.getByText('keep 1 of 2')).toBeVisible();
  await shot('4-whatsapp-keep-1-of-2');
  await page.getByRole('button', { name: 'Confirm 2, cancel 1' }).click();

  const o = await orderById(page, id);
  expect(o.items.map((i: { productId: string; qty: number }) => `${i.productId}×${i.qty}`)).toEqual(['P15×1', 'P17×1']);
  expect(o.total).toBe(459 + 249);
  expect(o.confirm.state).toBe('confirmed');
  noErrors();
});

test('Edge · confirmation call: keep only some → "how many?" → keep 2 of 3', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'J-edge-cases');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');
  await addToCart(page, 'P15');
  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Increase' }).first().click();
  await page.getByRole('button', { name: 'Increase' }).first().click(); // 3 × curtains (one line)
  const id = await placeCodNoConfirm(page);

  await page.goto('/transit?tab=confirm');
  await page.locator('div.card', { hasText: id }).getByRole('button', { name: /No tap in 10 min/ }).click();
  const queued = page.getByRole('button', { name: /9 am → place queued call/ });
  if (await queued.isVisible()) await queued.click();
  await page.goto('/customer');
  await page.getByRole('button', { name: 'Answer' }).click();
  await expect(page.getByText(/You ordered 3 items/)).toBeVisible();
  await page.getByRole('button', { name: '3', exact: true }).click(); // choose item by item
  await expect(page.getByText(/3 pieces for ₹1,377\. Press 1 to keep all 3\. Press 2 to cancel all 3\. Press 3 to keep only some\./)).toBeVisible();
  await page.getByRole('button', { name: '3', exact: true }).click(); // keep only some
  await expect(page.getByText('How many of the 3 do you want to keep? Press a number from 1 to 2.')).toBeVisible();
  await shot('5-call-how-many');
  await page.getByRole('button', { name: '2', exact: true }).click(); // keep 2
  await expect(page.getByText(/^Keeping Blackout Door Curtains \(Set of 2\) × 2\. Cancelled Blackout Door Curtains \(Set of 2\)/)).toBeVisible();

  const o = await orderById(page, id);
  expect(o.items[0].qty).toBe(2);
  expect(o.total).toBe(459 * 2);
  expect(o.confirm.state).toBe('confirmed');
  noErrors();
});
