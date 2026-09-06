// Shared ambient backdrop for every dashboard page: burgundy glows, isometric grid, ink blooms.
export function DashboardBackground() {
  return (
    <div className="bg-decor-veil pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background">
      {/* Corner-anchored glows. */}
      <div className="bg-decor absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full glow-burgundy opacity-40" />
      <div className="bg-decor absolute -bottom-40 -right-24 h-[560px] w-[560px] rounded-full glow-burgundy opacity-25" />

      {/* Isometric grid, matching AuthShell but dimmer. */}
      <div
        className="bg-decor absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          transform: "perspective(900px) rotateX(55deg) scale(1.6)",
          transformOrigin: "top center",
        }}
      />

      {/* Slow-drifting ink blooms. */}
      <div className="bg-decor octo-ink octo-ink-1 absolute h-72 w-72 rounded-full blur-3xl" />
      <div className="bg-decor octo-ink octo-ink-2 absolute h-96 w-96 rounded-full blur-3xl" />
    </div>
  );
}
