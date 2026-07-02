import { test, expect } from '@playwright/test';
import { WorkflowMode } from '@prisma/client';
import { seedTestData, setWorkflowMode, TEST_RESTAURANT_ID } from './fixtures/seed';
import {
  loginStaff,
  updateItemStatus,
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

test.describe('Phase 9.3 — Self Collection', () => {
  let seeded: Awaited<ReturnType<typeof seedTestData>>;

  test.beforeAll(async () => {
    seeded = await seedTestData();
    await setWorkflowMode(WorkflowMode.SELF_COLLECTION);
  });

  test('kitchen app receives items and waiter app stays silent', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    const orderId = await placeOrder(page);

    const k1 = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const waiter = await loginStaff(TEST_RESTAURANT_ID, '3333');

    const kitchenOrders = await getKitchenOrders(k1.token);
    const biriyaniItem = kitchenOrders.find((o) => o.menuItemName === 'Chicken Biriyani');
    expect(biriyaniItem).toBeTruthy();
    expect(biriyaniItem!.order.workflowMode).toBe('SELF_COLLECTION');

    const waiterOrders = await getWaiterOrders(waiter.token);
    const waiterOrder = waiterOrders.find((o) => o.orderId === orderId);
    expect(waiterOrder).toBeUndefined();
  });

  test('K1 marks biriyani ready; customer sees pickup banner', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    await placeOrder(page);

    const k1 = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const kitchenOrders = await getKitchenOrders(k1.token);
    const biriyaniItem = kitchenOrders.find((o) => o.menuItemName === 'Chicken Biriyani');
    expect(biriyaniItem).toBeTruthy();

    await updateItemStatus(k1.token, biriyaniItem!.id, 'ACCEPTED');
    await updateItemStatus(k1.token, biriyaniItem!.id, 'PREPARING');
    await updateItemStatus(k1.token, biriyaniItem!.id, 'READY');

    await expectText(page, 'Ready for Pickup');
    await expectText(page, 'Chicken Biriyani');
  });

  test('both kitchens mark items ready; customer sees all ready banner', async ({ page }) => {
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

  test('kitchen marks items served; customer sees collection complete', async ({ page }) => {
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
    await updateItemStatus(k1.token, biriyaniItem!.id, 'SERVED');
    await updateItemStatus(k2.token, lassiItem!.id, 'SERVED');

    await expectText(page, 'All done! Enjoy your meal');
  });

  test('cashier closes session after self-collection and seats are freed', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    await placeOrder(page);

    const k1 = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const k2 = await loginStaff(TEST_RESTAURANT_ID, '2222');
    const cashier = await loginStaff(TEST_RESTAURANT_ID, '4444');
    const kitchenOrders = await getKitchenOrders(k1.token);

    const biriyaniItem = kitchenOrders.find((o) => o.menuItemName === 'Chicken Biriyani');
    const lassiItem = kitchenOrders.find((o) => o.menuItemName === 'Mango Lassi');

    await updateItemStatus(k1.token, biriyaniItem!.id, 'READY');
    await updateItemStatus(k2.token, lassiItem!.id, 'READY');
    await updateItemStatus(k1.token, biriyaniItem!.id, 'SERVED');
    await updateItemStatus(k2.token, lassiItem!.id, 'SERVED');

    const tables = await getCashierTables(cashier.token);
    const table = tables.find((t) => t.tableId === seeded.t1.id);
    expect(table).toBeTruthy();
    expect(table!.activeSessions.length).toBe(1);

    await closeSession(cashier.token, table!.activeSessions[0].sessionId);

    await expectText(page, 'Your session has ended');

    const refreshedTables = await getCashierTables(cashier.token);
    const refreshedTable = refreshedTables.find((t) => t.tableId === seeded.t1.id);
    expect(refreshedTable).toBeTruthy();
    expect(refreshedTable!.availableSeats).toBe(refreshedTable!.totalSeats);
  });

  test('workflow mode switch: in-flight MANAGED order still routes to waiter', async ({ page }) => {
    await setWorkflowMode(WorkflowMode.MANAGED_DINING);

    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    const orderAId = await placeOrder(page);

    await setWorkflowMode(WorkflowMode.SELF_COLLECTION);

    const k1 = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const waiter = await loginStaff(TEST_RESTAURANT_ID, '3333');
    const kitchenOrders = await getKitchenOrders(k1.token);

    const biriyaniItem = kitchenOrders.find(
      (o) => o.menuItemName === 'Chicken Biriyani' && o.orderId === orderAId
    );
    expect(biriyaniItem).toBeTruthy();
    expect(biriyaniItem!.order.workflowMode).toBe('MANAGED_DINING');

    await updateItemStatus(k1.token, biriyaniItem!.id, 'READY');

    const waiterOrders = await getWaiterOrders(waiter.token);
    const waiterOrder = waiterOrders.find((o) => o.orderId === orderAId);
    expect(waiterOrder).toBeTruthy();

    await setWorkflowMode(WorkflowMode.SELF_COLLECTION);
  });
});
