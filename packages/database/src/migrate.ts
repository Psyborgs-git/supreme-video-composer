import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb } from "./client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../drizzle");

migrate(getDb(), { migrationsFolder });
console.log("[database] migrations applied");
