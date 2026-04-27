import type { AppStatus } from "@/lib/mock/apps";

const STYLES: Record<AppStatus, string> = {
  available: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  beta: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  "coming-soon": "border-neutral-700 bg-neutral-800/60 text-neutral-400",
};

const LABELS: Record<AppStatus, string> = {
  available: "Available",
  beta: "Beta",
  "coming-soon": "Coming soon",
};

export function AppStatusBadge({ status }: { status: AppStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STYLES[status]}`}
    >
      {status === "available" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
      ) : null}
      {LABELS[status]}
    </span>
  );
}
