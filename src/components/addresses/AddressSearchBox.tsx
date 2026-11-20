"use client";

import { useEffect, useState } from "react";

/** Search input that reports the query after a short debounce (same delay as the audit page). */
export function AddressSearchBox({ onChange }: { onChange: (query: string) => void }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const t = setTimeout(() => onChange(value), 350);
    return () => clearTimeout(t);
  }, [value, onChange]);

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search loaded addresses by customer reference"
      aria-label="Search loaded addresses by customer reference"
      className="w-full max-w-sm rounded-xl border border-border bg-surface-raised px-4 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
    />
  );
}
