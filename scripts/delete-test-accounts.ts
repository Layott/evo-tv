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
 * transaction: if any row cannot be dealt with the whole thing rolls back and
 * prints what stopped it, rather than leaving an account half-deleted.
 *
 * Matching is deliberately narrow. A pattern like `%test%` would also match a
 * real signup called `testimony@`, so the rule is: the exact admin address, or
 * the `@evotv.local` domain, which is reserved and unroutable.
 *
 * ── What happens to rows that point at these accounts ────────────────────────
 *
 * Each foreign key already declares what should happen, and the script obeys
 * it rather than deleting everything it can reach:
 *
 *   cascade    delete the row. It exists only because the user does.
 *   set null   keep the row, null the reference. This is the schema saying the
 *              record outlives the account, which is the entire point of
 *              `audit_log`: the action stays, the actor becomes unknown.
 *   no action  a decision, not a default. If the column is nullable it is
 *              nulled; if it is NOT NULL the script stops and names it, since
 *              deleting a sanction issued BY the test admin would erase a
 *              moderation record about somebody else.
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

/**
 * One extra address, named on the command line.
 *
 * Verification on production needs an account: a password change cannot be
 * proved against the owner's own login, and the local database proves only
 * that the code can work. So a throwaway is made, used, and removed, and this
 * is the removing. The app's own delete button files a GDPR erasure request
 * that the weekly purge picks up, which is right for a person and too slow for
 * a test account made ten minutes ago.
 *
 * Exact match only, never a pattern. The whole point of the two constants
 * above is that `%test%` would also match somebody called `testimony@`.
 *
 *   pnpm tsx scripts/delete-test-accounts.ts --email qa@evotv.local --apply
 */
const emailFlag = process.argv.indexOf("--email");
const extraEmail = emailFlag === -1 ? null : process.argv[emailFlag + 1];
if (emailFlag !== -1 && !extraEmail?.includes("@")) {
  console.error("[accounts] --email wants an address");
  process.exit(1);
}
const targetEmails = extraEmail ? [...EXACT_EMAILS, extraEmail] : EXACT_EMAILS;

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

type Action = "delete" | "null" | "blocked";

interface Ref {
  schema: string;
  table: string;
  column: string;
  onDelete: string;
  notNull: boolean;
  action: Action;
}

/**
 * Every column pointing at `user`, with the behaviour its constraint declares.
 *
 * Schema-qualified on both sides, because this database has more than one: a
 * leftover Neon Auth schema carries its own `user`, `account`, `member` and
 * `invitation`. Matching on bare relname pulled those in, then counting them
 * unqualified resolved to the public table, which reported that
 * `account.userId` does not exist on a table whose column is `user_id`. Both
 * true, neither the same table.
 */
async function referencingColumns(): Promise<Ref[]> {
  const rows = await sql<
    Array<{
      schema: string;
      table: string;
      column: string;
      confdeltype: string;
      attnotnull: boolean;
    }>
  >`
    select
      nsp.nspname            as schema,
      src.relname            as table,
      att.attname            as column,
      c.confdeltype::text    as confdeltype,
      att.attnotnull         as attnotnull
    from pg_constraint c
    join pg_class src        on src.oid = c.conrelid
    join pg_namespace nsp    on nsp.oid = src.relnamespace
    join pg_class tgt        on tgt.oid = c.confrelid
    join pg_namespace tnsp   on tnsp.oid = tgt.relnamespace
    join unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute att    on att.attrelid = c.conrelid and att.attnum = k.attnum
    where c.contype = 'f'
      and tgt.relname = 'user'
      and tnsp.nspname = current_schema()
      and nsp.nspname = current_schema()
      and src.relname <> 'user'
    order by src.relname, att.attname
  `;

  const meaning: Record<string, string> = {
    a: "no action",
    r: "restrict",
    c: "cascade",
    n: "set null",
    d: "set default",
  };

  return rows.map((r) => {
    const onDelete = meaning[r.confdeltype] ?? r.confdeltype;
    let action: Action;
    if (onDelete === "cascade") action = "delete";
    else if (onDelete === "set null") action = "null";
    else action = r.attnotnull ? "blocked" : "null";
    return {
      schema: r.schema,
      table: r.table,
      column: r.column,
      onDelete,
      notNull: r.attnotnull,
      action,
    };
  });
}

