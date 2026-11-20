import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallet Transactions" };

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
