export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-input border-t-sky-400" />
        <span className="text-sm">Loading EVO TV…</span>
      </div>
    </div>
  );
}
