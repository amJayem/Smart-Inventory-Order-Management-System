import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.seedDemoUser();
      await this.seedCategories();
      await this.seedProducts();
    } catch (err) {
      this.logger.error('Seeding failed', err);
    }
  }

  private async seedDemoUser() {
    const exists = await this.prisma.user.findUnique({
      where: { email: 'demo@admin.com' },
    });
    if (!exists) {
      const hashed = await bcrypt.hash('demo1234', 10);
      await this.prisma.user.create({
        data: {
          name: 'Demo Admin',
          email: 'demo@admin.com',
          password: hashed,
          role: 'ADMIN',
          isDemo: true,
        },
      });
      this.logger.log('✓ Demo admin created');
    }
  }

  private async seedCategories() {
    const categories = [
      { name: 'Electronics', description: 'Electronic devices and accessories' },
      { name: 'Clothing', description: 'Apparel and fashion items' },
      { name: 'Grocery', description: 'Food and daily essentials' },
    ];

    for (const cat of categories) {
      const exists = await this.prisma.category.findUnique({ where: { name: cat.name } });
      if (!exists) {
        await this.prisma.category.create({ data: cat });
      }
    }
    this.logger.log('✓ Categories ready');
  }

  private async seedProducts() {
    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true },
    });
    const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    const products = [
      { name: 'iPhone 13', cat: 'Electronics', price: 799.99, stock: 3, threshold: 5, status: 'ACTIVE' as const },
      { name: 'Wireless Headphones', cat: 'Electronics', price: 149.99, stock: 15, threshold: 5, status: 'ACTIVE' as const },
      { name: 'T-Shirt', cat: 'Clothing', price: 19.99, stock: 20, threshold: 10, status: 'ACTIVE' as const },
      { name: 'Running Shoes', cat: 'Clothing', price: 89.99, stock: 0, threshold: 5, status: 'OUT_OF_STOCK' as const },
      { name: 'Organic Coffee', cat: 'Grocery', price: 12.99, stock: 50, threshold: 20, status: 'ACTIVE' as const },
    ];

    for (const p of products) {
      const exists = await this.prisma.product.findFirst({ where: { name: p.name } });
      if (!exists && catMap[p.cat]) {
        await this.prisma.product.create({
          data: {
            name: p.name,
            categoryId: catMap[p.cat],
            price: p.price,
            stock: p.stock,
            minStockThreshold: p.threshold,
            status: p.status,
          },
        });
      }
    }
    this.logger.log('✓ Products ready');
  }
}
