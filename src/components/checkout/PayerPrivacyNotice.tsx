/** Tells the payer who receives the name and email they enter on checkout. */
export function PayerPrivacyNotice({
  merchantName,
  linkOnly = false,
}: {
  merchantName: string;
  linkOnly?: boolean;
}) {
  if (linkOnly) {
    return (
      <a
        id="payer-privacy-notice"
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:no-underline"
      >
        Privacy Policy
      </a>
    );
  }

  return (
    <p id="payer-privacy-notice" className="mt-1 text-[11px] text-gray-500">
      Shared with {merchantName} and Octo to process this payment. See our{" "}
      <a
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:no-underline"
      >
        Privacy Policy
      </a>
      .
    </p>
  );
}