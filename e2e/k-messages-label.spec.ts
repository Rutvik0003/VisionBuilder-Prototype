import { test, expect, type Page } from '@playwright/test';
import { asCustomer, resetDemo, shooter, store, watchConsole } from './helpers';

type O = { id: string; groupId?: string; items: { productId: string }[]; slot: { date: string; window: string } };
const row = (page: Page, id: string) => page.locator('tr').filter({ has: page.getByText('#' + id, { exact: true }) });

async function addToCart(page: Page, productId: string, size?: string) {
  await page.goto(`/customer/product/${productId}`);
  if (size) await page.getByRole('button', { name: size, exact: true }).click();
  await page.getByRole('button', { name: 'Add to Cart' }).click();
}

test('3 sellers, 2 on the same day → "2 deliveries"; messages name their items', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'K-messages-label');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');
  await addToCart(page, 'P02', 'M'); // Shree Textiles
  await addToCart(page, 'P09', 'M'); // Anjali Fashions (same day)
  await addToCart(page, 'P14');      // Panipat Home Mills (a day later)

  await page.goto('/customer/cart');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Deliver each when ready/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('2 deliveries', { exact: true })).toBeVisible(); // 3 parcels, 2 visits
  await shot('1-summary-2-deliveries');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByText('2 deliveries, as you chose')).toBeVisible();

  const leadId = page.url().split('/').pop()!;
  const s = await store(page);
  const group: O[] = s.orders.filter((o: O) => o.groupId === s.orders.find((x: O) => x.id === leadId).groupId);
  const late = group.find((o) => o.items[0].productId === 'P14')!;
  await page.goto('/customer/inbox');
  await page.getByRole('button', { name: 'Confirm all' }).last().click();

  // Delay: the message says which item is late
  await page.goto('/transit');
  await row(page, late.id).getByRole('button', { name: /Seller missed dispatch/ }).click();
  await row(page, late.id).getByRole('button', { name: '1d', exact: true }).click();
  await page.goto('/customer/inbox');
  await expect(page.getByText(/Your order of Cotton Double Bedsheet \+ 2 Pillow Covers may arrive late/)).toBeVisible();
  await shot('2-delay-names-item');

  // "Will you be home?": one message for the two same-day parcels, naming both and the total cash
  await page.goto('/transit');
  for (const o of group.filter((x) => x.id !== late.id)) {
    await row(page, o.id).getByRole('button', { name: 'Seller ships' }).click();
    await row(page, o.id).getByRole('button', { name: 'In transit' }).click();
    await row(page, o.id).getByRole('button', { name: 'Reached hub' }).click();
  }
  await page.goto('/hub/HUB_HARDOI');
  await page.getByRole('button', { name: /Scan in all/ }).click();
  await page.goto('/customer/inbox');
  await expect(page.getByText(/Your Meesho order of Floral Rayon Kurti \(M\) \+ Anarkali Printed Kurta Set \(M\) has reached your local delivery hub/)).toBeVisible();
  await expect(page.getByText(/Amount ₹1,148\./)).toBeVisible();
  await shot('3-ping-names-items');
  noErrors();
});

test('Label: an address without a pin shows "DIGIPIN not set"', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'K-messages-label');
  await resetDemo(page);
  await asCustomer(page, 'New User');
  await page.goto('/customer/addresses/new');
  await page.getByLabel('Pincode').fill('241001');
  await page.getByRole('button', { name: 'Skip for now' }).click(); // no pin → no DIGIPIN
  await page.getByLabel('Full name').fill('Kavita Patel');
  await page.getByLabel('House / flat / shop no.').fill('Patel Kirana Store');
  await page.getByLabel('Area, street, village').fill('Railway Ganj');
  await page.getByRole('button', { name: 'Save address' }).click();
  await page.goto('/customer/product/P20');
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Pay online (UPI)' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  const id = page.url().split('/').pop()!;

  await page.goto('/transit');
  await row(page, id).getByRole('button', { name: 'Label' }).click();
  await expect(page.getByText('NOT SET · use the address above')).toBeVisible();
  await expect(page.getByText(/^[2-9CFJKLMPT]{3}-[2-9CFJKLMPT]{3}-[2-9CFJKLMPT]{4}$/)).toHaveCount(0);
  await shot('4-label-no-digipin');
  noErrors();
});
