import { test, expect, type Page } from '@playwright/test';
import { asCustomer, hubPublishRunFor, orderById, resetDemo, riderWorkUntil, shooter, store, watchConsole } from './helpers';

type O = { id: string; groupId?: string; status: string; items: { productId: string }[]; total: number; deliveryOtp: string; confirm?: { state: string }; route?: { riderId: string } };

async function addToCart(page: Page, productId: string, size?: string) {
  await page.goto(`/customer/product/${productId}`);
  if (size) await page.getByRole('button', { name: size, exact: true }).click();
  await page.getByRole('button', { name: 'Add to Cart' }).click();
}

async function checkoutCart(page: Page) {
  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Continue' }).click(); // cart → checkout
  await page.getByRole('button', { name: 'Continue' }).click(); // address → delivery
  await page.getByRole('button', { name: 'Continue' }).click(); // delivery → payment
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: 'Continue' }).click(); // → summary
}

const group = async (page: Page, leadId: string) => {
  const s = await store(page);
  const lead = s.orders.find((o: O) => o.id === leadId);
  return s.orders.filter((o: O) => o.groupId && o.groupId === lead.groupId) as O[];
};

// One checkout, several sellers: split into one order per seller, confirmed ONCE, delivered in ONE stop
test('Multiple orders · one confirmation, one call, one stop', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'F-multi-order');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');

  // Cart: curtains + cushion covers (Homely Decor) and a tawa (Steel King) → 2 sellers
  await addToCart(page, 'P15');
  await addToCart(page, 'P17');
  await addToCart(page, 'P20');
  await checkoutCart(page);
  await expect(page.getByText('These items are from 2 sellers, so they come as 2 parcels')).toBeVisible();
  await shot('1-checkout-two-sellers');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  await expect(page.getByText(/2 parcels · #/)).toBeVisible();
  await shot('2-order-placed-two-parcels');

  const leadId = page.url().split('/').pop()!;
  let orders = await group(page, leadId);
  expect(orders.length).toBe(2);
  expect(orders.map((o) => o.items.length).sort()).toEqual([1, 2]); // same seller → one order with both items
  expect(new Set(orders.map((o) => o.deliveryOtp)).size).toBe(1); // one OTP for the door
  let s = await store(page);
  expect(s.messages.filter((m: { featureId: string; channel: string }) => m.featureId === 'P1' && m.channel === 'whatsapp').length).toBe(1);

  // ONE WhatsApp for both orders, with "Keep some, cancel some"
  await page.goto('/customer/inbox');
  await expect(page.getByText(/Confirm your order: 3 items for ₹1,037 in total/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep some, cancel some' })).toBeVisible();
  await shot('3-one-whatsapp-for-both');

  // Seller & Transit: one card, one call
  await page.goto('/transit?tab=confirm');
  const card = page.locator('div.card', { hasText: 'one confirmation' });
  await expect(card).toHaveCount(1);
  await shot('4-transit-one-card');
  await card.getByRole('button', { name: /No tap in 10 min/ }).click();
  const queued = page.getByRole('button', { name: /9 am → place queued call/ });
  if (await queued.isVisible()) await queued.click();
  s = await store(page);
  expect(s.events.filter((e: { name: string }) => e.name === 'ivr_call_placed').length).toBe(1);

  // ONE call: press 3 → keep curtains, cancel cushion covers, keep tawa
  await page.goto('/customer');
  await page.getByRole('button', { name: 'Answer' }).click();
  await expect(page.getByText(/Press 3 to choose item by item/)).toBeVisible();
  await shot('5-one-call-for-both');
  await page.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.getByText(/Item 1 of 3:/)).toBeVisible();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await expect(page.getByText(/Item 2 of 3:/)).toBeVisible();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await expect(page.getByText(/Item 3 of 3:/)).toBeVisible();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await expect(page.getByText(/^Keeping .* Cancelled Cushion Covers/)).toBeVisible();
  await shot('6-kept-two-cancelled-one');

  orders = await group(page, leadId);
  const homely = orders.find((o) => o.items.some((i) => i.productId === 'P15'))!;
  const steel = orders.find((o) => o.items.some((i) => i.productId === 'P20'))!;
  expect(homely.items.map((i) => i.productId)).toEqual(['P15']);
  expect(homely.total).toBe(459);
  expect(homely.confirm?.state).toBe('confirmed');
  expect(steel.confirm?.state).toBe('confirmed');

  // Second checkout, kept 1 / cancelled 1 from WhatsApp: kurti (Shree Textiles) + masala box (Steel King)
  await addToCart(page, 'P02', 'M');
  await addToCart(page, 'P21');
  await checkoutCart(page);
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  const lead2 = page.url().split('/').pop()!;
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Keep some, cancel some' }).last().click();
  const sheet = page.locator('div.absolute.inset-0.z-40');
  await sheet.locator('div.flex.items-center', { hasText: 'Airtight Masala Box' }).getByRole('button', { name: 'Cancel' }).click();
  await shot('7-whatsapp-keep-some');
  await sheet.getByRole('button', { name: 'Confirm 1, cancel 1' }).click();
  const second = await group(page, lead2);
  expect(second.find((o) => o.items.some((i) => i.productId === 'P02'))?.confirm?.state).toBe('confirmed');
  expect(second.find((o) => o.items.some((i) => i.productId === 'P21'))?.status).toBe('CANCELLED');

  // Ship both parcels of the first checkout → hub → ONE "Will you be home?" → ONE stop at the door
  await page.goto('/transit');
  for (const o of [homely, steel]) {
    const row = page.locator('tr').filter({ has: page.getByText('#' + o.id, { exact: true }) });
    await row.getByRole('button', { name: 'Seller ships' }).click();
    await row.getByRole('button', { name: 'In transit' }).click();
    await row.getByRole('button', { name: 'Reached hub' }).click();
  }
  await page.goto('/hub/HUB_HARDOI');
  await page.getByRole('button', { name: /Scan in all/ }).click();
  s = await store(page);
  const pings = s.messages.filter((m: { featureId: string; channel: string; buttons: { action: string }[] }) => m.featureId === 'C1-F2' && m.channel === 'whatsapp'
    && m.buttons.some((b) => b.action.includes(homely.id) || b.action.includes(steel.id)));
  expect(pings.length).toBe(1);
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Yes, I’ll be there' }).last().click();

  const riderId = await hubPublishRunFor(page, homely.id);
  expect((await orderById(page, steel.id)).route.riderId).toBe(riderId); // same door → same rider
  await page.goto(`/rider/${riderId}`);
  await page.getByRole('button', { name: /^Start / }).click();
  await riderWorkUntil(page, riderId, (cur) => !!cur && [homely.id, steel.id].includes(cur.id));
  const cur = (await store(page)).orders.find((o: O) => [homely.id, steel.id].includes(o.id) && o.status !== 'DELIVERED');
  await page.goto(`/rider/${riderId}/stop/${cur.id}`);
  await expect(page.getByText(/Same door: 2 parcels for Rekha Yadav/)).toBeVisible();
  await expect(page.getByText('Collect ₹788')).toBeVisible();
  await shot('8-rider-one-stop');
  await page.getByRole('button', { name: 'Arrived at stop' }).click();
  await page.getByRole('button', { name: 'Delivered', exact: true }).click();
  await page.getByRole('button', { name: 'Customer reads it out' }).click();
  await page.getByRole('button', { name: /Collected ₹788 · Confirm delivery/ }).click();
  expect((await orderById(page, homely.id)).status).toBe('DELIVERED');
  expect((await orderById(page, steel.id)).status).toBe('DELIVERED');
  s = await store(page);
  expect(s.messages.filter((m: { orderId?: string; text: string }) => [homely.id, steel.id].includes(m.orderId ?? '') && /delivered/i.test(m.text) && !/away/.test(m.text)).length).toBe(1);
  noErrors();
});
