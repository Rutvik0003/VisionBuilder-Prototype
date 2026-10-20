import { test, expect, type Page } from '@playwright/test';
import { asCustomer, resetDemo, shooter, store, watchConsole } from './helpers';

async function addAddressWithPinLink(page: Page, area: string, receiver: string) {
  await page.goto('/customer/addresses/new');
  await page.getByLabel('Pincode').fill('241001');
  await page.getByRole('button', { name: 'Not at this address? Send a link to pin it' }).click();
  // the details step opens at the top, so the receiver field is visible without scrolling
  await expect(page.getByLabel("Receiver's phone number (optional)")).toBeInViewport();
  await page.getByLabel('Full name').fill('Rekha Yadav');
  await page.getByLabel('House / flat / shop no.').fill('Mother’s house');
  await page.getByLabel('Area, street, village').fill(area);
  await page.getByLabel('Receiver\'s phone number (optional)').fill(receiver);
}

// C2-F1 remote pin link: optional receiver number + "Share this link" from Messages
test('Pin link · receiver number and share', async ({ page }) => {
  const noErrors = watchConsole(page);
  const shot = shooter(page, 'E-pin-link');
  await resetDemo(page);
  await asCustomer(page, 'Existing User');

  // 1. Empty receiver → link only to me
  await addAddressWithPinLink(page, 'Sandi Road', '');
  await expect(page.getByText('Leave it empty and the link comes only to you.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save address' }).click();
  let s = await store(page);
  let msg = s.messages.find((m: { link?: unknown }) => m.link);
  expect(msg.text).not.toContain('also sent to');
  expect(msg.sharedTo).toBeUndefined();

  // 2. Invalid receiver blocks save; a valid one sends to me and to them
  await addAddressWithPinLink(page, 'Civil Lines', '12345');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('Enter a valid 10-digit mobile number')).toBeVisible();
  await page.getByLabel('Receiver\'s phone number (optional)').fill('98765 43210');
  await expect(page.getByText('We’ll send the pin link to you and to this number.')).toBeVisible();
  await shot('1-receiver-number');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page).toHaveURL(/\/customer\/addresses$/);

  await page.goto('/customer/inbox');
  await expect(page.getByText('This link was also sent to +91 98XXX XX210.')).toBeVisible();
  await expect(page.getByText('Shared with +91 98XXX XX210')).toBeVisible();
  await shot('2-message-sent-to-both');

  // 3. "Share this link" → copy field + send to another number
  await page.getByRole('button', { name: 'Share this link' }).last().click(); // the Civil Lines message (newest is last)
  await expect(page.locator('input[readonly]')).toHaveValue(/\/pin\/A_/);
  await page.getByLabel('Receiver’s phone number').fill('91234 56789');
  await shot('3-share-sheet');
  await page.getByRole('button', { name: 'Send link on WhatsApp' }).click();
  await expect(page.getByText('Shared with +91 98XXX XX210, +91 91XXX XX789')).toBeVisible();
  await shot('4-shared-again');

  s = await store(page);
  expect(s.events.some((e: { name: string }) => e.name === 'remote_link_forwarded')).toBe(true);
  // the link itself still opens the pin page
  await page.getByRole('link', { name: 'Pin my location' }).first().click();
  await expect(page).toHaveURL(/\/pin\/A_/);
  noErrors();
});
