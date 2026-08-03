import { Prose, Code, Endpoint, ParamTable, Callout } from "@/components/docs/DocsUI";

export default function Checkout() {
  return (
    <Prose>
      <p className="text-xs font-semibold uppercase tracking-wide text-burgundy-bright">
        API Reference
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-foreground">
        Payment Links (Checkout)
      </h1>
      <p>
        A payment link is a hosted checkout page backed by a dedicated Stellar/USDC
        deposit address. Integrating one into your own checkout is server-to-server —
        create a link with your API key, get back a ready-to-use URL, and get notified
        when it&apos;s paid. No SDK or client-side signing required on your end.
      </p>

      <h2>Create a payment link</h2>
      <Endpoint method="POST" path="/v1/wallets/:id/payment-links" />
      <ParamTable
        rows={[
          {
            name: "name",
            type: "string",
            required: true,
            desc: "Shown to the payer on the checkout page.",
          },
          {
            name: "description",
            type: "string",
            desc: "Optional detail shown below the amount.",
          },
          {
            name: "image_url",
            type: "string",
            desc: "Optional image shown on the checkout page.",
          },
          {
            name: "amount_usdc_stroops",
            type: "integer",
            desc: "Fixed amount in USDC stroops (7dp). Omit for a flexible amount the payer enters themselves.",
          },
          {
            name: "redirect_url",
            type: "string",
            desc: "Where to send the payer's browser after a confirmed payment. See “Redirect back to your site” below.",
          },
        ]}
      />
      <Code label="Request">{`curl -X POST http://localhost:8080/v1/wallets/<WALLET_ID>/payment-links \\
  -H "authorization: Bearer octo_sk_test_ab12…" \\
  -H "content-type: application/json" \\
  -d '{
    "name": "Pro plan — 1 month",
    "amount_usdc_stroops": 250000000,
    "redirect_url": "https://your-site.com/thank-you"
  }'`}</Code>
      <Code label="Response (201)">{`{
  "statusCode": 201,
  "message": "Created",
  "data": {
    "id": "b41a…",
    "slug": "ab12cd34ef",
    "name": "Pro plan — 1 month",
    "description": null,
    "image_url": null,
    "redirect_url": "https://your-site.com/thank-you",
    "amount_usdc_stroops": 250000000,
    "active": true,
    "collected_usdc_stroops": 0,
    "created_at": "2026-08-03T09:12:00Z",
    "url": "https://app.octo.dev/pay/ab12cd34ef"
  }
}`}</Code>

      <h2>Share the checkout URL</h2>
      <p>
        <code>data.url</code> is the full hosted checkout page — link it, embed it,
        or put it in an iframe. Octo handles wallet connection, signing, and payment
        confirmation on that page; nothing else is required on your side.
      </p>

      <h2>The public checkout flow</h2>
      <p>
        The hosted page already implements the flow below — this is reference only,
        for understanding what happens behind the URL.
      </p>
      <Endpoint method="GET" path="/v1/pay/:slug" />
      <Endpoint method="POST" path="/v1/pay/:slug/intent" />
      <Endpoint method="GET" path="/v1/pay/:slug/payments/:payment_id" />
      <Endpoint method="POST" path="/v1/pay/:slug/submit-signed" />

      <h2>
        Get notified: the <code>payment_link.paid</code> webhook
      </h2>
      <p>
        Register a webhook endpoint (see{" "}
        <a href="/docs/webhooks">Webhooks</a>) to be notified the moment a payment
        confirms on-chain.
      </p>
      <Code label="POST to your URL">{`{
  "event": "payment_link.paid",
  "data": {
    "payment_link_id": "b41a…",
    "payment_id": "7c3e…",
    "slug": "ab12cd34ef",
    "payer_name": "Jane Doe",
    "payer_email": "jane@example.com",
    "amount_usdc_stroops": 250000000,
    "stellar_tx_hash": "9c0d…"
  }
}`}</Code>

      <h2>Redirect back to your site</h2>
      <p>
        If you set <code>redirect_url</code> when creating the link, the checkout
        page redirects the payer&apos;s browser there shortly after their payment is
        confirmed, with query params appended:
      </p>
      <Code label="Redirect">{`https://your-site.com/thank-you?status=success&payment_id=7c3e…&slug=ab12cd34ef`}</Code>
      <Callout type="warning">
        This redirect is UX only. Always confirm a payment via the{" "}
        <code>payment_link.paid</code> webhook, not the redirect query params — a
        customer could reload or hand-craft the URL themselves.
      </Callout>
    </Prose>
  );
}
