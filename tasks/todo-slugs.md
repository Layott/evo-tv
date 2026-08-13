# Slug URLs across evotv.co

Owner asked for the slug treatment "for the entire site", after confirming the
EVO Originals posters were the example: they carry a `slug` and link nowhere.

## What is actually there

Seven tables already carry a unique `slug` column, and most of it is unused by
the website.

| Entity | Has slug column | Site route today | Gap |
|---|---|---|---|
| shows | yes | **none** | `/api/shows/[slug]` exists, no page. Originals posters link nowhere. |
| channels | yes | `/channel` only | `/api/channels/[slug]` exists, no per-channel page. |
| events | yes | `/events/[id]` | Addressed by opaque id despite having a slug. |
| products | yes | `/shop/[id]` | Same. |
| teams | yes | `/team/[slug]` | Done. |
| games | yes | `/categories/[slug]` | Done. |
| publishers | yes | none | Partner-facing, probably not public. |
| streams | **no** | `/stream/[id]` | Only `title`. Needs a column to have a slug. |
| vods | **no** | `/vod/[id]` | Same. |
| clips | **no** | `/clips/[id]` | Same. |

Also missing entirely: **`app/sitemap.ts` and `app/robots.ts`**. Slugs without a
sitemap is half the job, because nothing is being offered to a crawler at all.

## Phase 1, no decision needed

Nothing here changes a URL anyone already holds.

1. `app/(public)/show/[slug]/page.tsx`, fed by the existing shows API.
2. Link the Originals posters to it. `PosterCard` has no `Link` at all today.
3. `app/(public)/channel/[slug]/page.tsx`, fed by the existing channels API.
4. `generateMetadata` on both: title, description, and an OG image so a shared
   link renders the poster instead of a bare URL.
5. `app/sitemap.ts` listing every slug route, and `app/robots.ts` pointing at it.

## Phase 2, needs the owner's call

`/events/[id]` and `/shop/[id]` already have slugs sitting unused, and
`/stream`, `/vod`, `/clips` have no slug column at all. Both moves change URLs
that exist today, so they want 301s from the old form. See the question put to
the owner before starting.

## Rules for whatever gets built

- Slugs are generated from the title, lowercased, non-alphanumerics collapsed to
  a hyphen, with a short suffix on collision. Uniqueness is enforced by the
  column, not by hoping.
- A slug never changes once published. Renaming a show must not break a link
  somebody posted, so the old slug keeps resolving.
- Old id URLs keep working via permanent redirect, forever. They are in people's
  messages and in search indexes.
