/** Wallet-encryption password policy, backed by a lazily loaded zxcvbn-ts estimator. */

import type { ZxcvbnFactory } from "@zxcvbn-ts/core";

/** The backup blob sits on the server, so this password is the only barrier to offline guessing. */
export const MIN_PASSWORD_LENGTH = 12;

/** zxcvbn score (0–4) required to accept a password; 3 = "safely unguessable" offline. */
export const MIN_PASSWORD_SCORE = 3;

export const STRENGTH_LABELS = [
  "Very weak",
  "Weak",
  "Fair",
  "Strong",
  "Very strong",
] as const;

export type PasswordAssessment = {
  score: 0 | 1 | 2 | 3 | 4;
  label: (typeof STRENGTH_LABELS)[number];
  acceptable: boolean;
  /** Human-readable reasons/suggestions, most important first. */
  feedback: string[];
};

let estimator: Promise<ZxcvbnFactory> | null = null;

// Dictionaries are ~1 MB, so load them only once the user starts typing a password.
function loadEstimator(): Promise<ZxcvbnFactory> {
  estimator ??= Promise.all([
    import("@zxcvbn-ts/core"),
    import("@zxcvbn-ts/language-common"),
    import("@zxcvbn-ts/language-en"),
  ])
    .then(
      ([core, common, en]) =>
        new core.ZxcvbnFactory({
          dictionary: { ...common.dictionary, ...en.dictionary },
          graphs: common.adjacencyGraphs,
          translations: en.translations,
          useLevenshteinDistance: true,
        }),
    )
    .catch((err) => {
      // Allow a retry after a transient chunk-load failure instead of caching the rejection.
      estimator = null;
      throw err;
    });
  return estimator;
}

/** Warm the estimator ahead of the first keystroke (e.g. on focus). */
export function preloadPasswordEstimator(): void {
  loadEstimator().catch(() => {});
}

/** Score a password; `userInputs` (wallet name, email…) are penalised as guessable. Rejects if the estimator can't load. */
export async function assessPassword(
  password: string,
  userInputs: string[] = [],
): Promise<PasswordAssessment> {
  const zxcvbn = await loadEstimator();
  const result = zxcvbn.check(password, userInputs.filter(Boolean));
  const feedback = [
    ...(password.length < MIN_PASSWORD_LENGTH
      ? [`Use at least ${MIN_PASSWORD_LENGTH} characters.`]
      : []),
    ...(result.feedback.warning ? [result.feedback.warning] : []),
    ...result.feedback.suggestions,
  ];
  return {
    score: result.score,
    label: STRENGTH_LABELS[result.score],
    acceptable:
      password.length >= MIN_PASSWORD_LENGTH && result.score >= MIN_PASSWORD_SCORE,
    feedback,
  };
}
