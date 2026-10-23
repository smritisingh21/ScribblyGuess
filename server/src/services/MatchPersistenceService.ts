import { Game, GameStatus, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/prisma.js';
import { FinalizedMatchPayload } from '../types/index.js';

export interface FinalizeMatchResult {
  success: boolean;
  gameId: string;
  winnerId: string | null;
  savedPlayersCount: number;
  savedRoundsCount: number;
  savedGuessesCount: number;
}

export class MatchPersistenceService {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Persist a finalized multiplayer match in an atomic database transaction.
   * Satisfies Requirement 6: Atomic database transaction for match results and player scores.
   */
  async persistCompletedMatch(payload: FinalizedMatchPayload): Promise<FinalizeMatchResult> {
    this.validatePayload(payload);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Update Game to COMPLETED status
        await tx.game.update({
          where: { id: payload.gameId },
          data: {
            status: GameStatus.COMPLETED,
            winnerId: payload.winnerId,
            startedAt: payload.startedAt,
            endedAt: payload.endedAt,
          },
        });

        // 2. Persist GamePlayer final standings and update User lifetime statistics
        let playersProcessed = 0;
        for (const player of payload.players) {
          // Upsert GamePlayer record
          await tx.gamePlayer.upsert({
            where: {
              gameId_userId: {
                gameId: payload.gameId,
                userId: player.userId,
              },
            },
            update: {
              score: player.score,
              rank: player.rank,
              leftAt: payload.endedAt,
            },
            create: {
              gameId: payload.gameId,
              userId: player.userId,
              score: player.score,
              rank: player.rank,
              isHost: player.isHost ?? false,
              leftAt: payload.endedAt,
            },
          });

          // Atomically update durable user scores and match counts
          const isWinner = payload.winnerId !== null && player.userId === payload.winnerId;
          await tx.user.update({
            where: { id: player.userId },
            data: {
              totalScore: { increment: Math.max(0, player.score) },
              gamesPlayed: { increment: 1 },
              gamesWon: isWinner ? { increment: 1 } : undefined,
            },
          });

          playersProcessed++;
        }

        // 3. Batch persist Rounds and nested Guesses
        let roundsProcessed = 0;
        let guessesProcessed = 0;

        for (const round of payload.rounds) {
          const createdRound = await tx.round.create({
            data: {
              gameId: payload.gameId,
              roundNumber: round.roundNumber,
              drawerId: round.drawerId,
              secretWord: round.secretWord,
              hint: round.hint || null,
              durationSeconds: round.durationSeconds,
              startedAt: round.startedAt,
              endedAt: round.endedAt,
            },
          });

          roundsProcessed++;

          if (round.guesses && round.guesses.length > 0) {
            const guessBatch = round.guesses.map((g) => ({
              roundId: createdRound.id,
              userId: g.userId,
              guessText: g.guessText,
              isCorrect: g.isCorrect,
              pointsAwarded: g.pointsAwarded,
              createdAt: g.createdAt,
            }));

            const createdGuesses = await tx.guess.createMany({
              data: guessBatch,
            });

            guessesProcessed += createdGuesses.count;
          }
        }

        return {
          success: true,
          gameId: payload.gameId,
          winnerId: payload.winnerId,
          savedPlayersCount: playersProcessed,
          savedRoundsCount: roundsProcessed,
          savedGuessesCount: guessesProcessed,
        };
      });

      return result;
    } catch (error) {
      console.error(`[MatchPersistenceService] Failed to persist match for game ${payload.gameId}:`, error);
      throw new Error(`Match persistence failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate that payload data structure conforms to required constraints
   */
  private validatePayload(payload: FinalizedMatchPayload): void {
    if (!payload.gameId) {
      throw new Error('Invalid match payload: gameId is required');
    }
    if (!payload.players || payload.players.length === 0) {
      throw new Error('Invalid match payload: at least one player is required');
    }
    if (!payload.rounds || payload.rounds.length === 0) {
      throw new Error('Invalid match payload: at least one round is required');
    }
  }
}
