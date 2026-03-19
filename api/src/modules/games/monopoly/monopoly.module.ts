import { Module } from '@nestjs/common';
import { MonopolyService } from './monopoly.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MonopolyService],
  exports: [MonopolyService],
})
export class MonopolyModule {}
