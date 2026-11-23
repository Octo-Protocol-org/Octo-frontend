/**
 * Octo non-custodial SDK (internal module; extractable to `@octo/sdk`).
 *
 * The full client-side flow: generate/recover a key, encrypt it for backup, build + sign
 * transactions locally, and relay the signed XDR to Octo. The private key never leaves here.
 *
 * Password hygiene: the decrypted keypair is only needed for the instant of signing. Callers
 * must clear the password from state in a `finally` right after signing and never retain the
 * `Keypair` in state or refs beyond the submit function.
 */
export { generateWallet, fromMnemonic, keypairFromRawSeed } from "./keys";
export type { WalletKeys } from "./keys";

export { encryptSeed, decryptSeed, serializeBackup, parseBackup, WrongPasswordError } from "./crypto";
export type { EncryptedBackup } from "./crypto";

export {
  buildSignedPayment,
  buildSignedChangeTrust,
  buildSignedCreateAccount,
  buildUnsignedPayment,
  txExpiresAt,
  describeSignedWithdrawal,
  TX_TIMEOUT_SECONDS,
  validateMemo,
} from "./tx";
export type { SigningInfo, Memo, SignedWithdrawalDetails } from "./tx";

export {
  getSigningInfo,
  submitSigned,
  getBackup,
  uploadBackup,
  requestWithdrawOtp,
  confirmWithdraw,
  getAccountExists,
} from "./client";
export type { SubmitResult } from "./client";

export { saveLocalBackup, loadLocalBackup, clearLocalBackups, versionOf, markPhraseUnconfirmed, markPhraseConfirmed, isPhraseUnconfirmed, listUnconfirmedPhraseWalletIds } from "./store";

export { unlockWallet, unlockBackup } from "./unlock";

export { MIN_FEE_STROOPS, MAX_FEE_STROOPS, validateFee, getFeeStroops } from "./tx";
export { assertNetworkConsistency, isConfiguredNetwork } from "./network";
