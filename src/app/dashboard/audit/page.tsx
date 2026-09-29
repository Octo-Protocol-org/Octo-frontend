"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { listAuditLogsPage, type AuditLog } from "@/lib/audit";
import { errorMessage } from "@/lib/api";
import { Pagination } from "@/components/dashboard/Pagination";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageSpinner } from "@/components/OctoSpinner";

const CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "authentication", label: "Authentication" },
  { value: "wallet", label: "Wallet" },
  { value: "address", label: "Address" },
  { value: "credentials", label: "Credentials" },
  { value: "configuration", label: "Configuration" },
];

const CATEGORY_COLOR: Record<string, string> = {
  authentication: "bg-burgundy-bright",
  wallet: "bg-sky-400",
  address: "bg-success",
  credentials: "bg-fuchsia-400",
  configuration: "bg-warning",
};

export default function AuditLogsPage() {
  const { user, token, loading, logout } = useAuth();
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  // Cursor stack: index 0 = page 1 (no cursor), each subsequent entry is the next_cursor.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (before: string | null) => {
      if (!token) return;
      setLogs(null);
      setError(null);
      listAuditLogsPage(token, { category, search, before })
        .then((page) => {
          setLogs(page.data);
          setNextCursor(page.next_cursor);
        })
        .catch((err) => {
          setError(errorMessage(err, "Failed to load audit logs."));
          setLogs([]);
        });
    },
    [token, category, search],
  );

  useEffect(() => {
    // Reset to page 1 whenever filters change.
    setCursors([null]);
    setPageIndex(0);
    setNextCursor(null);
    const t = setTimeout(() => load(null), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function goNext() {
    if (!nextCursor) return;
    setCursors((c) => [...c.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((i) => i + 1);
    load(nextCursor);
  }

  function goPrev() {
    if (pageIndex === 0) return;
    const target = cursors[pageIndex - 1];
    setPageIndex((i) => i - 1);
    load(target ?? null);
  }

  if (loading || !user) {
    return (
      <PageSpinner />
    );
  }

  return (
    <DashboardShell user={user} title="Audit Logs" onLogout={logout}>
      <div className="mx-auto max-w-6xl">
        {/* controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5">
            <span className="text-muted">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm text-foreground focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} className="bg-background">
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm text-burgundy-bright">
            {error}
          </p>
        )}

        {/* table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Activity</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">IP Address</th>
                <th className="px-5 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {logs === null ? (
                <Row colSpan>Loading…</Row>
              ) : logs.length === 0 ? (
                <Row colSpan>No activity yet.</Row>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="text-foreground/90">
                    <td className="px-5 py-3.5">
                      {l.action}
                      {l.target && (
                        <span className="text-muted"> · {l.target}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted">{user.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs capitalize text-muted">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            CATEGORY_COLOR[l.category] ?? "bg-muted"
                          }`}
                        />
                        {l.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {l.ip_address ? (
                        <span className="rounded-md bg-hover px-2 py-0.5 font-mono text-xs">
                          {l.ip_address}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted">
                      {timeAgo(l.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={pageIndex + 1}
          hasPrev={pageIndex > 0}
          hasNext={nextCursor !== null}
          loading={logs === null}
          onPrev={goPrev}
          onNext={goNext}
        />

        {logs && logs.length > 0 && (
          <p className="mt-4 text-xs text-muted">
            Showing {logs.length} {logs.length === 1 ? "result" : "results"}
          </p>
        )}
      </div>
    </DashboardShell>
  );
}

function Row({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: boolean;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan ? 5 : 1}
        className="px-5 py-10 text-center text-sm text-muted"
      >
        {children}
      </td>
    </tr>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
