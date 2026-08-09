import { Module } from '@nestjs/common';
import { OrdersGateway } from './orders.gateway';
import { LocationModule } from '../location/location.module';
import { AuthModule } from '../auth/auth.module';


@Module({
  imports: [LocationModule, AuthModule],
  providers: [OrdersGateway],
  exports: [OrdersGateway],
})

export class GatewayModule {}