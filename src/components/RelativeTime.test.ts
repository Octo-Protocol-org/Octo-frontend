import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime } from "./RelativeTime";

afterEach(() => {
  vi.useRealTimers();
});

// Bucket helpers — freeze time then compare the formatted output.
function at(nowIso: string, dateIso: string): string {
  vi.useFakeTimers({ now: new Date(nowIso).getTime() });
  return formatRelativeTime(new Date(dateIso));
}

describe("formatRelativeTime buckets", () => {
  it("seconds: 30 s ago → relative-second label", () => {
    const label = at("2024-01-01T12:00:30Z", "2024-01-01T12:00:00Z");
    // Intl.RelativeTimeFormat gives e.g. "30 seconds ago"
    expect(label).toMatch(/second/i);
  });

  it("minutes: 5 min ago → relative-minute label", () => {
    const label = at("2024-01-01T12:05:00Z", "2024-01-01T12:00:00Z");
    expect(label).toMatch(/minute/i);
  });

  it("hours: 3 h ago → relative-hour label", () => {
    const label = at("2024-01-01T15:00:00Z", "2024-01-01T12:00:00Z");
    expect(label).toMatch(/hour/i);
  });

  it("days: 2 days ago → relative-day label", () => {
    const label = at("2024-01-03T12:00:00Z", "2024-01-01T12:00:00Z");
    expect(label).toMatch(/day/i);
  });

  it("weeks: 2 weeks ago → relative-week label", () => {
    const label = at("2024-01-15T12:00:00Z", "2024-01-01T12:00:00Z");
    expect(label).toMatch(/week/i);
  });

  it("months: 2 months ago → relative-month label", () => {
    const label = at("2024-03-01T12:00:00Z", "2024-01-01T12:00:00Z");
    expect(label).toMatch(/month/i);
  });

  it("years: 2 years ago → relative-year label", () => {
    const label = at("2026-01-01T12:00:00Z", "2024-01-01T12:00:00Z");
    expect(label).toMatch(/year/i);
  });

  it("future: 1 hour from now → future relative-hour label", () => {
    const label = at("2024-01-01T12:00:00Z", "2024-01-01T13:00:00Z");
    expect(label).toMatch(/hour/i);
  });
});
