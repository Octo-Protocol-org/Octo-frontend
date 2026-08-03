// Shared ambient backdrop for every dashboard page: burgundy glows, isometric grid, ink blooms.
export function DashboardBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background">
      {/* Corner-anchored glows. */}
      <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full glow-burgundy opacity-40" />
      <div className="absolute -bottom-40 -right-24 h-[560px] w-[560px] rounded-full glow-burgundy opacity-25" />

      {/* Isometric grid, matching AuthShell but dimmer. */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(var(--burgundy-bright) 1px, transparent 1px), linear-gradient(90deg, var(--burgundy-bright) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          transform: "perspective(900px) rotateX(55deg) scale(1.6)",
          transformOrigin: "top center",
        }}
      />

      {/* Slow-drifting ink blooms. */}
      <div className="octo-ink octo-ink-1 absolute h-72 w-72 rounded-full blur-3xl" />
      <div className="octo-ink octo-ink-2 absolute h-96 w-96 rounded-full blur-3xl" />
    </div>
  );
}
