"use client";

import { useSyncExternalStore } from "react";

// One shared ticker for every RelativeTime on the page, so labels stay current without an interval per row.
const TICK_MS = 30_000;
const listeners = new Set<() => void>();
let tickNow = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    tickNow = Date.now();
    timer = setInterval(() => {
      tickNow = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getNow = () => tickNow;

// Largest unit first; each entry is the unit and its length in seconds.
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** Localized relative label ("5 minutes ago", "in 1 hour") for `date` measured from `now`. */
export function formatRelativeTime(date: Date, now: number = Date.now()): string {
  const diffSec = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  const [unit, size] = UNITS.find(([, s]) => abs >= s) ?? ["second", 1];
  return formatter.format(Math.trunc(diffSec / size), unit);
}

// Shows relative time (e.g., "2 hours ago") with full datetime on hover; invalid dates render a placeholder.
export function RelativeTime({
  date,
  className = "",
}: {
  date: string | Date;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, getNow, getNow);
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return <span className={className}>—</span>;

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
    <time dateTime={d.toISOString()} title={full} className={className} suppressHydrationWarning>
      {formatRelativeTime(d, now)}
    </time>
  );
}
