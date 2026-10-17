import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createPaymentIntent,
  createPaymentLink,
  getPaymentLink,
  getPaymentStatus,
  getPublicPaymentLink,
  getPublicSigningInfo,
  listRecentPaymentLinks,
  listPaymentLinkPayments,
  listPaymentLinksPage,
  setPaymentLinkActive,
  submitPublicPayment,
} from "./payment-links";
import type { AuthToken, WalletId } from "./brands";

const TOKEN = "tok_123" as AuthToken;
const WALLET_ID = "wallet_1" as WalletId;

function makeResponse(status: number, body: unknown, contentType = "application/json"): Response {
  const init: ResponseInit = { status, headers: { "content-type": contentType } };
  const bodyText = contentType === "application/json" ? JSON.stringify(body) : (body as string);
  return new Response(bodyText, init);
}

describe("payment-links path encoding", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastUrl(): string {
    const [url] = vi.mocked(fetch).mock.calls[vi.mocked(fetch).mock.calls.length - 1] as [
      string,
    ];
    return url;
  }

  it("encodes a slash in a public link slug", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await getPublicPaymentLink("a/b");
    expect(lastUrl()).toContain("/v1/pay/a%2Fb");
  });

  it("encodes dot-dot in a public link slug", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await getPublicPaymentLink("..");
    expect(lastUrl()).toContain("/v1/pay/%2E%2E");
  });

  it("encodes slash and dot-dot in a wallet-scoped link id", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await getPaymentLink(TOKEN, WALLET_ID, "../x");
    expect(lastUrl()).toContain("/v1/wallets/wallet_1/payment-links/%2E%2Ex");
  });

  it("encodes slash and dot-dot in a payment id", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await getPaymentStatus("slug", "../pay");
    expect(lastUrl()).toContain("/v1/pay/slug/payments/%2E%2Epay");
  });

  it("encodes slash and dot-dot in submitPublicPayment", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await submitPublicPayment("s", "xdr", "../pay");
    expect(lastUrl()).toContain("/v1/pay/s/submit-signed");
    expect(lastUrl()).not.toContain("/v1/pay/s/../pay");
  });

  it("encodes slash and dot-dot in createPaymentIntent", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await createPaymentIntent("a/b", {});
    expect(lastUrl()).toContain("/v1/pay/a%2Fb/intent");
  });

  it("encodes slash and dot-dot in signing-info account query", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await getPublicSigningInfo("s", "a/b");
    expect(lastUrl()).toContain("/v1/pay/s/signing-info?account=a%2Fb");
  });

  it("encodes slash and dot-dot in wallet id for listPaymentLinksPage", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: { data: [] } }));
    await listPaymentLinksPage(TOKEN, "../w" as WalletId);
    expect(lastUrl()).toContain("/v1/wallets/%2E%2Ew/payment-links");
  });

  it("encodes slash and dot-dot in wallet id for listRecentPaymentLinks", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: { data: [] } }));
    await listRecentPaymentLinks(TOKEN, "../w" as WalletId);
    expect(lastUrl()).toContain("/v1/wallets/%2E%2Ew/payment-links");
  });

  it("encodes slash and dot-dot in wallet id for createPaymentLink", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await createPaymentLink(TOKEN, "../w" as WalletId, { name: "n" });
    expect(lastUrl()).toContain("/v1/wallets/%2E%2Ew/payment-links");
  });

  it("encodes slash and dot-dot in wallet id for setPaymentLinkActive", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: {} }));
    await setPaymentLinkActive(TOKEN, "../w" as WalletId, "l", true);
    expect(lastUrl()).toContain("/v1/wallets/%2E%2Ew/payment-links/l");
  });

  it("encodes slash and dot-dot in wallet id and link id for listPaymentLinkPayments", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200, { statusCode: 200, message: "ok", data: { data: [] } }));
    await listPaymentLinkPayments(TOKEN, "../w" as WalletId, "../l");
    expect(lastUrl()).toContain("/v1/wallets/%2E%2Ew/payment-links/%2E%2El/payments");
  });
});
