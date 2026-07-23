import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AuthWalletScene } from "@/components/auth/AuthWalletScene";

/** Split-screen auth layout: glass form card on the left, brand copy on the
 *  right, both floating over a full-screen underwater "secure deposits" scene. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Fixed backdrop: burgundy glow + faint isometric grid. The underwater
          animation itself is rendered (also fixed) inside AuthWalletScene. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 glow-burgundy opacity-50" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(var(--burgundy-bright) 1px, transparent 1px), linear-gradient(90deg, var(--burgundy-bright) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            transform: "perspective(800px) rotateX(55deg) scale(1.6)",
            transformOrigin: "top center",
          }}
        />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Left: glass form card */}
        <div className="flex flex-col px-6 py-8 sm:px-12">
          <Link
            href="/"
            className="glass-btn inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            ‹ Home
          </Link>

          <div className="flex flex-1 items-center justify-center py-8">
            <div className="glass-strong w-full max-w-sm rounded-3xl p-8">
              <div className="mb-8 flex justify-center">
                <Logo />
              </div>
              {children}

              <p className="mx-auto mt-8 max-w-sm text-center text-xs text-muted">
                By signing up, you agree to our{" "}
                <Link href="#" className="underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="#" className="underline">
                  Conditions of use
                </Link>{" "}
                and{" "}
                <Link href="#" className="underline">
                  Privacy policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Right: live wallet dashboard above the brand copy. */}
        <div className="hidden flex-col items-center justify-center gap-10 px-12 py-16 lg:flex">
          {/* Live wallet dashboard the octopuses deposit into. */}
          <AuthWalletScene />

          <div className="max-w-md text-center">
            <span className="glass inline-block rounded-md px-3 py-1 text-[11px] uppercase tracking-widest text-muted">
              Wallet Infrastructure
            </span>
              <h2 className="mt-6 text-2xl font-semibold leading-snug text-foreground">
                No <span className="text-muted">Complexity.</span> Just secure{" "}
                <span className="text-burgundy-bright">
                  wallet infrastructure
                </span>{" "}
                for Fintechs
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                We help fintechs deliver secure, scalable, and flexible
                enterprise-grade wallet solutions on Stellar. Empower your
                customers to unlock the power of stablecoins, whether abstracted
                away or fully integrated.
              </p>
          </div>
        </div>
      </div>
    </div>
  );
}
