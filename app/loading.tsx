export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950">
      <div className="flex items-center gap-3 text-neutral-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-sky-400" />
        <span className="text-sm">Loading EVO TV…</span>
      </div>
    </div>
  );
}
