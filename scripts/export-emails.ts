import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { renderWelcomeEmail } from "../src/emails/welcomeEmail";
import { renderOtpEmail } from "../src/emails/otpEmail";
import { renderWithdrawalSuccessEmail } from "../src/emails/withdrawalSuccessEmail";
import { renderWithdrawalFailedEmail } from "../src/emails/withdrawalFailedEmail";

const OUT_DIR = join(process.cwd(), "emails-export");

const FAKE_NAME = "Ada Lovelace";
const FAKE_EMAIL = "ada.lovelace@example.com";
const FAKE_CODE = "123456";
const FAKE_AMOUNT = "1.00000000";
const FAKE_ASSET = "XLM";
const FAKE_DESTINATION =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const FAKE_TX_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";
const FAKE_REASON = "Insufficient balance to cover the withdrawal amount and fee.";

const templates: Array<{ name: string; html: string }> = [
  {
    name: "welcome.html",
    html: renderWelcomeEmail({ name: FAKE_NAME, email: FAKE_EMAIL }),
  },
  {
    name: "otp-signup.html",
    html: renderOtpEmail({ code: FAKE_CODE, purpose: "signup" }),
  },
  {
    name: "otp-withdrawal.html",
    html: renderOtpEmail({
      code: FAKE_CODE,
      purpose: "withdrawal",
      amount: FAKE_AMOUNT,
      asset: FAKE_ASSET,
      destination: FAKE_DESTINATION,
    }),
  },
  {
    name: "withdrawal-success.html",
    html: renderWithdrawalSuccessEmail({
      name: FAKE_NAME,
      amount: FAKE_AMOUNT,
      asset: FAKE_ASSET,
      destination: FAKE_DESTINATION,
      txHash: FAKE_TX_HASH,
    }),
  },
  {
    name: "withdrawal-failed.html",
    html: renderWithdrawalFailedEmail({
      name: FAKE_NAME,
      amount: FAKE_AMOUNT,
      asset: FAKE_ASSET,
      destination: FAKE_DESTINATION,
      reason: FAKE_REASON,
    }),
  },
];

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const { name, html } of templates) {
    await writeFile(join(OUT_DIR, name), html, "utf8");
  }
  console.log(`Exported ${templates.length} email templates to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});