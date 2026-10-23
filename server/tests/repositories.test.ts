import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../src/repositories/UserRepository.js';
import { GameRepository } from '../src/repositories/GameRepository.js';
import { MatchPersistenceService } from '../src/services/MatchPersistenceService.js';
import { GameStatus } from '@prisma/client';

describe('UserRepository', () => {
  let mockPrisma: any;
  let userRepo: UserRepository;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    userRepo = new UserRepository(mockPrisma);
  });

  it('creates a guest user with unique generated username', async () => {
    mockPrisma.user.create.mockImplementation((args: any) => ({
      id: 'mock-uuid',
      username: args.data.username,
      isGuest: true,
      totalScore: 0,
      gamesPlayed: 0,
      gamesWon: 0,
    }));

    const guest = await userRepo.createGuest('Doodler');
    expect(guest.username).toMatch(/^Doodler_\d{4}$/);
    expect(guest.isGuest).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledOnce();
  });

  it('calculates winRate correctly on leaderboard query', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        username: 'alice',
        totalScore: 350,
        gamesPlayed: 5,
        gamesWon: 3,
      },
      {
        id: 'u2',
        username: 'bob',
        totalScore: 100,
        gamesPlayed: 2,
        gamesWon: 0,
      },
    ]);

    const leaderboard = await userRepo.getLeaderboard(5);
    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].winRate).toBe(60); // 3 / 5 * 100 = 60%
    expect(leaderboard[1].winRate).toBe(0);
  });
});

describe('GameRepository', () => {
  let mockPrisma: any;
  let gameRepo: GameRepository;

  beforeEach(() => {
    mockPrisma = {
      game: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      gamePlayer: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
    };
    gameRepo = new GameRepository(mockPrisma);
  });

  it('sanitizes secret words for active games (Requirement 7)', async () => {
    mockPrisma.game.findUnique.mockResolvedValue({
      id: 'g-1',
      roomCode: 'TEST12',
      status: GameStatus.IN_PROGRESS,
      maxPlayers: 8,
      totalRounds: 3,
      roundDuration: 80,
      hostId: 'u-1',
      winnerId: null,
      startedAt: new Date(),
      endedAt: null,
      createdAt: new Date(),
      players: [],
      rounds: [
        {
          id: 'r-1',
          roundNumber: 1,
          drawerId: 'u-1',
          secretWord: 'elephant',
          hint: 'Large animal',
          durationSeconds: 80,
          startedAt: new Date(),
          endedAt: null, // Still active!
        },
      ],
    });

    const game = await gameRepo.findByRoomCode('TEST12', true);
    expect(game).not.toBeNull();
    // Secret word MUST be masked/null for active rounds
    expect(game!.rounds[0].secretWord).toBeNull();
    expect(game!.rounds[0].wordLength).toBe(8);
  });

  it('reveals secret words when game is COMPLETED and round is ended', async () => {
    mockPrisma.game.findUnique.mockResolvedValue({
      id: 'g-1',
      roomCode: 'DONE01',
      status: GameStatus.COMPLETED,
      maxPlayers: 8,
      totalRounds: 1,
      roundDuration: 80,
      hostId: 'u-1',
      winnerId: 'u-1',
      startedAt: new Date(),
      endedAt: new Date(),
      createdAt: new Date(),
      players: [],
      rounds: [
        {
          id: 'r-1',
          roundNumber: 1,
          drawerId: 'u-1',
          secretWord: 'guitar',
          hint: 'Instrument',
          durationSeconds: 80,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ],
    });

    const game = await gameRepo.findByRoomCode('DONE01', true);
    expect(game!.rounds[0].secretWord).toBe('guitar');
  });
});

describe('MatchPersistenceService', () => {
  let mockPrisma: any;
  let mockTx: any;
  let persistenceService: MatchPersistenceService;

  beforeEach(() => {
    mockTx = {
      game: { update: vi.fn() },
      gamePlayer: { upsert: vi.fn() },
      user: { update: vi.fn() },
      round: {
        create: vi.fn().mockResolvedValue({ id: 'persisted-round-id' }),
      },
      guess: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };

    mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    persistenceService = new MatchPersistenceService(mockPrisma);
  });

  it('persists match atomically with player scores and round history', async () => {
    const payload = {
      gameId: 'game-123',
      winnerId: 'user-winner',
      startedAt: new Date(),
      endedAt: new Date(),
      players: [
        { userId: 'user-winner', score: 250, rank: 1, isHost: true },
        { userId: 'user-loser', score: 100, rank: 2, isHost: false },
      ],
      rounds: [
        {
          roundNumber: 1,
          drawerId: 'user-winner',
          secretWord: 'castle',
          hint: 'Fortress',
          durationSeconds: 80,
          startedAt: new Date(),
          endedAt: new Date(),
          guesses: [
            {
              userId: 'user-loser',
              guessText: 'house',
              isCorrect: false,
              pointsAwarded: 0,
              createdAt: new Date(),
            },
            {
              userId: 'user-loser',
              guessText: 'castle',
              isCorrect: true,
              pointsAwarded: 70,
              createdAt: new Date(),
            },
          ],
        },
      ],
    };

    const result = await persistenceService.persistCompletedMatch(payload);

    expect(result.success).toBe(true);
    expect(result.savedPlayersCount).toBe(2);
    expect(result.savedRoundsCount).toBe(1);
    expect(result.savedGuessesCount).toBe(2);

    // Verify transaction executed
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockTx.game.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'game-123' },
        data: expect.objectContaining({
          status: GameStatus.COMPLETED,
          winnerId: 'user-winner',
        }),
      })
    );
    expect(mockTx.round.create).toHaveBeenCalledOnce();
    expect(mockTx.guess.createMany).toHaveBeenCalledOnce();
    // 2 players updated
    expect(mockTx.user.update).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid payload without required fields', async () => {
    const invalidPayload: any = {
      gameId: '',
      players: [],
      rounds: [],
    };

    await expect(persistenceService.persistCompletedMatch(invalidPayload)).rejects.toThrow();
  });
});
