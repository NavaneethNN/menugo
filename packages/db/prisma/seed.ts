import { PrismaClient, WorkflowMode, StaffRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { id: 'seed-restaurant-1' },
    update: {},
    create: {
      id: 'seed-restaurant-1',
      name: 'Demo Restaurant',
      workflowMode: WorkflowMode.MANAGED_DINING,
    },
  });
  console.log(`✅ Restaurant: ${restaurant.name}`);

  // Create 2 kitchens
  const k1 = await prisma.kitchen.upsert({
    where: { id: 'seed-kitchen-1' },
    update: {},
    create: {
      id: 'seed-kitchen-1',
      restaurantId: restaurant.id,
      name: 'K1 — Main Kitchen',
    },
  });

  const k2 = await prisma.kitchen.upsert({
    where: { id: 'seed-kitchen-2' },
    update: {},
    create: {
      id: 'seed-kitchen-2',
      restaurantId: restaurant.id,
      name: 'K2 — Beverage Counter',
    },
  });
  console.log(`✅ Kitchens: ${k1.name}, ${k2.name}`);

  // Create categories
  const mainCat = await prisma.category.upsert({
    where: { id: 'seed-cat-1' },
    update: {},
    create: {
      id: 'seed-cat-1',
      restaurantId: restaurant.id,
      name: 'Main Course',
      sortOrder: 1,
    },
  });

  const bevCat = await prisma.category.upsert({
    where: { id: 'seed-cat-2' },
    update: {},
    create: {
      id: 'seed-cat-2',
      restaurantId: restaurant.id,
      name: 'Beverages',
      sortOrder: 2,
    },
  });
  console.log(`✅ Categories: ${mainCat.name}, ${bevCat.name}`);

  // Create menu items
  const menuItems = [
    {
      id: 'seed-item-1',
      name: 'Chicken Biriyani',
      description: 'Fragrant basmati rice with tender chicken',
      price: 180,
      categoryId: mainCat.id,
      kitchenId: k1.id,
    },
    {
      id: 'seed-item-2',
      name: 'Mutton Biriyani',
      description: 'Slow-cooked mutton with aromatic spices',
      price: 220,
      categoryId: mainCat.id,
      kitchenId: k1.id,
    },
    {
      id: 'seed-item-3',
      name: 'Veg Fried Rice',
      description: 'Wok-tossed vegetables with fried rice',
      price: 120,
      categoryId: mainCat.id,
      kitchenId: k1.id,
    },
    {
      id: 'seed-item-4',
      name: 'Masala Dosa',
      description: 'Crispy dosa with spiced potato filling',
      price: 80,
      categoryId: mainCat.id,
      kitchenId: k1.id,
    },
    {
      id: 'seed-item-5',
      name: 'Lassi',
      description: 'Chilled yoghurt drink',
      price: 60,
      categoryId: bevCat.id,
      kitchenId: k2.id,
    },
    {
      id: 'seed-item-6',
      name: 'Fresh Lime Soda',
      description: 'Sweet or salted lime soda',
      price: 50,
      categoryId: bevCat.id,
      kitchenId: k2.id,
    },
    {
      id: 'seed-item-7',
      name: 'Mango Juice',
      description: 'Fresh mango pulp juice',
      price: 70,
      categoryId: bevCat.id,
      kitchenId: k2.id,
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        restaurantId: restaurant.id,
      },
    });
  }
  console.log(`✅ Menu items: ${menuItems.length} items`);

  // Create 3 tables
  const tables = [
    { id: 'seed-table-1', tableNumber: 'T1', totalSeats: 4 },
    { id: 'seed-table-2', tableNumber: 'T2', totalSeats: 6 },
    { id: 'seed-table-3', tableNumber: 'T3', totalSeats: 2 },
  ];

  for (const table of tables) {
    await prisma.table.upsert({
      where: { id: table.id },
      update: {},
      create: {
        ...table,
        restaurantId: restaurant.id,
        qrToken: `qr-${table.tableNumber}-${randomUUID().slice(0, 8)}`,
      },
    });
  }
  console.log(`✅ Tables: ${tables.length} tables`);

  // Create staff accounts
  const staffMembers = [
    {
      id: 'seed-staff-admin',
      name: 'Restaurant Admin',
      role: StaffRole.ADMIN,
      pin: '1234',
      kitchenId: null,
    },
    {
      id: 'seed-staff-kitchen1',
      name: 'Kitchen Staff K1',
      role: StaffRole.KITCHEN,
      pin: '1111',
      kitchenId: k1.id,
    },
    {
      id: 'seed-staff-kitchen2',
      name: 'Kitchen Staff K2',
      role: StaffRole.KITCHEN,
      pin: '2222',
      kitchenId: k2.id,
    },
    {
      id: 'seed-staff-waiter',
      name: 'Waiter 1',
      role: StaffRole.WAITER,
      pin: '3333',
      kitchenId: null,
    },
    {
      id: 'seed-staff-cashier',
      name: 'Cashier 1',
      role: StaffRole.CASHIER,
      pin: '4444',
      kitchenId: null,
    },
  ];

  for (const staff of staffMembers) {
    const hashedPin = await bcrypt.hash(staff.pin, 10);
    await prisma.staff.upsert({
      where: { id: staff.id },
      update: {},
      create: {
        ...staff,
        pin: hashedPin,
        restaurantId: restaurant.id,
      },
    });
  }
  console.log(`✅ Staff: ${staffMembers.length} accounts`);

  console.log('\n🎉 Seed complete!');
  console.log('   Staff PINs: Admin=1234 | K1=1111 | K2=2222 | Waiter=3333 | Cashier=4444');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
