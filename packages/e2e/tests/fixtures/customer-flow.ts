import type { Page } from '@playwright/test';
import { CUSTOMER_BASE } from '../../playwright.config';

export async function scanAndJoinSession(page: Page, qrToken: string, seats: number) {
  await page.goto(`${CUSTOMER_BASE}/scan/${qrToken}`);
  await page.waitForSelector('text=/Welcome!/');

  for (let i = 1; i < seats; i++) {
    await page.getByRole('button', { name: '+' }).click();
  }

  await page.getByRole('button', { name: /See the menu/ }).click();
  await page.waitForURL('**/menu/**');
}

export async function addItemToCart(page: Page, itemName: string) {
  const itemCard = page.locator('div').filter({ hasText: itemName }).first();
  await itemCard.getByRole('button', { name: '+' }).click();
}

export async function placeOrder(page: Page) {
  await page.getByRole('button', { name: /Place order/ }).click();
  await page.waitForURL('**/track/**');
  return page.url().split('/track/')[1];
}

export async function expectItemStatus(page: Page, itemName: string, status: string) {
  const itemCard = page.locator('div').filter({ hasText: itemName }).first();
  await itemCard.locator('text=' + status).waitFor({ timeout: 10_000 });
}

export async function expectText(page: Page, text: string | RegExp) {
  await page.locator('text=' + text).waitFor({ timeout: 10_000 });
}
