/** Small animated octopus used as the app's loading indicator: blinks and swings its tentacles. */
export function OctoSpinner({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={`octo-spinner shrink-0 ${className}`}
    >
      <g className="octo-spinner-tentacles" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none">
        <path className="octo-tentacle octo-tentacle-1" d="M20 40 C14 46 14 52 20 56" />
        <path className="octo-tentacle octo-tentacle-2" d="M27 44 C24 51 26 56 31 58" />
        <path className="octo-tentacle octo-tentacle-3" d="M37 44 C40 51 38 56 33 58" />
        <path className="octo-tentacle octo-tentacle-4" d="M44 40 C50 46 50 52 44 56" />
      </g>
      <circle cx="32" cy="30" r="20" fill="currentColor" />
      <g className="octo-spinner-eyes octo-spinner-face">
        <circle className="octo-eye" cx="24" cy="28" r="4" />
        <circle className="octo-eye" cx="40" cy="28" r="4" />
      </g>
      <path
        className="octo-smile octo-spinner-face"
        d="M24 37 Q32 43 40 37"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Full-page loading state, for pages waiting on auth/data before they can render. */
export function PageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <OctoSpinner size={40} />
    </div>
  );
}
