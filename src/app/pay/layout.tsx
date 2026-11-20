import type { Metadata } from "next";

// Required by the strict nonce-based CSP in src/proxy.ts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
