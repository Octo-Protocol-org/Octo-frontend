"use client";

import { useEffect, useRef } from "react";

/**
 * Full-screen fixed canvas with drifting bubbles and animated octopuses.
 * Animation pauses if tab is hidden or user prefers reduced motion.
 * Sits beneath all content as a static underwater background.
 */

// Octo brand burgundy, used to tint bubbles/octopus so the scene stays on-brand.
const BURGUNDY = { r: 184, g: 31, b: 77 }; // #b81f4d

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
      grad.addColorStop(0, `rgba(255,255,255,${b.alpha * 1.1})`);
      grad.addColorStop(
        0.5,
        `rgba(${BURGUNDY.r + 40},${BURGUNDY.g + 40},${BURGUNDY.b + 40},${b.alpha * 0.5})`,
      );
      grad.addColorStop(1, `rgba(${BURGUNDY.r},${BURGUNDY.g},${BURGUNDY.b},0)`);
      ctx!.beginPath();
      ctx!.fillStyle = grad;
      ctx!.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx!.fill();
      // crisp highlight rim
      ctx!.beginPath();
      ctx!.strokeStyle = `rgba(255,255,255,${b.alpha * 0.6})`;
      ctx!.lineWidth = 0.6;
      ctx!.arc(b.x, b.y, b.r, Math.PI * 1.1, Math.PI * 1.7);
      ctx!.stroke();
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
      c.globalAlpha = 0.22; // semi-transparent, sits behind content

      const tint = (a: number) =>
        `rgba(${Math.min(255, BURGUNDY.r + o.hueShift + 30)},${
          BURGUNDY.g + 20
        },${BURGUNDY.b + 20},${a})`;

      // soft glow halo
      const halo = c.createRadialGradient(0, 0, 4, 0, 0, 46);
      halo.addColorStop(0, tint(0.5));
      halo.addColorStop(1, tint(0));
      c.fillStyle = halo;
      c.beginPath();
      c.arc(0, 0, 46, 0, Math.PI * 2);
      c.fill();

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
      c.globalAlpha = 0.35;
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.arc(-7, -4, 3.4, 0, Math.PI * 2);
      c.arc(7, -4, 3.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(20,4,10,0.9)";
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

      // subtle depth gradient wash
      const wash = ctx!.createLinearGradient(0, 0, 0, height);
      wash.addColorStop(0, "rgba(123,23,51,0.05)");
      wash.addColorStop(1, "rgba(10,5,6,0)");
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

    if (reduceMotion) {
      // Draw a single static frame, no animation loop.
      running = false;
      ctx.clearRect(0, 0, width, height);
      for (const o of octopuses) drawOctopus(o, 0);
      for (const b of bubbles) drawBubble(b);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
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
