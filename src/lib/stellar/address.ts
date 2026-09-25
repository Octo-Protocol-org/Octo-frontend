import { StrKey, MuxedAccount } from "@stellar/stellar-base";

export type StellarAddressKind = "ed25519" | "med25519";

// Accepts account (G...) and muxed account (M...) StrKeys.
export function isValidStellarAddress(value: string): boolean {
  const address = value.trim();
  return (
    StrKey.isValidEd25519PublicKey(address) ||
    StrKey.isValidMed25519PublicKey(address)
  );
}

export function getStellarAddressKind(
  value: string,
): StellarAddressKind | null {
  const address = value.trim();
  if (StrKey.isValidEd25519PublicKey(address)) return "ed25519";
  if (StrKey.isValidMed25519PublicKey(address)) return "med25519";
  return null;
}

// The underlying G... account of a valid address (muxed M... addresses share their base account).
export function baseAccountOf(value: string): string {
  const address = value.trim();
  return StrKey.isValidMed25519PublicKey(address)
    ? MuxedAccount.fromAddress(address, "0").baseAccount().accountId()
    : address;
}

// Returns an inline error message, or null when the address is valid.
export function validateStellarAddress(
  value: string,
  options: { ownAddress?: string } = {},
): string | null {
  const address = value.trim();
  if (!address) return "Enter a Stellar address.";
  if (!isValidStellarAddress(address)) {
    return "Enter a valid Stellar address (G... or M...).";
  }
  if (options.ownAddress && address === options.ownAddress.trim()) {
    return "This is your own wallet address.";
  }
  return null;
}
