import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RestockService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.restockQueue.findMany({
        skip,
        take: limit,
        orderBy: [
          { priority: 'asc' },
          { addedAt: 'asc' },
        ],
        include: {
          product: {
            include: { category: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.restockQueue.count(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string) {
    await this.prisma.restockQueue.delete({ where: { id } });
    return { message: 'Removed from restock queue' };
  }
}
