import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gas Tank" };

export default function GasTankLayout({ children }: { children: React.ReactNode }) {
  return children;
}
