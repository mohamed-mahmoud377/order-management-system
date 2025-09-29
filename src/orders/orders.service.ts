import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private computeItemTotal(unitPriceCents: number, taxRatePct: number, quantity: number) {
    const taxPerUnit = Math.round((unitPriceCents * taxRatePct) / 100);
    const totalPerUnit = unitPriceCents + taxPerUnit;
    return totalPerUnit * quantity;
  }

  async create(userId: string, dto: CreateOrderDto) {
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
      if (product.stock < item.quantity) throw new BadRequestException(`Insufficient stock for product ${product.name}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        const res = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (res.count !== 1) {
          throw new BadRequestException(`Insufficient stock for product ${product.name}`);
        }
      }

      const order = await tx.order.create({ data: { userId, status: OrderStatus.PENDING, totalCents: 0 } });

      let totalCents = 0;
      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        const lineTotal = this.computeItemTotal(product.priceCents, product.taxRatePct, item.quantity);
        totalCents += lineTotal;
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: item.quantity,
            unitPriceCents: product.priceCents,
            taxRatePct: product.taxRatePct,
          },
        });
      }

      const updated = await tx.order.update({ where: { id: order.id }, data: { totalCents } });
      return updated;
    });
  }

  async listForUser(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async getForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();
    return order;
  }

  async getById(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true, user: true } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatusAdmin(orderId: string, status: OrderStatus) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!existing) throw new NotFoundException('Order not found');

    if (status === OrderStatus.CANCELLED) {
      if (existing.status !== OrderStatus.PENDING) {
        throw new BadRequestException('Only pending orders can be cancelled');
      }
      await this.restoreStock(existing.id);
    }

    return this.prisma.order.update({ where: { id: orderId }, data: { status } });
  }

  async cancelByUser(userId: string, orderId: string) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!existing) throw new NotFoundException('Order not found');
    if (existing.userId !== userId) throw new ForbiddenException();
    if (existing.status !== OrderStatus.PENDING) throw new BadRequestException('Only pending orders can be cancelled');

    await this.restoreStock(existing.id);
    return this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
  }

  private async restoreStock(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
    });
  }
}
