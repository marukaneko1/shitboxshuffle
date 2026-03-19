import { IsString, IsNumber, IsBoolean, IsArray, Min } from 'class-validator';

export class MonopolyGameDto {
  @IsString()
  gameId!: string;
}

export class MonopolyBidDto {
  @IsString()
  gameId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;
}

export class MonopolyPropertyDto {
  @IsString()
  gameId!: string;

  @IsNumber()
  @Min(0)
  propertyIndex!: number;
}

export class MonopolyTradeOfferDto {
  @IsString()
  gameId!: string;

  @IsArray()
  offeredProperties!: number[];

  @IsArray()
  requestedProperties!: number[];

  @IsNumber()
  @Min(0)
  offeredCash!: number;

  @IsNumber()
  @Min(0)
  requestedCash!: number;
}

export class MonopolyTradeResponseDto {
  @IsString()
  gameId!: string;

  @IsBoolean()
  accept!: boolean;
}
