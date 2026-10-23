import { PrismaClient, GameStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Word repository for Scribbly game rounds
export const WORD_BANK = [
  // Easy
  'apple', 'banana', 'cat', 'dog', 'sun', 'tree', 'car', 'house', 'fish', 'star',
  'book', 'door', 'ball', 'hat', 'cup', 'clock', 'bed', 'shoe', 'boat', 'bird',
  // Medium
  'elephant', 'guitar', 'airplane', 'pizza', 'bicycle', 'camera', 'castle',
  'dinosaur', 'firefighter', 'helicopter', 'lighthouse', 'mountain', 'octopus',
  'penguin', 'rainbow', 'sandwich', 'telescope', 'umbrella', 'volcano', 'windmill',
  // Hard
  'astronaut', 'chameleon', 'constellation', 'labyrinth', 'microscope',
  'rollercoaster', 'scarecrow', 'submariner', 'time machine', 'treasure map'
];

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Users
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  const users = [
    {
      username: 'alice',
      email: 'alice@scribbly.test',
      passwordHash: defaultPasswordHash,
      isGuest: false,
      totalScore: 350,
      gamesPlayed: 5,
      gamesWon: 3,
    },
    {
      username: 'bob',
      email: 'bob@scribbly.test',
      passwordHash: defaultPasswordHash,
      isGuest: false,
      totalScore: 280,
      gamesPlayed: 4,
      gamesWon: 1,
    },
    {
      username: 'charlie',
      email: 'charlie@scribbly.test',
      passwordHash: defaultPasswordHash,
      isGuest: false,
      totalScore: 190,
      gamesPlayed: 3,
      gamesWon: 0,
    },
    {
      username: 'guest_sketcher',
      email: null,
      passwordHash: null,
      isGuest: true,
      totalScore: 120,
      gamesPlayed: 2,
      gamesWon: 1,
    },
  ];

  const createdUsers: Record<string, any> = {};

  for (const user of users) {
    const record = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        totalScore: user.totalScore,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
      },
      create: user,
    });
    createdUsers[user.username] = record;
    console.log(`  ✓ User created/updated: ${record.username} (${record.id})`);
  }

  // 2. Seed a completed sample game with players, rounds, and guesses
  const sampleRoomCode = 'SCRBL1';

  // Check if sample game already exists
  const existingGame = await prisma.game.findUnique({
    where: { roomCode: sampleRoomCode },
  });

  if (!existingGame) {
    console.log(`  🎮 Creating sample completed match (Room: ${sampleRoomCode})...`);

    const alice = createdUsers['alice'];
    const bob = createdUsers['bob'];
    const charlie = createdUsers['charlie'];

    const game = await prisma.game.create({
      data: {
        roomCode: sampleRoomCode,
        status: GameStatus.COMPLETED,
        maxPlayers: 8,
        totalRounds: 2,
        roundDuration: 80,
        hostId: alice.id,
        winnerId: alice.id,
        startedAt: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
        endedAt: new Date(Date.now() - 1000 * 60 * 5),   // 5 mins ago
      },
    });

    // Create GamePlayers
    await prisma.gamePlayer.createMany({
      data: [
        {
          gameId: game.id,
          userId: alice.id,
          score: 180,
          rank: 1,
          isHost: true,
        },
        {
          gameId: game.id,
          userId: bob.id,
          score: 120,
          rank: 2,
          isHost: false,
        },
        {
          gameId: game.id,
          userId: charlie.id,
          score: 75,
          rank: 3,
          isHost: false,
        },
      ],
    });

    // Create Round 1: Alice draws "elephant"
    const round1 = await prisma.round.create({
      data: {
        gameId: game.id,
        roundNumber: 1,
        drawerId: alice.id,
        secretWord: 'elephant',
        hint: 'Animal with a trunk',
        durationSeconds: 80,
        startedAt: new Date(Date.now() - 1000 * 60 * 14),
        endedAt: new Date(Date.now() - 1000 * 60 * 12),
      },
    });

    // Round 1 guesses
    await prisma.guess.createMany({
      data: [
        {
          roundId: round1.id,
          userId: bob.id,
          guessText: 'rhino',
          isCorrect: false,
          pointsAwarded: 0,
        },
        {
          roundId: round1.id,
          userId: bob.id,
          guessText: 'elephant',
          isCorrect: true,
          pointsAwarded: 60,
        },
        {
          roundId: round1.id,
          userId: charlie.id,
          guessText: 'elephant',
          isCorrect: true,
          pointsAwarded: 45,
        },
      ],
    });

    // Create Round 2: Bob draws "guitar"
    const round2 = await prisma.round.create({
      data: {
        gameId: game.id,
        roundNumber: 2,
        drawerId: bob.id,
        secretWord: 'guitar',
        hint: 'String musical instrument',
        durationSeconds: 80,
        startedAt: new Date(Date.now() - 1000 * 60 * 10),
        endedAt: new Date(Date.now() - 1000 * 60 * 8),
      },
    });

    // Round 2 guesses
    await prisma.guess.createMany({
      data: [
        {
          roundId: round2.id,
          userId: alice.id,
          guessText: 'violin',
          isCorrect: false,
          pointsAwarded: 0,
        },
        {
          roundId: round2.id,
          userId: alice.id,
          guessText: 'guitar',
          isCorrect: true,
          pointsAwarded: 80,
        },
        {
          roundId: round2.id,
          userId: charlie.id,
          guessText: 'guitar',
          isCorrect: true,
          pointsAwarded: 30,
        },
      ],
    });

    console.log(`  ✓ Sample game, players, rounds, and guesses seeded successfully.`);
  } else {
    console.log(`  ✓ Sample game (${sampleRoomCode}) already exists. Skipping game seed.`);
  }

  console.log(`  ✓ Total words available in WORD_BANK: ${WORD_BANK.length}`);
  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
