import { Module } from "@nestjs/common";
import { GeoGuesserService } from "./geoguesser.service";
import { PrismaModule } from "../../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [GeoGuesserService],
  exports: [GeoGuesserService],
})
export class GeoGuesserModule {}
