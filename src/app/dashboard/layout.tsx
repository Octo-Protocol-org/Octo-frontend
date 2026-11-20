import type { Metadata } from "next";
import { AuthProvider } from "@/lib/useAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}