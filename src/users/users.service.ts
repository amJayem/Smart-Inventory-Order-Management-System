import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: { id: true, name: true, email: true, role: true, isDemo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateRole(id: string, role: Role, changedByUserId?: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { name: true, role: true },
    });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, isDemo: true, createdAt: true },
    });

    await this.activityService.log({
      action: 'USER_ROLE_CHANGED',
      description: `Role for "${target?.name}" changed: ${target?.role} → ${role}`,
      userId: changedByUserId,
    });

    return updated;
  }
}
