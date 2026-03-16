import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
  return new PrismaClient({ adapter });
}

// In dev, always create a fresh client to avoid stale HMR-cached instances
// that don't include newly-generated Prisma models.
if (process.env.NODE_ENV !== "production") {
  delete (globalForPrisma as { prisma?: PrismaClient }).prisma;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
