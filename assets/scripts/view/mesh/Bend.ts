import type { Path } from '../../core/Path';
import type { Geo } from './ModelBake';

export function stretchZ(g: Geo, lo: number, hi: number, extra: number): Geo {
  const positions = g.positions.slice();
  for (let k = 2; k < positions.length; k += 3) {
    const z = positions[k];
    positions[k] = z <= lo ? z - extra / 2 : z >= hi ? z + extra / 2 : z + extra * ((z - lo) / (hi - lo) - 0.5);
  }
  return { positions, normals: g.normals, indices: g.indices };
}

export function bendAlongPath(g: Geo, path: Path, scale: number, lift: number, sectionLength: number): Geo {
  const copies = Math.max(8, Math.round(path.length / sectionLength));
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const count = g.positions.length / 3;
  for (let c = 0; c < copies; c++) {
    const base = positions.length / 3;
    for (let k = 0; k < count; k++) {
      const x = g.positions[k * 3], y = g.positions[k * 3 + 1], z = g.positions[k * 3 + 2];
      const f = (c + (z + 1) / 2) / copies;
      const at = path.at(f), t = path.tangent(f);
      const nx = -t.y, ny = t.x;
      positions.push(at.x + nx * x * scale, y * scale + lift + path.height(f), -(at.y + ny * x * scale));
      const ax = g.normals[k * 3], ay = g.normals[k * 3 + 1], az = g.normals[k * 3 + 2];
      normals.push(nx * ax + t.x * az, ay, -(ny * ax + t.y * az));
    }
    for (let k = 0; k < g.indices.length; k++) indices.push(base + g.indices[k]);
  }
  return { positions, normals, indices };
}
