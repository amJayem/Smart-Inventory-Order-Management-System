import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityAction } from '@prisma/client';

interface LogParams {
  action: ActivityAction;
  description: string;
  userId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async log(params: LogParams) {
    return this.prisma.activityLog.create({
      data: {
        action: params.action,
        description: params.description,
        userId: params.userId,
        metadata: params.metadata,
      },
    });
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.activityLog.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getRecent(limit = 10) {
    return this.prisma.activityLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }
}
