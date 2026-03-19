import { Module } from '@nestjs/common';
import { BsService } from './bs.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BsService],
  exports: [BsService],
})
export class BsModule {}
