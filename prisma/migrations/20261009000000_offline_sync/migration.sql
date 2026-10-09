-- AlterTable
ALTER TABLE "ExerciseAttempt" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAttempt_clientId_key" ON "ExerciseAttempt"("clientId");

