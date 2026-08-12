/**
 * A television, drawn rather than photographed, with the screen running.
 *
 * There is no TV in `public/`, and a stock photo would be the one photographic
 * element on a page built entirely from type and flat colour. So it is inline
 * SVG in the landing palette.
 *
 * The screen plays test-card bars sweeping sideways under a falling scanline,
 * both looping forever. The bars are the wordmark's own colours rather than
 * broadcast primaries: red and yellow bars would be the only warm pixels on
 * the page.
 *
 * Drawn in strokes rather than filled shapes. The first version filled the
 * casing with `--ink-raised`, four percent lighter than the page behind it, so
 * at the size this renders, around 44px, the casing vanished and the mark read
 * as a bright blob with an aerial. Small marks carry their shape in contrast,
 * not in fill.
 *
 * `aria-hidden` because the sentence beside it already says what it means, and
 * an animated decoration announcing itself would be worse than silent.
 *
 * Ids are namespaced. Two SVGs on a page sharing an id and the second silently
 * wins, which only shows up when somebody reuses the component.
 */

/** Screen box in user units. The CSS keyframes translate by exactly SCREEN_W. */
const SCREEN = { x: 8, y: 19, w: 35, h: 23 } as const;

/** One pass of bars. Drawn twice, so a translate of one screen width loops. */
const BARS = ["var(--brand-blue)", "var(--brand)", "#5cf0d6", "var(--brand-deep)"];

export default function TvMark({ className }: { className?: string }) {
  const barWidth = SCREEN.w / BARS.length;

  return (
    <svg
      viewBox="0 0 60 52"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="evo-tv-mark-clip">
          <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx="2.5" />
        </clipPath>
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

      <g clipPath="url(#evo-tv-mark-clip)">
        {/* Two passes of bars side by side. The strip is 2x the screen wide, so
            translating one screen width lands the copy exactly where the
            original started and the loop has no seam. */}
        <g className="tv-bars">
          {[0, 1].map((pass) =>
            BARS.map((fill, i) => (
              <rect
                key={`${pass}_${i}`}
                x={SCREEN.x + pass * SCREEN.w + i * barWidth}
                y={SCREEN.y}
                width={barWidth + 0.4}
                height={SCREEN.h}
                fill={fill}
              />
            )),
          )}
        </g>
        {/* Scanline. Kept inside the clip so it never crosses the casing. */}
        <rect
          className="tv-scan"
          x={SCREEN.x}
          y={SCREEN.y}
          width={SCREEN.w}
          height="2.4"
          fill="var(--paper)"
        />
      </g>

      {/* Dials. The detail that survives at this size and says "set". */}
      <circle cx="50" cy="25" r="3" fill="var(--brand)" />
      <circle cx="50" cy="37" r="3" fill="var(--paper-faint)" />
    </svg>
  );
}
