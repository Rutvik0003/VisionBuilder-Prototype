import { test, expect, type Page } from '@playwright/test';
import { OPEN_BOX_CHECKLIST, asCustomer, hubPublishRunFor, orderById, resetDemo, riderWorkUntil, shooter, store, watchConsole } from './helpers';

type O = { id: string; groupId?: string; status: string; items: { productId: string }[]; total: number; returnedFrom?: string; returnedPart?: string };

async function addToCart(page: Page, productId: string, size?: string) {
  await page.goto(`/customer/product/${productId}`);
  if (size) await page.getByRole('button', { name: size, exact: true }).click();
  await page.getByRole('button', { name: 'Add to Cart' }).click();
}

/** Cart → COD + open-box → place → confirm on WhatsApp. Returns the order ids of the checkout. */
async function placeOpenBoxCart(page: Page) {
  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: /Open-box delivery/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  const leadId = page.url().split('/').pop()!;
  const s = await store(page);
  const lead = s.orders.find((o: O) => o.id === leadId);
  const ids: string[] = lead.groupId ? s.orders.filter((o: O) => o.groupId === lead.groupId).map((o: O) => o.id) : [leadId];
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: /^Confirm (all|order)$/ }).first().click();
  return ids;
}

/** Seller ships → transit → hub scan-in → "Yes" → plan + publish → rider at the door. */
async function bringToDoor(page: Page, ids: string[], beforeScan?: () => Promise<void>) {
  await page.goto('/transit');
  for (const id of ids) {
    const row = page.locator('tr').filter({ has: page.getByText('#' + id, { exact: true }) });
    await row.getByRole('button', { name: 'Seller ships' }).click();
    await row.getByRole('button', { name: 'In transit' }).click();
    await row.getByRole('button', { name: 'Reached hub' }).click();
  }
  await page.goto('/hub/HUB_HARDOI');
  if (beforeScan) await beforeScan();
  await page.getByRole('button', { name: /Scan in all/ }).click();
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Yes, I’ll be there' }).last().click();
  const riderId = await hubPublishRunFor(page, ids[0]);
  await page.goto(`/rider/${riderId}`);
  await page.getByRole('button', { name: /^Start / }).click();
  await riderWorkUntil(page, riderId, (cur) => !!cur && ids.includes(cur.id));
  return riderId;
}

async function startOpenBox(page: Page) {
  await page.getByRole('button', { name: 'Open-box check' }).click();
  await page.getByRole('button', { name: 'Take seal photo' }).click();
  await page.getByRole('button', { name: /Start inspection/ }).click();
}

