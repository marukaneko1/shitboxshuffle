import { Module } from '@nestjs/common';
import { BlackjackService } from './blackjack.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BlackjackService],
  exports: [BlackjackService],
})
export class BlackjackModule {}
