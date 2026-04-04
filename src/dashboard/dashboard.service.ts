import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalOrdersToday,
      pendingOrders,
      completedOrders,
      lowStockCount,
      revenueToday,
      totalProducts,
      totalCategories,
      recentActivity,
      lowStockProducts,
      ordersByStatus,
    ] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: { in: ['DELIVERED'] } } }),
      this.prisma.restockQueue.count(),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } },
        _sum: { totalPrice: true },
      }),
      this.prisma.product.count(),
      this.prisma.category.count(),
      this.prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.product.findMany({
        where: { restockQueue: { isNot: null } },
        include: {
          restockQueue: true,
          category: { select: { name: true } },
        },
        orderBy: { stock: 'asc' },
        take: 5,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    return {
      today: {
        orders: totalOrdersToday,
        revenue: revenueToday._sum.totalPrice || 0,
      },
      orders: {
        pending: pendingOrders,
        completed: completedOrders,
        byStatus: ordersByStatus.map((s) => ({
          status: s.status,
          count: s._count.status,
        })),
      },
      inventory: {
        totalProducts,
        totalCategories,
        lowStockCount,
      },
      recentActivity,
      lowStockProducts,
    };
  }

  async getRevenueChart() {
    const days = 7;
    const result: { date: string; revenue: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const revenue = await this.prisma.order.aggregate({
        where: {
          createdAt: { gte: date, lt: nextDate },
          status: { not: 'CANCELLED' },
        },
        _sum: { totalPrice: true },
      });

      result.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Number(revenue._sum.totalPrice || 0),
      });
    }

    return result;
  }
}
