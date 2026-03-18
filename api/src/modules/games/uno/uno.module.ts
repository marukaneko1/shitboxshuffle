import { Module } from '@nestjs/common';
import { UnoService } from './uno.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UnoService],
  exports: [UnoService],
})
export class UnoModule {}
