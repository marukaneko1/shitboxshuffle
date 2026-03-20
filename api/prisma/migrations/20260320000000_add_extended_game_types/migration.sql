-- GameType values existed in schema.prisma but were never migrated; production DB only had
-- types added through earlier migrations — creating BLACKJACK / word games / etc. failed at INSERT.

ALTER TYPE "GameType" ADD VALUE 'BLACKJACK';
ALTER TYPE "GameType" ADD VALUE 'WORDLE';
ALTER TYPE "GameType" ADD VALUE 'SPELLING_BEE';
ALTER TYPE "GameType" ADD VALUE 'LETTER_BOXED';
ALTER TYPE "GameType" ADD VALUE 'BANANAGRAMS';
ALTER TYPE "GameType" ADD VALUE 'SCRABBLE_GAME';
ALTER TYPE "GameType" ADD VALUE 'BOGGLE';
ALTER TYPE "GameType" ADD VALUE 'HANGMAN';
ALTER TYPE "GameType" ADD VALUE 'SCATTERGORIES';
ALTER TYPE "GameType" ADD VALUE 'GHOST';
ALTER TYPE "GameType" ADD VALUE 'JOTTO';
ALTER TYPE "GameType" ADD VALUE 'MONOPOLY';
ALTER TYPE "GameType" ADD VALUE 'BS';
ALTER TYPE "GameType" ADD VALUE 'SPIN_THE_WHEEL';
