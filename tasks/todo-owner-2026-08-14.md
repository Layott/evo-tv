# Owner request list, 2026-08-14

Fourteen items, asked for in one message. Updated 2026-08-15: everything that
does not need something from the owner is done. Detail in
`docs/HANDOVER-2026-08-15.md`.

## Done and live on the branch

- [x] **Remove AI commentary** from the player and Settings.
- [x] **Say AI helped build this** in privacy and terms, on both surfaces.
- [x] **Profile pictures render black, some names missing.** One resolver for
      every call site, initials rather than nothing when there is no image.
- [x] **Admin dashboard has no visible menu on mobile.** A sticky bar and a
      drawer below `md`, filtered by what the role can open.
- [x] **Light theme is not a real light theme.** 1,760 hardcoded neutrals across
      110 files mapped onto semantic tokens. Opened in a browser and checked.
- [x] **Shows CMS.** `/admin/shows`: create a show, tags, description, free or
      paid, upload video, episodes attached to the show. Reworked to the owner's
      2026-08-15 spec: no slug field, status derived, creator socials, artwork
      shape and size limits, and a price ladder for paid shows.
- [x] **Admin schedule input**, populating site and app. `/admin/schedule`,
      picking a show from the catalogue rather than typing a name.
- [x] **Clips upload, linked to a show or a video.** Both, plus a single episode.
- [x] **Admins can add admins and assign roles.** All nine roles assignable, by
      email as well as from the list, with a floor that stops the platform
      losing its last admin.

## Needs something from the owner

- [ ] **"Get the app" downloads the app.** The pages read the visitor's platform
      now, but there is still nothing to link to: no store listing, no hosted
      APK. Send either and it is a one-line change.
- [ ] **Premium page: remove options we do not have.** `/upgrade` still lists
      tiers and perks nobody has confirmed. Say which are real and they go in;
      the rest come out.
- [ ] **Push notifications on the app.** The send paths exist and the droplet
      crontab schedules the reminder fan-out. What is unproven is a real
      delivery to a real handset, which needs a device with the app installed.

## The two that are not one-sitting jobs

- [ ] **Same design as the landing page, every page, both surfaces.** Roughly 90
      web pages and a similar number of app screens. It is a redesign, not a
      restyle, and it wants doing surface by surface with the owner looking at
      each. The token sweep above is the groundwork: every page now reads its
      colours from one place, so a change to the palette moves all of them.
- [ ] **English and French, every page, button and email.** Still no i18n of any
      kind in either repo. Pick a library, wire locale routing, extract several
      thousand strings, translate, then do it again in the app and the email
      templates.

## Also done, not on the original list

- Two guard bugs that locked a `head_admin` out of the entire dashboard and out
  of every admin write.
- `/admin/library` and `/admin/subscriptions`, both endpoints that existed with
  no screen.
- `/admin/announcements`, the first thing on the platform that can send a push.
- Catalogue rows are editable and deletable, with the delete refusing when
  something still points at the row.
- 226 em dashes removed from source, per the standing rule.
