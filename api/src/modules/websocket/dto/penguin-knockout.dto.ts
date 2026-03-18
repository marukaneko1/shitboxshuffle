import { IsString, IsIn, IsNumber, Min, Max } from "class-validator";

export class PenguinMoveDto {
  @IsString()
  gameId!: string;

  @IsString()
  @IsIn(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'STAY'])
  direction!: string;

  @IsNumber()
  @Min(1)
  @Max(3)
  power!: number;
}
