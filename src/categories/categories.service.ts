import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
  ) {}

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto, userId?: string) {
    const exists = await this.prisma.category.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Category name already exists');

    const category = await this.prisma.category.create({
      data: dto,
      include: { _count: { select: { products: true } } },
    });

    await this.activityService.log({
      action: 'CATEGORY_CREATED',
      description: `Category "${category.name}" created`,
      userId,
    });

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, userId?: string) {
    const existing = await this.findOne(id);

    if (dto.name) {
      const conflict = await this.prisma.category.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Category name already exists');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: dto,
      include: { _count: { select: { products: true } } },
    });

    await this.activityService.log({
      action: 'CATEGORY_UPDATED',
      description: `Category "${existing.name}" updated`,
      userId,
    });

    return updated;
  }

  async remove(id: string, userId?: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (category._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.products} product(s) assigned to it`,
      );
    }

    await this.prisma.category.delete({ where: { id } });

    await this.activityService.log({
      action: 'CATEGORY_DELETED',
      description: `Category "${category.name}" deleted`,
      userId,
    });

    return { message: 'Category deleted successfully' };
  }
}
