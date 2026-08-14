import type { Metadata } from "next";
import Link from "next/link";

import { LegalDoc, Section, List } from "@/components/legal/prose";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement between you and EVO TV: accounts, subscriptions, conduct, content and cancellation.",
  alternates: { canonical: "/terms" },
};

/**
 * Terms that describe this service, not a generic one.
 *
 * Subscriptions really do renew through Paystack, orders really are physical
 * goods that ship, chat really is moderated and sanctions really do block
 * sign-in via the session hook in `lib/auth`. Where a right exists in Nigerian
 * consumer law it is stated plainly instead of being drafted around, because a
 * term that is unenforceable is not protection, it is just something a user
 * discovers was untrue.
 */
export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="14 August 2026"
      summary="These terms are the agreement between you and EVO TV. By creating an account or watching, you accept them. They are written to be read, so they are shorter than you expect."
    >
      <Section heading="Who you are agreeing with">
        <p>
          EVO TV is operated from Lagos, Nigeria. These terms govern evotv.co,
          app.evotv.co and the EVO TV mobile apps. Nigerian law applies, and the
          courts of Lagos State have jurisdiction.
        </p>
        <p>
          You must be at least 13 to hold an account. If you are under 18, you
          need a parent or guardian to agree to these terms with you.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          Keep your password to yourself. You are responsible for what happens
          under your account, unless it was our failure that let someone else in.
          Tell us immediately if you think someone else has access.
        </p>
        <p>
          One account per person. Do not share it with people outside your
          household, and do not sell or transfer it.
        </p>
      </Section>

      <Section heading="Subscriptions and payment">
        <List
          items={[
            "Free accounts can watch the free schedule. Premium unlocks premium programming and removes ads.",
            "Premium renews automatically each period until you cancel. Payments are taken by Paystack.",
            "Cancel any time in Settings. You keep access until the end of the period you have already paid for, and you are not charged again.",
            "We can change the price, but not without telling you at least 30 days beforehand by email. If you do not want the new price, cancel before it takes effect.",
            "Refunds follow Nigerian consumer law. If the service was not delivered as described, tell us and we will put it right.",
          ]}
        />
      </Section>

      <Section heading="Merchandise">
        <p>
          Physical items are sold and shipped by us. Prices include VAT where it
          applies. If an item arrives damaged, faulty or not as described, you
          have the rights Nigerian consumer law gives you, and we will replace or
          refund it.
        </p>
      </Section>

      <Section heading="What you may not do">
        <List
          items={[
            "Record, restream, download or redistribute our programming. It is licensed to us, not to you.",
            "Get around geographic limits, age ratings or the premium paywall.",
            "Harass, threaten or abuse anyone in chat, or post content that is illegal, hateful or sexual.",
            "Impersonate someone else, including our staff.",
            "Scrape the service, hammer it with automated requests, or attempt to break into any part of it.",
          ]}
        />
        <p>
          We moderate chat. We can remove messages, mute an account, or suspend
          it. For anything short of an immediate safety problem, we will tell you
          what happened and why, and you can reply and ask us to reconsider.
        </p>
      </Section>

      <Section heading="Content you post">
        <p>
          What you post stays yours. You give us permission to display it on the
          service, which is what allows a chat message to appear on a stream, and
          nothing more. We do not sell it, license it on, or use it in
          advertising.
        </p>
        <p>
          You keep that permission only while it is posted. Delete it, or delete
          your account, and the permission ends.
        </p>
      </Section>

      <Section heading="Our content">
        <p>
          Programming, artwork, the schedule and the EVO TV name and marks belong
          to us or to the people we license from. Watching does not transfer any
          of it to you.
        </p>
        <p>
          If you believe something on EVO TV infringes your copyright, email{" "}
          <a
            href="mailto:legal@evotv.co"
            className="text-[var(--brand)] underline underline-offset-4"
          >
            legal@evotv.co
          </a>{" "}
          with enough detail to identify the work and where it appears. We will
          investigate and remove anything that should not be there.
        </p>
      </Section>

      <Section heading="What we do not promise">
        <p>
          We work to keep EVO TV available, but we do not promise it will never
          go down. Live broadcasts depend on the internet, on venues, and on
          third parties, and any of them can fail. Schedules can change, and
          programming can be added or withdrawn.
        </p>
        <p>
          Where the law lets us limit our liability, we do, to the amount you
          paid us in the twelve months before the problem. Nothing here limits
          liability for death, personal injury or fraud, because it cannot.
        </p>
      </Section>

      <Section heading="Ending the agreement">
        <p>
          You can delete your account at any time in{" "}
          <Link
            href="/settings"
            className="text-[var(--brand)] underline underline-offset-4"
          >
            Settings
          </Link>
          . We can suspend or close an account that repeatedly breaks these
          terms, and we will tell you why.
        </p>
        <p>
          If we close your account and you have paid for a period you have not
          used, we will refund the unused part, unless it was closed for fraud.
        </p>
      </Section>

      <Section heading="How this was built">
        <p>
          Parts of EVO TV, the website and the apps, were built with the help of
          AI coding tools. A person reviewed and approved what shipped. It
          changes nothing about these terms: the service is ours, and so is the
          responsibility for it.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We will email you at least 30 days before any change that materially
          affects you. Continuing to use EVO TV after that means you accept the
          new terms; if you do not, delete your account and we will refund
          anything you have paid for and not used.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          <a
            href="mailto:legal@evotv.co"
            className="text-[var(--brand)] underline underline-offset-4"
          >
            legal@evotv.co
          </a>{" "}
          for anything about these terms. See the{" "}
          <Link
            href="/privacy"
            className="text-[var(--brand)] underline underline-offset-4"
          >
            Privacy Policy
          </Link>{" "}
          for how we handle your data.
        </p>
      </Section>
    </LegalDoc>
  );
}
