import { escapeHtml, shell, BURGUNDY_BRIGHT } from "./shell";
import { TX_TIMEOUT_SECONDS } from "../lib/sdk/tx";

/** One-time code email, shared by signup verification and withdrawal confirmation. */
export function renderOtpEmail({
  code,
  purpose,
  amount,
  asset,
  destination,
}: {
  code: string;
  purpose: "signup" | "withdrawal";
  amount?: string;
  asset?: string;
  destination?: string;
}): string {
  const action = purpose === "withdrawal" ? "confirm a withdrawal" : "verify your email";
  const details =
    purpose === "withdrawal" && (amount || asset || destination)
      ? `<div style="margin:0 0 20px;border:1px solid #eee;border-radius:10px;padding:14px 16px;">
<p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;">You are approving</p>
${amount || asset ? `<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111;">${escapeHtml(amount ?? "")}${amount && asset ? " " : ""}${escapeHtml(asset ?? "")}</p>` : ""}
${destination ? `<p style="margin:0;font-size:13px;color:#444;word-break:break-all;">To: <span style="font-family:monospace;">${escapeHtml(destination)}</span></p>` : ""}
</div>`
      : "";
  const warning =
    purpose === "withdrawal"
      ? `<p style="margin:20px 0 0;color:#b00020;font-size:12px;font-weight:600;">Didn't request this? Don't share the code.</p>`
      : "";
  // Withdrawals confirm a signed envelope that expires after TX_TIMEOUT_SECONDS, not the 10-minute code TTL.
  const expiry =
    purpose === "withdrawal"
      ? `This code expires in ${Math.ceil(TX_TIMEOUT_SECONDS / 60)} minutes. If you didn't request it, you can ignore this email.`
      : "This code expires in 10 minutes. If you didn't request it, you can ignore this email.";
  return shell(
    `<p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111;">Your verification code</p>
<p style="margin:0 0 20px;color:#666;">Use this code to ${escapeHtml(action)}.</p>
${details}
<div style="display:inline-block;background:${BURGUNDY_BRIGHT};border-radius:10px;padding:14px 28px;">
<span style="font-size:30px;font-weight:700;letter-spacing:6px;color:#fff;">${escapeHtml(code)}</span>
</div>
${warning}
<p style="margin:20px 0 0;color:#999;font-size:12px;">${escapeHtml(expiry)}</p>`,
    "key",
  );
}
