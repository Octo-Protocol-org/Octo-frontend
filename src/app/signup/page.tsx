import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

// Force dynamic render so the strict nonce-based CSP (src/proxy.ts) can stamp its per-request
// nonce onto this page's scripts — the signup form handles credentials.
export const dynamic = "force-dynamic";

export const metadata = { title: "Sign up — Octo" };

export default function SignupPage() {
  return (
    <AuthShell>
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
