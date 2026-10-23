import { PrismaClient, User } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/prisma.js';
import { CreateUserData, LeaderboardEntryDTO, UserProfileDTO } from '../types/index.js';

export class UserRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by unique username
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Create a standard registered user
   */
  async createUser(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        username: data.username.trim(),
        email: data.email?.trim() || null,
        passwordHash: data.passwordHash || null,
        isGuest: data.isGuest ?? false,
      },
    });
  }

  /**
   * Create an ephemeral guest user profile
   */
  async createGuest(preferredName?: string): Promise<User> {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const guestUsername = preferredName
      ? `${preferredName.trim()}_${randomSuffix}`
      : `Guest_${randomSuffix}`;

    return this.prisma.user.create({
      data: {
        username: guestUsername,
        isGuest: true,
      },
    });
  }

  /**
   * Get public user profile without sensitive fields
   */
  async getProfile(userId: string): Promise<UserProfileDTO | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        isGuest: true,
        totalScore: true,
        gamesPlayed: true,
        gamesWon: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Fetch top players ordered by total score descending
   */
  async getLeaderboard(limit = 10): Promise<LeaderboardEntryDTO[]> {
    const topUsers = await this.prisma.user.findMany({
      where: {
        isGuest: false, // Only rank registered players
      },
      orderBy: {
        totalScore: 'desc',
      },
      take: limit,
      select: {
        id: true,
        username: true,
        totalScore: true,
        gamesPlayed: true,
        gamesWon: true,
      },
    });

    return topUsers.map((user) => ({
      ...user,
      winRate:
        user.gamesPlayed > 0
          ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
          : 0,
    }));
  }

  /**
   * Update user cumulative match stats
   */
  async updateUserStats(
    userId: string,
    data: { scoreDelta: number; won: boolean }
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        totalScore: { increment: data.scoreDelta },
        gamesPlayed: { increment: 1 },
        gamesWon: data.won ? { increment: 1 } : undefined,
      },
    });
  }
}
