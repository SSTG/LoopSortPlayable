import { Mesh } from 'cc';
import { toMesh } from './ModelBake';
import type { Geo } from './ModelBake';

function subdivide(g: Geo, levels: number): Geo {
  let positions = g.positions.slice(), normals = g.normals.slice(), indices = g.indices.slice();
  for (let l = 0; l < levels; l++) {
    const mids = new Map<number, number>();
    const count = positions.length / 3;
    const mid = (a: number, b: number): number => {
      const key = a < b ? a * count + b : b * count + a;
      const hit = mids.get(key);
      if (hit !== undefined) return hit;
      const at = positions.length / 3;
      for (let k = 0; k < 3; k++) {
        positions.push((positions[a * 3 + k] + positions[b * 3 + k]) / 2);
        normals.push((normals[a * 3 + k] + normals[b * 3 + k]) / 2);
      }
      mids.set(key, at);
      return at;
    };
    const next: number[] = [];
    for (let k = 0; k < indices.length; k += 3) {
      const a = indices[k], b = indices[k + 1], c = indices[k + 2];
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    indices = next;
  }
  return { positions, normals, indices };
}

export function roundOff(g: Geo, half: number[], bevel: number, levels: number, flatNegZ = false): Geo {
  const out = subdivide(g, levels);
  const { positions, normals } = out;
  for (let k = 0; k < positions.length; k += 3) {
    const core = [0, 0, 0], d = [0, 0, 0];
    for (let a = 0; a < 3; a++) {
      const v = positions[k + a], c = half[a] - bevel;
      core[a] = a === 2 && flatNegZ && v < 0 ? v : Math.max(-c, Math.min(c, v));
      d[a] = v - core[a];
    }
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-6) continue;
    for (let a = 0; a < 3; a++) {
      normals[k + a] = d[a] / len;
      positions[k + a] = core[a] + (d[a] / len) * bevel;
    }
  }
  return out;
}

const boxCache = new Map<string, Mesh>();

export function sliceBox(g: Geo, name: string, nativeHalf: number[], nativeBevel: number, w: number, h: number, l: number, bevel: number): Mesh {
  const key = name + [w, h, l, bevel].map(v => v.toFixed(3)).join('_');
  const hit = boxCache.get(key);
  if (hit) return hit;
  const half = [w / 2, h / 2, l / 2];
  const b = Math.min(bevel, half[0], half[1], half[2]);
  const positions = g.positions.slice();
  for (let k = 0; k < positions.length; k++) {
    const a = k % 3, v = positions[k];
    const inset = Math.min(nativeBevel, nativeHalf[a] - Math.abs(v));
    const edge = half[a] - (inset / nativeBevel) * b;
    positions[k] = Math.abs(v) >= nativeHalf[a] - nativeBevel ? Math.sign(v) * edge : (v / (nativeHalf[a] - nativeBevel)) * (half[a] - b);
  }
  const mesh = toMesh({ positions, normals: g.normals, indices: g.indices });
  boxCache.set(key, mesh);
  return mesh;
}
