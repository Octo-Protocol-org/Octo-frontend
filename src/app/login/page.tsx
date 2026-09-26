import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Log in — Octo" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;

  // Guard: only allow same-origin relative paths (must start with / but not //).
  const safeNext =
    next && /^\/(?!\/)/.test(next) ? next : undefined;

  return (
    <AuthShell>
      <AuthForm mode="login" next={safeNext} reason={reason} />
    </AuthShell>
  );
}
