-- CreateTable
CREATE TABLE "skill_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "curriculum" JSONB,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "totalDays" INTEGER NOT NULL DEFAULT 30,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "lastActiveAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_challenges" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'practice',
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "hints" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submission" TEXT,
    "feedback" TEXT,
    "score" INTEGER,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "skill_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_goals_userId_idx" ON "skill_goals"("userId");

-- CreateIndex
CREATE INDEX "skill_challenges_goalId_idx" ON "skill_challenges"("goalId");

-- CreateIndex
CREATE INDEX "skill_challenges_userId_idx" ON "skill_challenges"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_challenges_goalId_day_key" ON "skill_challenges"("goalId", "day");

-- AddForeignKey
ALTER TABLE "skill_goals" ADD CONSTRAINT "skill_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_challenges" ADD CONSTRAINT "skill_challenges_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "skill_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
