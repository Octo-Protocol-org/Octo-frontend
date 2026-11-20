export const metadata = { title: "Webhooks — Octo" };

import { Prose, Code, Callout, Endpoint } from "@/components/docs/DocsUI";
import { API_URL } from "@/lib/api";

export default function Webhooks() {
  return (
    <Prose>
      <p className="text-xs font-semibold uppercase tracking-wide text-burgundy-bright">
        Essentials
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-foreground">Webhooks</h1>
      <p>
        Octo notifies your backend of events by POSTing signed JSON to URLs you
        register. Today the main event is <code>deposit.created</code>, fired
        when a deposit confirms on-chain and is attributed to one of your
        addresses.
      </p>

      <h2>Register an endpoint</h2>
      <Endpoint method="POST" path="/v1/wallets/:id/webhooks" />
      <Code label="Request">{`curl -X POST ${API_URL}/v1/wallets/<WALLET_ID>/webhooks \\
  -H "authorization: Bearer octo_sk_test_ab12…" \\
  -H "content-type: application/json" \\
  -d '{ "url": "https://your.app/webhooks/octo" }'`}</Code>
      <p>
        The response includes a <strong>signing secret</strong>, shown once. You
        use it to verify deliveries.
      </p>
      <Callout type="note">
        The URL must be a public <code>http(s)</code> endpoint. Loopback and
        private addresses are rejected.
      </Callout>

      <h2>Event payload</h2>
      <Code label="POST to your URL">{`X-Octo-Signature: <hmac-sha256 hex>
Content-Type: application/json

{
  "event": "deposit.created",
  "data": {
    "id": "1f2e…",
    "wallet_id": "52775…",
    "address_id": "8d22…",
    "asset_code": "native",
    "amount_stroops": 50000000,
    "source_account": "GA…",
    "stellar_tx_hash": "7f18…",
    "memo_id": 7,
    "status": "confirmed",
    "attributed": true,
    "metadata": { "plan": "pro" }
  }
}`}</Code>
      <p>
        The <code>metadata</code> is exactly what you attached when creating the
        address — use it to reconcile the deposit to your user.
      </p>

      <h2>Verify the signature</h2>
      <p>
        Each delivery includes an <code>X-Octo-Signature</code> header: the
        lowercase hex HMAC-SHA256 of the <strong>raw request body</strong> using
        your signing secret. Recompute it and compare in constant time before
        trusting the event.
      </p>
      <Code label="Node.js">{`import crypto from "node:crypto";

function verify(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(signature, "hex");
  return receivedBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(expectedBytes, receivedBytes);
}

app.post("/webhooks/octo", (req, res) => {
  const sig = req.header("X-Octo-Signature");
  const secret = process.env.OCTO_WEBHOOK_SECRET;
  if (!verify(req.rawBody, sig, secret)) return res.status(401).end();

  let payload;
  try {
    payload = JSON.parse(req.rawBody.toString("utf8"));
  } catch {
    return res.status(400).end();
  }
  const { event, data } = payload;
  // Check a durable event key before applying the side effect and return 200 for duplicates.
  // credit data.metadata's user by data.amount_stroops …
  res.status(200).end();
});`}</Code>
      <Callout type="warning">
        Verify against the <strong>raw body bytes</strong>, not a re-serialized
        object — re-serializing can change the bytes and break the signature.
      </Callout>
      <Callout type="note">
        Deliveries can be retried or duplicated. Store a durable key such as the
        event ID (and event type), check it before applying side effects, and
        return <code>2xx</code> for a delivery that was already processed.
      </Callout>

      <h2>Delivery &amp; retries</h2>
      <ul>
        <li>Respond with a <code>2xx</code> to acknowledge.</li>
        <li>
          Non-2xx responses are retried with exponential backoff; every attempt
          is logged.
        </li>
        <li>
          Deposits are deduplicated on-chain, so design your handler to be
          idempotent.
        </li>
      </ul>
    </Prose>
  );
}
