import type { Geo } from './ModelBake';

const FACES = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];

function cubeTurns(): number[][][] {
  const out: number[][][] = [];
  const perms = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]];
  perms.forEach((perm, pi) => {
    for (let bits = 0; bits < 8; bits++) {
      const sg = [bits & 1 ? -1 : 1, bits & 2 ? -1 : 1, bits & 4 ? -1 : 1];
      if ((pi < 3 ? 1 : -1) * sg[0] * sg[1] * sg[2] < 0) continue;
      const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let r = 0; r < 3; r++) m[r][perm[r]] = sg[r];
      out.push(m);
    }
  });
  return out;
}

const mul = (m: number[][], v: number[]) => m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

export function turnPiece(g: Geo, from: number[], to: number[]): Geo {
  const want = to.slice().sort().join();
  for (const m of cubeTurns()) {
    const got = from.map(f => { const v = mul(m, FACES[f]); return FACES.findIndex(n => n[0] === v[0] && n[1] === v[1] && n[2] === v[2]); });
    if (got.sort().join() !== want) continue;
    const positions: number[] = [], normals: number[] = [];
    for (let k = 0; k < g.positions.length; k += 3) {
      positions.push(...mul(m, [g.positions[k], g.positions[k + 1], g.positions[k + 2]]));
      normals.push(...mul(m, [g.normals[k], g.normals[k + 1], g.normals[k + 2]]));
    }
    return { positions, normals, indices: g.indices };
  }
  return g;
}
