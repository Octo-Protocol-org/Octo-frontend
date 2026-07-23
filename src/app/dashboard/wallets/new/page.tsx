import { connection } from "next/server";
import { NewWalletClient } from "./NewWalletClient";

// This page generates a wallet key in the browser, so it must run under the strict nonce-based
// CSP (see src/proxy.ts). Awaiting `connection()` opts the route into dynamic rendering, which is
// what lets Next stamp the per-request CSP nonce onto the page's scripts (a statically
// prerendered shell would ship without the nonce and be blocked by the strict CSP).
export default async function NewWalletPage() {
  await connection();
  return <NewWalletClient />;
}
