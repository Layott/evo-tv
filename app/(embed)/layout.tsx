// Bare layout for /embed and /embed/player/[id] — no shell, no nav. Lives inside
// a route group so the segments stay at /embed and /embed/player.
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
