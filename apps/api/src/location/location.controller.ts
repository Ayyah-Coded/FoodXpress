import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocationService } from './location.service';


@Controller('location')
@UseGuards(JwtAuthGuard)
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Get(':orderId')
  getDriverLocation(@Param('orderId') orderId: string) {
    return this.locationService.getDriverLocation(orderId);
  }
}