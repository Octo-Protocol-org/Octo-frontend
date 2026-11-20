import Link from "next/link";

export const metadata = { title: "Privacy Policy — Octo" };

const LAST_UPDATED = "February 1, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ‹ Home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        This Privacy Policy explains what personal data Octo collects, how we use and retain it, who we share it with, and the choices you have. Octo is a non-custodial service: we never hold your funds, and we never have access to your wallet encryption password or private keys.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Data we collect</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        <strong className="text-foreground">Account data.</strong> When you create an account we collect the email address you provide. We use it to authenticate you, send transactional messages such as sign-in and security notices, and contact you about your account.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        <strong className="text-foreground">Checkout payer data.</strong> When someone pays one of your payment links, we collect the payer name and email address they enter at checkout. We use this to identify the payment, show it to you as the link owner, and send the payer a receipt or confirmation. If you are a payer, the operator of the payment link you are paying can see the name and email you submit.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        <strong className="text-foreground">Content you upload.</strong> If you add images to a payment link, those images are stored with our image-hosting processor. Do not upload sensitive personal data in images.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        <strong className="text-foreground">Technical data.</strong> We process limited technical information needed to operate and secure the service, such as request logs and error reports.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        <strong className="text-foreground">What we never collect.</strong> We do not collect your wallet encryption password, your private keys, or your seed phrase. These stay on your device and are never transmitted to Octo. Because we do not hold them, we cannot recover them for you or move funds on your behalf.
      </p>

      <h2 className="mt-8 text-xl font-semibold">How we use your data</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        We use personal data to provide and secure the service, authenticate accounts, process and display payments, send transactional email, respond to support requests, prevent abuse and fraud, and comply with applicable law. We do not sell your personal data.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Processors we share data with</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        We share personal data with service providers who process it on our behalf and only for the purposes described above:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted">
        <li>
          <strong className="text-foreground">Cloudinary</strong> — image hosting and delivery for images attached to payment links.
        </li>
        <li>
          <strong className="text-foreground">Our email provider</strong> — delivery of transactional messages such as sign-in codes, security notices, and payment receipts.
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        We may also disclose data where required by law, to enforce our Terms of Service, or to protect the rights, safety, and security of Octo, our users, and the public.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Retention</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        We retain account data for as long as your account is active and for a reasonable period afterward to meet legal, accounting, and security obligations. Payer name and email records are retained for as long as needed to support the associated payment record and any related dispute or legal requirement. Uploaded images are retained until you remove them or your payment link is deleted. When data is no longer needed, we delete or anonymize it.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Your choices and rights</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Depending on where you live, you may have the right to access, correct, export, or delete your personal data, or to object to certain processing. You can request this by contacting us through the support channels listed on the site. Deleting your account removes your account data, subject to records we must keep for legal or security reasons.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Security</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        We use technical and organizational measures to protect personal data. No system is perfectly secure, but because Octo is non-custodial, a compromise of our systems does not expose your private keys or wallet encryption password.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Changes to this policy</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        We may update this policy from time to time. When we do, we will revise the “Last updated” date above and, for material changes, provide additional notice where appropriate.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Contact</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Questions about this policy or your personal data can be sent to us through the support channels listed on the site.
      </p>
    </main>
  );
}