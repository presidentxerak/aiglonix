/**
 * Hero radar sweep (§2.5 moment 5) — pure CSS conic-gradient rotating at
 * 4s/turn with blips lighting up on its passage. The ONLY continuous
 * animation in the entire product, and it lives on the landing page.
 */
export function Radar() {
  const blips = [
    { top: "26%", left: "62%", delay: "0.4s" },
    { top: "58%", left: "30%", delay: "1.8s" },
    { top: "70%", left: "68%", delay: "3.1s" },
  ];

  return (
    <div
      aria-hidden
      className="relative aspect-square w-64 md:w-80 lg:w-96 rounded-full border border-line bg-surface overflow-hidden"
      style={{
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* range rings */}
      {[68, 44, 20].map((size) => (
        <span
          key={size}
          className="absolute rounded-full border border-line/70"
          style={{
            inset: `${(100 - size) / 2}%`,
          }}
        />
      ))}
      {/* crosshair */}
      <span className="absolute left-1/2 top-0 bottom-0 w-px bg-line/60" />
      <span className="absolute top-1/2 left-0 right-0 h-px bg-line/60" />
      {/* sweep */}
      <span className="radar-sweep absolute inset-0 rounded-full" />
      {/* blips */}
      {blips.map((b, i) => (
        <span
          key={i}
          className="radar-blip absolute h-2 w-2 rounded-full bg-accent"
          style={{ top: b.top, left: b.left, animationDelay: b.delay }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
    </div>
  );
}
