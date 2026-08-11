/** Line-style nav icons, matching the sidebar's minimal glyph aesthetic — used where a plain
 * unicode character doesn't read clearly enough (e.g. the gas-pump emoji it replaces). */

export function GasPumpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16" />
      <path d="M3 21h10" />
      <path d="M6 9h4" />
      <path d="M12 8h2.5L18 11.5V18a1.5 1.5 0 0 0 3 0v-6.7a1 1 0 0 0-.3-.7L17 7" />
    </svg>
  );
}
