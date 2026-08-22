/**
 * Which public pages a search engine can actually understand, and which are
 * invisible to it.
 *
 * The site shipped with one title across 94 pages, no structured data and a
 * sitemap of three fixed URLs, and none of that was noticed for months because
 * nothing failed. A page with no description looks completely normal to
 * everyone who already knows the URL. This is the check that makes it fail.
 *
 *   node scripts/seo-coverage.mjs           list every gap
 *   node scripts/seo-coverage.mjs --max 0   fail if there are any
 *
 * The `--max` form is what `pnpm check` runs. The number may fall, never rise.
 *
 * What it enforces, for every page under (public), (legal) and app/page.tsx:
 *
 *   1. Metadata exists, on the page or on a layout inside the same route.
 *      A client component cannot export metadata at all, so it needs a
 *      layout.tsx beside it; that is the single most common way to ship a page
 *      with no title, because nothing about it looks wrong.
 *   2. An indexable page has a title, a description and a canonical. Without a
 *      canonical, the same page reached with ?utm_source= is a second page
 *      competing with the first.
 *   3. A page that still says "coming soon" is noindex. Sending a searcher to a
 *      dead end costs more than the page could earn.
 *   4. An entity route ([id] or [slug]) renders JSON-LD. A show, a video or a
 *      product that does not say what it is gets read as a page of links.
 *   5. Every indexable route appears in sitemap.ts, so a new kind of page is
 *      never left to be discovered by luck.
 *
 * The private groups are checked from the other end: (auth), (authed) and
 * (embed) must be noindex at the group layout, so a page added inside one of
 * them inherits it rather than needing to remember.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP = path.join(ROOT, "app");

/** Route groups whose pages face the public and therefore must be described. */
const PUBLIC_GROUPS = ["(public)", "(legal)"];

/** Groups that must be noindex as a whole, checked at their layout. */
const PRIVATE_GROUPS = ["(auth)", "(authed)", "(embed)"];

/**
 * Routes that are deliberately absent from the sitemap, with the reason.
 *
 * An exception has to be written down and justified here rather than being a
 * silent omission, which is the difference between a decision and an oversight.
 */
const SITEMAP_EXEMPT = new Map([
  ["/home", "the signed-in shell that / redirects to; indexing both splits one result in two"],
  ["/api-access/keys", "noindex, not published yet"],
  ["/api-access/docs", "noindex, not published yet"],
  ["/api-access/usage", "noindex, not published yet"],
  ["/apps/desktop", "noindex, not released yet"],
  ["/apps/tv", "noindex, not released yet"],
  ["/calendar", "noindex, not published yet"],
  ["/partners", "noindex, not published yet"],
  ["/stream/[id]/co-stream", "noindex, not released yet"],
  ["/events/[id]/bracket", "noindex, a view of an event rather than its own result"],
  ["/discover", "a search box; the results it shows are all listed in their own right"],
  ["/embed", "meant to sit inside somebody else's page"],
]);

/** Entity routes that legitimately carry no JSON-LD, with the reason. */
const JSON_LD_EXEMPT = new Map([
  ["/events/[id]/bracket", "noindex"],
  ["/stream/[id]/co-stream", "noindex"],
  ["/categories/[slug]", "breadcrumbs only: the lists are fetched in the browser, so a server-built ItemList would describe different content from the one on screen"],
  ["/profile/[handle]", "private"],
]);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** app/(public)/show/[slug]/page.tsx -> /show/[slug] */
function routeOf(file) {
  const rel = path.relative(APP, path.dirname(file)).split(path.sep);
  const segments = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segments.join("/");
}

const hasMetadataExport = (src) =>
  /export\s+(const|async\s+function|function)\s+(metadata|generateMetadata)\b/.test(src);

/**
 * Metadata from the page, or from a layout inside the same route.
 *
 * Walks up only as far as the route group. The root layout and the group
 * layout both carry a default title, and counting those would mark every page
 * as described while they all still shared one title, which is the exact bug
 * this is meant to catch.
 */
function metadataSources(pageFile) {
  const sources = [];
  const pageSrc = read(pageFile);
  if (hasMetadataExport(pageSrc)) sources.push({ file: pageFile, src: pageSrc });

  let dir = path.dirname(pageFile);
  while (dir.startsWith(APP) && dir !== APP) {
    const base = path.basename(dir);
    const layout = path.join(dir, "layout.tsx");
    if (fs.existsSync(layout) && layout !== pageFile) {
      const src = read(layout);
      if (hasMetadataExport(src)) sources.push({ file: layout, src });
    }
    // Stop at the route group: anything above it is site-wide default.
    if (base.startsWith("(") && base.endsWith(")")) break;
    dir = path.dirname(dir);
  }
  return sources;
}

