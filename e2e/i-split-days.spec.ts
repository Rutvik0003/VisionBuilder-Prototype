import { test, expect, type Page } from '@playwright/test';
import { asCustomer, fmtDate, resetDemo, shooter, store, watchConsole } from './helpers';

type O = { id: string; groupId?: string; slot: { date: string; window: string }; promisedDate: string; items: { productId: string }[] };

async function addToCart(page: Page, productId: string) {
  await page.goto(`/customer/product/${productId}`);
  await page.getByRole('button', { name: 'Add to Cart' }).click();
}
async function toDelivery(page: Page) {
  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Continue' }).click(); // cart → checkout
  await page.getByRole('button', { name: 'Continue' }).click(); // address → delivery
}

// Two sellers, ready on different days: deliver together (default) or each when ready
test('Different ready dates · together by default, or each parcel on its own day', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'I-split-days');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');

  // Curtains (Homely Decor) are ready a day before the tawa (Steel King ships from further away)
  await addToCart(page, 'P15');
  await addToCart(page, 'P20');
  await toDelivery(page);
  await expect(page.getByText('Your items are ready on different days')).toBeVisible();
  await expect(page.getByRole('button', { name: /Deliver together/ })).toHaveAttribute('aria-pressed', 'true'); // default
  await shot('1-ready-on-different-days');

  // Deliver each when ready → one picker per parcel; the curtains in the afternoon
  await page.getByRole('button', { name: /Deliver each when ready/ }).click();
  await expect(page.getByText('Parcel 1 · Homely Decor')).toBeVisible();
  await expect(page.getByText('Parcel 2 · Steel King')).toBeVisible();
  const parcel1 = page.locator('div.space-y-2', { has: page.getByText('Parcel 1 · Homely Decor') }).last();
  await parcel1.getByRole('button', { name: /^Afternoon/ }).click();
  await expect(parcel1.getByText('Slot held for you')).toBeVisible();
  await shot('2-each-when-ready');
  await page.getByRole('button', { name: 'Continue' }).click(); // → payment
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: 'Continue' }).click(); // → summary
  await expect(page.getByText('2 deliveries')).toBeVisible();
  await expect(page.getByText(/each on its own day as you chose/)).toBeVisible();
  await shot('3-summary-two-deliveries');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  await expect(page.getByText('2 deliveries, as you chose')).toBeVisible();
  await shot('4-placed-two-days');

  const leadId = page.url().split('/').pop()!;
  const s = await store(page);
  const lead = s.orders.find((o: O) => o.id === leadId);
  const group: O[] = s.orders.filter((o: O) => o.groupId === lead.groupId);
  const homely = group.find((o) => o.items[0].productId === 'P15')!;
  const steel = group.find((o) => o.items[0].productId === 'P20')!;
  expect(homely.slot.window).toBe('Afternoon 12-4');
  expect(steel.slot.date > homely.slot.date).toBe(true); // the tawa comes a day later
  expect(steel.promisedDate > homely.promisedDate).toBe(true);
  // still ONE confirmation for the checkout, which shows each parcel's day
  const confirms = s.messages.filter((m: { featureId: string; channel: string }) => m.featureId === 'P1' && m.channel === 'whatsapp');
  expect(confirms.length).toBe(1);
  expect(confirms[0].text).toContain(`arriving ${fmtDate(homely.slot.date)} and ${fmtDate(steel.slot.date)}`);
  expect(confirms[0].text).toContain(`· arrives ${fmtDate(steel.slot.date)}`);

  // Default "together": a new cart goes out on the later seller's day, in one visit
  await addToCart(page, 'P17');
  await addToCart(page, 'P21');
  await toDelivery(page);
  await page.getByRole('button', { name: 'Continue' }).click(); // keep "Deliver together"
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  const lead2 = page.url().split('/').pop()!;
  const s2 = await store(page);
  const g2: O[] = s2.orders.filter((o: O) => o.groupId === s2.orders.find((x: O) => x.id === lead2).groupId);
  expect(new Set(g2.map((o) => o.slot.date)).size).toBe(1);
  expect(g2[0].slot.date).toBe(steel.promisedDate); // the later (Steel King) ready date
  noErrors();
});
