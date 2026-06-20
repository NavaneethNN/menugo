import { PrismaClient, WorkflowMode, StaffRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const TEST_RESTAURANT_ID = 'e2e-restaurant-1';

export async function resetTestRestaurant() {
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { order: { tableSession: { table: { restaurantId: TEST_RESTAURANT_ID } } } } }),
    prisma.order.deleteMany({ where: { tableSession: { table: { restaurantId: TEST_RESTAURANT_ID } } } }),
    prisma.tableSession.deleteMany({ where: { table: { restaurantId: TEST_RESTAURANT_ID } } }),
    prisma.menuItem.deleteMany({ where: { restaurantId: TEST_RESTAURANT_ID } }),
    prisma.category.deleteMany({ where: { restaurantId: TEST_RESTAURANT_ID } }),
    prisma.staff.deleteMany({ where: { restaurantId: TEST_RESTAURANT_ID } }),
    prisma.table.deleteMany({ where: { restaurantId: TEST_RESTAURANT_ID } }),
    prisma.kitchen.deleteMany({ where: { restaurantId: TEST_RESTAURANT_ID } }),
    prisma.restaurant.deleteMany({ where: { id: TEST_RESTAURANT_ID } }),
  ]);
}

export async function seedTestData() {
  await resetTestRestaurant();

  const restaurant = await prisma.restaurant.create({
    data: {
      id: TEST_RESTAURANT_ID,
      name: 'E2E Test Restaurant',
      workflowMode: WorkflowMode.MANAGED_DINING,
    },
  });

  const k1 = await prisma.kitchen.create({
    data: { restaurantId: restaurant.id, name: 'K1 — Main Kitchen' },
  });

  const k2 = await prisma.kitchen.create({
    data: { restaurantId: restaurant.id, name: 'K2 — Beverage Counter' },
  });

  const mainCat = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: 'Main Course', sortOrder: 1 },
  });

  const bevCat = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: 'Beverages', sortOrder: 2 },
  });

  const [biriyani, lassi] = await prisma.$transaction([
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: mainCat.id,
        kitchenId: k1.id,
        name: 'Chicken Biriyani',
        description: 'Fragrant basmati rice with tender chicken',
        price: 180,
      },
    }),
    prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: bevCat.id,
        kitchenId: k2.id,
        name: 'Mango Lassi',
        description: 'Chilled yoghurt drink',
        price: 60,
      },
    }),
  ]);

  const t1 = await prisma.table.create({
    data: {
      restaurantId: restaurant.id,
      tableNumber: 'T1',
      totalSeats: 4,
      qrToken: `e2e-qr-${randomUUID().slice(0, 8)}`,
    },
  });

  const staffPins = [
    { role: StaffRole.KITCHEN, name: 'Kitchen Staff K1', pin: '1111', kitchenId: k1.id },
    { role: StaffRole.KITCHEN, name: 'Kitchen Staff K2', pin: '2222', kitchenId: k2.id },
    { role: StaffRole.WAITER, name: 'Waiter 1', pin: '3333' },
    { role: StaffRole.CASHIER, name: 'Cashier 1', pin: '4444' },
    { role: StaffRole.ADMIN, name: 'Restaurant Admin', pin: '1234' },
  ];

  for (const s of staffPins) {
    await prisma.staff.create({
      data: {
        restaurantId: restaurant.id,
        role: s.role,
        name: s.name,
        pin: await bcrypt.hash(s.pin, 10),
        kitchenId: s.kitchenId ?? null,
        isActive: true,
      },
    });
  }

  return { restaurant, k1, k2, t1, biriyani, lassi };
}

export async function setWorkflowMode(mode: WorkflowMode) {
  await prisma.restaurant.update({
    where: { id: TEST_RESTAURANT_ID },
    data: { workflowMode: mode },
  });
}
