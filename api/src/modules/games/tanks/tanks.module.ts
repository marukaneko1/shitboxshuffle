import { Module } from '@nestjs/common';
import { TanksService } from './tanks.service';

@Module({
  providers: [TanksService],
  exports: [TanksService],
})
export class TanksModule {}
