import { apiFetch, path } from "./api";

export type Session = {
  id: string;
  createdAt: string;
  lastSeenAt?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  current?: boolean;
};

export async function listSessions(): Promise<Session[]> {
  return apiFetch<Session[]>(path("/sessions"));
}

export async function revokeSession(id: string): Promise<void> {
  await apiFetch<void>(path(`/sessions/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
}

export async function revokeOtherSessions(): Promise<void> {
  await apiFetch<void>(path("/sessions/others"), {
    method: "DELETE",
  });
}