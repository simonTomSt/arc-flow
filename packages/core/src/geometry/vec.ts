/** 2D vector math. Internal geometry is millimetres, math orientation (X right, Y up). */
export interface Vec2 {
  x: number;
  y: number;
}

export const EPS = 1e-9;

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** Rotate +90° (counter-clockwise): the LEFT normal of a direction of travel. */
export const left = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });
/** Rotate -90° (clockwise): the RIGHT normal of a direction of travel. */
export const right = (a: Vec2): Vec2 => ({ x: a.y, y: -a.x });
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const near = (a: Vec2, b: Vec2, tol: number): boolean => dist(a, b) <= tol;
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);
export const polar = (c: Vec2, r: number, ang: number): Vec2 => ({ x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) });
export const rotate = (p: Vec2, ang: number, about: Vec2 = { x: 0, y: 0 }): Vec2 => {
  const s = Math.sin(ang);
  const c = Math.cos(ang);
  const dx = p.x - about.x;
  const dy = p.y - about.y;
  return { x: about.x + dx * c - dy * s, y: about.y + dx * s + dy * c };
};
