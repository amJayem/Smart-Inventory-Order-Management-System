import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { CreateProductDto, UpdateProductDto, RestockProductDto } from './dto/product.dto';
import { ProductStatus, RestockPriority } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async findAll(page = 1, limit = 10, search?: string, categoryId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (categoryId) where.categoryId = categoryId;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto, userId?: string) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');

    const status: ProductStatus = dto.stock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
    const product = await this.prisma.product.create({
      data: { ...dto, status },
      include: { category: { select: { id: true, name: true } } },
    });

    await this.checkAndUpdateRestockQueue(product.id, product.stock, product.minStockThreshold);
    await this.activityService.log({
      action: 'PRODUCT_ADDED',
      description: `Product "${product.name}" added to ${category.name} — stock: ${product.stock}`,
      userId,
    });

    return product;
  }

  async update(id: string, dto: UpdateProductDto, userId?: string) {
    await this.findOne(id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Category not found');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: { select: { id: true, name: true } } },
    });

    await this.checkAndUpdateRestockQueue(updated.id, updated.stock, updated.minStockThreshold);
    await this.activityService.log({
      action: 'PRODUCT_UPDATED',
      description: `Product "${updated.name}" updated`,
      userId,
    });

    return updated;
  }

  async remove(id: string, userId?: string) {
    const product = await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });

    await this.activityService.log({
      action: 'PRODUCT_DELETED',
      description: `Product "${product.name}" deleted`,
      userId,
    });

    return { message: 'Product deleted successfully' };
  }

  async restock(id: string, dto: RestockProductDto, userId?: string) {
    const product = await this.findOne(id);
    if (product.status === 'OUT_OF_STOCK' && dto.quantity === 0)
      throw new BadRequestException('Quantity must be at least 1');

    const newStock = product.stock + dto.quantity;
    const newStatus: ProductStatus = newStock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK';

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock, status: newStatus },
      include: { category: { select: { id: true, name: true } } },
    });

    await this.checkAndUpdateRestockQueue(updated.id, updated.stock, updated.minStockThreshold);
    await this.activityService.log({
      action: 'STOCK_UPDATED',
      description: `Stock updated for "${product.name}": ${product.stock} → ${newStock}`,
      userId,
    });

    return updated;
  }

  async checkAndUpdateRestockQueue(productId: string, stock: number, threshold: number) {
    if (stock < threshold) {
      const priority = this.getPriority(stock);
      await this.prisma.restockQueue.upsert({
        where: { productId },
        update: { priority },
        create: { productId, priority },
      });
    } else {
      await this.prisma.restockQueue.deleteMany({ where: { productId } });
    }
  }

  private getPriority(stock: number): RestockPriority {
    if (stock < 5) return 'HIGH';
    if (stock < 20) return 'MEDIUM';
    return 'LOW';
  }
}
