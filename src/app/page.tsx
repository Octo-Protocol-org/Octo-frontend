import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Developers } from "@/components/landing/Developers";
import { UseCases } from "@/components/landing/UseCases";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { WaterBackground } from "@/components/landing/WaterBackground";
import { Parallax } from "@/components/Parallax";

export default function Home() {
  return (
    <>
      {/* Fixed underwater scene — stays static while the page scrolls. */}
      <WaterBackground />

      {/* All content sits above the canvas. */}
      <div className="relative z-10 flex min-h-full flex-1 flex-col">
        <Navbar />
        <main className="flex-1">
          <Hero />
          <Parallax speed={60}>
            <Features />
          </Parallax>
          <Parallax speed={-50}>
            <Developers />
          </Parallax>
          <Parallax speed={60}>
            <UseCases />
          </Parallax>
          <Parallax speed={-40}>
            <CTA />
          </Parallax>
        </main>
        <Footer />
      </div>
    </>
  );
}
