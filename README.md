# Scribbly 🎨

A Scribbl.io-style real-time multiplayer drawing and guessing game built with PostgreSQL, Prisma ORM, Node.js + Express, Socket.IO, and React.

---

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Real-Time Communication**: Socket.IO
- **Database**: PostgreSQL (relational persistence for accounts, games, rounds, and scores)
- **ORM & Migrations**: Prisma ORM

---

## Database Architecture & Models

The relational schema models the full lifecycle of multiplayer matches:
- `User`: Accounts, guest profiles, lifetime scores, and match statistics.
- `Game`: Game sessions, room codes, settings (rounds, durations), and match status.
- `GamePlayer`: Join records linking users to specific games with final scores and rankings.
- `Round`: Individual drawing turns, secret words (revealed only upon round completion), and drawer assignments.
- `Guess`: Guess logs for scoring, accuracy tracking, and historical review.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher
- **PostgreSQL**: v14 or higher running locally or remotely

### 2. Configure Environment Variables
Copy the template `.env.example` in `server/` to `.env`:

```bash
cd server
cp .env.example .env
```

Update your `DATABASE_URL` in `server/.env` with your PostgreSQL credentials:
```env
DATABASE_URL="postgresql://<USER>:<PASSWORD>@localhost:5432/scribbly?schema=public"
```

### 3. Create the Database
Ensure PostgreSQL is running and create the `scribbly` database:

```bash
# Using PostgreSQL CLI
createdb scribbly

# Or via psql:
psql -U postgres -c "CREATE DATABASE scribbly;"
```

### 4. Run Prisma Migrations
Generate Prisma Client and apply the database migrations:

```bash
cd server
npm run db:migrate
# or: npx prisma migrate dev --name init_postgres_schema
```

To deploy migrations directly without prompt:
```bash
npx prisma migrate deploy
```

### 5. Seed Development Data
Populate the database with sample users (`alice`, `bob`, `charlie`, `guest_sketcher`), a sample completed match with rounds and guesses, and the drawing word bank:

```bash
cd server
npm run db:seed
```

### 6. Inspect the Database (Prisma Studio)
To visually browse and test database records in a browser GUI:

```bash
cd server
npm run db:studio
```

---

## Running the Application

### Development Server
Start the Express server with live reload:
```bash
cd server
npm run dev
```

Build and run production server:
```bash
cd server
npm run build
npm start
```