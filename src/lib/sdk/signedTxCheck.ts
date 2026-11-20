import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-base";
import { baseAccountOf } from "@/lib/stellar/address";

function parseTx(xdr: string, passphrase: string): Transaction {
  const decoded = TransactionBuilder.fromXDR(xdr, passphrase);
  return decoded instanceof Transaction ? decoded : decoded.innerTransaction;
}

/** True when at least one signature on `tx` verifies against the source account's key. */
export function verifySourceSignature(tx: Transaction): boolean {
  const signer = Keypair.fromPublicKey(baseAccountOf(tx.source));
  const hash = tx.hash();
  return tx.signatures.some((sig) => signer.verify(hash, sig.signature()));
}

export const SIGNED_TX_MISMATCH_MESSAGE =
  "Freighter returned a different transaction than the one you approved. Nothing was sent.";

/**
 * Throw unless `signedXdr` is the same transaction as `unsignedXdr` (equal hash; signatures do
 * not change the hash) and carries a valid signature from its source account.
 */
export function assertSignedMatchesBuilt(
  unsignedXdr: string,
  signedXdr: string,
  passphrase: string,
): void {
  let ok = false;
  try {
    const built = parseTx(unsignedXdr, passphrase);
    const signed = parseTx(signedXdr, passphrase);
    ok = built.hash().equals(signed.hash()) && verifySourceSignature(signed);
  } catch {
    ok = false;
  }
  if (!ok) throw new Error(SIGNED_TX_MISMATCH_MESSAGE);
}
