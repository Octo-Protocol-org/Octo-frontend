export const metadata = { title: "API Overview — Octo" };

import Link from "next/link";
import { Prose, Code } from "@/components/docs/DocsUI";
import { API_URL } from "@/lib/api";

export default function ApiOverview() {
  return (
    <Prose>
      <p className="text-xs font-semibold uppercase tracking-wide text-burgundy-bright">
        API Reference
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-foreground">Overview</h1>

      <p>
        The Octo API is a JSON REST API. The base URL is <code>{API_URL}</code>{" "}
        (<code>http://localhost:8080</code> when running the backend locally).
      </p>

      <h2>Response envelope</h2>
      <p>Every response uses the same envelope:</p>
      <Code>{`{
  "statusCode": 200,
  "message": "OK",
  "data": { /* object or array */ }
}`}</Code>
      <ul>
        <li>
          <code>statusCode</code> — mirrors the HTTP status.
        </li>
        <li>
          <code>message</code> — a short human-readable summary, or the error
          reason.
        </li>
        <li>
          <code>data</code> — the result (object or array), or <code>null</code>{" "}
          on error.
        </li>
      </ul>

      <h2>Errors</h2>
      <p>Errors use standard HTTP status codes and the same envelope:</p>
      <ul>
        <li>
          <code>400</code> — invalid request (bad input).
        </li>
        <li>
          <code>401</code> — missing or invalid credentials.
        </li>
        <li>
          <code>404</code> — not found, or not authorized for this resource.
        </li>
        <li>
          <code>409</code> — conflict (e.g. a reused idempotency key).
        </li>
      </ul>

      <h2>Webhooks</h2>
      <p>
        Register webhook endpoints with{" "}
        <code>POST /v1/wallets/:id/webhooks</code> and keep the signing secret
        that is shown once. You can also manage endpoints — list, add, rotate
        the secret, and delete — from the dashboard{" "}
        <Link href="/dashboard">Webhooks page</Link> for each wallet, without
        using curl.
      </p>

      <p>
        Next: <Link href="/docs/api/authentication">Authentication</Link>.
      </p>
    </Prose>
  );
}
