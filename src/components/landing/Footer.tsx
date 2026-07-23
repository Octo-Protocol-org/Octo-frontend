import Link from "next/link";
import { Logo } from "@/components/Logo";

const COLUMNS = [
  {
    heading: "Developers",
    links: ["Documentation", "API Reference", "Status Page"],
  },
  {
    heading: "Resources",
    links: ["Terms of Service", "Privacy Policy", "Blog", "Brand Kit"],
  },
  {
    heading: "Company",
    links: ["About Us", "Contact Sales", "Security Overview", "Affiliate Program"],
  },
];

export function Footer() {
  return (
    <footer id="company" className="border-t border-white/10 px-4 py-16">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">
            Our solutions are as simple as they are powerful, making stablecoin
            wallets accessible for every fintech.
          </p>
          <p className="mt-6 inline-block rounded-md border border-burgundy/40 px-3 py-1 text-sm text-burgundy-bright">
            hello@octo.dev
          </p>
          <p className="mt-4 text-xs text-muted">
            Stellar-native wallet infrastructure
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h4 className="text-sm font-semibold text-foreground">
              {col.heading}
            </h4>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l}>
                  <Link
                    href="#"
                    className="text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl items-center justify-between border-t border-white/10 pt-6 text-xs text-muted">
        <span>© {new Date().getFullYear()} Octo. All rights reserved.</span>
        <div className="flex gap-4">
          <Link
            href="https://x.com/Octo_Hq"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
            aria-label="X (Twitter)"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 4.01 14.49 12.14 21.35 20h-3.02l-5.01-6.23-5.94 6.23H2l7.91-8.29L2.87 4h3.1l4.61 5.72L16 4h6Z" fill="currentColor"/>
            </svg>
          </Link>
          <Link
            href="https://instagram.com/OctoHQ"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
            aria-label="Instagram"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <rect width="20" height="20" x="2" y="2" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
            </svg>
          </Link>
          <Link
            href="https://linkedin.com/company/OctoHQ"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
            aria-label="LinkedIn"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M6 9V17M6 7V7.01M10 13V17M10 13c0-1.1.9-2 2-2s2 .9 2 2v4M18 13v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </Link>
          <Link
            href="https://github.com/Octo-Protocol-org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
            aria-label="GitHub"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.596 2 12.184c0 4.477 2.865 8.278 6.839 9.626.5.097.682-.222.682-.493 0-.242-.009-.883-.013-1.734-2.782.617-3.369-1.373-3.369-1.373-.454-1.176-1.11-1.49-1.11-1.49-.908-.637.07-.624.07-.624 1.004.072 1.532 1.046 1.532 1.046.892 1.549 2.341 1.102 2.912.843.092-.659.35-1.102.637-1.355-2.221-.259-4.555-1.131-4.555-5.034 0-1.112.384-2.021 1.014-2.735-.102-.259-.44-1.298.096-2.707 0 0 .832-.273 2.729 1.045A9.347 9.347 0 0 1 12 6.844c.843.004 1.693.115 2.487.337 1.895-1.318 2.726-1.045 2.726-1.045.537 1.409.2 2.448.099 2.707.631.714 1.013 1.623 1.013 2.735 0 3.912-2.337 4.773-4.566 5.027.359.314.68.933.68 1.882 0 1.359-.012 2.454-.012 2.785 0 .274.18.594.688.493C19.137 20.46 22 16.658 22 12.184 22 6.596 17.522 2 12 2Z" fill="currentColor"/>
            </svg>
          </Link>
          <Link
            href="https://t.me/OctoHQ"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
            aria-label="Telegram"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.772 5.336a1.07 1.07 0 0 0-1.149-.215L3.271 12.234c-.447.183-.738.616-.701 1.092.036.476.389.868.864.948l3.108.516 2.605 3.553a1.07 1.07 0 0 0 1.215.419 1.06 1.06 0 0 0 .692-.778l1.002-4.11 4.335 3.421c.153.121.335.185.523.185a1.06 1.06 0 0 0 1.035-.844l2.123-10.19a1.07 1.07 0 0 0-.198-.938ZM9.989 15.383l-.657 2.42-1.881-2.566 2.538.146Z" fill="currentColor"/>
            </svg>
          </Link>
        </div>
   
      </div>
    </footer>
  );
}
