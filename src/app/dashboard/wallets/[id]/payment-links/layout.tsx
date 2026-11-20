import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payment Links" };

export default function PaymentLinksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
