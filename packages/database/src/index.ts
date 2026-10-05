import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as typeof globalThis & {
  wishStudioPrisma?: PrismaClient;
};

export const prisma =
  prismaGlobal.wishStudioPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.wishStudioPrisma = prisma;
}