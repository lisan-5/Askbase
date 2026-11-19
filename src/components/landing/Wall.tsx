/**
 * The wall: the sample company's raw order rows, drifting across the hero like ticker
 * tape. The pointer is a highlighter — cells it passes over get marked and fade back.
 * Typing a filter lights up every matching cell (a live WHERE clause) and reports how
 * many rows match. Canvas 2D; pauses off-screen; static for reduced motion.
 */
import { useEffect, useRef } from "react";

export interface WallHandle {
  filter: string;
  matches: number;
}

export function Wall({
  lines,
  state,
  onMatches,
  className,
}: {
  lines: string[];
  /** Shared, mutable: the current filter text. Read every frame (no re-render). */
  state: { filter: string };
  onMatches?: (n: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lines.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let font = 12;
    let cw = 7.2;
    let lh = 20;
    const css = () => {
      const s = getComputedStyle(document.documentElement);
      return {
        ink: s.getPropertyValue("--ink").trim(),
        muted: s.getPropertyValue("--muted").trim(),
        mark: s.getPropertyValue("--mark").trim(),
      };
    };
    let col = css();
    const mo = new MutationObserver(() => (col = css()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      font = w < 640 ? 10.5 : 12;
      lh = font * 1.75;
      ctx.font = `${font}px "Fragment Mono", ui-monospace, monospace`;
      cw = ctx.measureText("0").width;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // tokenise every line once: cell text + char offset
    const rows = lines.map((l) => {
      const cells: { text: string; at: number; lower: string }[] = [];
      let at = 0;
      for (const part of l.split(",")) {
        cells.push({ text: part, at, lower: part.toLowerCase() });
        at += part.length + 1;
      }
      return { text: `${l},   `, len: l.length + 4, cells };
    });

    // highlighter: cell id → time it was marked
    const marked = new Map<string, number>();
    const pointer = { x: -999, y: -999, px: -999, py: -999, inside: false };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= w && pointer.y <= h;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let running = false;
    let lastMatches = -1;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = reduced ? 0 : (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      ctx.font = `${font}px "Fragment Mono", ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      const f = state.filter.trim().toLowerCase();
      const filtering = f.length >= 2;
      const visibleRows = Math.ceil(h / lh) + 1;
      let matches = 0;

      for (let r = 0; r < visibleRows; r++) {
        const row = rows[r % rows.length];
        const y = r * lh + lh / 2;
        const speed = (r % 2 ? -1 : 1) * (9 + ((r * 37) % 23));
        const span = row.len * cw;
        let x0 = ((((t * speed) % span) + span) % span) - span;
        for (; x0 < w; x0 += span) {
          for (let c = 0; c < row.cells.length; c++) {
            const cell = row.cells[c];
            const cx = x0 + cell.at * cw;
            const cwidth = cell.text.length * cw;
            if (cx > w || cx + cwidth < 0) continue;
            const id = `${r}:${c}`;
            // highlighter stroke under the pointer
            if (
              pointer.inside &&
              Math.abs(pointer.y - y) < lh * 0.55 &&
              pointer.x > cx - 4 &&
              pointer.x < cx + cwidth + 4
            ) {
              marked.set(id, now);
            }
            const hit = filtering && cell.lower.includes(f);
            if (hit) matches++;
            const age = (now - (marked.get(id) ?? -1e9)) / 1000;
            const markAlpha = hit ? 1 : age < 2.6 ? 1 - age / 2.6 : 0;
            if (markAlpha > 0) {
              ctx.globalAlpha = markAlpha * 0.95;
              ctx.fillStyle = col.mark;
              ctx.beginPath();
              ctx.roundRect(cx - 3, y - lh * 0.38, cwidth + 6, lh * 0.76, 3);
              ctx.fill();
            }
            ctx.globalAlpha = markAlpha > 0.05 ? 1 : filtering ? 0.13 : 0.32;
            ctx.fillStyle = markAlpha > 0.05 ? "#0e0f13" : col.muted;
            ctx.fillText(cell.text, cx, y + 0.5);
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = col.muted;
            ctx.fillText(",", cx + cwidth, y + 0.5);
          }
        }
      }
      ctx.globalAlpha = 1;
      if (filtering ? matches !== lastMatches : lastMatches !== -1) {
        lastMatches = filtering ? matches : -1;
        onMatches?.(filtering ? matches : -1);
      }
      if (!reduced || state.filter) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    // in reduced motion, redraw when the filter changes
    const poll = reduced ? window.setInterval(() => requestAnimationFrame(frame), 250) : 0;
    return () => {
      stop();
      clearInterval(poll);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [lines, state, onMatches]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