test('Open-box · one parcel, two items: keep one, return one', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'G-openbox-multi');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');

  // Two items from the same seller (Homely Decor) → one parcel
  await addToCart(page, 'P15');
  await addToCart(page, 'P17');
  const [id] = await placeOpenBoxCart(page);
  expect((await orderById(page, id)).items.length).toBe(2);

  // Seller & Transit and the hub name both items in the parcel
  await page.goto('/transit');
  const row = page.locator('tr').filter({ has: page.getByText('#' + id, { exact: true }) });
  await expect(row.getByText('Blackout Door Curtains (Set of 2)')).toBeVisible();
  await expect(row.getByText('Cushion Covers (Set of 5)')).toBeVisible();
  await expect(row.getByText(/2 items in one parcel/)).toBeVisible();
  await shot('1-transit-both-items');
  const riderId = await bringToDoor(page, [id], async () => {
    // Hub Inbound names both items in the parcel
    await expect(page.getByText(/Blackout Door Curtains \(Set of 2\) \+ Cushion Covers \(Set of 5\)/).first()).toBeVisible();
    await shot('1b-hub-both-items');
  });

  // At the door: the customer keeps the curtains, returns the cushion covers
  await page.goto(`/rider/${riderId}/stop/${id}`);
  await page.getByRole('button', { name: 'Arrived at stop' }).click();
  await startOpenBox(page);
  await page.getByRole('button', { name: 'Customer refuses' }).click();
  await page.locator('label', { hasText: 'Blackout Door Curtains' }).locator('input').uncheck(); // keeps this one
  await expect(page.getByText('The rest is delivered now: the customer pays only for what they keep.')).toBeVisible();
  await page.getByRole('button', { name: 'Colour/design different' }).click();
  await page.getByRole('button', { name: 'Take item photo' }).click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('button', { name: 'Customer reads it out' }).click();
  await shot('2-rider-return-one-keep-one');
  await page.getByRole('button', { name: 'Reseal returned items · deliver the rest · collect ₹459' }).click();

  const kept = await orderById(page, id);
  expect(kept.status).toBe('DELIVERED');
  expect(kept.items.map((i: { productId: string }) => i.productId)).toEqual(['P15']);
  expect(kept.total).toBe(459);
  const back = await orderById(page, kept.returnedPart);
  expect(back.status).toBe('REFUSED_AFTER_INSPECTION');
  expect(back.items.map((i: { productId: string }) => i.productId)).toEqual(['P17']);
  expect(back.refusal.disposition).toBe('return_to_seller');

  // Hub: the returned part goes back to the seller; the customer can order it again or close it
  await page.goto('/hub/HUB_HARDOI?view=returns');
  await expect(page.locator('div.flex-wrap', { hasText: 'Cushion Covers (Set of 5)' }).getByText('Returning to seller')).toBeVisible();
  await shot('3-hub-returned-part');
  await page.goto('/customer/inbox');
  await expect(page.getByRole('button', { name: 'Get the correct item' }).last()).toBeVisible();
  await expect(page.getByText(/You kept Blackout Door Curtains \(Set of 2\) and returned Cushion Covers \(Set of 5\) at the door/)).toBeInViewport(); // newest message in view
  await page.goto(`/customer/orders/${id}`);
  await expect(page.getByText(`Some items returned at the door · #${back.id}`)).toBeVisible();
  await expect(page.getByText('Part of this parcel was returned at the door')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close order' })).toBeVisible();
  await shot('4-customer-delivered-part');
  noErrors();
});

test('Open-box · two parcels (two sellers): accept one, refuse the other', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'G-openbox-multi');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');

  // Kurti (Shree Textiles) + Anarkali kurta set (Anjali Fashions), both open-box → two parcels, same door
  await addToCart(page, 'P02', 'M');
  await addToCart(page, 'P09', 'M');
  const ids = await placeOpenBoxCart(page);
  expect(ids.length).toBe(2);
  const riderId = await bringToDoor(page, ids);

  // First parcel: full open-box check, accepted
  let cur = (await store(page)).orders.find((o: O) => ids.includes(o.id) && o.status !== 'DELIVERED');
  await page.goto(`/rider/${riderId}/stop/${cur.id}`);
  await expect(page.getByText(/The open-box parcel needs its own check after this one/)).toBeVisible();
  await page.getByRole('button', { name: 'Arrived at stop' }).click();
  await startOpenBox(page);
  for (const c of OPEN_BOX_CHECKLIST) await page.getByLabel(c, { exact: true }).check();
  await page.getByRole('button', { name: 'Customer reads it out' }).click();
  await page.getByRole('button', { name: /^Customer accepts/ }).click();
  expect((await orderById(page, cur.id)).status).toBe('DELIVERED');

  // Second parcel at the same door: its own open-box check → refused
  const second = ids.find((x) => x !== cur.id)!;
  expect((await orderById(page, second)).status).not.toBe('DELIVERED'); // not handed over blindly with the first
  await page.goto(`/rider/${riderId}/stop/${second}`);
  await startOpenBox(page); // already at the door (arrived with the first parcel)
  await page.getByRole('button', { name: 'Customer refuses' }).click();
  await page.getByRole('button', { name: 'Wrong size label' }).click();
  await page.getByRole('button', { name: 'Take item photo' }).click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await shot('5-second-parcel-refused');
  await page.getByRole('button', { name: 'Reseal in tamper-evident bag' }).click();
  cur = await orderById(page, second);
  expect(cur.status).toBe('REFUSED_AFTER_INSPECTION');
  noErrors();
});
