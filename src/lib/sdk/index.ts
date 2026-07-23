/**
 * Octo non-custodial SDK (internal module; extractable to `@octo/sdk`).
 *
 * The full client-side flow: generate/recover a key, encrypt it for backup, build + sign
 * transactions locally, and relay the signed XDR to Octo. The private key never leaves here.
 */
export { generateWallet, fromMnemonic, keypairFromRawSeed } from "./keys";
export type { WalletKeys } from "./keys";

export { encryptSeed, decryptSeed, serializeBackup, parseBackup } from "./crypto";
export type { EncryptedBackup } from "./crypto";

export { buildSignedPayment, buildSignedChangeTrust, buildUnsignedPayment } from "./tx";
export type { SigningInfo } from "./tx";

export { getSigningInfo, submitSigned, getBackup } from "./client";
export type { SubmitResult } from "./client";

export { saveLocalBackup, loadLocalBackup, clearLocalBackups } from "./store";

export { unlockWallet } from "./unlock";
