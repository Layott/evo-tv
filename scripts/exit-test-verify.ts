import "./_env";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { desc, eq } from "drizzle-orm";
import * as schema from "../db/schema";

const sqlite = new Database(process.env.DATABASE_URL ?? "./data/evo.db");
const db = drizzle(sqlite, { schema });

console.log("--- recent VODs (top 3) ---");
db.select().from(schema.vods).orderBy(desc(schema.vods.publishedAt)).limit(3).all().forEach((v) =>
  console.log(`  ${v.id}  stream=${v.streamId}  title=${v.title}  hls=${v.hlsPath}  dur=${v.durationSec}  pub=${v.publishedAt}`)
);

console.log("\n--- viewer-exit sub ---");
const u = db.select().from(schema.user).where(eq(schema.user.email, "viewer-exit@evotv.local")).get();
console.log(`  user: ${u?.id} role=${u?.role}`);
if (u) {
  const subs = db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, u.id)).all();
  console.log(`  subs count: ${subs.length}`);
  subs.forEach((s) => console.log(`    ${s.id} status=${s.status} tier=${s.tier} provider=${s.provider} ref=${s.providerSubId}`));
}

console.log("\n--- new stream event row ---");
const s = db.select().from(schema.streams).where(eq(schema.streams.id, "stream_83da7dc3b42d0988")).get();
console.log(`  ${s?.id}  isLive=${s?.isLive}  started=${s?.startedAt}  ended=${s?.endedAt}  hls=${s?.hlsPath}`);

console.log("\n--- audit_log recent ---");
db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(5).all().forEach((a) =>
  console.log(`  ${a.createdAt}  ${a.action}  ${a.targetType}:${a.targetId}`)
);

sqlite.close();
