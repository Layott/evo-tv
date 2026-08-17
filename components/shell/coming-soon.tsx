import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The honest placeholder for a feature that is built as UI but has no data
 * behind it.
 *
 * Around forty screens shipped from the 2026-04-27 expansion as fully designed
 * pages fed entirely by `lib/mock`: fantasy leagues with standings, rewards with
 * balances, watch parties with members, USSD with transactions. All of it was
 * invented. Showing a real person a fabricated league table or coin balance is
 * worse than showing them nothing, so those screens render this instead until
 * the feature has a backend.
 *
 * This is not a permanent state. Each of these has a route and a design already;
 * what it lacks is a table and an endpoint.
 */
export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold text-sky-400">
        Coming soon
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description ?? "This part of EVO TV is not ready yet. We would rather show you nothing than show you numbers we made up."}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-sky-600 text-white hover:bg-sky-500">
          <Link href="/home">Back to the channel</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="bg-card text-foreground hover:bg-accent"
        >
          <Link href="/schedule">See the schedule</Link>
        </Button>
      </div>
    </div>
  );
}
