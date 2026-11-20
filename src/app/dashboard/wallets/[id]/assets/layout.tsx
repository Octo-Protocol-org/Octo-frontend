import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallet Assets" };

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
