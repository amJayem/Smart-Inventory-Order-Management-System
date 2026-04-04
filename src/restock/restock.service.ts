import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class RestockService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.restockQueue.findMany({
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { addedAt: 'asc' }],
        include: {
          product: { include: { category: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.restockQueue.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string, userId?: string) {
    const item = await this.prisma.restockQueue.findUnique({
      where: { id },
      include: { product: { select: { name: true } } },
    });

    await this.prisma.restockQueue.delete({ where: { id } });

    if (item) {
      await this.activityService.log({
        action: 'RESTOCK_QUEUE_REMOVED',
        description: `"${item.product.name}" marked as restocked and removed from queue`,
        userId,
      });
    }

    return { message: 'Removed from restock queue' };
  }
}
