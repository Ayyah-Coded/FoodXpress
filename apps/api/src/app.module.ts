import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { RestaurantsModule } from './restaurant/restaurants.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { GatewayModule } from './gateway/gateway.module';
import { DriverModule } from './driver/driver.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
    RestaurantsModule,
    MenuModule,
    OrdersModule,
    PaymentsModule,
    GatewayModule,
    DriverModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
