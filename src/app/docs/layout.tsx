import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { Parallax } from "@/components/Parallax";

export const metadata = { title: "Docs — Octo" };

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <DocsSidebar />
      <main className="flex-1 px-6 py-12 sm:px-12">
        <Parallax speed={36} className="mx-auto block max-w-3xl">
          <article>{children}</article>
        </Parallax>
      </main>
    </div>
  );
}
