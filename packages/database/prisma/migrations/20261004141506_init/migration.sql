-- CreateEnum
CREATE TYPE "Occasion" AS ENUM ('BIRTHDAY', 'ANNIVERSARY', 'RETIREMENT', 'GRADUATION');

-- CreateTable
CREATE TABLE "Wish" (
    "id" TEXT NOT NULL,
    "occasion" "Occasion" NOT NULL,
    "recipients" TEXT[],
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wish_pkey" PRIMARY KEY ("id")
);
