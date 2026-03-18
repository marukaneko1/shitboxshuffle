import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { IsEnum, IsString, IsOptional, IsNotEmpty } from "class-validator";
import { ReportReason } from "@prisma/client";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../../types/auth";

class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  reportedUserId!: string;

  @IsEnum(ReportReason)
  reason!: ReportReason;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  roomId?: string;
}

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async createReport(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReportDto
  ) {
    return this.reportsService.createReport(
      user.sub,
      dto.reportedUserId,
      dto.reason,
      dto.comment,
      dto.sessionId,
      dto.roomId
    );
  }
}
