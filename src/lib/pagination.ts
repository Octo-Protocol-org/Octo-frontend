"use client";

export type Paginated<T> = {
  data: T[];
  next_cursor: string | null;
};

export type PageOpts = {
  limit?: number;
  before?: string | null;
};

export function pageQuery(opts?: PageOpts): string {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.before) params.set("before", opts.before);
  const query = params.toString();
  return query ? `?${query}` : "";
}
