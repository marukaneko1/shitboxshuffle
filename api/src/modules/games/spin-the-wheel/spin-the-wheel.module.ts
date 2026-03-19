import { Module } from '@nestjs/common';
import { SpinTheWheelService } from './spin-the-wheel.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SpinTheWheelService],
  exports: [SpinTheWheelService],
})
export class SpinTheWheelModule {}
