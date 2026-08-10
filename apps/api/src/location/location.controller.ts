import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocationService } from './location.service';
import { Request as ExpressRequest } from 'express';
import { JwtPayload } from '@food-xpress/types';

type AuthRequest = ExpressRequest & { user: JwtPayload };

@Controller('location')
@UseGuards(JwtAuthGuard)
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Get(':orderId')
  getDriverLocation(@Param('orderId') orderId: string, @Request() req: AuthRequest) {
    return this.locationService.getAuthorizedDriverLocation(orderId, req.user);
  }
}