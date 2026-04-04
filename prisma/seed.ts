import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('demo1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'demo@admin.com' },
    update: {},
    create: {
      name: 'Demo Admin',
      email: 'demo@admin.com',
      password: hashedPassword,
      role: 'ADMIN',
      isDemo: true,
    },
  });
  console.log('✓ Demo admin created:', admin.email);

  const electronics = await prisma.category.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: { name: 'Electronics', description: 'Electronic devices and accessories' },
  });
  const clothing = await prisma.category.upsert({
    where: { name: 'Clothing' },
    update: {},
    create: { name: 'Clothing', description: 'Apparel and fashion items' },
  });
  const grocery = await prisma.category.upsert({
    where: { name: 'Grocery' },
    update: {},
    create: { name: 'Grocery', description: 'Food and daily essentials' },
  });
  console.log('✓ Categories created');

  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      { name: 'iPhone 13', categoryId: electronics.id, price: 799.99, stock: 3, minStockThreshold: 5, status: 'ACTIVE' },
      { name: 'Wireless Headphones', categoryId: electronics.id, price: 149.99, stock: 15, minStockThreshold: 5, status: 'ACTIVE' },
      { name: 'T-Shirt', categoryId: clothing.id, price: 19.99, stock: 20, minStockThreshold: 10, status: 'ACTIVE' },
      { name: 'Running Shoes', categoryId: clothing.id, price: 89.99, stock: 0, minStockThreshold: 5, status: 'OUT_OF_STOCK' },
      { name: 'Organic Coffee', categoryId: grocery.id, price: 12.99, stock: 50, minStockThreshold: 20, status: 'ACTIVE' },
    ],
  });
  console.log('✓ Products created');

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
