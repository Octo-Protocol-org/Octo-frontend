"use client";

// Shows relative time (e.g., "2 hours ago") with full datetime on hover.
export function RelativeTime({
  date,
  className = "",
}: {
  date: string | Date;
  className?: string;
}) {
  const d = typeof date === "string" ? new Date(date) : date;
  const relative = formatRelativeTime(d);
  const full = d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  return (
    <time dateTime={d.toISOString()} title={full} className={className}>
      {relative}
    </time>
  );
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const then = date.getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks}w ago`;
  }
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months}mo ago`;
  }
  const years = Math.floor(diffDay / 365);
  return `${years}y ago`;
}
