import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CreateOrderDto, UpdateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { OrderStatus } from '@prisma/client';

const LOCKED_STATUSES: OrderStatus[] = ['SHIPPED', 'DELIVERED'];

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async findAll(page = 1, limit = 10, status?: OrderStatus, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (search) where.customerName = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where, skip, take: limit,
        include: {
          items: { include: { product: { select: { id: true, name: true, price: true } } } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true, price: true, status: true } } } },
        user: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(dto: CreateOrderDto, userId: string) {
    const productIds = dto.items.map((i) => i.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length)
      throw new BadRequestException('Duplicate products in order are not allowed');

    let totalPrice = 0;
    const validatedItems: { productId: string; quantity: number; unitPrice: number }[] = [];

    for (const item of dto.items) {
      const product = await this.productsService.findOne(item.productId);
      if (product.status === 'OUT_OF_STOCK')
        throw new BadRequestException(`"${product.name}" is currently unavailable`);
      if (product.stock < item.quantity)
        throw new BadRequestException(`Only ${product.stock} item(s) available for "${product.name}"`);

      validatedItems.push({ productId: item.productId, quantity: item.quantity, unitPrice: Number(product.price) });
      totalPrice += Number(product.price) * item.quantity;
    }

    const orderNumber = `ORD-${Date.now()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerName: dto.customerName,
          notes: dto.notes,
          totalPrice,
          userId,
          items: { create: validatedItems },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, price: true } } } },
          user: { select: { id: true, name: true } },
        },
      });

      for (const item of validatedItems) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        const newStatus = product.stock <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
        await tx.product.update({ where: { id: item.productId }, data: { status: newStatus } });
        await this.productsService.checkAndUpdateRestockQueue(item.productId, product.stock, product.minStockThreshold);
      }

      return created;
    });

    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    const order = await this.findOne(id);
    if (LOCKED_STATUSES.includes(order.status))
      throw new ForbiddenException(`Order cannot be edited once it is ${order.status}`);
    if (order.status === 'CANCELLED')
      throw new ForbiddenException('Cancelled orders cannot be edited');

    if (!dto.items) {
      return this.prisma.order.update({
        where: { id },
        data: { customerName: dto.customerName, notes: dto.notes },
        include: { items: { include: { product: { select: { id: true, name: true, price: true } } } } },
      });
    }

    const productIds = dto.items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length)
      throw new BadRequestException('Duplicate products in order are not allowed');

    let totalPrice = 0;
    const validatedItems: { productId: string; quantity: number; unitPrice: number }[] = [];

    for (const item of dto.items) {
      const product = await this.productsService.findOne(item.productId);
      if (product.status === 'OUT_OF_STOCK')
        throw new BadRequestException(`"${product.name}" is currently unavailable`);

      const existingItem = order.items.find((i) => i.productId === item.productId);
      const stockDiff = item.quantity - (existingItem?.quantity || 0);
      if (product.stock < stockDiff)
        throw new BadRequestException(`Only ${product.stock} item(s) available for "${product.name}"`);

      validatedItems.push({ productId: item.productId, quantity: item.quantity, unitPrice: Number(product.price) });
      totalPrice += Number(product.price) * item.quantity;
    }

    return this.prisma.$transaction(async (tx) => {
      for (const old of order.items) {
        await tx.product.update({ where: { id: old.productId }, data: { stock: { increment: old.quantity } } });
      }
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      for (const item of validatedItems) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        const newStatus = product.stock <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
        await tx.product.update({ where: { id: item.productId }, data: { status: newStatus } });
        await this.productsService.checkAndUpdateRestockQueue(item.productId, product.stock, product.minStockThreshold);
      }

      return tx.order.update({
        where: { id },
        data: {
          customerName: dto.customerName,
          notes: dto.notes,
          totalPrice,
          items: { create: validatedItems },
        },
        include: { items: { include: { product: { select: { id: true, name: true, price: true } } } } },
      });
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);
    if (LOCKED_STATUSES.includes(order.status))
      throw new ForbiddenException(`Order status cannot be changed once it is ${order.status}`);

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
    });
  }

  async cancel(id: string) {
    const order = await this.findOne(id);
    if (LOCKED_STATUSES.includes(order.status))
      throw new ForbiddenException(`Cannot cancel an order that is already ${order.status}`);
    if (order.status === 'CANCELLED')
      throw new BadRequestException('Order is already cancelled');

    return this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, status: 'ACTIVE' },
        });
        await this.productsService.checkAndUpdateRestockQueue(item.productId, product.stock, product.minStockThreshold);
      }
      return tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { items: { include: { product: { select: { id: true, name: true } } } } },
      });
    });
  }
}
