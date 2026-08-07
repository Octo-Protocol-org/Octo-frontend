import { shell } from "./shell";

/** Sent after a withdrawal successfully relays to Horizon. */
export function renderWithdrawalSuccessEmail({
  amount,
  asset,
  destination,
  txHash,
}: {
  amount: string;
  asset: string;
  destination: string;
  txHash: string;
}): string {
  return shell(
    `<p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111;">Withdrawal confirmed</p>
<p style="margin:0 0 20px;color:#666;">Your withdrawal has been confirmed on-chain.</p>
<div style="text-align:left;background:#fafafa;border-radius:10px;padding:16px 20px;font-size:13px;">
<p style="margin:0 0 8px;"><strong>Amount:</strong> ${amount} ${asset}</p>
<p style="margin:0 0 8px;word-break:break-all;"><strong>Destination:</strong> ${destination}</p>
<p style="margin:0;word-break:break-all;"><strong>Transaction:</strong> ${txHash}</p>
</div>`,
    "check",
  );
}
