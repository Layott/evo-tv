import type { EpgPillar } from "@/lib/epg/grid";
import { PILLARS, PILLAR_ORDER } from "./pillar";

interface Props {
  /** Hours per week actually programmed, taken from the grid, not asserted. */
  hoursByPillar: Record<EpgPillar, number>;
}

export default function PillarsSection({ hoursByPillar }: Props) {
  return (
    <section className="border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          What EVO TV is
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
          {PILLAR_ORDER.map((p) => {
            const pillar = PILLARS[p];
            const hours = hoursByPillar[p] ?? 0;
            return (
              <div
                key={p}
                className="rounded-2xl border border-white/10 bg-[#05091a] p-5 sm:p-6"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: pillar.accent }}
                  />
                  <h3 className="text-base font-bold text-white">{pillar.label}</h3>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {pillar.blurb}
                </p>

                {hours > 0 ? (
                  <p className="mt-4 font-mono text-xs tabular-nums text-neutral-600">
                    {hours}h a week
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
