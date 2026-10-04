import { test, expect, type Page } from '@playwright/test';
import { asCustomer, latestOrderId, orderById, resetDemo, shooter, store, watchConsole } from './helpers';

const sheet = (page: Page) => page.locator('div.absolute.inset-0.z-40');
async function pad(page: Page, digits: string) {
  for (const d of digits) await sheet(page).getByRole('button', { name: d, exact: true }).click();
}

// C. Dispatch Layer — flagged order + child lock (Existing User, a medium-risk COD customer)
test('C · Dispatch layer', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'C-dispatch');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');

  // 1. Turn on Child PIN Lock → wrong PIN 3 times → 5-minute block → Forgot PIN → OTP reset
  await page.goto('/customer/account');
  await page.getByRole('button', { name: 'Child PIN Lock' }).click();
  await pad(page, '1234');
  await pad(page, '1234');
  await expect(page.getByText('PIN needed before every order')).toBeVisible();
  await shot('1-child-pin-lock-on');

  await page.goto('/customer/product/P02');
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await page.getByRole('button', { name: 'Continue' }).click(); // → delivery
  await page.getByRole('button', { name: 'Continue' }).click(); // → payment
  await page.getByText('Cash on Delivery').first().click();
  await page.getByRole('button', { name: 'Continue' }).click(); // → summary
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByText('Enter your 4-digit child-lock PIN')).toBeVisible();
  await pad(page, '0000');
  await expect(page.getByText('Wrong PIN. 2 attempts left.')).toBeVisible();
  await pad(page, '1111');
  await pad(page, '2222');
  await expect(page.getByText('Too many wrong PINs')).toBeVisible();
  await shot('1b-locked-5-minutes');
  const owner = (await store(page)).messages.filter((m: { customerId: string; channel: string; text: string }) => m.customerId === 'existing' && m.channel === 'whatsapp' && m.text.includes('Child PIN'));
  expect(owner.length).toBe(1); // owner alerted on WhatsApp

  await sheet(page).getByRole('button', { name: 'Forgot PIN?' }).click();
  await sheet(page).getByRole('button', { name: 'Send OTP' }).click();
  const code = (await sheet(page).locator('span.font-mono').textContent())!.trim();
  await pad(page, code);
  await shot('1c-otp-reset');
  await sheet(page).getByRole('button', { name: 'Verify' }).click();
  await pad(page, '4321');
  await pad(page, '4321');
  await expect(page.getByText('PIN reset. Enter your new PIN.')).toBeVisible();

  // 2. Flagged COD order placed with the new PIN → WhatsApp confirm not tapped → call → press 2 → cancelled
  await pad(page, '4321');
  await expect(page).toHaveURL(/order-placed/);
  const id = await latestOrderId(page, 'existing');
  expect((await orderById(page, id)).confirm.risk).toBe('medium');
  await page.goto('/customer/inbox');
  await expect(page.getByText(/Confirm your order/).first()).toBeVisible();
  await shot('2-whatsapp-confirm');

  await page.goto('/transit?tab=confirm');
  const row = page.locator('div.card, tr, li', { hasText: id }).first();
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: /No tap in 10 min/ }).first().click();
  const queued = page.getByRole('button', { name: /9 am → place queued call/ });
  if (await queued.isVisible()) await queued.click(); // quiet hours (9 pm – 9 am) on the test machine
  await shot('2b-seller-awaiting-confirmation');

  await page.goto('/customer');
  await expect(page.getByText('Answer')).toBeVisible({ timeout: 10_000 });
  await shot('2c-incoming-call');
  await page.getByRole('button', { name: 'Answer' }).click();
  await expect(page.getByText(/Press 1 to confirm your order\. Press 2 to cancel it\./)).toBeVisible();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await expect(page.getByText('Your order has been cancelled. Nothing to pay.')).toBeVisible();
  await shot('2d-pressed-2-cancelled');
  await expect.poll(async () => (await orderById(page, id)).status).toBe('CANCELLED');

  // 3. Hub plans the morning run → riders, km and expected drops → Lock & publish
  await page.goto('/hub/HUB_HARDOI?view=routes');
  await page.getByRole('button', { name: /Plan morning run/ }).click();
  await expect(page.getByText(/\d+ stops? · \d+ riders? · [\d.]+ km · ~[\d.]+ successful drops expected/)).toBeVisible();
  await shot('3-morning-plan');
  await page.getByRole('button', { name: /Lock & publish/ }).click();
  await expect(page.getByText(/Locked · \d+ stops published/).first()).toBeVisible();
  await shot('3b-published');
  noErrors();
});
