import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtPayload, UserRole } from '@food-xpress/types';
import { CreateOrderDto } from './dto/create-order.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Request as ExpressRequest } from 'express';
import { OrdersService } from './orders.service';


type AuthRequest = ExpressRequest & { user: JwtPayload };

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  create(@Request() req: AuthRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.sub, dto);
  }

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.DRIVER)
  findMine(
    @Request() req: AuthRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ordersService.findMyOrders(
      req.user.sub,
      req.user.role,
      this.parsePagination(limit),
      this.parsePagination(offset),
    );
  }

  @Get('restaurant')
  @UseGuards(RolesGuard)
  @Roles(UserRole.RESTAURANT_OWNER)
  findByRestaurant(
    @Request() req: AuthRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ordersService.findByRestaurant(
      req.user.sub,
      this.parsePagination(limit),
      this.parsePagination(offset),
    );
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.DRIVER)
  updateStatus(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    // pass the logged-in user so the service can enforce role-based access
    return this.ordersService.findById(id, req.user);
  };

  private parsePagination(value?: string) {
    if (!value) return undefined;

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new BadRequestException(
        'Pagination values must be non-negative integers',
      );
    }
    return parsed;
  };
};