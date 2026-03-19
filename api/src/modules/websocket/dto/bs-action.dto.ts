import { IsString, IsArray, IsIn, ArrayMinSize, ArrayMaxSize, IsNumber } from 'class-validator';

export class BsPlayCardsDto {
  @IsString()
  gameId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsNumber({}, { each: true })
  cardIndices!: number[];
}

export class BsCallDto {
  @IsString()
  gameId!: string;

  @IsString()
  @IsIn(['callBS', 'pass'])
  action!: 'callBS' | 'pass';
}

export class BsEndGameDto {
  @IsString()
  gameId!: string;
}
