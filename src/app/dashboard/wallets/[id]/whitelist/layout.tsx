import type { Metadata } from "next";

export const metadata: Metadata = { title: "Withdrawal Allowlist" };

export default function WhitelistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
