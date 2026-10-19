import { useEffect, useRef } from "react";
import { distToContour, type Contour, type Operation, type Toolpath, type Vec2, type Segment } from "@arcflow/core";

interface Props {
  contours: Contour[];
  ops: Operation[];
  toolpath: Toolpath;
  sheet: { widthMm: number; heightMm: number };
  selectedId: string | null;
  showOrder?: boolean;
  showRapids?: boolean;
  onSelect: (id: string | null) => void;
}

interface View {
  scale: number; // px per mm
  tx: number;
  ty: number;
}

/**
 * CAM canvas (design screen C). Canvas 2D for the starter; the renderer is isolated
 * here so it can move to WebGL (regl/PixiJS) when part counts demand it (spec §7).
 * Draws in sheet millimetres with a Y-flip transform: math Y-up, screen Y-down.
 */
export function CamCanvas(p: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef<View | null>(null);
  const propsRef = useRef(p);
  propsRef.current = p;

  useEffect(() => {
    const cv = ref.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(cv);
    let drag: { x: number; y: number } | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current!;
      const k = Math.exp(-e.deltaY * 0.0015);
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      v.tx = mx - (mx - v.tx) * k;
      v.ty = my - (my - v.ty) * k;
      v.scale *= k;
      draw();
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 1 || e.button === 2 || e.altKey) {
        drag = { x: e.clientX, y: e.clientY };
        cv.setPointerCapture(e.pointerId);
        return;
      }
      const r = cv.getBoundingClientRect();
      const pt = toSheet({ x: e.clientX - r.left, y: e.clientY - r.top });
      const tol = 6 / view.current!.scale;
      let best: { id: string; d: number } | null = null;
      for (const c of propsRef.current.contours) {
        const d = distToContour(c, pt);
        if (d < tol && (!best || d < best.d)) best = { id: c.id, d };
      }
      propsRef.current.onSelect(best ? best.id : null);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const v = view.current!;
      v.tx += e.clientX - drag.x;
      v.ty += e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      draw();
    };
    const onUp = () => (drag = null);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    return () => {
      ro.disconnect();
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => draw());

  function toSheet(s: Vec2): Vec2 {
    const v = view.current!;
    return { x: (s.x - v.tx) / v.scale, y: -(s.y - v.ty) / v.scale };
  }

  function fit(w: number, h: number) {
    const { sheet } = propsRef.current;
    const pad = 40;
    const scale = Math.min((w - 2 * pad) / sheet.widthMm, (h - 2 * pad) / sheet.heightMm);
    view.current = { scale, tx: (w - sheet.widthMm * scale) / 2, ty: (h + sheet.heightMm * scale) / 2 };
  }

  function draw() {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr;
      cv.height = h * dpr;
    }
    if (!view.current) fit(w, h);
    const v = view.current!;
    const css = getComputedStyle(cv);
    const col = (n: string) => css.getPropertyValue(n).trim();
    const ctx = cv.getContext("2d")!;
    const { contours, ops, toolpath, sheet, selectedId, showOrder, showRapids = true } = propsRef.current;
    const px = 1 / v.scale;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col("--bg-canvas");
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(dpr * v.scale, 0, 0, -dpr * v.scale, dpr * v.tx, dpr * v.ty);

    // sheet + grid
    ctx.fillStyle = col("--cam-sheet");
    ctx.fillRect(0, 0, sheet.widthMm, sheet.heightMm);
    ctx.strokeStyle = col("--cam-grid");
    ctx.lineWidth = px;
    const step = v.scale > 3 ? 10 : 50;
    ctx.beginPath();
    for (let x = 0; x <= sheet.widthMm; x += step) (ctx.moveTo(x, 0), ctx.lineTo(x, sheet.heightMm));
    for (let y = 0; y <= sheet.heightMm; y += step) (ctx.moveTo(0, y), ctx.lineTo(sheet.widthMm, y));
    ctx.stroke();

    // rapids + leads from the toolpath
    let pos: Vec2 = { x: 0, y: sheet.heightMm };
    const rapid = new Path2D();
    const lead = new Path2D();
    for (const b of toolpath.blocks) {
      for (const m of b.moves) {
        if (m.type === "rapid") {
          rapid.moveTo(pos.x, pos.y);
          rapid.lineTo(m.to.x, m.to.y);
          pos = m.to;
        } else if (m.type === "line" || m.type === "arc") {
          if (m.tag === "lead" || m.tag === "leadOut") {
            lead.moveTo(pos.x, pos.y);
            if (m.type === "line") lead.lineTo(m.to.x, m.to.y);
            else addArc(lead, pos, m.to, m.center, m.ccw, m.full);
          }
          pos = m.to;
        }
      }
    }
    if (showRapids) {
      ctx.setLineDash([4 * px, 3 * px]);
      ctx.strokeStyle = col("--cam-rapid");
      ctx.lineWidth = px;
      ctx.stroke(rapid);
      ctx.setLineDash([]);
    }

    // contours
    const opBy = new Map(ops.map((o) => [o.contourId, o]));
    for (const c of contours) {
      const op = opBy.get(c.id);
      const path = contourPath(c);
      const sel = c.id === selectedId;
      ctx.strokeStyle = sel ? col("--cam-selected") : op?.action.value === "mark" ? col("--cam-mark") : c.closed ? col("--cam-cut") : col("--cam-open");
      ctx.lineWidth = (sel ? 2.4 : 1.5) * px;
      ctx.stroke(path);
    }
    ctx.strokeStyle = col("--cam-lead");
    ctx.lineWidth = 1.2 * px;
    ctx.stroke(lead);

    // pierce points + order numbers (screen space for text)
    ctx.fillStyle = col("--cam-pierce");
    for (const b of toolpath.blocks) {
      ctx.beginPath();
      ctx.arc(b.pierce.x, b.pierce.y, 2.2 * px, 0, Math.PI * 2);
      ctx.fill();
    }
    if (showOrder) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "11px system-ui";
      ctx.fillStyle = col("--text");
      for (const b of toolpath.blocks) ctx.fillText(String(b.order), v.tx + b.pierce.x * v.scale + 4, v.ty - b.pierce.y * v.scale - 4);
    }
  }

  return <canvas ref={ref} aria-label="CAM canvas" />;
}

function contourPath(c: Contour): Path2D {
  const p = new Path2D();
  const first = c.segments[0];
  if (!first) return p;
  p.moveTo(first.a.x, first.a.y);
  for (const s of c.segments) addSeg(p, s);
  if (c.closed) p.closePath();
  return p;
}

function addSeg(p: Path2D, s: Segment) {
  if (s.kind === "line") p.lineTo(s.b.x, s.b.y);
  else addArc(p, s.a, s.b, s.c, s.ccw, s.full);
}

/** Canvas angles grow with +Y; under the Y-flip transform that is math-CCW, so anticlockwise = !ccw. */
function addArc(p: Path2D, a: Vec2, b: Vec2, c: Vec2, ccw: boolean, full?: boolean) {
  const r = Math.hypot(a.x - c.x, a.y - c.y);
  const a0 = Math.atan2(a.y - c.y, a.x - c.x);
  const a1 = full ? a0 + (ccw ? 2 * Math.PI : -2 * Math.PI) : Math.atan2(b.y - c.y, b.x - c.x);
  p.arc(c.x, c.y, r, a0, a1, !ccw);
}

