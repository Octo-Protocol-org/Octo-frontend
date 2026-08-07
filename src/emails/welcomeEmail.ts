import { shell, BURGUNDY_BRIGHT } from "./shell";

/** Sent once, right after signup verification succeeds. */
export function renderWelcomeEmail({ email }: { email: string }): string {
  return shell(
    `<p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111;">Welcome to Octo 🎉</p>
<p style="margin:0 0 20px;color:#666;">${email} is verified and ready to go.</p>
<a href="https://app.octo.dev/dashboard" style="display:inline-block;background:${BURGUNDY_BRIGHT};border-radius:10px;padding:12px 28px;color:#fff;font-weight:600;text-decoration:none;font-size:14px;">Go to dashboard</a>`,
    "wave",
  );
}
