"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";
import {
  updateUsername,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
  type User,
} from "@/lib/auth";
import {
  errorMessage,
} from "@/lib/api";
import { listSessions, revokeSession, revokeOtherSessions, type Session } from "@/lib/sessions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageSpinner } from "@/components/OctoSpinner";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const { user, token, loading, logout } = useAuth();
  // Set only once a save succeeds, so the sidebar/greeting reflect it immediately without
  // waiting for a fresh `me()` fetch on next navigation.
  const [savedUser, setSavedUser] = useState<User | null>(null);
  // null until the user types; the field otherwise mirrors whatever username is current.
  const [draft, setDraft] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);



// Load sessions once a token is available; failures surface inline rather than blocking the page.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listSessions(token)
      .then((rows) => {
        if (!cancelled) {
          setSessions(rows);
          setSessionsError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setSessionsError(errorMessage(err, "Failed to load sessions."));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading || !user) {
    return <PageSpinner />;
  }

  // Derived rather than copied into state on every `user` change — copying props into state
  // makes the effect fight the fetch, and leaves the field stale for a render after each save.
  const currentUser = savedUser ?? user;
  const username = draft ?? currentUser.username ?? "";

  

  async function onRevoke(sessionId: string) {
    if (!token) return;
    setRevoking(sessionId);
    try {
      await revokeSession(token, sessionId);
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== sessionId) : prev));
      toast.success("Session signed out.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to sign out session."));
    } finally {
      setRevoking(null);
    }
  }

  async function onRevokeOthers() {
    if (!token) return;
    setRevoking("others");
    try {
      await revokeOtherSessions(token);
      setSessions((prev) => (prev ? prev.filter((s) => s.current) : prev));
      toast.success("Other sessions signed out.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to sign out other sessions."));
    } finally {
      setRevoking(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const trimmed = username.trim();
    if (
      trimmed.length < USERNAME_MIN ||
      trimmed.length > USERNAME_MAX ||
      !USERNAME_PATTERN.test(trimmed)
    ) {
      toast.error(`Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters: letters, numbers, underscores, and hyphens only.`);
      return;
    }
    setSubmitting(true);
    try {
      const updated = await updateUsername(token, username.trim());
      setSavedUser(updated);
      // Drop the draft so the field falls back to the saved value.
      setDraft(null);
      toast.success("Username saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save username."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell user={currentUser} title="Settings" onLogout={logout}>
      <div className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-semibold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-muted">
          This is what shows up around your dashboard instead of your email.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-6 rounded-2xl border border-border bg-burgundy-soft/30 p-6"
        >
          <div>
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Username
            </label>
            <p className="mt-1 text-xs text-muted">
              {USERNAME_MIN}–{USERNAME_MAX} characters: letters, numbers, underscores, and hyphens only.
            </p>
            <input
              id="username"
              value={username}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. tosin"
              maxLength={USERNAME_MAX}
              className="mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <p className="mt-2 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
              {user.email}
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || username.trim().length < USERNAME_MIN}
            className="rounded-xl glass-btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save username"}
          </button>
        </form>
      </div>
      {token && (
        <div className="mx-auto mt-10 max-w-2xl">
          <h2 className="text-2xl font-semibold text-foreground">Sessions</h2>
          <p className="mt-1 text-sm text-muted">
            Devices currently signed in to your account. Sign out any you don&apos;t recognize.
          </p>
          <div className="mt-6 space-y-3 rounded-2xl border border-border bg-burgundy-soft/30 p-6">
            {sessionsError && (
              <p className="rounded-lg border border-burgundy/40 bg-burgundy/10 px-3 py-2 text-sm text-burgundy-bright">
                {sessionsError}
              </p>
            )}
            {!sessions && !sessionsError && <p className="text-sm text-muted">Loading sessions…</p>}
            {sessions && sessions.length === 0 && (
              <p className="text-sm text-muted">No active sessions.</p>
            )}
            {sessions?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-raised px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.device ?? "Unknown device"}
                    {s.current && <span className="ml-2 text-xs text-muted">(this device)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Last seen {new Date(s.last_seen).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRevoke(s.id)}
                  disabled={revoking !== null}
                  className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                >
                  {revoking === s.id ? "Signing out…" : "Sign out"}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onRevokeOthers}
              disabled={revoking !== null || !sessions || sessions.length < 2}
              className="rounded-xl glass-btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {revoking === "others" ? "Signing out…" : "Sign out all other sessions"}
            </button>
          </div>
        </div>
      )}
      {token && <ChangePasswordForm token={token} />}

    </DashboardShell>
  );
}
