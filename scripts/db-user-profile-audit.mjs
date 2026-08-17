/**
 * Why does the admin user list show "@" and a "?" avatar for most accounts?
 *
 * Reads the profile columns the admin table renders, so the answer is either
 * "the column is null in the database" or "the API is not sending it".
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
  process.env.POSTGRES_URL;
if (!URL) {
  console.error("no DB url");
  process.exit(1);
}

// Local points at a tunnel on 55432 which speaks plain postgres; the managed
// database wants TLS. Pick by host rather than guessing.
const needsTls = !/@(localhost|127\.0\.0\.1)/.test(URL);
const sql = postgres(URL, { ssl: needsTls ? "require" : false, max: 1 });

const rows = await sql`
  select id, email, name, handle, image, role, created_at
  from "user"
  order by created_at desc
  limit 20
`;

console.table(
  rows.map((r) => ({
    email: (r.email ?? "").slice(0, 30),
    name: r.name ?? "(null)",
    handle: r.handle ?? "(null)",
    image: r.image ? r.image.slice(0, 40) : "(null)",
    role: r.role,
  })),
);

// The app-owned profile rows the admin endpoint never joins.
const profs = await sql`
  select u.email, p.display_name, p.avatar_url, p.bio, p.country, p.onboarded_at
  from "user" u
  left join profiles p on p.user_id = u.id
  order by u.created_at desc
  limit 20
`;
console.log("\nprofiles join:");
console.table(
  profs.map((r) => ({
    email: (r.email ?? "").slice(0, 28),
    display_name: r.display_name ?? "(NO PROFILE ROW)",
    avatar_url: r.avatar_url ? r.avatar_url.slice(0, 42) : "(empty)",
    country: r.country ?? "-",
    onboarded: r.onboarded_at ? "yes" : "no",
  })),
);

const [pc] = await sql`
  select
    (select count(*) from "user")::int     as users,
    (select count(*) from profiles)::int   as profile_rows,
    (select count(*) from profiles where avatar_url <> '')::int as with_avatar
`;
console.log("\nprofile coverage:", pc);

const [counts] = await sql`
  select
    count(*)::int                                         as total,
    count(*) filter (where handle is null)::int           as no_handle,
    count(*) filter (where name is null or name = '')::int as no_name,
    count(*) filter (where image is null)::int            as no_image
  from "user"
`;
console.log("\ncounts:", counts);

await sql.end();
