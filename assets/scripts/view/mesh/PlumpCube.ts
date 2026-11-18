import { Mesh, utils } from 'cc';

const STEPS = 10;
const cache = new Map<string, Mesh>();

// A soft, plump cube about one unit across: a superellipsoid |x|^n + |y|^n + |z|^n = r^n.
// A low n (around 3) gives heavily rounded edges and faces that bulge; a higher n gets closer to a box.
// `reach` is the half-size at the middle of each face.
export function plumpCube(n: number, reach = 0.52): Mesh {
  const key = n.toFixed(2) + '_' + reach.toFixed(3);
  const hit = cache.get(key);
  if (hit) return hit;
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const faces: [number, number, number, number][] = [
    [0, 1, 2, 1], [0, 2, 1, -1], [1, 2, 0, 1], [1, 0, 2, -1], [2, 0, 1, 1], [2, 1, 0, -1],
  ];
  const p = [0, 0, 0];
  // Wind each triangle so its front faces outward (along the vertex normals), whichever face of the cube it is on;
  // otherwise half the faces are culled and the cube looks hollow.
  const tri = (i: number, j: number, k: number) => {
    const ux = positions[j * 3] - positions[i * 3], uy = positions[j * 3 + 1] - positions[i * 3 + 1], uz = positions[j * 3 + 2] - positions[i * 3 + 2];
    const vx = positions[k * 3] - positions[i * 3], vy = positions[k * 3 + 1] - positions[i * 3 + 1], vz = positions[k * 3 + 2] - positions[i * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = normals[i * 3] + normals[j * 3] + normals[k * 3];
    const my = normals[i * 3 + 1] + normals[j * 3 + 1] + normals[k * 3 + 1];
    const mz = normals[i * 3 + 2] + normals[j * 3 + 2] + normals[k * 3 + 2];
    if (nx * mx + ny * my + nz * mz >= 0) indices.push(i, j, k); else indices.push(i, k, j);
  };
  for (const [a, b, c, s] of faces) {
    const base = positions.length / 3;
    for (let i = 0; i <= STEPS; i++) for (let j = 0; j <= STEPS; j++) {
      // Spread the grid with tan so the corners, where the curve is tightest, get as many vertices as the faces.
      p[a] = s;
      p[b] = Math.tan((i / STEPS - 0.5) * Math.PI / 2);
      p[c] = Math.tan((j / STEPS - 0.5) * Math.PI / 2);
      const len = Math.pow(Math.pow(Math.abs(p[0]), n) + Math.pow(Math.abs(p[1]), n) + Math.pow(Math.abs(p[2]), n), 1 / n);
      const q = p.map(v => v / len);
      const g = q.map(v => Math.sign(v) * Math.pow(Math.abs(v), n - 1));
      const gl = Math.hypot(g[0], g[1], g[2]) || 1;
      positions.push(q[0] * reach, q[1] * reach, q[2] * reach);
      normals.push(g[0] / gl, g[1] / gl, g[2] / gl);
    }
    const row = STEPS + 1;
    for (let i = 0; i < STEPS; i++) for (let j = 0; j < STEPS; j++) {
      const v0 = base + i * row + j, v1 = v0 + 1, v2 = v0 + row, v3 = v2 + 1;
      tri(v0, v2, v1);
      tri(v1, v2, v3);
    }
  }
  const mesh = utils.MeshUtils.createMesh({ positions, normals, indices });
  cache.set(key, mesh);
  return mesh;
}
