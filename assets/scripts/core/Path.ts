import type { BeltPathData } from './Level';

export interface Pt { x: number; y: number }

export interface Path {
  length: number;
  at(f: number): Pt;
  tangent(f: number): Pt;
  height(f: number): number;
  nearest(p: Pt): number;
}

const ARC_STEPS = 10;

export function buildPath(d: BeltPathData): Path {
  const P = d.points.map(p => ({ x: p[0], y: p[1], h: p[2] || 0 }));
  const n = P.length;
  const pts: (Pt & { h: number })[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], p = P[i], b = P[(i + 1) % n];
    const la = Math.hypot(a.x - p.x, a.y - p.y), lb = Math.hypot(b.x - p.x, b.y - p.y);
    const d1 = { x: (a.x - p.x) / la, y: (a.y - p.y) / la };
    const d2 = { x: (b.x - p.x) / lb, y: (b.y - p.y) / lb };
    const theta = Math.acos(Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y)));
    const tanHalf = Math.tan(theta / 2);
    let t = d.radius > 0 && tanHalf > 1e-6 && theta < Math.PI - 1e-3 ? d.radius / tanHalf : 0;
    t = Math.min(t, la / 2, lb / 2);
    if (t < 1e-6) { pts.push(p); continue; }

    const h0 = p.h + (a.h - p.h) * (t / la), h1 = p.h + (b.h - p.h) * (t / lb);
    const r = t * tanHalf;
    const bx = d1.x + d2.x, by = d1.y + d2.y, bl = Math.hypot(bx, by);
    const cd = r / Math.sin(theta / 2);
    const c = { x: p.x + (bx / bl) * cd, y: p.y + (by / bl) * cd };
    const a0 = Math.atan2(p.y + d1.y * t - c.y, p.x + d1.x * t - c.x);
    let sweep = Math.atan2(p.y + d2.y * t - c.y, p.x + d2.x * t - c.x) - a0;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    for (let k = 0; k <= ARC_STEPS; k++) {
      const ang = a0 + (sweep * k) / ARC_STEPS;
      pts.push({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r, h: h0 + ((h1 - h0) * k) / ARC_STEPS });
    }
  }
  const m = pts.length;
  const cum: number[] = [0];
  for (let i = 0; i < m; i++) {
    const q = pts[(i + 1) % m];
    cum.push(cum[i] + Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
  }
  const length = cum[m];

  const locate = (f: number) => {
    const dist = (((f % 1) + 1) % 1) * length;
    let lo = 0, hi = m - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= dist) lo = mid; else hi = mid - 1; }
    const seg = cum[lo + 1] - cum[lo];
    return { i: lo, u: seg > 0 ? (dist - cum[lo]) / seg : 0 };
  };

  return {
    length,
    at(f) {
      const { i, u } = locate(f);
      const a = pts[i], b = pts[(i + 1) % m];
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    },
    height(f) {
      const { i, u } = locate(f);
      return pts[i].h + (pts[(i + 1) % m].h - pts[i].h) * u;
    },
    tangent(f) {
      let { i } = locate(f);
      for (let k = 0; k < m; k++, i = (i + 1) % m) {
        const a = pts[i], b = pts[(i + 1) % m];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        if (l > 1e-9) return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
      }
      return { x: 1, y: 0 };
    },
    nearest(p) {
      let best = Infinity, bestF = 0;
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[(i + 1) % m];
        const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
        const u = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
        const qx = a.x + dx * u, qy = a.y + dy * u;
        const dd = (p.x - qx) * (p.x - qx) + (p.y - qy) * (p.y - qy);
        if (dd < best) { best = dd; bestF = (cum[i] + (cum[i + 1] - cum[i]) * u) / length; }
      }
      return bestF % 1;
    },
  };
}
