import * as React from "react";

/**
 * Type for a long legal document.
 *
 * Set for reading rather than skimming: one measure, generous leading, and
 * headings that separate by size and space rather than by rules. Same reasoning
 * as the rest of the site, and it matters more here, because these are the
 * pages people actually have to read.
 */
export function LegalDoc({
  title,
  updated,
  summary,
  children,
}: {
  title: string;
  updated: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <h1 className="landing-display text-[clamp(2.2rem,6vw,3.6rem)] leading-[1.05]">
        {title}
      </h1>
      <p className="mt-4 text-[0.95rem] text-[var(--paper-faint)]">
        Last updated {updated}
      </p>
      <p className="mt-8 text-[1.15rem] leading-relaxed text-[var(--paper-dim)]">
        {summary}
      </p>
      <div className="mt-12 space-y-10">{children}</div>
    </article>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="landing-display text-[1.5rem] text-[var(--brand)]">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-[1.02rem] leading-relaxed text-[var(--paper-dim)]">
        {children}
      </div>
    </section>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden
            className="mt-[0.62em] size-1 shrink-0 rounded-full bg-[var(--paper-faint)]"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
