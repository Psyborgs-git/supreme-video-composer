import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    const url = process.env.DATABASE_URL ?? "./dev.db";
    const sqlite = new Database(url.replace(/^file:/, ""));
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
  },
});

export type DB = ReturnType<typeof getDb>;
