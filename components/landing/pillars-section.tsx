import type { EpgPillar } from "@/lib/epg/grid";
import { PILLARS, PILLAR_ORDER } from "./pillar";

interface Props {
  /** Hours per week actually programmed, counted off the grid, not asserted. */
  hoursByPillar: Record<EpgPillar, number>;
}

/**
 * What the channel is, told in type and numbers rather than in three bordered
 * cards with a coloured dot each.
 */
export default function PillarsSection({ hoursByPillar }: Props) {
  return (
    <section className="relative bg-[var(--ink-raised)]">
      <div className="mx-auto max-w-[92rem] px-5 py-20 sm:px-10 sm:py-28">
        <h2 className="reveal landing-display text-[clamp(2.4rem,7vw,5rem)]">
          What EVO TV is
        </h2>

        <div className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10 lg:gap-16">
          {PILLAR_ORDER.map((p) => {
            const pillar = PILLARS[p];
            const hours = hoursByPillar[p] ?? 0;
            return (
              <div key={p}>
                {hours > 0 ? (
                  <p className="landing-display text-[clamp(3.4rem,8vw,5.5rem)] text-[var(--brand)]">
                    {hours}
                    <span className="text-[0.36em] text-[var(--paper-faint)]">
                      {" "}
                      hrs/wk
                    </span>
                  </p>
                ) : null}

                <h3 className="landing-display mt-3 text-[1.85rem]">
                  {pillar.label}
                </h3>

                <p className="mt-3 max-w-[34ch] text-[0.98rem] leading-relaxed text-[var(--paper-dim)]">
                  {pillar.blurb}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
