/**
 * A television, drawn rather than photographed.
 *
 * There is no TV in `public/`, and a stock photo would be the one photographic
 * element on a page built entirely from type and flat colour. So it is inline
 * SVG in the landing palette, with the wordmark's own blue-to-mint gradient in
 * the screen, the same one the on-air bar carries.
 *
 * It is drawn in strokes rather than filled shapes. The first version filled
 * the casing with `--ink-raised`, which is four percent lighter than the page
 * behind it: at the size this actually renders, around 40px, the casing simply
 * vanished and the mark read as a bright blob with an aerial. Anything meant
 * to be legible small has to carry its shape in contrast, not in fill.
 *
 * `aria-hidden` because the sentence beside it already says what it means.
 *
 * The gradient id is namespaced. Two SVGs on one page sharing an id and the
 * second silently wins, which only shows up when somebody reuses the component.
 */
export default function TvMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 52"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="evo-tv-mark-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-blue)" />
          <stop offset="62%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="#5cf0d6" />
        </linearGradient>
      </defs>

      <g
        stroke="var(--paper-dim)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* Aerial, behind the casing so it reads as attached to it. */}
        <path d="M21 14 L30 5 M39 14 L31 5" />
        {/* Casing. */}
        <rect x="3" y="14" width="54" height="33" rx="4" />
        {/* Feet. */}
        <path d="M16 47 L13 51 M44 47 L47 51" />
      </g>

      {/* Screen, inset far enough that the casing stroke stays a clear frame. */}
      <rect x="8" y="19" width="35" height="23" rx="2.5" fill="url(#evo-tv-mark-screen)" />

      {/* Dial. The one detail that survives at this size and says "set". */}
      <circle cx="50" cy="25" r="3" fill="var(--brand)" />
      <circle cx="50" cy="37" r="3" fill="var(--paper-faint)" />
    </svg>
  );
}
