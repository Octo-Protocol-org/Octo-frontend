"use client";

import { useEffect, useRef } from "react";

/**
 Underwater "secure deposits" scene for the auth page.
 */

 
type AuthUnderwaterProps = {
  /** The live wallet-dashboard card the coins are dropped into. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Called once per coin the moment it lands in the card. */
  onDeposit?: () => void;
};

const BURGUNDY = { r: 184, g: 31, b: 77 };
const GOLD = { r: 240, g: 196, b: 110 };

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

type Phase = "approach" | "deposit" | "leave";

type Coin = { held: boolean; dropT: number };

type Swimmer = {
  x: number;
  y: number;
  angle: number;
  scale: number;
  phase: Phase;
  // approach path (bezier from an edge to a point near the wallet slot)
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  t: number;
  duration: number;
  bob: number;
  coin: Coin;
  // leave path
  lx: number;
  ly: number;
};

type Ring = { x: number; y: number; r: number; life: number; max: number };
type Bubble = { x: number; y: number; r: number; speed: number; phase: number; alpha: number };

export function AuthUnderwater({ targetRef, onDeposit }: AuthUnderwaterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep the latest onDeposit in a ref so the animation effect never re-runs.
  const onDepositRef = useRef(onDeposit);
  useEffect(() => {
    onDepositRef.current = onDeposit;
  }, [onDeposit]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const swimmers: Swimmer[] = [];
    const rings: Ring[] = [];
    const bubbles: Bubble[] = [];

    // Coin target — the top-center "deposit point" of the DOM dashboard card,
    // in canvas-local coordinates. Recomputed each frame so it tracks layout.
    const wallet = { x: 0, y: 0, slotY: 0, visible: false };
    let shieldPulse = 0; // 0..1 decaying flash on each accepted coin

    function updateTarget() {
      const el = targetRef.current;
      const canvasRect = canvas.getBoundingClientRect();
      if (!el || canvasRect.width === 0) {
        // Fallback: aim toward the right side if the card isn't mounted yet.
        wallet.x = width * 0.78;
        wallet.y = height * 0.42;
        wallet.slotY = wallet.y;
        wallet.visible = false;
        return;
      }
      const r = el.getBoundingClientRect();
      wallet.x = r.left + r.width / 2 - canvasRect.left;
      wallet.y = r.top + r.height / 2 - canvasRect.top;
      // Drop coins into the top edge of the card.
      wallet.slotY = r.top - canvasRect.top + 6;
      wallet.visible = true;
    }

    // Spawn a swimmer from a random edge heading toward the wallet slot.
    function spawnSwimmer(): Swimmer {
      const edge = Math.floor(rand(0, 4));
      let sx = 0;
      let sy = 0;
      const m = 60;
      if (edge === 0) {
        sx = rand(-m, width * 0.5);
        sy = -m;
      } else if (edge === 1) {
        sx = -m;
        sy = rand(-m, height);
      } else if (edge === 2) {
        sx = rand(-m, width * 0.4);
        sy = height + m;
      } else {
        sx = rand(width * 0.2, width * 0.6);
        sy = height + m;
      }
      // Aim a little above the card's deposit slot; the drop arc finishes it.
      const tx = wallet.x + rand(-30, 30);
      const ty = wallet.slotY - rand(50, 90);
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      const curl = rand(80, 220) * (Math.random() < 0.5 ? -1 : 1);
      const nx = -(ty - sy);
      const ny = tx - sx;
      const len = Math.hypot(nx, ny) || 1;
      return {
        x: sx,
        y: sy,
        angle: 0,
        scale: rand(0.6, 0.95),
        phase: "approach",
        sx,
        sy,
        cx: midX + (nx / len) * curl,
        cy: midY + (ny / len) * curl,
        tx,
        ty,
        t: 0,
        duration: rand(5.5, 9),
        bob: rand(0, Math.PI * 2),
        coin: { held: true, dropT: 0 },
        lx: rand(-80, width * 0.3),
        ly: rand(-80, -40),
      };
    }

    function spawnBubble(atBottom = false): Bubble {
      return {
        x: rand(0, width),
        y: atBottom ? height + rand(0, 30) : rand(0, height),
        r: rand(1.5, 5),
        speed: rand(12, 40),
        phase: rand(0, Math.PI * 2),
        alpha: rand(0.06, 0.22),
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      updateTarget();

      bubbles.length = 0;
      const bubbleCount = Math.round((width * height) / 24000);
      for (let i = 0; i < bubbleCount; i++) bubbles.push(spawnBubble());

      if (swimmers.length === 0) {
        const count = 3;
        for (let i = 0; i < count; i++) {
          const s = spawnSwimmer();
          s.t = -i * 2.2; // stagger arrivals
          swimmers.push(s);
        }
      }
    }

    function bezier(s: Swimmer, t: number) {
      const mt = 1 - t;
      const x = mt * mt * s.sx + 2 * mt * t * s.cx + t * t * s.tx;
      const y = mt * mt * s.sy + 2 * mt * t * s.cy + t * t * s.ty;
      const dx = 2 * mt * (s.cx - s.sx) + 2 * t * (s.tx - s.cx);
      const dy = 2 * mt * (s.cy - s.sy) + 2 * t * (s.ty - s.cy);
      return { x, y, dx, dy };
    }

    // ---- drawing --------------------------------------------

    function drawCoin(x: number, y: number, r: number, time: number) {
      const wobble = Math.sin(time * 4 + x) * 0.5 + 0.5; // face turn
      const rx = r * (0.35 + 0.65 * wobble);
      ctx.save();
      ctx.translate(x, y);
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0.95)`);
      g.addColorStop(1, `rgba(${GOLD.r - 60},${GOLD.g - 70},70,0.95)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,200,0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Octo "O" mark
      ctx.strokeStyle = `rgba(${BURGUNDY.r},${BURGUNDY.g},${BURGUNDY.b},0.9)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.45, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawOctopus(s: Swimmer, time: number) {
      const scale = s.scale;
      const bob = Math.sin(time * 1.6 + s.bob) * 3;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      ctx.rotate(s.angle + Math.PI / 2);
      ctx.scale(scale, scale);
      ctx.globalAlpha = 0.4;

      const tint = (a: number) =>
        `rgba(${BURGUNDY.r + 30},${BURGUNDY.g + 20},${BURGUNDY.b + 20},${a})`;

      const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, 40);
      halo.addColorStop(0, tint(0.5));
      halo.addColorStop(1, tint(0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = tint(0.85);
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const spread = (i / 7 - 0.5) * Math.PI * 0.9;
        const baseX = Math.sin(spread) * 10;
        const wave = Math.sin(time * 3 + i * 0.8) * 7;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(baseX, 12);
        ctx.quadraticCurveTo(
          baseX + Math.sin(spread) * 16 + wave,
          28,
          baseX + Math.sin(spread) * 24 + wave * 1.5,
          44 + Math.cos(spread) * 5,
        );
        ctx.stroke();
      }

      const body = ctx.createRadialGradient(0, -5, 3, 0, 0, 22);
      body.addColorStop(0, tint(1));
      body.addColorStop(1, tint(0.35));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(-6, -3, 2.8, 0, Math.PI * 2);
      ctx.arc(6, -3, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(20,4,10,0.9)";
      ctx.beginPath();
      ctx.arc(-6, -3, 1.3, 0, Math.PI * 2);
      ctx.arc(6, -3, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Coin held below the tentacles (drawn in world space, not rotated body).
      if (s.coin.held) {
        drawOctopusCoin(s, time);
      }
    }

    // Coin position while carried/dropping, in canvas coordinates.
    function coinPos(s: Swimmer) {
      if (s.phase === "deposit") {
        // Arc the coin from the octopus into the wallet slot.
        const p = s.coin.dropT;
        const startX = s.x;
        const startY = s.y + 46 * s.scale;
        const endX = wallet.x;
        const endY = wallet.slotY;
        const midX = (startX + endX) / 2;
        const midY = Math.min(startY, endY) - 40;
        const mt = 1 - p;
        return {
          x: mt * mt * startX + 2 * mt * p * midX + p * p * endX,
          y: mt * mt * startY + 2 * mt * p * midY + p * p * endY,
        };
      }
      return { x: s.x, y: s.y + 46 * s.scale };
    }

    function drawOctopusCoin(s: Swimmer, time: number) {
      const p = coinPos(s);
      // trailing glow
      ctx.save();
      ctx.globalAlpha = 0.9;
      const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 14);
      glow.addColorStop(0, `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0.5)`);
      glow.addColorStop(1, `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawCoin(p.x, p.y, 7, time);
    }

    // The DOM card renders the wallet itself; here we only draw the ambient
    // glow behind it and the security shield above it.
    function drawSecurity(time: number) {
      if (!wallet.visible) return;
      const { x, y } = wallet;

      ctx.save();
      // ambient glow behind the card
      const aura = ctx.createRadialGradient(x, y, 10, x, y, 220);
      aura.addColorStop(0, `rgba(${BURGUNDY.r},${BURGUNDY.g},${BURGUNDY.b},0.22)`);
      aura.addColorStop(1, `rgba(${BURGUNDY.r},${BURGUNDY.g},${BURGUNDY.b},0)`);
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(x, y, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Security signifier: shield + lock hovering above the card's top edge.
      drawShield(x, wallet.slotY - 26, 1 + shieldPulse * 0.25, time);
    }

    function drawShield(cx: number, cy: number, scale: number, time: number) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // pulse ring on accept
      if (shieldPulse > 0.01) {
        ctx.globalAlpha = shieldPulse * 0.5;
        ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},1)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + (1 - shieldPulse) * 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // shield outline
      ctx.globalAlpha = 0.9;
      const breathe = 0.5 + 0.5 * Math.sin(time * 2);
      const shieldGrad = ctx.createLinearGradient(0, -16, 0, 16);
      shieldGrad.addColorStop(0, `rgba(${BURGUNDY.r + 60},${BURGUNDY.g + 20},${BURGUNDY.b + 20},0.9)`);
      shieldGrad.addColorStop(1, `rgba(${BURGUNDY.r},${BURGUNDY.g},${BURGUNDY.b},0.7)`);
      ctx.fillStyle = shieldGrad;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(13, -9);
      ctx.lineTo(13, 4);
      ctx.quadraticCurveTo(13, 14, 0, 18);
      ctx.quadraticCurveTo(-13, 14, -13, 4);
      ctx.lineTo(-13, -9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + breathe * 0.35})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // padlock inside
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -2, 3.4, Math.PI, 0); // shackle
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      roundRect(-4, 1, 8, 7, 1.5);
      ctx.fill();

      ctx.restore();
    }

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawBubble(b: Bubble) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${b.alpha})`;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- loop --------------------------------------------------------------

    let raf = 0;
    let last = performance.now();
    let running = true;

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const time = now / 1000;

      ctx.clearRect(0, 0, width, height);

      // depth wash
      const wash = ctx.createLinearGradient(0, 0, 0, height);
      wash.addColorStop(0, "rgba(123,23,51,0.10)");
      wash.addColorStop(1, "rgba(10,5,6,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      // Track the DOM card's live position, then draw glow + shield behind the
      // swimmers/coins.
      updateTarget();
      drawSecurity(time);

      // bubbles
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        b.y -= b.speed * dt;
        b.x += Math.sin(time + b.phase) * 8 * dt;
        if (b.y + b.r < 0) bubbles[i] = spawnBubble(true);
        drawBubble(b);
      }

      // swimmers
      for (const s of swimmers) {
        if (s.phase === "approach") {
          s.t += dt / s.duration;
          const tt = Math.max(0, Math.min(s.t, 1));
          const et = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
          const p = bezier(s, et);
          s.x = p.x;
          s.y = p.y;
          s.angle = Math.atan2(p.dy, p.dx);
          if (s.t >= 1) {
            s.phase = "deposit";
            s.coin.dropT = 0;
          }
        } else if (s.phase === "deposit") {
          s.coin.dropT += dt / 0.7;
          if (s.coin.dropT >= 1) {
            // Coin banked → notify React (balance ticks up) + security response.
            s.coin.held = false;
            shieldPulse = 1;
            onDepositRef.current?.();
            rings.push({ x: wallet.x, y: wallet.slotY, r: 4, life: 1, max: 1 });
            // set up leave path
            s.phase = "leave";
            s.sx = s.x;
            s.sy = s.y;
            const midX = (s.x + s.lx) / 2;
            const midY = (s.y + s.ly) / 2;
            const curl = rand(60, 160) * (Math.random() < 0.5 ? -1 : 1);
            const nx = -(s.ly - s.y);
            const ny = s.lx - s.x;
            const len = Math.hypot(nx, ny) || 1;
            s.cx = midX + (nx / len) * curl;
            s.cy = midY + (ny / len) * curl;
            s.tx = s.lx;
            s.ty = s.ly;
            s.t = 0;
            s.duration = rand(4, 6.5);
          }
        } else {
          // leave
          s.t += dt / s.duration;
          const tt = Math.min(s.t, 1);
          const et = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
          const p = bezier(s, et);
          s.x = p.x;
          s.y = p.y;
          s.angle = Math.atan2(p.dy, p.dx);
          if (s.t >= 1) {
            // respawn a fresh carrier
            Object.assign(s, spawnSwimmer());
          }
        }
        drawOctopus(s, time);
      }

      // security rings (encryption pulse) around the wallet
      for (let i = rings.length - 1; i >= 0; i--) {
        const rg = rings[i];
        rg.r += 90 * dt;
        rg.life -= dt / 1.1;
        if (rg.life <= 0) {
          rings.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${rg.life * 0.4})`;
        ctx.lineWidth = 2;
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      shieldPulse = Math.max(0, shieldPulse - dt * 1.6);

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
      running = false;
      ctx.clearRect(0, 0, width, height);
      updateTarget();
      drawSecurity(0);
      for (const s of swimmers) drawOctopus(s, 0);
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
  }, [targetRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
