/**
 * promote-admin.ts - grant or revoke the admin role on an account.
 *
 *   pnpm tsx scripts/promote-admin.ts <email>            # make admin
 *   pnpm tsx scripts/promote-admin.ts <email> --role user
 *
 * The account must already exist: sign up through the app first, then run this.
 * There is deliberately no way to create an admin without a real signed-up
 * account, so every admin has a password the app itself set.
 *
 * This previously opened `./data/evo.db` with better-sqlite3, left over from
 * before the Postgres move, so it silently did nothing on a real database.
 */
import "./_env";
import postgres from "postgres";

const VALID_ROLES = ["user", "premium", "creator", "admin"] as const;
type RoleName = (typeof VALID_ROLES)[number];

async function main() {
  const email = process.argv[2];
  const roleFlag = process.argv.indexOf("--role");
  const role = (roleFlag === -1 ? "admin" : process.argv[roleFlag + 1]) as RoleName;

  if (!email || email.startsWith("--")) {
    console.error("usage: pnpm tsx scripts/promote-admin.ts <email> [--role user|premium|creator|admin]");
    process.exit(1);
  }
  if (!VALID_ROLES.includes(role)) {
    console.error(`role must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    console.error("[promote-admin] No database URL in the environment");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql`
      update "user" set role = ${role} where email = ${email}
      returning id, email, role`;

    if (rows.length === 0) {
      console.error(`[promote-admin] no account with email ${email}`);
      console.error("[promote-admin] sign up through the app first, then re-run");
      process.exitCode = 1;
      return;
    }
    console.log(`[promote-admin] ${rows[0]!.email} -> role=${rows[0]!.role}`);
  } finally {
    // postgres-js keeps the event loop alive; without this the script hangs.
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[promote-admin] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
