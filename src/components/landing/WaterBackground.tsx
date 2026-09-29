"use client";

import { useEffect, useRef } from "react";
import {
  readCanvasPalette,
  watchCanvasPalette,
  rgba,
  separate,
} from "@/lib/canvasPalette";

/**
 * Full-screen fixed canvas with drifting bubbles and animated octopuses.
 * Animation pauses if tab is hidden or user prefers reduced motion.
 * Sits beneath all content as a static underwater background.
 *
 * Colours come from the `--canvas-*` theme tokens rather than constants, and are re-read on a
 * theme change — the draw calls dereference the palette every frame, so the scene rethemes
 * mid-flight without remounting or resetting any octopus position.
 */

type Bubble = {
  x: number;
  y: number;
  r: number;
  speed: number; // upward px/sec
  drift: number; // horizontal wobble amplitude
  phase: number; // wobble phase offset
  alpha: number;
};

type OctoPath = {
  // A swim leg: move from (sx,sy) to (tx,ty) over `duration`, with a bezier
  // control point so the motion curves organically instead of going straight.
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  duration: number; // seconds
  elapsed: number; // seconds into this leg
  scale: number;
};

type Octopus = {
  x: number;
  y: number;
  angle: number; // heading, radians — head points along travel direction
  path: OctoPath;
  hueShift: number; // slight per-octopus tint variance
  bob: number; // phase for gentle vertical bob
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function WaterBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    // Non-null aliases so TypeScript keeps the narrowing inside nested closures.
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Mutated in place by the theme observer; every draw call reads it fresh. The reduced-motion
    // path re-subscribes below with a redraw callback, since it has no loop to pick changes up.
    const palette = readCanvasPalette();
    let unwatchPalette = watchCanvasPalette(palette);

    let width = 0;
    let height = 0;
    let dpr = 1;

    const bubbles: Bubble[] = [];
    const octopuses: Octopus[] = [];

    // ---- helpers -----------------------------------------------------------

    function spawnBubble(atBottom = false): Bubble {
      return {
        x: rand(0, width),
        y: atBottom ? height + rand(0, 40) : rand(0, height),
        r: rand(1.5, 6),
        speed: rand(15, 55),
        drift: rand(6, 28),
        phase: rand(0, Math.PI * 2),
        alpha: rand(0.08, 0.28),
      };
    }

    // Build a new random swim leg starting from the octopus's current position.
    function newPath(fromX: number, fromY: number): OctoPath {
      const margin = 80;
      const tx = rand(-margin, width + margin);
      const ty = rand(-margin, height + margin);
      // Control point offset to one side of the straight line for a curved arc.
      const midX = (fromX + tx) / 2;
      const midY = (fromY + ty) / 2;
      const curl = rand(120, 340) * (Math.random() < 0.5 ? -1 : 1);
      const nx = -(ty - fromY);
      const ny = tx - fromX;
      const len = Math.hypot(nx, ny) || 1;
      return {
        sx: fromX,
        sy: fromY,
        cx: midX + (nx / len) * curl,
        cy: midY + (ny / len) * curl,
        tx,
        ty,
        duration: rand(12, 24),
        elapsed: 0,
        scale: rand(0.7, 1.25),
      };
    }

    function spawnOctopus(): Octopus {
      const startX = rand(0, width);
      const startY = rand(0, height);
      return {
        x: startX,
        y: startY,
        angle: 0,
        path: newPath(startX, startY),
        hueShift: rand(-18, 18),
        bob: rand(0, Math.PI * 2),
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // (Re)seed populations sized to the viewport.
      bubbles.length = 0;
      const bubbleCount = Math.round((width * height) / 26000);
      for (let i = 0; i < bubbleCount; i++) bubbles.push(spawnBubble());

      if (octopuses.length === 0) {
        const octoCount = width < 640 ? 2 : 3;
        for (let i = 0; i < octoCount; i++) octopuses.push(spawnOctopus());
      } else {
        // Keep existing octopuses but nudge in-bounds after a resize.
        for (const o of octopuses) {
          o.x = Math.min(Math.max(o.x, 0), width);
          o.y = Math.min(Math.max(o.y, 0), height);
        }
      }
    }

    // Quadratic bezier point + tangent at t.
    function bezier(p: OctoPath, t: number) {
      const mt = 1 - t;
      const x =
        mt * mt * p.sx + 2 * mt * t * p.cx + t * t * p.tx;
      const y =
        mt * mt * p.sy + 2 * mt * t * p.cy + t * t * p.ty;
      const dx =
        2 * mt * (p.cx - p.sx) + 2 * t * (p.tx - p.cx);
      const dy =
        2 * mt * (p.cy - p.sy) + 2 * t * (p.ty - p.cy);
      return { x, y, dx, dy };
    }

    // ---- drawing -----------------------------------------------------------

    function drawBubble(b: Bubble) {
      const grad = ctx!.createRadialGradient(
        b.x - b.r * 0.3,
        b.y - b.r * 0.3,
        b.r * 0.1,
        b.x,
        b.y,
        b.r,
      );
      const a = b.alpha * palette.bubbleAlpha;

      // A glowing white body reads as light against dark but vanishes on white, so in light mode
      // the bubble becomes refractive instead: a tinted edge with a small specular catch.
      if (palette.isLight) {
        grad.addColorStop(0, rgba(palette.highlight, a * 0.5));
        grad.addColorStop(0.55, rgba(palette.brand, a * 0.16));
        grad.addColorStop(1, rgba(palette.brand, a * 0.5));
      } else {
        grad.addColorStop(0, rgba(palette.highlight, a * 1.1));
        grad.addColorStop(0.5, separate(palette, palette.brand, 40, a * 0.5));
        grad.addColorStop(1, rgba(palette.brand, 0));
      }
      ctx!.beginPath();
      ctx!.fillStyle = grad;
      ctx!.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx!.fill();

      // crisp highlight rim
      ctx!.beginPath();
      ctx!.strokeStyle = palette.isLight
        ? rgba(palette.brand, a * 0.85)
        : rgba(palette.highlight, a * 0.6);
      ctx!.lineWidth = palette.isLight ? 0.9 : 0.6;
      ctx!.arc(b.x, b.y, b.r, Math.PI * 1.1, Math.PI * 1.7);
      ctx!.stroke();

      // Light mode adds the specular dot a real bubble shows under overhead sunlight.
      if (palette.isLight) {
        ctx!.beginPath();
        ctx!.fillStyle = rgba(palette.highlight, a * 0.9);
        ctx!.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, Math.max(0.6, b.r * 0.16), 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawOctopus(o: Octopus, time: number) {
      const c = ctx!;
      const s = o.path.scale;
      const bob = Math.sin(time * 1.6 + o.bob) * 3;

      c.save();
      c.translate(o.x, o.y + bob);
      // Head points along travel; +90° so the "top" of the octopus leads.
      c.rotate(o.angle + Math.PI / 2);
      c.scale(s, s);
      // Light mode raises this — the same alpha that reads as a silhouette on near-black
      // dissolves into white.
      c.globalAlpha = palette.octoAlpha;

      // Separating from the page means lightening on dark and darkening on light.
      const tint = (a: number) =>
        separate(palette, palette.brand, o.hueShift + 26, a);

      // A glow halo separates the creature from darkness, but on a bright page it just smears it
      // into a haze — light mode relies on the silhouette instead.
      if (!palette.isLight) {
        const halo = c.createRadialGradient(0, 0, 4, 0, 0, 46);
        halo.addColorStop(0, tint(0.5));
        halo.addColorStop(1, tint(0));
        c.fillStyle = halo;
        c.beginPath();
        c.arc(0, 0, 46, 0, Math.PI * 2);
        c.fill();
      }

      // 8 tentacles, waving with a phase offset per tentacle
      c.strokeStyle = tint(0.85);
      c.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const spread = (i / 7 - 0.5) * Math.PI * 0.9; // fan them out
        const baseX = Math.sin(spread) * 12;
        const wave = Math.sin(time * 3 + i * 0.8) * 8;
        c.lineWidth = 3.2;
        c.beginPath();
        c.moveTo(baseX, 14);
        c.quadraticCurveTo(
          baseX + Math.sin(spread) * 20 + wave,
          34,
          baseX + Math.sin(spread) * 30 + wave * 1.6,
          52 + Math.cos(spread) * 6,
        );
        c.stroke();
      }

      // head / mantle
      const body = c.createRadialGradient(0, -6, 3, 0, 0, 26);
      body.addColorStop(0, tint(1));
      body.addColorStop(1, tint(0.35));
      c.fillStyle = body;
      c.beginPath();
      c.ellipse(0, 0, 20, 26, 0, 0, Math.PI * 2);
      c.fill();

      // eyes
      c.globalAlpha = palette.isLight ? 0.55 : 0.35;
      c.fillStyle = rgba(palette.highlight, 0.9);
      c.beginPath();
      c.arc(-7, -4, 3.4, 0, Math.PI * 2);
      c.arc(7, -4, 3.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = rgba(palette.shadow, 0.9);
      c.beginPath();
      c.arc(-7, -4, 1.5, 0, Math.PI * 2);
      c.arc(7, -4, 1.5, 0, Math.PI * 2);
      c.fill();

      c.restore();
    }

    // ---- loop --------------------------------------------------------------

    let raf = 0;
    let last = performance.now();
    let running = true;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05); // clamp big gaps
      last = now;
      const time = now / 1000;

      ctx!.clearRect(0, 0, width, height);

      // Subtle depth wash. On dark it fades a burgundy tint out toward the page; on light the sun
      // is overhead, so it runs clear at the surface and deepens to aqua further down.
      const wash = ctx!.createLinearGradient(0, 0, 0, height);
      if (palette.isLight) {
        wash.addColorStop(0, rgba(palette.wash, 0));
        wash.addColorStop(1, rgba(palette.wash, 0.32));
      } else {
        wash.addColorStop(0, rgba(palette.wash, 0.05));
        wash.addColorStop(1, rgba(palette.deep, 0));
      }
      ctx!.fillStyle = wash;
      ctx!.fillRect(0, 0, width, height);

      // octopuses (behind bubbles)
      for (const o of octopuses) {
        o.path.elapsed += dt;
        const t = Math.min(o.path.elapsed / o.path.duration, 1);
        // ease in-out for natural glide
        const et = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const p = bezier(o.path, et);
        o.x = p.x;
        o.y = p.y;
        o.angle = Math.atan2(p.dy, p.dx);
        drawOctopus(o, time);
        if (t >= 1) o.path = newPath(o.x, o.y);
      }

      // bubbles
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (!b) continue;
        b.y -= b.speed * dt;
        b.x += Math.sin(time + b.phase) * b.drift * dt;
        if (b.y + b.r < 0) bubbles[i] = spawnBubble(true);
        drawBubble(b);
      }

      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    // Draw a single static frame, no animation loop.
    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      for (const o of octopuses) drawOctopus(o, 0);
      for (const b of bubbles) drawBubble(b);
    }

    if (reduceMotion) {
      running = false;
      drawStatic();
      // Without a redraw the static frame would keep the previous theme's colours forever.
      unwatchPalette();
      unwatchPalette = watchCanvasPalette(palette, drawStatic);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      unwatchPalette();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
