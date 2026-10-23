import { Game, GamePlayer, GameStatus, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/prisma.js';
import { CreateGameData, SanitizedGameDTO, SanitizedRoundDTO } from '../types/index.js';

export class GameRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Create a new game room session
   */
  async createGame(data: CreateGameData): Promise<Game> {
    return this.prisma.game.create({
      data: {
        roomCode: data.roomCode.toUpperCase().trim(),
        hostId: data.hostId || null,
        maxPlayers: data.maxPlayers ?? 8,
        totalRounds: data.totalRounds ?? 3,
        roundDuration: data.roundDuration ?? 80,
        status: GameStatus.WAITING,
      },
    });
  }

  /**
   * Find game by room code with word sanitization guard (Requirement 7)
   */
  async findByRoomCode(
    roomCode: string,
    sanitizeSecretWords = true
  ): Promise<SanitizedGameDTO | null> {
    const game = await this.prisma.game.findUnique({
      where: { roomCode: roomCode.toUpperCase().trim() },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: { score: 'desc' },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!game) return null;

    return this.mapToSanitizedGame(game, sanitizeSecretWords);
  }

  /**
   * Find game by ID with word sanitization guard (Requirement 7)
   */
  async findById(
    gameId: string,
    sanitizeSecretWords = true
  ): Promise<SanitizedGameDTO | null> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: { score: 'desc' },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!game) return null;

    return this.mapToSanitizedGame(game, sanitizeSecretWords);
  }

  /**
   * Add a player to a game session (or update if already present)
   */
  async addPlayerToGame(
    gameId: string,
    userId: string,
    isHost = false
  ): Promise<GamePlayer> {
    return this.prisma.gamePlayer.upsert({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
      update: {
        isHost,
        leftAt: null, // Reset if rejoining
      },
      create: {
        gameId,
        userId,
        isHost,
        score: 0,
      },
    });
  }

  /**
   * Update game status (e.g., WAITING -> IN_PROGRESS -> COMPLETED)
   */
  async updateStatus(
    gameId: string,
    status: GameStatus,
    extraData?: { startedAt?: Date; endedAt?: Date; winnerId?: string }
  ): Promise<Game> {
    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        status,
        ...extraData,
      },
    });
  }

  /**
   * Get past completed games for a user
   */
  async getPlayerMatchHistory(userId: string, limit = 10) {
    const playerParticipations = await this.prisma.gamePlayer.findMany({
      where: {
        userId,
        game: {
          status: GameStatus.COMPLETED,
        },
      },
      take: limit,
      orderBy: {
        game: {
          endedAt: 'desc',
        },
      },
      include: {
        game: {
          include: {
            winner: {
              select: { id: true, username: true },
            },
            players: {
              include: {
                user: { select: { id: true, username: true } },
              },
              orderBy: { rank: 'asc' },
            },
          },
        },
      },
    });

    return playerParticipations.map((gp) => ({
      gameId: gp.game.id,
      roomCode: gp.game.roomCode,
      startedAt: gp.game.startedAt,
      endedAt: gp.game.endedAt,
      playerScore: gp.score,
      playerRank: gp.rank,
      isWinner: gp.game.winnerId === userId,
      winner: gp.game.winner?.username ?? null,
      totalPlayers: gp.game.players.length,
      leaderboard: gp.game.players.map((p) => ({
        userId: p.userId,
        username: p.user.username,
        score: p.score,
        rank: p.rank,
      })),
    }));
  }

  /**
   * Transform game model to SanitizedGameDTO, scrubbing secret words if requested or if round is not ended
   */
  private mapToSanitizedGame(
    game: any,
    sanitizeSecretWords: boolean
  ): SanitizedGameDTO {
    const sanitizedRounds: SanitizedRoundDTO[] = (game.rounds || []).map(
      (round: any) => {
        const isRoundCompleted = round.endedAt !== null;
        // Never expose secret word if round is still active or sanitize is requested
        const hideWord = sanitizeSecretWords && (!isRoundCompleted || game.status !== GameStatus.COMPLETED);

        return {
          id: round.id,
          roundNumber: round.roundNumber,
          drawerId: round.drawerId,
          secretWord: hideWord ? null : round.secretWord,
          wordLength: round.secretWord.length,
          hint: round.hint,
          durationSeconds: round.durationSeconds,
          startedAt: round.startedAt,
          endedAt: round.endedAt,
        };
      }
    );

    return {
      id: game.id,
      roomCode: game.roomCode,
      status: game.status,
      maxPlayers: game.maxPlayers,
      totalRounds: game.totalRounds,
      roundDuration: game.roundDuration,
      hostId: game.hostId,
      winnerId: game.winnerId,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      createdAt: game.createdAt,
      players: (game.players || []).map((p: any) => ({
        id: p.id,
        userId: p.userId,
        username: p.user?.username ?? 'Unknown',
        score: p.score,
        rank: p.rank,
        isHost: p.isHost,
      })),
      rounds: sanitizedRounds,
    };
  }
}
