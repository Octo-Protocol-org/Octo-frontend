import { shell, BURGUNDY_BRIGHT } from "./shell";

/** One-time code email, shared by signup verification and withdrawal confirmation. */
export function renderOtpEmail({
  code,
  purpose,
}: {
  code: string;
  purpose: "signup" | "withdrawal";
}): string {
  const action = purpose === "withdrawal" ? "confirm a withdrawal" : "verify your email";
  return shell(
    `<p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111;">Your verification code</p>
<p style="margin:0 0 20px;color:#666;">Use this code to ${action}.</p>
<div style="display:inline-block;background:${BURGUNDY_BRIGHT};border-radius:10px;padding:14px 28px;">
<span style="font-size:30px;font-weight:700;letter-spacing:6px;color:#fff;">${code}</span>
</div>
<p style="margin:20px 0 0;color:#999;font-size:12px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
    "key",
  );
}
