import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallet API Keys" };

export default function ApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
