import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypair } from "@stellar/stellar-base";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Balance } from "@/lib/wallets";
import { network } from "@/lib/network";
import { WithdrawModal } from "./WalletModals";

// Only the network-facing SDK calls are mocked; building, signing and decoding run for real.
vi.mock("@/lib/sdk", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/sdk")>()),
  unlockWallet: vi.fn(),
  getSigningInfo: vi.fn(),
  getAccountExists: vi.fn(),
  requestWithdrawOtp: vi.fn(),
  confirmWithdraw: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const sdk = vi.mocked(await import("@/lib/sdk"));

const wallet = Keypair.random();
const recipient = Keypair.random().publicKey();
const USDC_ISSUER = network.usdc.issuer;
const HASH = "a".repeat(64);

const balances: Balance[] = [
  { asset_type: "native", balance: "100.0000000" },
  { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: USDC_ISSUER, balance: "50.0000000" },
] as Balance[];

const signingInfo = {
  account: wallet.publicKey(),
  sequence: "1000",
  network_passphrase: network.passphrase,
  base_fee_stroops: 100,
  base_reserve_stroops: 5_000_000,
  subentry_count: 1,
};

function renderModal() {
  const user = userEvent.setup();
  render(
    <WithdrawModal
      token="tok"
      walletId="w1"
      walletAddress={wallet.publicKey()}
      balances={balances}
      onClose={vi.fn()}
      onDone={vi.fn()}
    />,
  );
  return user;
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, opts: { destination: string; amount: string; asset?: "USDC" }) {
  if (opts.asset) await user.click(screen.getByRole("button", { name: new RegExp(`^${opts.asset}`) }));
  await user.type(screen.getByLabelText("Destination address"), opts.destination);
  await user.type(screen.getByLabelText(/^Amount/), opts.amount);
  await user.click(screen.getByRole("button", { name: /Review & (withdraw|sign again)/ }));
}

async function signOnReview(user: ReturnType<typeof userEvent.setup>, password = "pw") {
  await screen.findByRole("heading", { name: "Review withdrawal" });
  await user.type(screen.getByLabelText("Wallet password (to sign)"), password);
  await user.click(screen.getByRole("button", { name: "Sign & continue" }));
}

describe("WithdrawModal", () => {
  beforeEach(() => {
    sdk.getSigningInfo.mockResolvedValue(signingInfo);
    sdk.getAccountExists.mockResolvedValue({ exists: true });
    sdk.unlockWallet.mockResolvedValue(wallet);
    sdk.requestWithdrawOtp.mockResolvedValue({ sent: true });
  });

  it.each([
    ["an invalid destination", "not-an-address", "1", /valid Stellar address/],
    ["the wallet's own address", wallet.publicKey(), "1", /your own wallet address/],
    ["an amount over spendable", recipient, "1000", /You can send at most/],
  ])("rejects %s", async (_case, destination, amount, message) => {
    const user = renderModal();
    await fillForm(user, { destination, amount });
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(sdk.getAccountExists).not.toHaveBeenCalled();
  });

  it("reviews an XLM send to an unfunded destination as account creation", async () => {
    sdk.getAccountExists.mockResolvedValue({ exists: false });
    const user = renderModal();
    await fillForm(user, { destination: recipient, amount: "5" });
    await screen.findByRole("heading", { name: "Review withdrawal" });
    expect(screen.getByText("This will create the account.")).toBeInTheDocument();
  });

  it("refuses USDC to an unfunded destination and re-enables the button", async () => {
    sdk.getAccountExists.mockResolvedValue({ exists: false });
    const user = renderModal();
    await fillForm(user, { destination: recipient, amount: "5", asset: "USDC" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't activated on Stellar yet, so it can't hold USDC/);
    expect(screen.getByRole("button", { name: "Review & withdraw" })).toBeEnabled();
  });

  it("signs and shows the decoded destination and amount on the OTP step", async () => {
    const user = renderModal();
    await fillForm(user, { destination: recipient, amount: "5" });
    await signOnReview(user);

    await screen.findByRole("heading", { name: "Verify withdrawal" });
    expect(sdk.requestWithdrawOtp).toHaveBeenCalledOnce();
    expect(screen.getByText(/Destination:/).parentElement).toHaveTextContent(recipient);
    expect(screen.getAllByText(/5\.0000000 XLM/).length).toBeGreaterThan(0);
  });

  it("shows the expiry message when the countdown ends and keeps inputs on Sign again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = renderModal();
    await fillForm(user, { destination: recipient, amount: "5" });
    await signOnReview(user);
    await screen.findByRole("heading", { name: "Verify withdrawal" });

    // Jump past the envelope's time bounds so the countdown reaches zero.
    await act(async () => vi.advanceTimersByTime(200_000));
    expect(await screen.findByText(/This signed withdrawal expired/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify & withdraw" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Sign again" }));
    expect(screen.getByLabelText("Destination address")).toHaveValue(recipient);
    expect(screen.getByLabelText(/^Amount/)).toHaveValue("5");
    expect(screen.getByRole("button", { name: "Review & sign again" })).toBeInTheDocument();
  });

  it("shows the confirmed hash with an explorer link", async () => {
    sdk.confirmWithdraw.mockResolvedValue({ status: "confirmed", stellar_tx_hash: HASH });
    const user = renderModal();
    await fillForm(user, { destination: recipient, amount: "5" });
    await signOnReview(user);
    await screen.findByRole("heading", { name: "Verify withdrawal" });

    await user.click(screen.getByLabelText("Digit 1 of 6"));
    await user.paste("123456");
    await user.click(screen.getByRole("button", { name: "Verify & withdraw" }));

    const link = await screen.findByRole("link", { name: HASH });
    expect(link).toHaveAttribute("href", `${network.explorerBase}/tx/${HASH}`);
    expect(sdk.confirmWithdraw).toHaveBeenCalledWith("tok", "w1", expect.any(String), "123456");
  });

  it.each([
    ["succeeded", () => sdk.unlockWallet.mockResolvedValue(wallet)],
    ["failed", () => sdk.unlockWallet.mockRejectedValue(new Error("Wrong password"))],
  ])("clears the password after signing %s", async (outcome, arrange) => {
    arrange();
    const user = renderModal();
    await fillForm(user, { destination: recipient, amount: "5" });
    await signOnReview(user, "secret-password");

    if (outcome === "succeeded") {
      await screen.findByRole("heading", { name: "Verify withdrawal" });
      await user.click(screen.getByRole("button", { name: "Back" }));
      await user.click(screen.getByRole("button", { name: "Review & withdraw" }));
      await screen.findByRole("heading", { name: "Review withdrawal" });
    } else {
      await screen.findByRole("alert");
    }
    await waitFor(() => expect(screen.getByLabelText("Wallet password (to sign)")).toHaveValue(""));
  });
});