(async () => {
  const users = await sql<UserRow[]>`
    select id, email, name, role, created_at
    from "user"
    where email = any(${targetEmails}) or email like ${"%" + DOMAIN_SUFFIX}
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

  const refs = await referencingColumns();
  const ids = users.map((u) => u.id);
  const withRows: Array<Ref & { n: number }> = [];

  for (const ref of refs) {
    // One unreadable table must not hide the other fifty. Report and carry on:
    // this loop only counts, so a failure here costs information, not safety.
    try {
      const [{ n }] = await sql<Array<{ n: number }>>`
        select count(*)::int as n
        from ${sql(ref.schema)}.${sql(ref.table)}
        where ${sql(ref.column)} = any(${ids})
      `;
      if (n > 0) withRows.push({ ...ref, n });
    } catch (err) {
      console.error(
        `  ${ref.table}.${ref.column}  COULD NOT COUNT: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  console.log(`[accounts] ${refs.length} column(s) reference "user"; ${withRows.length} hold rows:`);
  for (const ref of withRows) {
    const verb =
      ref.action === "delete"
        ? "delete"
        : ref.action === "null"
          ? "keep, null the reference"
          : "BLOCKED, NOT NULL";
    console.log(`  ${ref.table}.${ref.column}  ${ref.n} row(s)  [${ref.onDelete}] -> ${verb}`);
  }

  /*
   * The dry run does the real work and rolls it back.
   *
   * Reporting from counts alone was wrong in a way worth keeping a note about:
   * it flagged `user_sanctions.issued_by` as blocking, when that row is a
   * sanction ON one of the other test accounts, so the cascade on `user_id`
   * removes it long before `issued_by` matters. A count taken before anything
   * happens cannot see that. Doing the work and rolling back can.
   *
   * Deletes run before nulls, and the blocked check runs last, against what is
   * actually left.
   */
  const DRY_RUN = Symbol("dry run");

  try {
    await sql.begin(async (tx) => {
      for (const ref of withRows.filter((r) => r.action === "delete")) {
        const removed = await tx`
          delete from ${tx(ref.schema)}.${tx(ref.table)}
          where ${tx(ref.column)} = any(${ids})
        `;
        console.log(`[accounts] ${ref.table}: ${removed.count} row(s) removed`);
      }

      for (const ref of withRows.filter((r) => r.action !== "delete")) {
        const [{ n }] = await tx<Array<{ n: number }>>`
          select count(*)::int as n
          from ${tx(ref.schema)}.${tx(ref.table)}
          where ${tx(ref.column)} = any(${ids})
        `;
        if (n === 0) continue;

        if (ref.action === "blocked") {
          const rows = await tx`
            select * from ${tx(ref.schema)}.${tx(ref.table)}
            where ${tx(ref.column)} = any(${ids})
            limit 20
          `;
          console.error(
            `[accounts] ${ref.table}.${ref.column} still holds ${n} row(s), is NOT NULL, and is not a cascade:`,
          );
          for (const row of rows) console.error(`    ${JSON.stringify(row)}`);
          throw new Error(
            `${ref.table}.${ref.column} names this account in a record about somebody else. Decide what that record should say, then rerun.`,
          );
        }

        const updated = await tx`
          update ${tx(ref.schema)}.${tx(ref.table)}
          set ${tx(ref.column)} = null
          where ${tx(ref.column)} = any(${ids})
        `;
        console.log(
          `[accounts] ${ref.table}.${ref.column}: ${updated.count} row(s) kept, reference nulled`,
        );
      }

      const removed = await tx`delete from "user" where id = any(${ids})`;
      console.log(`[accounts] user: ${removed.count} row(s) removed`);

      if (!apply) throw DRY_RUN;
    });
    console.log("[accounts] done.");
  } catch (err) {
    if (err === DRY_RUN) {
      console.log("[accounts] dry run: everything above was rolled back. Rerun with --apply to keep it.");
      return;
    }
    throw err;
  }
})()
  .catch((err) => {
    console.error("[accounts] failed, nothing was deleted:", err);
    process.exitCode = 1;
  })
  // postgres-js keeps the socket open, so the process hangs without this.
  .finally(() => sql.end({ timeout: 5 }));
