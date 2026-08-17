/**
 * Lists the accounts in the LOCAL dev database and their roles.
 *
 * Read-only, and it refuses to run against anything that is not localhost, so
 * it cannot be pointed at the droplet by accident.
 */
import { config } from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!URL) {
  console.error("no database url in .env.local");
  process.exit(1);
}
if (!/@localhost[:/]/.test(URL)) {
  console.error("refusing to run: this is not a localhost database");
  process.exit(1);
}

const sql = postgres(URL, { max: 1 });

const users = await sql`
  select u.email, u.name, u.role, u.email_verified, p.display_name
  from "user" u
  left join profiles p on p.user_id = u.id
  order by
    case u.role
      when 'head_admin' then 0 when 'admin' then 1 when 'finance_admin' then 2
      when 'moderator' then 3 when 'support_admin' then 4 else 5 end,
    u.email
  limit 20
`;

console.table(
  users.map((u) => ({
    email: u.email,
    role: u.role,
    name: u.display_name ?? u.name,
    verified: u.email_verified,
  })),
);

await sql.end();
