/**
 * The questions and answers printed on /upgrade.
 *
 * Shared rather than duplicated because the page renders these and the layout
 * marks them up as an `FAQPage`. Google requires the answer text in the
 * structured data to be the text a reader can actually see, so the two must
 * come from one place: a copy edit on the page that left the markup behind
 * would turn a rich result into a manual action.
 */
export const UPGRADE_FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Your benefits continue to the end of the period you have paid for, and nothing renews after that.",
  },
  {
    q: "Which payment methods work?",
    a: "Card and bank transfer through Paystack. Card details never touch EVO TV's servers.",
  },
  {
    q: "What happens to my account if I stop paying?",
    a: "Nothing is deleted. You drop back to Free, keep your follows, watch history and profile, and the ads come back.",
  },
  {
    q: "Do I need to pay to chat?",
    a: "No. Chat is free on every stream. Paid plans add a badge and access to premium-only rooms.",
  },
] as const;
