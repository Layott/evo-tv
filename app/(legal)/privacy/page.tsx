import type { Metadata } from "next";
import Link from "next/link";

import { LegalDoc, Section, List } from "@/components/legal/prose";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What EVO TV collects, why, who it is shared with, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

/**
 * Written against what the system actually does, not from a template.
 *
 * Every processor named here is one the code really calls: Paystack in
 * `lib/payments`, Resend and Gmail SMTP in `lib/email`, DigitalOcean for the
 * droplet, managed Postgres and Spaces, Google only when someone chooses that
 * sign-in. Every category of data is a column that exists.
 *
 * A policy that lists things we do not collect, or omits things we do, is worse
 * than having none: it is a statement of fact that happens to be false, and it
 * is the one page a regulator reads first.
 *
 * If a processor is added or dropped, this page changes in the same commit.
 */
export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="14 August 2026"
      summary="EVO TV is operated from Lagos, Nigeria. This explains what we collect, why, who we share it with, and how to make us delete it. It covers evotv.co, app.evotv.co and the EVO TV mobile apps."
    >
      <Section heading="Who we are">
        <p>
          EVO TV is a streaming service for esports, anime and lifestyle
          programming. For the purposes of the Nigeria Data Protection Act 2023,
          we are the data controller for the information described here.
        </p>
        <p>
          Questions, requests or complaints:{" "}
          <a
            href="mailto:privacy@evotv.co"
            className="text-[var(--brand)] underline underline-offset-4"
          >
            privacy@evotv.co
          </a>
        </p>
      </Section>

      <Section heading="What we collect">
        <p>When you create an account:</p>
        <List
          items={[
            "Your email address and name. Both are required to have an account.",
            "A handle, profile picture, short bio and country, if you choose to add them.",
            "A password, stored only as a hash. We cannot read it, and neither can anyone who obtains the database.",
          ]}
        />
        <p>When you use the service:</p>
        <List
          items={[
            "What you watch and roughly for how long, recorded as one row per minute of viewing. This is how live viewer counts work and how we know which programmes people actually watch.",
            "Messages you send in chat, and polls you vote in.",
            "Things you follow, like, add to a watchlist, or leave part-watched.",
            "Orders you place, including the delivery address you enter.",
            "Your IP address. It is stored as a one-way hash for anonymous viewer counting, and in full only on the session record, so that you can see and revoke your own sign-ins.",
          ]}
        />
        <p>
          We do not collect your location beyond the country you tell us, we do
          not buy data about you from anyone, and we do not run advertising or
          analytics trackers belonging to third parties.
        </p>
      </Section>

      <Section heading="Why we are allowed to hold it">
        <List
          items={[
            <>
              <strong className="text-[var(--paper)]">
                To provide the service.
              </strong>{" "}
              An account, a viewing history and an order cannot exist without the
              data that describes them. This is contractual necessity.
            </>,
            <>
              <strong className="text-[var(--paper)]">
                To keep it working and safe.
              </strong>{" "}
              Session records, moderation and abuse handling rest on our
              legitimate interest in a service that functions and is not hostile
              to use.
            </>,
            <>
              <strong className="text-[var(--paper)]">Because you asked.</strong>{" "}
              Marketing email is consent, given by opting in and withdrawn by
              unsubscribing. Nothing else depends on that consent.
            </>,
            <>
              <strong className="text-[var(--paper)]">
                Because the law requires it.
              </strong>{" "}
              Payment and order records are kept for the period tax and consumer
              law demands, even after an account is closed.
            </>,
          ]}
        />
      </Section>

      <Section heading="Who else touches it">
        <p>
          We use a small number of processors. Each gets only what it needs to do
          its job, and none may use your data for their own purposes.
        </p>
        <List
          items={[
            <>
              <strong className="text-[var(--paper)]">DigitalOcean</strong> hosts
              the service, the database and uploaded files, in Frankfurt,
              Germany.
            </>,
            <>
              <strong className="text-[var(--paper)]">Paystack</strong> processes
              payments. Card details go to Paystack directly and never reach our
              servers, so we never hold them.
            </>,
            <>
              <strong className="text-[var(--paper)]">Resend</strong> and{" "}
              <strong className="text-[var(--paper)]">Google</strong> deliver
              transactional email such as sign-in codes and receipts.
            </>,
            <>
              <strong className="text-[var(--paper)]">Google</strong> also
              receives your email address and name, but only if you choose to
              sign in with a Google account.
            </>,
            <>
              <strong className="text-[var(--paper)]">Cloudflare</strong> may
              deliver video when a broadcast is served from its network.
            </>,
          ]}
        />
        <p>
          We do not sell your data. We will not share it with anyone else unless
          you ask us to, or unless a valid legal order requires it, in which case
          we will tell you where we are permitted to.
        </p>
      </Section>

      <Section heading="Where it is stored">
        <p>
          Our servers are in Frankfurt, Germany, so data about Nigerian users
          leaves Nigeria. Those transfers rest on the safeguards the Nigeria Data
          Protection Act 2023 provides for countries with adequate protection,
          and our processors are bound by contract to the standards we hold
          ourselves to.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <List
          items={[
            "Your account and profile: until you delete the account.",
            "Viewing records: 24 months, after which they become counts that identify nobody.",
            "Chat messages: 12 months, or until the stream they belong to is deleted.",
            "Orders and payment records: 7 years, because tax law requires it.",
            "Sign-in sessions: in a browser, 3 hours from last use. In the app, 7 days from last use. Either way, immediately when you sign out.",
          ]}
        />
      </Section>

      <Section heading="Your rights">
        <p>
          Under the Nigeria Data Protection Act 2023 you may ask us for a copy of
          your data, correct anything wrong, delete your account and its data,
          object to a particular use, or withdraw consent you have given.
        </p>
        <p>
          Most of it you can do yourself in{" "}
          <Link
            href="/settings"
            className="text-[var(--brand)] underline underline-offset-4"
          >
            Settings
          </Link>
          . For anything else, email{" "}
          <a
            href="mailto:privacy@evotv.co"
            className="text-[var(--brand)] underline underline-offset-4"
          >
            privacy@evotv.co
          </a>{" "}
          and we will respond within 30 days. If we get it wrong, you can
          complain to the Nigeria Data Protection Commission.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          We use cookies to keep you signed in and to remember which interface
          your account should see. That is all they do. There are no advertising
          cookies and no third-party tracking on this site, which is why you are
          not being asked to dismiss a consent banner.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          EVO TV is not intended for children under 13, and we do not knowingly
          collect their data. Some programming carries an age rating and is
          restricted accordingly. If you believe a child has given us their
          information, email us and we will remove it.
        </p>
      </Section>

      <Section heading="How this was built">
        <p>
          Parts of EVO TV, the website and the apps, were built with the help of
          AI coding tools. A person reviewed and approved what shipped, and the
          decisions about what the service does are ours.
        </p>
        <p>
          AI is not used to make decisions about you. Nothing here profiles you,
          scores you, or decides automatically what you may access.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes in a way that affects you, we will email you
          before it takes effect, rather than quietly changing the date at the
          top.
        </p>
      </Section>
    </LegalDoc>
  );
}
