import type { PrismaClient } from "@prisma/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "./database-client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let productionClient: PrismaClient | undefined;
const requestClients = new WeakMap<object, PrismaClient>();

function workerContext() {
  try {
    return getCloudflareContext();
  } catch {
    return undefined;
  }
}

export function getPrisma(): PrismaClient {
  const context = workerContext();
  if (context) {
    let client = requestClients.get(context.ctx);
    if (!client) {
      const env = context.env as {
        DATABASE_URL?: string;
        HYPERDRIVE?: { connectionString: string };
      };
      client = createDatabaseClient(
        env.HYPERDRIVE?.connectionString ||
          env.DATABASE_URL ||
          process.env.DATABASE_URL,
        true,
      );
      requestClients.set(context.ctx, client);
    }
    return client;
  }
  if (process.env.NODE_ENV === "production")
    return (productionClient ??= createDatabaseClient());
  return (globalForPrisma.prisma ??= createDatabaseClient());
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
