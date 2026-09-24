import { describe, it, expect } from 'vitest';
import { parseBackup } from './crypto';

const VALID_SALT = new Uint8Array(16).fill(1);
const VALID_NONCE = new Uint8Array(12).fill(2);
const VALID_CIPHERTEXT = new Uint8Array(32).fill(3);

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function makeBackup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    v: 1,
    kdf: 'pbkdf2-sha256',
    iter: 600_000,
    salt: toBase64(VALID_SALT),
    nonce: toBase64(VALID_NONCE),
    ciphertext: toBase64(VALID_CIPHERTEXT),
    ...overrides,
  });
}

describe('parseBackup', () => {
  it('parses a well-formed backup', () => {
    const backup = parseBackup(makeBackup());
    expect(backup.iter).toBe(600_000);
    expect(backup.salt).toEqual(VALID_SALT);
    expect(backup.nonce).toEqual(VALID_NONCE);
  });

  it('rejects an iter below the sane range', () => {
    expect(() => parseBackup(makeBackup({ iter: 599_999 }))).toThrow();
  });

  it('rejects an iter above the sane range', () => {
    expect(() => parseBackup(makeBackup({ iter: 10_000_001 }))).toThrow();
  });

  it('rejects a non-numeric iter', () => {
    expect(() => parseBackup(makeBackup({ iter: '600000' }))).toThrow();
  });

  it('rejects a salt that is not 16 bytes', () => {
    expect(() => parseBackup(makeBackup({ salt: toBase64(new Uint8Array(15)) }))).toThrow();
  });

  it('rejects a nonce that is not 12 bytes', () => {
    expect(() => parseBackup(makeBackup({ nonce: toBase64(new Uint8Array(11)) }))).toThrow();
  });
});
