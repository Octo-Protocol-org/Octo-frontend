import { describe, expect, it } from "vitest";
import { TX_TIMEOUT_SECONDS } from "@/lib/sdk/tx";
import { renderOtpEmail } from "./otpEmail";
import { renderWelcomeEmail } from "./welcomeEmail";
import { renderWithdrawalFailedEmail } from "./withdrawalFailedEmail";
import { renderWithdrawalSuccessEmail } from "./withdrawalSuccessEmail";

/** A payload that must never appear unescaped in any email body. */
const PAYLOAD = `<img src=x onerror=alert(1)>`;
const ESCAPED = `&lt;img src=x onerror=alert(1)&gt;`;

/** Every string parameter is escaped: the raw payload is absent and its escape is present. */
function assertEscaped(html: string, ...params: string[]) {
  for (const p of params) {
    if (p !== PAYLOAD) throw new Error("test bug: every parameter must carry the payload");
  }
  expect(html).not.toContain(PAYLOAD);
  expect(html).toContain(ESCAPED);
}

describe("renderOtpEmail (signup)", () => {
  it("escapes the code and states the 10-minute TTL", () => {
    const html = renderOtpEmail({ code: PAYLOAD, purpose: "signup" });
    assertEscaped(html, PAYLOAD);
    expect(html).toContain("10 minutes");
    expect(html).toContain("verify your email");
  });

  it("renders a plain code intact", () => {
    const html = renderOtpEmail({ code: "123456", purpose: "signup" });
    expect(html).toContain("123456");
  });
});

describe("renderOtpEmail (withdrawal)", () => {
  it("escapes code, amount, asset and destination; shows amount, destination and the TX TTL", () => {
    const html = renderOtpEmail({
      code: PAYLOAD,
      purpose: "withdrawal",
      amount: PAYLOAD,
      asset: PAYLOAD,
      destination: PAYLOAD,
    });
    assertEscaped(html, PAYLOAD, PAYLOAD, PAYLOAD, PAYLOAD);
    // TTL is derived from the shared transaction timeout, in whole minutes.
    expect(html).toContain(`${Math.ceil(TX_TIMEOUT_SECONDS / 60)} minutes`);
  });

  it("shows the amount, asset and a plain destination", () => {
    const html = renderOtpEmail({
      code: "424242",
      purpose: "withdrawal",
      amount: "12.5",
      asset: "USDC",
      destination: "GDEST",
    });
    expect(html).toContain("12.5");
    expect(html).toContain("USDC");
    expect(html).toContain("GDEST");
    expect(html).toContain("424242");
  });

  it("omits the details box when no withdrawal details are given", () => {
    const html = renderOtpEmail({ code: "123456", purpose: "withdrawal" });
    expect(html).not.toContain("You are approving");
  });
});

describe("renderWelcomeEmail", () => {
  it("escapes the email address and links to the dashboard", () => {
    const html = renderWelcomeEmail({ email: PAYLOAD });
    assertEscaped(html, PAYLOAD);
    expect(html).toContain("/dashboard");
    expect(html).toContain("is verified and ready to go");
  });
});

describe("renderWithdrawalFailedEmail", () => {
  it("escapes amount, asset, destination and reason; shows amount, asset and destination", () => {
    const html = renderWithdrawalFailedEmail({
      amount: PAYLOAD,
      asset: PAYLOAD,
      destination: PAYLOAD,
      reason: PAYLOAD,
    });
    assertEscaped(html, PAYLOAD, PAYLOAD, PAYLOAD, PAYLOAD);
    expect(html).toContain("Withdrawal attempt failed");
  });

  it("shows the amount, asset, destination and reason", () => {
    const html = renderWithdrawalFailedEmail({
      amount: "3.2",
      asset: "USDC",
      destination: "GDEST",
      reason: "wrong OTP",
    });
    expect(html).toContain("3.2");
    expect(html).toContain("USDC");
    expect(html).toContain("GDEST");
    expect(html).toContain("wrong OTP");
  });
});

describe("renderWithdrawalSuccessEmail", () => {
  it("escapes amount, asset, destination and tx hash", () => {
    const html = renderWithdrawalSuccessEmail({
      amount: PAYLOAD,
      asset: PAYLOAD,
      destination: PAYLOAD,
      txHash: PAYLOAD,
    });
    assertEscaped(html, PAYLOAD, PAYLOAD, PAYLOAD, PAYLOAD);
    expect(html).toContain("Withdrawal confirmed");
  });

  it("shows the amount, asset, destination and transaction hash", () => {
    const html = renderWithdrawalSuccessEmail({
      amount: "3.2",
      asset: "USDC",
      destination: "GDEST",
      txHash: "HASH123",
    });
    expect(html).toContain("3.2");
    expect(html).toContain("USDC");
    expect(html).toContain("GDEST");
    expect(html).toContain("HASH123");
  });
});
