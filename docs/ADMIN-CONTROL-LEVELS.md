# Admin control levels

Nine roles, one ladder. A higher rank satisfies every requirement below it, so
there is one comparison in the whole system (`hasMinRole`) and no table of
special cases.

The ladder lives in `lib/auth/role-catalog.ts`. It is deliberately pure, so the
browser and the server read the same list: the dashboard used to hardcode three
roles in a dropdown while the API checked nine, which is how `moderator`,
`support_admin` and `finance_admin` came to exist in every guard and be
unassignable from any screen.

## The ladder

| Rank | Role | What it is for |
|---:|---|---|
| 0 | `guest` | Signed out. Never granted: giving it to an account locks it out rather than demoting it. |
| 1 | `user` | A normal account. Free content. |
| 2 | `premium` | Past the paywall. Granted here only for comps and staff; paying members get it from Paystack. |
| 5 | `creator` | A content partner. Their own channel and clips, nothing of anybody else's. |
| 10 | `support_admin` | Answers tickets. Reads accounts and orders, changes nothing a viewer sees. |
| 20 | `moderator` | Chat, reports and sanctions, plus read access to the library. |
| 30 | `finance_admin` | Orders, subscriptions, payouts. No editorial control. |
| 40 | `admin` | Everything a viewer sees, plus the roster. Can add other admins. |
| 100 | `head_admin` | Admin, plus the audit log in full, and the only role that can grant head admin. |

The gaps between the numbers are on purpose: a role can be inserted between two
tiers without renumbering the ones above it.

## What each level reaches

A cell is the **weakest** role that can do it. Everything above that role can do
it too.

| Area | Read | Write |
|---|---|---|
| Overview and analytics | admin | n/a |
| Shows, seasons, episodes | moderator | admin |
| Schedule (the weekly grid) | admin | admin |
| Library (videos and clips) | moderator | admin |
| Streams | admin | admin |
| Catalogue (games, teams, players, events) | admin | admin |
| Polls | admin | admin |
| Announcements and push | admin | admin |
| Ads | admin | admin |
| Users list | support_admin | admin (roles), moderator (sanctions) |
| Orders | support_admin | finance_admin (mark shipped) |
| Subscriptions | finance_admin | admin (cancel, extend) |
| Moderation queue and sanctions | moderator | moderator |
| Audit log | admin (not head_admin's rows) | n/a |
| Feature flags, email templates, settings | admin | admin |

Two rules hold everywhere:

1. **The nav shows only what the role can open.** `adminNavFor(role)` filters the
   sidebar and the mobile drawer from the same list, so a moderator does not see
   a row of doors that answer 403.
2. **The screen is a courtesy, the API is the boundary.** Every route under
   `/api/admin/*` checks the ladder server-side. A viewer who forces a screen to
   render gets an empty page and a row of 403s.

## The floors that stop the platform locking itself out

- **Nobody changes their own role.** Not even a head admin.
- **An admin may grant `admin`** (equal rank, never upward) but never
  `head_admin`, and never `guest`.
- **The last top-level admin cannot be demoted or deleted.** Counted, not
  reasoned about: `lib/api/admin-roster.ts` runs on role changes, bulk role
  changes, promotion by email and the account self-delete. With zero admins
  nobody can promote anybody, and the only way back is a hand-written UPDATE
  against production Postgres.
- **Granting by email does not create an account.** The person has to have signed
  up. A shell account with no password and no verified email holding `admin`
  would be a worse door than the one it opens.

## Suggested assignments

- **Owner** - `head_admin`. One or two people, no more.
- **Producers and editors** - `admin`. They publish shows, programme the channel
  and run the streams.
- **Community team** - `moderator`. Chat, reports, sanctions, and read access to
  the library so they can see what is published without being able to change it.
- **Anyone answering support mail** - `support_admin`. They can find the account
  and read the order, and cannot touch either.
- **Whoever reconciles payments** - `finance_admin`. Orders and subscriptions,
  no editorial reach.
- **Partner creators** - `creator`, never an admin tier. It is a content role.

## What is still not covered by a role

- **Forensic watermarking** and **Billing/USSD** are `ComingSoon` screens. They
  are listed in the nav at `admin` because that is where they will sit, not
  because there is anything behind them yet.
- **Publisher-scoped roles** (owner/admin/editor/viewer on a channel) are a
  separate ladder in `lib/auth/guards.ts` and are independent of this one. A
  plain `user` can own their own channel.
