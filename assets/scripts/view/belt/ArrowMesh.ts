import { Mesh, utils } from 'cc';
import { tuning } from '../ViewConfig';

const ARC_STEPS = 6;

export function buildArrowMesh(scale: number): Mesh {
  const arrow = tuning.arrow;
  const hw = arrow.width * scale / 2, hl = arrow.length * scale / 2, r = arrow.round * scale;
  const corners = [[hl, 0], [-hl, -hw], [-hl, hw]];
  const positions = [0, 0, 0], normals = [0, 1, 0], indices: number[] = [];
  corners.forEach((c, i) => {
    const a = corners[(i + 2) % 3], b = corners[(i + 1) % 3];
    const la = Math.hypot(a[0] - c[0], a[1] - c[1]), lb = Math.hypot(b[0] - c[0], b[1] - c[1]);
    const ua = [(a[0] - c[0]) / la, (a[1] - c[1]) / la], ub = [(b[0] - c[0]) / lb, (b[1] - c[1]) / lb];
    const half = Math.acos(ua[0] * ub[0] + ua[1] * ub[1]) / 2;
    const t = r / Math.tan(half), bl = Math.hypot(ua[0] + ub[0], ua[1] + ub[1]), cd = r / Math.sin(half);
    const cx = c[0] + ((ua[0] + ub[0]) / bl) * cd, cy = c[1] + ((ua[1] + ub[1]) / bl) * cd;
    const a0 = Math.atan2(c[1] + ua[1] * t - cy, c[0] + ua[0] * t - cx);
    let sweep = Math.atan2(c[1] + ub[1] * t - cy, c[0] + ub[0] * t - cx) - a0;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    for (let k = 0; k <= ARC_STEPS; k++) {
      const ang = a0 + (sweep * k) / ARC_STEPS;
      positions.push(cx + Math.cos(ang) * r, 0, -(cy + Math.sin(ang) * r));
      normals.push(0, 1, 0);
    }
  });
  const count = positions.length / 3 - 1;
  for (let k = 0; k < count; k++) indices.push(0, 1 + k, 1 + (k + 1) % count);
  return utils.MeshUtils.createMesh({ positions, normals, indices });
}
