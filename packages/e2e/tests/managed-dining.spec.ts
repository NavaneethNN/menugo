import { test, expect } from '@playwright/test';
import { WorkflowMode } from '@prisma/client';
import { seedTestData, setWorkflowMode, TEST_RESTAURANT_ID } from './fixtures/seed';
import {
  loginStaff,
  updateItemStatus,
  markOrderServed,
  closeSession,
  getKitchenOrders,
  getWaiterOrders,
  getCashierTables,
} from './fixtures/api';
import {
  scanAndJoinSession,
  addItemToCart,
  placeOrder,
  expectText,
} from './fixtures/customer-flow';

test.describe('Phase 9.1 — Managed Dining', () => {
  let seeded: Awaited<ReturnType<typeof seedTestData>>;

  test.beforeAll(async () => {
    seeded = await seedTestData();
    await setWorkflowMode(WorkflowMode.MANAGED_DINING);
  });

  test('customer places order and tracking shows items', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    await placeOrder(page);

    const orderId = page.url().split('/track/')[1];
    expect(orderId).toBeTruthy();

    await expectText(page, 'Received');
    await expectText(page, 'Chicken Biriyani');
    await expectText(page, 'Mango Lassi');
  });

  test('K1 kitchen marks biriyani ready; customer sees partially ready', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    await placeOrder(page);

    const orderId = page.url().split('/track/')[1];
    const sessionRes = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const orders = await getKitchenOrders(sessionRes.token);
    const biriyaniItem = orders.find((o) => o.menuItemName === 'Chicken Biriyani');
    expect(biriyaniItem).toBeTruthy();

    await updateItemStatus(sessionRes.token, biriyaniItem!.id, 'ACCEPTED');
    await updateItemStatus(sessionRes.token, biriyaniItem!.id, 'PREPARING');
    await updateItemStatus(sessionRes.token, biriyaniItem!.id, 'READY');

    await expectText(page, 'Ready');
    await expectText(page, 'Some items are ready');
  });

  test('K2 marks lassi ready; customer sees fully ready', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    await placeOrder(page);

    const k1 = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const k2 = await loginStaff(TEST_RESTAURANT_ID, '2222');
    const kitchenOrders = await getKitchenOrders(k1.token);

    const biriyaniItem = kitchenOrders.find((o) => o.menuItemName === 'Chicken Biriyani');
    const lassiItem = kitchenOrders.find((o) => o.menuItemName === 'Mango Lassi');
    expect(biriyaniItem).toBeTruthy();
    expect(lassiItem).toBeTruthy();

    await updateItemStatus(k1.token, biriyaniItem!.id, 'READY');
    await updateItemStatus(k2.token, lassiItem!.id, 'READY');

    await expectText(page, 'All items are ready');
  });

  test('waiter marks all served; customer sees completion', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    const order = await placeOrder(page);

    const orderId = page.url().split('/track/')[1];
    const k1 = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const k2 = await loginStaff(TEST_RESTAURANT_ID, '2222');
    const waiter = await loginStaff(TEST_RESTAURANT_ID, '3333');
    const kitchenOrders = await getKitchenOrders(k1.token);

    await updateItemStatus(k1.token, kitchenOrders.find((o) => o.menuItemName === 'Chicken Biriyani')!.id, 'READY');
    await updateItemStatus(k2.token, kitchenOrders.find((o) => o.menuItemName === 'Mango Lassi')!.id, 'READY');

    await markOrderServed(waiter.token, orderId);

    await expectText(page, 'All done! Enjoy your meal');
  });

  test('cashier settles session and customer sees session ended', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    await placeOrder(page);

    const orderId = page.url().split('/track/')[1];
    const k1 = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const k2 = await loginStaff(TEST_RESTAURANT_ID, '2222');
    const waiter = await loginStaff(TEST_RESTAURANT_ID, '3333');
    const cashier = await loginStaff(TEST_RESTAURANT_ID, '4444');
    const kitchenOrders = await getKitchenOrders(k1.token);

    await updateItemStatus(k1.token, kitchenOrders.find((o) => o.menuItemName === 'Chicken Biriyani')!.id, 'READY');
    await updateItemStatus(k2.token, kitchenOrders.find((o) => o.menuItemName === 'Mango Lassi')!.id, 'READY');
    await markOrderServed(waiter.token, orderId);

    const tables = await getCashierTables(cashier.token);
    const table = tables.find((t) => t.tableId === seeded.t1.id);
    expect(table).toBeTruthy();
    expect(table!.activeSessions.length).toBe(1);
    expect(table!.activeSessions[0].sessionTotal).toBe('240.00');

    await closeSession(cashier.token, table!.activeSessions[0].sessionId);

    await expectText(page, 'Your session has ended');

    const refreshedTables = await getCashierTables(cashier.token);
    const refreshedTable = refreshedTables.find((t) => t.tableId === seeded.t1.id);
    expect(refreshedTable).toBeTruthy();
    expect(refreshedTable!.availableSeats).toBe(refreshedTable!.totalSeats);
  });
});
