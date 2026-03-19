import { IsString, IsNumber, IsOptional, IsIn, Min, Max } from "class-validator";

export class BlackjackActionDto {
  @IsString()
  gameId!: string;

  @IsString()
  @IsIn(['hit', 'stand', 'bet', 'double'])
  action!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000000)
  amount?: number;
}

export class BlackjackNewHandDto {
  @IsString()
  gameId!: string;
}
