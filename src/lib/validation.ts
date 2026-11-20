/**
 * Shared email validation and normalization helpers.
 *
 * This is the single source of truth for email validation across the app
 * (signup, login, password reset, checkout, etc.). Do not duplicate the
 * regex elsewhere.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trim surrounding whitespace from an email address.
 *
 * We intentionally do NOT lowercase the local part (the portion before the
 * `@`), since it may be case-sensitive per RFC 5321. Comparisons that need to
 * be case-insensitive should be done explicitly by the caller.
 */
export function normalizeEmail(email: string): string {
  return email.trim();
}

/**
 * Validate an email address.
 *
 * Trims surrounding whitespace before validating, so inputs like
 * `"user@example.com "` are accepted. Returns `false` for non-string input.
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") {
    return false;
  }
  return EMAIL_PATTERN.test(email.trim());
}