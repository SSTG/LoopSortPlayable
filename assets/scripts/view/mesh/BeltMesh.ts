import { Mesh, utils } from 'cc';
import type { Path } from '../../core/Path';

function strip(path: Path, samples: number, offA: number, yA: number, offB: number, yB: number,
               positions: number[], normals: number[], indices: number[]) {
  const base = positions.length / 3;
  for (let i = 0; i <= samples; i++) {
    const f = (i % samples) / samples;
    const c = path.at(f), t = path.tangent(f);
    const nx = -t.y, ny = t.x;
    const ax = c.x + nx * offA, ay = c.y + ny * offA;
    const bx = c.x + nx * offB, by = c.y + ny * offB;
    positions.push(ax, yA, -ay, bx, yB, -by);

    const dOff = offB - offA, dY = yB - yA, l = Math.hypot(dOff, dY) || 1;
    let nOff = -dY / l, nUp = dOff / l;
    if (nUp < 0 || (nUp === 0 && nOff * (offA + offB) < 0)) { nOff = -nOff; nUp = -nUp; }
    for (let k = 0; k < 2; k++) normals.push(nx * nOff, nUp, -ny * nOff);
  }
  for (let i = 0; i < samples; i++) {
    const a = base + i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
}

function toMesh(positions: number[], normals: number[], indices: number[]): Mesh {
  return utils.MeshUtils.createMesh({ positions, normals, indices });
}

export function buildBeltFloor(path: Path, width: number): Mesh {
  const p: number[] = [], n: number[] = [], idx: number[] = [];
  strip(path, 240, -width / 2, 0.02, width / 2, 0.02, p, n, idx);
  return toMesh(p, n, idx);
}

export function buildBeltRims(path: Path, width: number, rim: number, height: number): Mesh {
  const p: number[] = [], n: number[] = [], idx: number[] = [];
  for (const side of [-1, 1]) {
    const inner = side * (width / 2), outer = side * (width / 2 + rim);
    strip(path, 240, inner, 0, inner, height, p, n, idx);
    strip(path, 240, inner, height, outer, height, p, n, idx);
    strip(path, 240, outer, height, outer, 0, p, n, idx);
  }
  return toMesh(p, n, idx);
}
