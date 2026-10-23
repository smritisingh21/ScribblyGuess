-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255),
    "passwordHash" VARCHAR(255),
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "roomCode" VARCHAR(10) NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'WAITING',
    "maxPlayers" SMALLINT NOT NULL DEFAULT 8,
    "totalRounds" SMALLINT NOT NULL DEFAULT 3,
    "roundDuration" SMALLINT NOT NULL DEFAULT 80,
    "hostId" UUID,
    "winnerId" UUID,
    "startedAt" TIMESTAMPTZ,
    "endedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_players" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rank" SMALLINT,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ,

    CONSTRAINT "game_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "roundNumber" SMALLINT NOT NULL,
    "drawerId" UUID NOT NULL,
    "secretWord" VARCHAR(100) NOT NULL,
    "hint" VARCHAR(100),
    "durationSeconds" SMALLINT NOT NULL DEFAULT 80,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guesses" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "guessText" VARCHAR(255) NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_totalScore_idx" ON "users"("totalScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "games_roomCode_key" ON "games"("roomCode");

-- CreateIndex
CREATE INDEX "games_status_idx" ON "games"("status");

-- CreateIndex
CREATE INDEX "games_createdAt_idx" ON "games"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "game_players_gameId_idx" ON "game_players"("gameId");

-- CreateIndex
CREATE INDEX "game_players_userId_idx" ON "game_players"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_gameId_userId_key" ON "game_players"("gameId", "userId");

-- CreateIndex
CREATE INDEX "rounds_gameId_idx" ON "rounds"("gameId");

-- CreateIndex
CREATE INDEX "rounds_drawerId_idx" ON "rounds"("drawerId");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_gameId_roundNumber_key" ON "rounds"("gameId", "roundNumber");

-- CreateIndex
CREATE INDEX "guesses_roundId_idx" ON "guesses"("roundId");

-- CreateIndex
CREATE INDEX "guesses_userId_idx" ON "guesses"("userId");

-- CreateIndex
CREATE INDEX "guesses_roundId_isCorrect_idx" ON "guesses"("roundId", "isCorrect");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_drawerId_fkey" FOREIGN KEY ("drawerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
