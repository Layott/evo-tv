# Owner request list, 2026-08-14

Fourteen items, asked for in one message. Two are done. The rest are sized here
against what is actually in the repo, not against how they sound.

## Done and live

- [x] **Remove AI commentary** from the player and Settings. It was canned lines
      on a timer presented as if they described the match.
- [x] **Say AI helped build this** in privacy and terms, on both surfaces.

## Bugs, and the only ones I can size without more digging

- [ ] **Profile pictures render black, some names missing.** Reported for own
      profile and other users. Not yet reproduced. Suspects, in order: the
      uploaded file never reaching Spaces, a signed-URL expiry, or
      `avatarUrl`/`displayName` being read off the wrong field. The app maps
      `name` to `displayName` and `image` to `avatarUrl`, and a cast rather than
      a map has bitten this codebase before.
- [ ] **Admin dashboard has no visible menu on mobile.** `/admin` is a desktop
      layout; the nav is presumably hidden below a breakpoint with nothing to
      replace it.
- [ ] **Light theme is not a real light theme.** The palette is dark-first and
      tokens were sampled for a dark ground; light mode almost certainly
      inverts only some of them.

## Features, roughly in the order I would build them

- [ ] **Shows CMS.** Create a show, tags, description, free or paid, upload
      video, episodes attached to the show. This is the biggest single item.
      Schema exists (`shows`, `seasons`, `episodes`, all with slugs) and
      **`/api/shows/[slug]` works but the table is empty**. There is no admin
      screen for any of it. Admin API has `vods` and `clips` but no `shows`.
- [ ] **Admin schedule input**, populating site and app. `epg_slots` and the
      grid already exist and drive the landing page and `/api/schedule`. What is
      missing is the admin screen to write them. **There is no `/admin/schedule`
      on the web.**
- [ ] **Clips upload, linked to a show or a video.** `admin/clips` API exists;
      no screen, and no link to shows.
- [ ] **Admins can add admins and assign roles.** The role ladder and audit log
      already exist (`lib/auth/roles.ts`, `admin/users`). This is a screen plus
      guardrails, not a new system.
- [ ] **Push notifications on the app.** Tokens are registered already
      (`usePushTokenRegistration`, `expoPushTokens` table). What is unproven is
      anything actually sending one, and foreground presentation.
- [ ] **"Get the app" downloads the app.** Currently links to `/apps`, an
      internal page. **Needs a real artefact from the owner:** a store listing,
      or a hosted APK. There is nothing to link to yet.
- [ ] **Premium page: remove options we do not have.** `/upgrade`, 250 lines.
      Needs the owner to say which tiers and perks are real.

## The two that are not one-sitting jobs

- [ ] **Same design as the landing page, every page, both surfaces.** The
      landing has its own design system (`landing-root`, `landing-display`, its
      own palette and tokens) and is deliberately a different world from the app
      shell, which is shadcn on neutral-950. This is roughly 90 web pages and a
      similar number of app screens. It is a redesign, not a restyle, and it
      wants doing surface by surface with the owner looking at each.
- [ ] **English and French, every page, button and email.** There is **no i18n
      of any kind in the repo today**: no `next-intl`, no `react-i18next`, zero
      matches. Every string is hardcoded in both repos. This is: pick a library,
      wire the provider and locale routing, extract several thousand strings,
      translate them, and do the same again in the app plus the email templates.

## Where I would start

The three bugs, because a black avatar and a missing menu are things a real user
hits today, and they are small. Then the shows CMS and the schedule screen,
because they are what turns the site from a shell into something the owner can
put content into without a developer. Design parity and translation last, and
each as its own run.
