import { test, expect } from '@playwright/test';
import { WorkflowMode } from '@prisma/client';
import { seedTestData, setWorkflowMode, TEST_RESTAURANT_ID } from './fixtures/seed';
import {
  loginStaff,
  markOrderServed,
  closeSession,
  getWaiterOrders,
  getKitchenOrders,
  getCashierTables,
} from './fixtures/api';
import {
  scanAndJoinSession,
  addItemToCart,
  placeOrder,
  expectText,
} from './fixtures/customer-flow';

test.describe('Phase 9.2 — Assisted Dining', () => {
  let seeded: Awaited<ReturnType<typeof seedTestData>>;

  test.beforeAll(async () => {
    seeded = await seedTestData();
    await setWorkflowMode(WorkflowMode.ASSISTED_DINING);
  });

  test('waiter receives new order and kitchen app stays silent', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    const orderId = await placeOrder(page);

    const waiter = await loginStaff(TEST_RESTAURANT_ID, '3333');
    const waiterOrders = await getWaiterOrders(waiter.token);
    const order = waiterOrders.find((o) => o.id === orderId);
    expect(order).toBeTruthy();
    expect(order!.items.length).toBe(2);

    const k1 = await loginStaff(TEST_RESTAURANT_ID, '1111');
    const kitchenOrders = await getKitchenOrders(k1.token);
    const kitchenOrder = kitchenOrders.find((o) => o.orderId === orderId);
    expect(kitchenOrder).toBeUndefined();
  });

  test('waiter marks served; customer sees completed', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    const orderId = await placeOrder(page);

    const waiter = await loginStaff(TEST_RESTAURANT_ID, '3333');
    await markOrderServed(waiter.token, orderId);

    await expectText(page, 'All done! Enjoy your meal');
  });

  test('cashier closes session and frees seats', async ({ page }) => {
    await scanAndJoinSession(page, seeded.t1.qrToken, 2);
    await addItemToCart(page, 'Chicken Biriyani');
    await addItemToCart(page, 'Mango Lassi');
    const orderId = await placeOrder(page);

    const waiter = await loginStaff(TEST_RESTAURANT_ID, '3333');
    const cashier = await loginStaff(TEST_RESTAURANT_ID, '4444');
    await markOrderServed(waiter.token, orderId);

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
});
