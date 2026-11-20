/**
 * Password-based encryption of the wallet seed for backup.
 *
 * The mnemonic is encrypted under a key derived from the user's password (PBKDF2-SHA256, 600k
 * iterations per current OWASP guidance) using AES-256-GCM. The resulting blob is opaque: it can
 * be stored anywhere — including on Octo's servers — without exposing the seed, because only the
 * password (which never leaves the client) can decrypt it.
 *
 * Uses the native WebCrypto API only (no wasm), so it runs in any modern browser.
 */

const PBKDF2_ITERATIONS = 600_000;
const MIN_ITERATIONS = 600_000;
const MAX_ITERATIONS = 10_000_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;

const MALFORMED_BACKUP = "Malformed or unrecognized backup.";

/** Thrown by `decryptSeed` when the password is wrong (or the ciphertext was tampered with). */
export class WrongPasswordError extends Error {
  constructor() {
    super("Incorrect password or corrupted backup.");
    this.name = "WrongPasswordError";
  }
}

export type EncryptedBackup = {
  /** Format version, for forward-compatibility. */
  v: 1;
  kdf: "PBKDF2-SHA256";
  iter: number;
  /** base64 */
  salt: string;
  /** base64 */
  nonce: string;
  /** base64 (AES-GCM ciphertext incl. auth tag) */
  ciphertext: string;
};

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Random bytes backed by a plain ArrayBuffer (satisfies WebCrypto's BufferSource typing). */
function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(out);
  return out;
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const pwBytes = new TextEncoder().encode(password);
  const material = await crypto.subtle.importKey(
    "raw",
    pwBytes as Uint8Array<ArrayBuffer>,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt `plaintext` (the mnemonic) under `password`. Returns a JSON-serializable blob. */
export async function encryptSeed(
  plaintext: string,
  password: string,
): Promise<EncryptedBackup> {
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ptBytes = new TextEncoder().encode(plaintext) as Uint8Array<ArrayBuffer>;
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, ptBytes);
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter: PBKDF2_ITERATIONS,
    salt: toB64(salt),
    nonce: toB64(nonce),
    ciphertext: toB64(new Uint8Array(ct)),
  };
}

/** Decrypt a backup blob with `password`. Throws if the password is wrong or the blob is bad. */
export async function decryptSeed(
  backup: EncryptedBackup,
  password: string,
): Promise<string> {
  assertValidBackup(backup);
  const salt = fromB64(backup.salt);
  const nonce = fromB64(backup.nonce);
  const key = await deriveKey(password, salt, backup.iter);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      fromB64(backup.ciphertext),
    );
  } catch {
    throw new WrongPasswordError();
  }
  return new TextDecoder().decode(plain);
}

/** Serialize a backup blob to the string the server stores. */
export function serializeBackup(backup: EncryptedBackup): string {
  return JSON.stringify(backup);
}

/** AES-GCM tag (16 bytes) plus bounds for a mnemonic of up to 24 words. */
const MIN_CIPHERTEXT_BYTES = 17;
const MAX_CIPHERTEXT_BYTES = 1024;

/** Validate KDF parameters and field sizes; throws on anything out of range. */
export function assertValidBackup(b: unknown): asserts b is EncryptedBackup {
  const x = b as EncryptedBackup | null;
  if (!x || typeof x !== "object" || x.v !== 1 || x.kdf !== "PBKDF2-SHA256") {
    throw new Error(MALFORMED_BACKUP);
  }
  if (typeof x.iter !== "number" || !Number.isInteger(x.iter) || x.iter < MIN_ITERATIONS || x.iter > MAX_ITERATIONS) {
    throw new Error(MALFORMED_BACKUP);
  }
  if (typeof x.salt !== "string" || typeof x.nonce !== "string" || typeof x.ciphertext !== "string") {
    throw new Error(MALFORMED_BACKUP);
  }
  let salt: Uint8Array;
  let nonce: Uint8Array;
  let ct: Uint8Array;
  try {
    salt = fromB64(x.salt);
    nonce = fromB64(x.nonce);
    ct = fromB64(x.ciphertext);
  } catch {
    throw new Error(MALFORMED_BACKUP);
  }
  if (salt.length !== SALT_BYTES || nonce.length !== NONCE_BYTES) {
    throw new Error(MALFORMED_BACKUP);
  }
  if (ct.length < MIN_CIPHERTEXT_BYTES || ct.length > MAX_CIPHERTEXT_BYTES) {
    throw new Error(MALFORMED_BACKUP);
  }
}

/** Parse a backup blob string; throws if malformed or if KDF parameters are out of range. */
export function parseBackup(s: string): EncryptedBackup {
  let b: unknown;
  try {
    b = JSON.parse(s);
  } catch {
    throw new Error(MALFORMED_BACKUP);
  }
  assertValidBackup(b);
  return b;
}
