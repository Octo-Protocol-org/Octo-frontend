import type { Metadata } from "next";

export const metadata: Metadata = { title: "Audit Logs" };

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return children;
}
