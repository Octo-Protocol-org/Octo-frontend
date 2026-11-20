/** Returns `next` only if it is a same-origin path; browsers treat `\` as `/` and strip tabs/newlines, so reject both. */
export function safeNextPath(next: unknown): string | undefined {
  return typeof next === "string" && /^\/(?![/\\])[^\\\u0000-\u001f\u007f]*$/.test(next) ? next : undefined;
}
