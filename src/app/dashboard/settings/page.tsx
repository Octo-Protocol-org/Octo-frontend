"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";
import { updateUsername, type User } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageSpinner } from "@/components/OctoSpinner";

export default function SettingsPage() {
  const { user, token, loading, logout } = useAuth();
  // Tracks the latest saved user so the sidebar/greeting on this page reflect a save
  // immediately, without waiting for a fresh `me()` fetch on next navigation.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
      setUsername(user.username ?? "");
    }
  }, [user]);

  if (loading || !user) {
    return <PageSpinner />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const updated = await updateUsername(token, username.trim());
      setCurrentUser(updated);
      toast.success("Username saved.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save username.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell user={currentUser ?? user} title="Settings" onLogout={logout}>
      <div className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-semibold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-muted">
          This is what shows up around your dashboard instead of your email.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-6 rounded-2xl border border-white/10 bg-burgundy-soft/30 p-6"
        >
          <div>
            <label className="text-sm font-medium text-foreground">
              Username
            </label>
            <p className="mt-1 text-xs text-muted">
              3–20 characters: letters, numbers, underscores, and hyphens only.
            </p>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. tosin"
              maxLength={20}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-burgundy-bright focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted">
              {user.email}
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || username.trim().length < 3}
            className="rounded-xl glass-btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save username"}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
