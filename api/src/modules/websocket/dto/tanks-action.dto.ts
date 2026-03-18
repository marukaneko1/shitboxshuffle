import { IsString, IsNumber, IsBoolean, IsObject, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class TankKeys {
  @IsBoolean()
  w!: boolean;

  @IsBoolean()
  a!: boolean;

  @IsBoolean()
  s!: boolean;

  @IsBoolean()
  d!: boolean;
}

export class TanksInputDto {
  @IsString()
  gameId!: string;

  @ValidateNested()
  @Type(() => TankKeys)
  keys!: TankKeys;

  @IsNumber()
  turretAngle!: number;

  @IsBoolean()
  shooting!: boolean;
}
