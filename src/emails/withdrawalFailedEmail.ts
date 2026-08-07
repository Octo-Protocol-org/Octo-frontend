import { shell } from "./shell";

/** Sent when a withdrawal was attempted but did not complete (wrong OTP, or Horizon rejected it). */
export function renderWithdrawalFailedEmail({
  amount,
  asset,
  destination,
  reason,
}: {
  amount: string;
  asset: string;
  destination: string;
  reason: string;
}): string {
  return shell(
    `<p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111;">Withdrawal attempt failed</p>
<p style="margin:0 0 20px;color:#666;">A withdrawal attempt on your account did not complete.</p>
<div style="text-align:left;background:#fafafa;border-radius:10px;padding:16px 20px;font-size:13px;">
<p style="margin:0 0 8px;"><strong>Amount:</strong> ${amount} ${asset}</p>
<p style="margin:0 0 8px;word-break:break-all;"><strong>Destination:</strong> ${destination}</p>
<p style="margin:0;"><strong>Reason:</strong> ${reason}</p>
</div>
<p style="margin:20px 0 0;color:#999;font-size:12px;">If this wasn't you, secure your account and contact support.</p>`,
    "warn",
  );
}
