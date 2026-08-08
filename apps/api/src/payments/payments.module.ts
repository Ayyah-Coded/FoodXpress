import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { GatewayModule } from '../gateway/gateway.module';
import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';


@Module({
  imports: [AuthModule, GatewayModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})

export class PaymentsModule {}