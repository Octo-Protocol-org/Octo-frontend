"use client";

import { use } from "react";
import { WalletProvider } from "@/lib/useWallet";

export default function WalletLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <WalletProvider walletId={id}>{children}</WalletProvider>;
}
