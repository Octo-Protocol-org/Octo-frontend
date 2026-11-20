export const metadata = { title: "Withdrawals API — Octo" };

import { Prose, Code, Endpoint, ParamTable, Callout } from "@/components/docs/DocsUI";

export default function ApiWithdrawals() {
  return (
    <Prose>
      <p className="text-xs font-semibold uppercase tracking-wide text-burgundy-bright">
        API Reference
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-foreground">
        Withdrawals
      </h1>
      <p>
        Octo is non-custodial — the server never holds your private key, so it
        cannot sign transactions on your behalf. Withdrawals follow a
        three-step flow: fetch signing parameters, build and sign the
        transaction in the client, then relay it through a one-time-password
        confirmation.
      </p>

      <Callout type="warning">
        Withdrawals require a <strong>dashboard login token</strong>. API keys
        are rejected (<code>401</code>) so an integration credential can never
        move funds out.
      </Callout>

      <h2>Overview</h2>
      <ol>
        <li>
          <strong>Fetch signing info</strong> — get the current sequence number
          and network parameters from the server.
        </li>
        <li>
          <strong>Build and sign client-side</strong> — construct and sign the
          Stellar transaction in the browser using{" "}
          <code>@stellar/stellar-base</code>. The private key never leaves the
          client.
        </li>
        <li>
          <strong>Request OTP</strong> — POST the signed XDR to{" "}
          <code>withdraw/request-otp</code>; the server emails a one-time code
          bound to that exact transaction.
        </li>
        <li>
          <strong>Confirm</strong> — POST the same signed XDR plus the OTP to{" "}
          <code>withdraw/confirm</code>; only on a valid code does the server
          relay the transaction to Horizon.
        </li>
      </ol>

      <Callout type="note">
        For non-payment operations (e.g. adding a trustline) there is no OTP
        step — use <code>POST /v1/wallets/:id/submit-signed</code> directly
        after signing.
      </Callout>

      <h2>Step 1 — Fetch signing info</h2>
      <Endpoint method="GET" path="/v1/wallets/:id/signing-info" />
      <p>
        Returns the data needed to build a valid transaction: the wallet&apos;s
        current account address, sequence number, network passphrase, and base
        fee. The sequence number is returned as a <strong>string</strong> to
        preserve precision (it exceeds{" "}
        <code>Number.MAX_SAFE_INTEGER</code>).
      </p>
      <Code label="Request">{`curl http://localhost:8080/v1/wallets/<WALLET_ID>/signing-info \\
  -H "authorization: Bearer <LOGIN_TOKEN>"`}</Code>
      <Code label="Response (200)">{`{
  "data": {
    "account": "GBYK…",
    "sequence": "1738329065660417",
    "network_passphrase": "Test SDF Network ; September 2015",
    "base_fee_stroops": 100,
    "base_reserve_stroops": 5000000,
    "subentry_count": 1,
    "num_sponsoring": 0,
    "num_sponsored": 0
  }
}`}</Code>

      <h2>Step 2 — Build and sign the transaction</h2>
      <p>
        Use <code>@stellar/stellar-base</code> to build the transaction
        client-side. Octo&apos;s SDK exports{" "}
        <code>buildSignedPayment</code> and{" "}
        <code>buildSignedCreateAccount</code> as thin wrappers. Pass the
        signing info from step 1 and the wallet&apos;s <code>Keypair</code>.
        Both return a base64-encoded signed XDR envelope.
      </p>
      <Code label="TypeScript (XLM payment)">{`import { buildSignedPayment } from "@/lib/sdk/tx";

// signingInfo: the response from GET /signing-info
// keypair: Keypair loaded from the user's decrypted seed
const signedXdr = buildSignedPayment(keypair, signingInfo, {
  destination: "G…DEST",
  amount: "10",          // decimal XLM string, e.g. "10" = 10 XLM
});`}</Code>
      <Code label="TypeScript (new account)">{`import { buildSignedCreateAccount } from "@/lib/sdk/tx";

// Use CreateAccount when the destination account doesn't exist yet.
// startingBalance must be at least 1 XLM (2 × base reserve).
const signedXdr = buildSignedCreateAccount(keypair, signingInfo, {
  destination: "G…NEWACCT",
  startingBalance: "1",  // decimal XLM string
});`}</Code>

      <h2>Step 3 — Request OTP</h2>
      <Endpoint method="POST" path="/v1/wallets/:id/withdraw/request-otp" />
      <p>
        POST the signed XDR. The server validates the transaction, then emails
        a short-lived OTP to the wallet owner. The code is cryptographically
        bound to the exact XDR — submitting a different transaction later will
        fail.
      </p>
      <ParamTable
        rows={[
          {
            name: "transaction_xdr",
            type: "string",
            required: true,
            desc: "The signed transaction envelope (base64 XDR) from step 2.",
          },
        ]}
      />
      <Code label="Request">{`curl -X POST http://localhost:8080/v1/wallets/<WALLET_ID>/withdraw/request-otp \\
  -H "authorization: Bearer <LOGIN_TOKEN>" \\
  -H "content-type: application/json" \\
  -d '{ "transaction_xdr": "<SIGNED_XDR>" }'`}</Code>
      <Code label="Response (200)">{`{ "data": { "sent": true } }`}</Code>

      <h2>Step 4 — Confirm with OTP</h2>
      <Endpoint method="POST" path="/v1/wallets/:id/withdraw/confirm" />
      <p>
        POST the same signed XDR plus the OTP code the user received by email.
        On a valid code the server relays the transaction to Horizon and returns
        the result.
      </p>
      <ParamTable
        rows={[
          {
            name: "transaction_xdr",
            type: "string",
            required: true,
            desc: "The same signed XDR sent in step 3.",
          },
          {
            name: "code",
            type: "string",
            required: true,
            desc: "The OTP code from the confirmation email.",
          },
        ]}
      />
      <Code label="Request">{`curl -X POST http://localhost:8080/v1/wallets/<WALLET_ID>/withdraw/confirm \\
  -H "authorization: Bearer <LOGIN_TOKEN>" \\
  -H "content-type: application/json" \\
  -d '{ "transaction_xdr": "<SIGNED_XDR>", "code": "847291" }'`}</Code>
      <Code label="Response (200)">{`{
  "data": {
    "status": "confirmed",
    "stellar_tx_hash": "9c0d…"
  }
}`}</Code>
      <p>
        <code>status</code> is <code>confirmed</code> when the transaction
        succeeded on-chain, or <code>failed</code> if Horizon rejected it (the
        OTP was still valid — the on-chain failure is in{" "}
        <code>detail</code>).
      </p>

      <h2>submit-signed (non-payment operations)</h2>
      <Endpoint method="POST" path="/v1/wallets/:id/submit-signed" />
      <p>
        Operations that don&apos;t move funds (e.g. adding a USDC trustline via{" "}
        <code>buildSignedChangeTrust</code>) skip the OTP flow entirely. Sign
        client-side and POST directly to <code>submit-signed</code>.
      </p>
      <ParamTable
        rows={[
          {
            name: "transaction_xdr",
            type: "string",
            required: true,
            desc: "The signed transaction envelope (base64 XDR).",
          },
        ]}
      />
      <Code label="Request">{`curl -X POST http://localhost:8080/v1/wallets/<WALLET_ID>/submit-signed \\
  -H "authorization: Bearer <LOGIN_TOKEN>" \\
  -H "content-type: application/json" \\
  -d '{ "transaction_xdr": "<SIGNED_XDR>" }'`}</Code>
      <Code label="Response (200)">{`{
  "data": {
    "status": "confirmed",
    "stellar_tx_hash": "a1b2…"
  }
}`}</Code>
    </Prose>
  );
}
