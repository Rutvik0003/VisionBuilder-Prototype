import { test, expect } from '@playwright/test';
import { resetDemo, shooter, store, watchConsole } from './helpers';

// The always-on sidebar switches between stakeholder interfaces and remembers each one's last screen
test('Sidebar · switch interfaces, come back to the same screen', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'H-sidebar');
  await resetDemo(page);
  const side = page.getByRole('complementary', { name: 'Switch interface' });
  await expect(page).toHaveURL(/\/customer$/); // no launcher page: the app opens on the customer phone

  // Customer (Rekha) → open a past order
  await side.getByRole('button', { name: /Existing User/ }).click();
  const pastId = (await store(page)).orders.find((o: { customerId: string; status: string }) => o.customerId === 'existing' && o.status === 'DELIVERED').id;
  await page.goto(`/customer/orders/${pastId}`);
  await shot('1-customer-order');

  // Seller & Transit, then the hub's Routes tab
  await side.getByRole('button', { name: /Seller & Transit/ }).click();
  await expect(page).toHaveURL(/\/transit$/);
  await side.getByRole('button', { name: /Hardoi LMDC/ }).click();
  await expect(page).toHaveURL(/\/hub\/HUB_HARDOI$/);
  await page.getByRole('button', { name: 'Routes', exact: true }).click();
  await expect(page).toHaveURL(/view=routes/);

  // Rider, then back to the customer: same order page as before
  await side.getByRole('button', { name: /Suresh/ }).click();
  await expect(page).toHaveURL(/\/rider\/R_SURESH$/);
  await side.getByRole('button', { name: /Existing User/ }).click();
  await expect(page).toHaveURL(new RegExp(`/customer/orders/${pastId}$`));
  await side.getByRole('button', { name: /Hardoi LMDC/ }).click();
  await expect(page).toHaveURL(/\/hub\/HUB_HARDOI\?view=routes$/);
  await shot('2-hub-routes-remembered');

  // New User is a separate customer screen
  await side.getByRole('button', { name: /New User/ }).click();
  await expect(page).toHaveURL(/\/customer$/);
  expect((await store(page)).account).toBe('new');

  // Live counts: an order placed by Rekha shows up on the Seller & Transit badge
  await side.getByRole('button', { name: /Existing User/ }).click();
  await page.goto('/customer/product/P20');
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page).toHaveURL(/order-placed/);
  await expect(side.getByRole('button', { name: /Seller & Transit/ })).toContainText('1');
  await shot('3-badges');
  noErrors();
});
