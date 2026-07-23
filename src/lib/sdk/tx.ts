/**
 * Build and sign Stellar transactions client-side, so the private key never leaves the browser.
 *
 * Each builder takes the wallet's current signing info (fetched from the server, which reads it
 * from Horizon) plus the user's Keypair, and returns a signed base64 XDR envelope ready to POST
 * to `/v1/wallets/:id/submit-signed`.
 */
import {
  Account,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-base";

export type SigningInfo = {
  account: string;
  /**
   * The account's current sequence number, as a **string** — never a JS `number`.
   *
   * Stellar sequence numbers are `(ledger << 32)`-based and are already ~1.6e16, well past
   * `Number.MAX_SAFE_INTEGER` (9.007e15). If this crosses the wire as a JSON number, `JSON.parse`
   * rounds it to the nearest float64 and silently drops the low bits — e.g. ...466433 arrives as
   * ...466432. The client then signs with a sequence one too low and Horizon rejects the
   * transaction with `tx_bad_seq` ("stale sequence number").
   *
   * Keep it a string end-to-end: `stellar-base` wants a string here anyway.
   */
  sequence: string;
  network_passphrase: string;
  base_fee_stroops: number;
};

/** stellar-base wants fees in stroops as a string, and the sequence pre-increment handled for us. */
function newBuilder(sourceAccount: string, info: SigningInfo) {
  // Account takes the CURRENT sequence; TransactionBuilder increments it for the built tx.
  // `info.sequence` is already a string — do NOT round-trip it through Number().
  const source = new Account(sourceAccount, info.sequence);
  return new TransactionBuilder(source, {
    fee: String(info.base_fee_stroops),
    networkPassphrase: info.network_passphrase,
  });
}

/** Build + sign a payment. `asset` omitted → native XLM. Amount is a decimal string (e.g. "1.5"). */
export function buildSignedPayment(
  keypair: Keypair,
  info: SigningInfo,
  params: {
    destination: string;
    amount: string;
    asset?: { code: string; issuer: string };
  },
): string {
  const asset = params.asset
    ? new Asset(params.asset.code, params.asset.issuer)
    : Asset.native();
  const tx = newBuilder(keypair.publicKey(), info)
    .addOperation(
      Operation.payment({
        destination: params.destination,
        asset,
        amount: params.amount,
      }),
    )
    .setTimeout(180)
    .build();
  tx.sign(keypair);
  return tx.toXDR();
}

/**
 * Build an UNSIGNED payment, for flows where a third-party wallet (e.g. Freighter) signs instead
 * of an in-browser Keypair — used by the public payment-link pay page.
 */
export function buildUnsignedPayment(
  sourceAccount: string,
  info: SigningInfo,
  params: {
    destination: string;
    amount: string;
    asset?: { code: string; issuer: string };
  },
): string {
  const asset = params.asset
    ? new Asset(params.asset.code, params.asset.issuer)
    : Asset.native();
  const tx = newBuilder(sourceAccount, info)
    .addOperation(
      Operation.payment({
        destination: params.destination,
        asset,
        amount: params.amount,
      }),
    )
    .setTimeout(180)
    .build();
  return tx.toXDR();
}

/** Build + sign a ChangeTrust (add a trustline, e.g. USDC). `limit` omitted → max. */
export function buildSignedChangeTrust(
  keypair: Keypair,
  info: SigningInfo,
  params: { asset: { code: string; issuer: string }; limit?: string },
): string {
  const tx = newBuilder(keypair.publicKey(), info)
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(params.asset.code, params.asset.issuer),
        ...(params.limit ? { limit: params.limit } : {}),
      }),
    )
    .setTimeout(180)
    .build();
  tx.sign(keypair);
  return tx.toXDR();
}
