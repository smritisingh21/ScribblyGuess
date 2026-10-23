import { GameStatus } from '@prisma/client';

// ==========================================
// User DTOs
// ==========================================

export interface CreateUserData {
  username: string;
  email?: string | null;
  passwordHash?: string | null;
  isGuest?: boolean;
}

export interface UserProfileDTO {
  id: string;
  username: string;
  email: string | null;
  isGuest: boolean;
  totalScore: number;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: Date;
}

export interface LeaderboardEntryDTO {
  id: string;
  username: string;
  totalScore: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number; // percentage (0 - 100)
}

// ==========================================
// Game & Match DTOs
// ==========================================

export interface CreateGameData {
  roomCode: string;
  hostId?: string | null;
  maxPlayers?: number;
  totalRounds?: number;
  roundDuration?: number;
}

export interface SanitizedRoundDTO {
  id: string;
  roundNumber: number;
  drawerId: string;
  secretWord: string | null; // Masked / null if round is still active or sanitized
  wordLength: number;
  hint: string | null;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date | null;
}

export interface SanitizedGameDTO {
  id: string;
  roomCode: string;
  status: GameStatus;
  maxPlayers: number;
  totalRounds: number;
  roundDuration: number;
  hostId: string | null;
  winnerId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  players: {
    id: string;
    userId: string;
    username: string;
    score: number;
    rank: number | null;
    isHost: boolean;
  }[];
  rounds: SanitizedRoundDTO[];
}

// ==========================================
// Match Persistence Transaction Payload
// ==========================================

export interface FinalizedPlayerResult {
  userId: string;
  score: number;
  rank: number;
  isHost?: boolean;
}

export interface FinalizedGuessResult {
  userId: string;
  guessText: string;
  isCorrect: boolean;
  pointsAwarded: number;
  createdAt: Date;
}

export interface FinalizedRoundResult {
  roundNumber: number;
  drawerId: string;
  secretWord: string;
  hint?: string | null;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
  guesses: FinalizedGuessResult[];
}

export interface FinalizedMatchPayload {
  gameId: string;
  winnerId: string | null;
  startedAt: Date;
  endedAt: Date;
  players: FinalizedPlayerResult[];
  rounds: FinalizedRoundResult[];
}
