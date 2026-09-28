"use client";

import { apiFetch } from "./api";
import { pageQuery, type Paginated, type PageOpts } from "./pagination";

export type AuditLog = {
  id: string;
  action: string;
  category: string;
  target: string | null;
  ip_address: string | null;
  created_at: string;
};

/** Cursor-paginated audit logs, optionally filtered by category and search. */
export function listAuditLogsPage(
  token: string,
  opts: { category?: string; search?: string } & PageOpts = {},
) {
  const params = new URLSearchParams();
  if (opts.category && opts.category !== "all") params.set("category", opts.category);
  if (opts.search) params.set("search", opts.search);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const qs = params.toString();
  return apiFetch<Paginated<AuditLog>>(`/v1/audit-logs${qs ? `?${qs}` : ""}`, { token });
}
