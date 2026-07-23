"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-linked parallax + reveal wrapper (used site-wide).
 *
 * As the element passes through the viewport its content is translated on the
 * Y axis at a rate different from the scroll (true parallax), and it fades +
 * eases into place the first time it appears. The parallax is continuous and
 * tied to scroll position, so the motion is obvious as you scroll any page.
 *
 * - `speed`  how far (px) the content drifts across a full viewport of scroll.
 *            Higher = more pronounced parallax. Negative drifts the other way.
 * - `reveal` whether to also fade/slide in on first appearance.
 * - `delay`  stagger for the reveal.
 *
 * Honors `prefers-reduced-motion` (renders static, fully visible, no drift).
 */
export function Parallax({
  children,
  speed = 40,
  reveal = true,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  speed?: number;
  reveal?: boolean;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  const outerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }

    // Reveal on first intersection.
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              setShown(true);
              io.disconnect();
              break;
            }
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
      );
      io.observe(outer);
    } else {
      requestAnimationFrame(() => setShown(true));
    }

    // Continuous scroll-linked parallax translate on the inner element.
    let raf = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const rect = outer.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // progress: -1 (just below viewport) → 0 (centered) → 1 (just above)
      const progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      const offset = Math.max(-1, Math.min(1, progress)) * speed;
      inner.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <Tag ref={outerRef} className={className}>
      <div
        ref={innerRef}
        style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
        className={[
          "will-change-transform motion-reduce:transition-none",
          reveal
            ? "transition-[opacity,filter] duration-[900ms] ease-out " +
              (shown
                ? "opacity-100 blur-0"
                : "opacity-0 blur-[6px]")
            : "",
        ].join(" ")}
      >
        {children}
      </div>
    </Tag>
  );
}
