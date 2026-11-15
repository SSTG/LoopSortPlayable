import { Mesh, utils } from 'cc';

const cache = new Map<string, Mesh>();

export function roundedBox(w: number, h: number, l: number, r: number, steps = 3): Mesh {
  const key = [w, h, l, r, steps].map(v => v.toFixed(3)).join('_');
  const hit = cache.get(key);
  if (hit) return hit;

  const half = [w / 2, h / 2, l / 2];
  r = Math.min(r, half[0], half[1], half[2]);
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];

  const samples = (hf: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i <= steps; i++) out.push(-hf + (r * i) / steps);
    for (let i = 0; i <= steps; i++) out.push(hf - r + (r * i) / steps);
    return out;
  };

  const faces: [number, number, number, number][] = [
    [0, 1, 2, 1], [0, 2, 1, -1], [1, 2, 0, 1], [1, 0, 2, -1], [2, 0, 1, 1], [2, 1, 0, -1],
  ];
  for (const [a, b, c, s] of faces) {
    const sb = samples(half[b]), sc = samples(half[c]);
    const base = positions.length / 3;
    for (const vb of sb) for (const vc of sc) {
      const p = [0, 0, 0];
      p[a] = s * half[a]; p[b] = vb; p[c] = vc;
      const inner = p.map((v, i) => Math.max(-(half[i] - r), Math.min(half[i] - r, v)));
      let nx = p[0] - inner[0], ny = p[1] - inner[1], nz = p[2] - inner[2];
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      positions.push(inner[0] + nx * r, inner[1] + ny * r, inner[2] + nz * r);
      normals.push(nx, ny, nz);
    }
    const nc = sc.length;
    for (let i = 0; i < sb.length - 1; i++) for (let j = 0; j < nc - 1; j++) {
      const v0 = base + i * nc + j, v1 = v0 + 1, v2 = v0 + nc, v3 = v2 + 1;
      if (s > 0) indices.push(v0, v2, v1, v1, v2, v3); else indices.push(v0, v1, v2, v1, v3, v2);
    }
  }
  const mesh = utils.MeshUtils.createMesh({ positions, normals, indices });
  cache.set(key, mesh);
  return mesh;
}
