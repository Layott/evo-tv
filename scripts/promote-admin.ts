/** Usage: pnpm tsx scripts/promote-admin.ts <email> */
import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

const email = process.argv[2];
if (!email) {
  console.error("usage: tsx scripts/promote-admin.ts <email>");
  process.exit(1);
}

const sqlite = new Database(process.env.DATABASE_URL ?? "./data/evo.db");
const db = drizzle(sqlite, { schema });

const rows = db.update(schema.user)
  .set({ role: "admin", updatedAt: new Date() })
  .where(eq(schema.user.email, email))
  .run();

console.log(`[promote-admin] ${email} → role=admin (changes: ${rows.changes})`);
sqlite.close();
