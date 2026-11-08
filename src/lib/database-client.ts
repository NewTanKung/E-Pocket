import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createDatabaseClient(
  connectionString = process.env.DATABASE_URL,
  requestScoped = false,
): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const adapter = new PrismaPg({
    connectionString,
    max: requestScoped ? 2 : 5,
    // A Workers socket must never be reused by a later request.
    ...(requestScoped ? { maxUses: 1 } : {}),
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  return new PrismaClient({ adapter });
}