/** The object literal passed to a call, by brace counting rather than regex. */
function callBody(src, from) {
  const open = src.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * Is this route actually kept out of the index?
 *
 * Not a text search for "noIndex", which was the first version and was wrong in
 * a way that switched the whole check off. Every dynamic layout carries a
 * fallback for a record that does not exist:
 *
 *   if (!clip) return pageMetadata({ ..., noIndex: true });
 *
 * so the string appears in a file describing a page that is very much indexed.
 * The checker read that, decided the route was noindex, and skipped its title,
 * canonical, JSON-LD and sitemap checks. It reported a clean site while every
 * individual clip was missing from the sitemap.
 *
 * A route counts as noindex only when there is no indexable path through it: an
 * explicit `robots: { index: false }`, `comingSoonMetadata`, or every single
 * `pageMetadata` call carrying `noIndex: true`.
 */
function isNoIndex(src) {
  if (/comingSoonMetadata/.test(src)) return true;
  if (/robots:\s*\{[^}]*index:\s*false/.test(src)) return true;

  const calls = [];
  const pattern = /pageMetadata\(/g;
  let match;
  while ((match = pattern.exec(src)) !== null) {
    const body = callBody(src, match.index);
    if (body) calls.push(body);
  }
  if (calls.length === 0) return false;
  return calls.every((body) => /noIndex:\s*true/.test(body));
}

const problems = [];
let checked = 0;

function fail(route, file, message) {
  problems.push({ route, file: path.relative(ROOT, file).replace(/\\/g, "/"), message });
}

/* ------------------------------------------------------- the public pages */

const publicPages = [];
for (const group of PUBLIC_GROUPS) {
  for (const file of walk(path.join(APP, group))) {
    if (path.basename(file) === "page.tsx") publicPages.push(file);
  }
}
// The guest root, which lives directly under app/.
const rootPage = path.join(APP, "page.tsx");
if (fs.existsSync(rootPage)) publicPages.push(rootPage);

const sitemapSrc = fs.existsSync(path.join(APP, "sitemap.ts"))
  ? read(path.join(APP, "sitemap.ts"))
  : "";

for (const file of publicPages) {
  const route = routeOf(file);
  const pageSrc = read(file);
  const sources = metadataSources(file);
  checked += 1;

  if (sources.length === 0) {
    const isClient = /^\s*["']use client["']/m.test(pageSrc);
    fail(
      route,
      file,
      isClient
        ? "no metadata, and the page is a client component so it can never carry its own: add a layout.tsx beside it"
        : "no metadata: no title, no description, no canonical",
    );
    continue;
  }

  const all = sources.map((s) => s.src).join("\n");
  const noIndex = sources.some((s) => isNoIndex(s.src));

  // A screen that still says "coming soon" must not be a search result.
  if (/ComingSoon/.test(pageSrc) && !noIndex) {
    fail(route, file, "renders ComingSoon but is indexable: use comingSoonMetadata");
  }

  if (!noIndex) {
    const hasTitle = /title:/.test(all);
    const hasDescription = /description:/.test(all);
    // `pageMetadata` always sets a canonical from `path`, so its presence counts.
    const hasCanonical = /alternates:|pageMetadata\(/.test(all);

    if (!hasTitle) fail(route, file, "indexable with no title");
    if (!hasDescription) fail(route, file, "indexable with no description");
    if (!hasCanonical) {
      fail(route, file, "indexable with no canonical: ?utm_source= becomes a second competing page");
    }

    // An entity page should say what the entity is.
    const isEntity = /\[[^\]]+\]/.test(route);
    if (isEntity && !JSON_LD_EXEMPT.has(route)) {
      const rendersJsonLd = sources.some((s) => /<JsonLd/.test(s.src)) || /<JsonLd/.test(pageSrc);
      if (!rendersJsonLd) {
        fail(route, file, "entity page with no JSON-LD: a crawler cannot tell what this is");
      }
    }

    // And it should be findable without relying on a crawler stumbling on it.
    if (!SITEMAP_EXEMPT.has(route)) {
      /*
       * A dynamic route and its listing page are different things.
       *
       * The first version of this looked for the route's static prefix, so
       * `/clips/[id]` was satisfied by the `/clips` entry that lists the page
       * of clips. Every individual clip was missing from the sitemap and the
       * check said everything was fine. A dynamic route has to be matched by a
       * template that interpolates, `/clips/${...}`, which is the only thing
       * that proves the rows themselves are listed.
       */
      const prefix = route.split("/[")[0];
      const inSitemap = isEntity
        ? sitemapSrc.includes(`${prefix}/\${`)
        : sitemapSrc.includes(`${prefix}\``) ||
          (prefix === "/" && sitemapSrc.includes("SITE_URL}/`"));
      if (!inSitemap) {
        fail(
          route,
          file,
          isEntity
            ? `indexable but sitemap.ts lists no rows under ${prefix}/`
            : `indexable but nothing in sitemap.ts lists ${prefix}`,
        );
      }
    }
  }
}

/* ------------------------------------------------------ the private groups */

for (const group of PRIVATE_GROUPS) {
  const layout = path.join(APP, group, "layout.tsx");
  if (!fs.existsSync(layout)) continue;
  if (!/index:\s*false/.test(read(layout))) {
    fail(
      `${group}/*`,
      layout,
      "group layout does not set robots index:false, so every page inside it is indexable",
    );
  }
}

/* ----------------------------------------------------------------- report */

problems.sort((a, b) => a.route.localeCompare(b.route));
for (const p of problems) {
  console.log(`  ${p.route.padEnd(34)} ${p.message}`);
  console.log(`  ${"".padEnd(34)} ${p.file}`);
}

console.log(
  `\n${checked} public pages checked, ${problems.length} cannot be read properly by a search engine.`,
);

const maxFlag = process.argv.indexOf("--max");
if (maxFlag !== -1) {
  const max = Number(process.argv[maxFlag + 1] ?? 0);
  if (problems.length > max) {
    console.error(
      `\nOver the agreed ceiling of ${max}. Every public page carries its own title, description and canonical; see the hard rule in CLAUDE.md.`,
    );
    process.exit(1);
  }
}
