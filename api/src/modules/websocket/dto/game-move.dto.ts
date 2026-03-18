import { IsString, IsNumber, IsOptional, Min, Max, IsIn } from "class-validator";
import { PieceType } from "../../games/chess/chess.types";

export class GameMoveDto {
  @IsString()
  gameId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(8)
  cellIndex?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  colIndex?: number;

  @IsOptional()
  from?: { row: number; col: number };

  @IsOptional()
  to?: { row: number; col: number };

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(35)
  cardIndex?: number;

  @IsOptional()
  @IsIn(['Q', 'R', 'B', 'N'])
  promotionPiece?: PieceType;

  @IsOptional()
  @IsIn(['play', 'draw'])
  unoMoveType?: 'play' | 'draw';

  @IsOptional()
  @IsNumber()
  @Min(0)
  unoCardId?: number;

  @IsOptional()
  @IsIn(['R', 'G', 'B', 'Y'])
  unoChosenColor?: string;
}








