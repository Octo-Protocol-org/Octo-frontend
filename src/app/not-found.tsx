import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-center">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface-raised p-8 shadow-xl">
        <p className="font-display text-5xl text-burgundy-bright">404</p>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This Octo page does not exist or may have moved.
        </p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-full glass-btn-primary px-5 py-2.5 text-sm font-semibold"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
