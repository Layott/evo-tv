import "./_env";
import postgres from "postgres";

/**
 * Remove the accounts that were created to test the platform, not to use it.
 *
 * One of them, `claude-test-admin@evo.tv`, is an **admin** with a password
 * nobody has, sitting in production since May. The rest are `@evotv.local`
 * addresses at a domain that cannot receive mail, so nobody can be behind
 * them.
 *
 * Run it inside the api container, where DATABASE_URL already is what it needs
 * to be and no credential has to be copied anywhere:
 *
 *   docker compose run --rm --no-deps api-1 pnpm tsx scripts/delete-test-accounts.ts
 *   docker compose run --rm --no-deps api-1 pnpm tsx scripts/delete-test-accounts.ts --apply
 *
 * Without `--apply` it only reports. With it, everything happens in one
 * transaction: if any child row cannot be removed the whole thing rolls back
 * and prints the constraint that stopped it, rather than leaving an account
 * half-deleted.
 *
 * Matching is deliberately narrow. A pattern like `%test%` would also match a
 * real signup called `testimony@`, so the rule is: the exact admin address, or
 * the `@evotv.local` domain, which is reserved and unroutable.
 */

const EXACT_EMAILS = ["claude-test-admin@evo.tv"];
const DOMAIN_SUFFIX = "@evotv.local";

const DATABASE_URL =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  console.error("[accounts] no DB URL in the environment");
  process.exit(1);
}

const apply = process.argv.includes("--apply");

// prepare: false, because DATABASE_URL points at the transaction pooler in
// production and named prepared statements do not survive it.
const sql = postgres(DATABASE_URL, { max: 1, prepare: false });

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  created_at: unknown;
}

/**
 * Every table with a foreign key pointing at `user`, and the column that
 * points. Read from the catalog rather than the schema files so a table added
 * after this was written is still cleaned up instead of blocking the delete.
 */
async function referencingTables(): Promise<Array<{ table: string; column: string; onDelete: string }>> {
  const rows = await sql<Array<{ table: string; column: string; confdeltype: string }>>`
    select
      src.relname            as table,
      att.attname            as column,
      c.confdeltype::text    as confdeltype
    from pg_constraint c
    join pg_class src        on src.oid = c.conrelid
    join pg_class tgt        on tgt.oid = c.confrelid
    join unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute att    on att.attrelid = c.conrelid and att.attnum = k.attnum
    where c.contype = 'f'
      and tgt.relname = 'user'
      and src.relname <> 'user'
    order by src.relname
  `;
  const meaning: Record<string, string> = {
    a: "no action",
    r: "restrict",
    c: "cascade",
    n: "set null",
    d: "set default",
  };
  return rows.map((r) => ({
    table: r.table,
    column: r.column,
    onDelete: meaning[r.confdeltype] ?? r.confdeltype,
  }));
}

(async () => {
  const users = await sql<UserRow[]>`
    select id, email, name, role, created_at
    from "user"
    where email = any(${EXACT_EMAILS}) or email like ${"%" + DOMAIN_SUFFIX}
    order by created_at
  `;

  if (users.length === 0) {
    console.log("[accounts] nothing matches. Already clean.");
    return;
  }

  console.log(`[accounts] ${users.length} account(s) match:`);
  for (const u of users) {
    console.log(`  ${u.email}  role=${u.role ?? "user"}  id=${u.id}  created=${String(u.created_at)}`);
  }

  const refs = await referencingTables();
  const ids = users.map((u) => u.id);

  console.log(`[accounts] ${refs.length} table(s) reference "user":`);
  for (const ref of refs) {
    const [{ n }] = await sql<Array<{ n: number }>>`
      select count(*)::int as n
      from ${sql(ref.table)}
      where ${sql(ref.column)} = any(${ids})
    `;
    if (n > 0) {
      console.log(`  ${ref.table}.${ref.column}  ${n} row(s)  on delete ${ref.onDelete}`);
    }
  }

  if (!apply) {
    console.log("[accounts] dry run. Re-run with --apply to delete.");
    return;
  }

  await sql.begin(async (tx) => {
    // Children first. A cascade would handle its own, but deleting explicitly
    // means the count printed above is the count actually removed, and a
    // restrict constraint fails here rather than at the end.
    for (const ref of refs) {
      const removed = await tx`
        delete from ${tx(ref.table)} where ${tx(ref.column)} = any(${ids})
      `;
      if (removed.count > 0) {
        console.log(`[accounts] ${ref.table}: ${removed.count} row(s) removed`);
      }
    }
    const removed = await tx`delete from "user" where id = any(${ids})`;
    console.log(`[accounts] user: ${removed.count} row(s) removed`);
  });

  console.log("[accounts] done.");
})()
  .catch((err) => {
    console.error("[accounts] failed, nothing was deleted:", err);
    process.exitCode = 1;
  })
  // postgres-js keeps the socket open, so the process hangs without this.
  .finally(() => sql.end({ timeout: 5 }));
