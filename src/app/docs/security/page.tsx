import { Prose, Callout } from "@/components/docs/DocsUI";

export default function Security() {
  return (
    <Prose>
      <p className="text-xs font-semibold uppercase tracking-wide text-burgundy-bright">
        Essentials
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-foreground">Security</h1>
      <p>
        Octo is <strong>non-custodial</strong>. Each wallet&apos;s private key is
        generated in your browser (or the SDK), never transmitted to Octo, and
        never stored on our servers. We build nothing that can move your funds —
        every transaction is signed on your device.
      </p>

      <h2>Key management</h2>
      <ul>
        <li>
          Keys are generated <strong>client-side</strong> from a BIP-39
          recovery phrase and derived via <strong>SEP-0005</strong>{" "}
          (SLIP-0010 ed25519). The mnemonic is shown once at creation — store it
          out-of-band.
        </li>
        <li>
          Your key is backed up as an <strong>opaque blob encrypted under your
          password</strong> (PBKDF2-SHA256 → AES-256-GCM, in the browser). Octo
          stores this blob for recovery but <strong>cannot decrypt it</strong> —
          only your password can, and your password never leaves your device.
        </li>
        <li>
          Because we never hold your key, a full compromise of Octo&apos;s
          database and servers <strong>cannot move your funds</strong>.
        </li>
      </ul>

      <h2>Deposits &amp; transactions</h2>
      <ul>
        <li>
          Deposits are credited only when the transaction is{" "}
          <strong>successful</strong> on-chain, and are{" "}
          <strong>idempotent</strong> on the immutable operation id — a replay
          or reorg can&apos;t double-credit.
        </li>
        <li>
          Outbound transfers are <strong>built and signed on your device</strong>;
          Octo validates the signed transaction (source must be your wallet;
          operation-type allowlist) and relays it to the network. It cannot alter
          or forge a transaction — it has no key to do so.
        </li>
        <li>
          <strong>Gas sponsorship</strong> is paid from a per-wallet{" "}
          <strong>gas tank</strong>: a separate, Octo-held account that holds only
          fee float. Worst-case exposure there is the gas budget — never customer
          balances.
        </li>
      </ul>

      <h2>Credentials</h2>
      <ul>
        <li>
          Passwords are hashed with <strong>argon2id</strong>; API keys are
          stored only as a <strong>SHA-256 hash</strong> (a leak can&apos;t
          expose them).
        </li>
        <li>
          An API key can relay a transaction you signed, but it{" "}
          <strong>cannot sign</strong> one — moving funds always requires your
          key.
        </li>
      </ul>

      <Callout type="note">
        Trade-off of true non-custodial: if you lose <strong>both</strong> your
        password and your recovery phrase, your funds are unrecoverable — Octo
        cannot reset them for you. Report vulnerabilities responsibly — do not
        open public issues for security reports.
      </Callout>
    </Prose>
  );
}
