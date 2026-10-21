import { test, expect } from '@playwright/test';
import { resetDemo, watchConsole } from './helpers';

// The in-app back arrow stays inside the interface you're in, even after switching interfaces in the sidebar
test('Back arrow steps back inside the same interface, not into the one you switched from', async ({ page }) => {
  const noErrors = watchConsole(page);
  await resetDemo(page);
  const side = page.getByRole('complementary', { name: 'Switch interface' });

  // Customer: home → product page
  await side.getByRole('button', { name: /Existing User/ }).click();
  await expect(page).toHaveURL(/\/customer$/);
  await page.getByText('Floral Rayon Kurti').first().click();
  await expect(page).toHaveURL(/\/customer\/product\//);
  const productUrl = page.url();

  // Switch to Seller, then back to the customer: the product page reopens
  await side.getByRole('button', { name: /Seller & Transit/ }).click();
  await expect(page).toHaveURL(/\/transit$/);
  await side.getByRole('button', { name: /Existing User/ }).click();
  await expect(page).toHaveURL(productUrl);

  // Back arrow → the customer's previous screen (home), not Seller & Transit
  await page.getByRole('button', { name: 'Back' }).first().click();
  await expect(page).toHaveURL(/\/customer$/);

  // Same for the hub: Inbound → Routes tab → a rider → back to the hub → back arrow = Inbound
  await side.getByRole('button', { name: /Hardoi LMDC/ }).click();
  await page.getByRole('button', { name: 'Routes', exact: true }).click();
  await expect(page).toHaveURL(/view=routes/);
  await side.getByRole('button', { name: /Suresh/ }).click();
  await expect(page).toHaveURL(/\/rider\/R_SURESH$/);
  await side.getByRole('button', { name: /Hardoi LMDC/ }).click();
  await expect(page).toHaveURL(/view=routes/);
  await page.getByRole('button', { name: 'Back' }).first().click();
  await expect(page).toHaveURL(/\/hub\/HUB_HARDOI$/);
  noErrors();
});
