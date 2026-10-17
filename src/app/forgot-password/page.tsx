import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

// Force dynamic render so the strict nonce-based CSP (src/proxy.ts) can stamp its per-request
// nonce onto this page's scripts — the reset form handles credentials.
export const dynamic = "force-dynamic";

export const metadata = { title: "Reset password — Octo" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
