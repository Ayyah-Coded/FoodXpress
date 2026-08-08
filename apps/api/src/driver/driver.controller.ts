import { Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload, UserRole } from '@food-xpress/types';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Request as ExpressRequest } from 'express';
import { DriverService } from './driver.service';


type AuthRequest = ExpressRequest & { user: JwtPayload };

@Controller('driver')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverController {
  constructor(private driverService: DriverService) {}

  @Patch('online')
  toggleOnline(@Request() req: AuthRequest) {
    return this.driverService.toggleOnline(req.user.sub);
  }

  @Get('status')
  getStatus(@Request() req: AuthRequest) {
    return this.driverService.getStatus(req.user.sub);
  }

  @Post('orders/:id/decline')
  declineOrder(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.driverService.declineOrder(id, req.user.sub);
  }
};