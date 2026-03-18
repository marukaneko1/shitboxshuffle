import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { IsNumber, IsNotEmpty, Min, Max } from "class-validator";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../../types/auth";

class UpdateLocationDto {
  // SECURITY: Validate latitude is within valid range (-90 to 90)
  @IsNumber()
  @IsNotEmpty()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude!: number;

  // SECURITY: Validate longitude is within valid range (-180 to 180)
  @IsNumber()
  @IsNotEmpty()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude!: number;
}

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/stats")
  async myStats(@CurrentUser() user: JwtPayload) {
    return this.usersService.getUserStats(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me/location")
  async updateLocation(@CurrentUser() user: JwtPayload, @Body() dto: UpdateLocationDto) {
    return this.usersService.updateLocation(user.sub, dto.latitude, dto.longitude);
  }
}


