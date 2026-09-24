import { describe, expect, it } from 'vitest';
import { isTrustedImageUrl } from './isTrustedImageUrl';

describe('isTrustedImageUrl', () => {
  it('accepts https URLs on res.cloudinary.com', () => {
    expect(isTrustedImageUrl('https://res.cloudinary.com/demo/image/upload/sample.png')).toBe(true);
  });

  it('rejects http URLs', () => {
    expect(isTrustedImageUrl('http://res.cloudinary.com/demo/image/upload/sample.png')).toBe(false);
  });

  it('rejects other hosts', () => {
    expect(isTrustedImageUrl('https://evil.example.com/tracker.png')).toBe(false);
  });

  it('rejects lookalike hosts', () => {
    expect(isTrustedImageUrl('https://res.cloudinary.com.evil.example.com/tracker.png')).toBe(false);
  });

  it('rejects empty, null, and malformed values', () => {
    expect(isTrustedImageUrl('')).toBe(false);
    expect(isTrustedImageUrl(null)).toBe(false);
    expect(isTrustedImageUrl(undefined)).toBe(false);
    expect(isTrustedImageUrl('not a url')).toBe(false);
  });
});
