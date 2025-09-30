import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      return await this.prisma.product.update({ where: { id }, data: dto });
    } catch (e) {
      throw new NotFoundException('Product not found');
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.product.delete({ where: { id } });
      return { success: true };
    } catch (e) {
      throw new NotFoundException('Product not found');
    }
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async search(query: QueryProductsDto) {
    // Base filters
    const baseWhere: any = { isActive: true };
    if (query.categoryId) baseWhere.categoryId = query.categoryId;

    const { skip, take, orderBy, page, limit } = (await import('../common/utils/pagination.util')).buildPagination(
      query,
      ['createdAt', 'name', 'priceCents', 'stock'],
      { field: 'createdAt', order: 'desc' },
    );

    //use full-text search to use the GIN index
    if (query.search && query.search.trim().length > 0) {
      const conditions: any[] = [
        Prisma.sql`p."isActive" = true`,
        Prisma.sql`to_tsvector('english', p."name" || ' ' || coalesce(p."description", '')) @@ plainto_tsquery('english', ${
          query.search
        })`,
      ];
      if (query.categoryId) conditions.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);

      // @ts-ignore
        const whereSql = Prisma.sql`${Prisma.join(conditions, Prisma.raw(' AND '))}`;

      const items = await this.prisma.$queryRaw<any[]>`
        SELECT p.*,
               ts_rank(
                 to_tsvector('english', p."name" || ' ' || coalesce(p."description", '')),
                 plainto_tsquery('english', ${query.search})
               ) AS rank
        FROM "Product" p
        WHERE ${whereSql}
        ORDER BY rank DESC, p."createdAt" DESC
        LIMIT ${take} OFFSET ${skip}
      `;

      const totalRows = await this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM "Product" p
        WHERE ${whereSql}
      `;
      const total = totalRows[0]?.count ?? 0;

      return { items, total, skip, take, page, limit };
    }

    // Fallback to simple filtering when there's no search term
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where: baseWhere, skip, take, orderBy }),
      this.prisma.product.count({ where: baseWhere }),
    ]);

    return { items, total, skip, take, page, limit };
  }

  async recommendForUser(userId: string, take = 10) {
    const userProductIds = new Set(
      (
        await this.prisma.orderItem.findMany({
          where: { order: { userId } },
          select: { productId: true },
        })
      ).map((i) => i.productId),
    );

    if (userProductIds.size === 0) {
      const popular = await this.prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take,
      });
      const products = await this.prisma.product.findMany({ where: { id: { in: popular.map((p) => p.productId) } } });
      const scoreMap = new Map(popular.map((p) => [p.productId, (p._sum.quantity || 0) as number]));
      return products
        .map((p) => ({ product: p, confidence: scoreMap.get(p.id) || 0 }))
        .sort((a, b) => b.confidence - a.confidence);
    }

    const candidates = await this.prisma.orderItem.findMany({
      where: { productId: { in: [...userProductIds] } },
      select: { orderId: true, productId: true, order: { select: { userId: true } } },
    });

    const overlapCountByUser = new Map<string, number>();
    const productsByUser = new Map<string, Set<string>>();

    for (const row of candidates) {
      const uid = row.order.userId;
      if (uid === userId) continue;
      if (!productsByUser.has(uid)) productsByUser.set(uid, new Set());
      productsByUser.get(uid)!.add(row.productId);
    }

    for (const [uid, prods] of productsByUser.entries()) {
      let overlap = 0;
      for (const pid of prods) if (userProductIds.has(pid)) overlap++;
      if (overlap >= 2) overlapCountByUser.set(uid, overlap);
    }

    const similarUserIds = [...overlapCountByUser.keys()];
    if (similarUserIds.length === 0) return [];

    const similarUsersItems = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { userId: { in: similarUserIds } }, NOT: { productId: { in: [...userProductIds] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take,
    });

    if (similarUsersItems.length === 0) return [];

    const products = await this.prisma.product.findMany({ where: { id: { in: similarUsersItems.map((p) => p.productId) } } });
    const countByProduct = new Map(similarUsersItems.map((p) => [p.productId, (p._sum.quantity || 0) as number]));

    const confidenceDenominator = Math.max(similarUserIds.length, 1);
    const result = products.map((p) => ({
      product: p,
      confidence: (countByProduct.get(p.id) || 0) / confidenceDenominator,
    }));

    return result.sort((a, b) => b.confidence - a.confidence);
  }
}
