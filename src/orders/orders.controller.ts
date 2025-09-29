import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Post('orders')
  async create(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.userId, dto);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Get('orders')
  async listMine(@Request() req: any) {
    return this.orders.listForUser(req.user.userId);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Get('orders/:id')
  async getMine(@Request() req: any, @Param('id') id: string) {
    return this.orders.getForUser(req.user.userId, id);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Delete('orders/:id')
  async cancelMine(@Request() req: any, @Param('id') id: string) {
    return this.orders.cancelByUser(req.user.userId, id);
  }

  @Roles(Role.ADMIN)
  @Get('admin/orders/:id')
  async getById(@Param('id') id: string) {
    return this.orders.getById(id);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/orders/:id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.orders.updateStatusAdmin(id, dto.status);
  }
}
