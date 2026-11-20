import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallet Addresses" };

export default function AddressesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
