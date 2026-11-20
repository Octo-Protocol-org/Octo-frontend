import Link from "next/link";

export const metadata = { title: "Terms of Service — Octo" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ‹ Home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 1 June 2025</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="text-base font-semibold text-foreground">1. Acceptance of these terms</h2>
          <p className="mt-2">
            By accessing or using Octo (the &quot;Service&quot;), you agree to be bound by these Terms of Service. If you do
            not agree to these terms, do not use the Service. You must be at least 18 years old and legally able to enter
            into a binding agreement to use Octo.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">2. Non-custodial model</h2>
          <p className="mt-2">
            Octo is a non-custodial service. We never hold, control, or have access to your private keys, recovery phrase,
            wallet encryption password, or funds. Your wallet is created and encrypted in your browser, and only you can
            unlock it. Because we do not hold your keys or funds, we cannot recover your wallet, reverse transactions, or
            restore access on your behalf.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">3. Your responsibilities</h2>
          <p className="mt-2">
            You are solely responsible for safeguarding your recovery phrase and wallet encryption password. Store them
            securely and offline, and never share them with anyone, including anyone claiming to represent Octo. If you
            lose your recovery phrase or encryption password, you will permanently lose access to your wallet and funds.
            You are also responsible for the security of the device and browser you use to access the Service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">4. Irreversible transactions</h2>
          <p className="mt-2">
            Blockchain transactions are irreversible. Once a transaction is signed and broadcast, it cannot be cancelled,
            reversed, or refunded by Octo. You are responsible for verifying all transaction details, including recipient
            addresses and amounts, before confirming. Octo is not liable for any loss resulting from transactions you
            authorize, including those sent to incorrect addresses.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">5. Acceptable use</h2>
          <p className="mt-2">
            You agree to use the Service only for lawful purposes and in compliance with all applicable laws and
            regulations. You must not use Octo to engage in fraud, money laundering, terrorist financing, sanctions
            evasion, or any other illegal activity; to infringe the rights of others; to distribute malware or attempt to
            compromise the Service; or to interfere with the operation of the Service or the networks it relies on. We may
            restrict or suspend access to the Service where we reasonably believe these terms have been violated.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">6. Third-party services</h2>
          <p className="mt-2">
            The Service relies on third-party infrastructure, including blockchain networks, RPC providers, and
            decentralized storage. We do not control these networks and are not responsible for their availability,
            performance, or security. Your use of third-party services may be subject to their own terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">7. No warranty</h2>
          <p className="mt-2">
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether
            express or implied, including warranties of merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or free of harmful
            components.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">8. Limitation of liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, Octo and its contributors will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or for any loss of funds, data, or profits, arising
            out of or related to your use of the Service. This includes losses resulting from lost keys, user error,
            irreversible transactions, or third-party failures.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">9. Changes to these terms</h2>
          <p className="mt-2">
            We may update these terms from time to time. When we do, we will revise the &quot;Last updated&quot; date
            above. Your continued use of the Service after changes take effect constitutes acceptance of the revised
            terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">10. Contact</h2>
          <p className="mt-2">
            If you have questions about these terms, please reach out to the Octo team through the contact channels listed
            in the project repository.
          </p>
        </section>
      </div>
    </main>
  );
}