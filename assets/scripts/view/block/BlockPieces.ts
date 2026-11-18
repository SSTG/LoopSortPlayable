import { Material, MeshRenderer, Vec3 } from 'cc';
import type { Stage } from '../Stage';
import type { Cube, Pieces } from '../cube/CubeTypes';
import type { BlockShapes } from './BlockShapes';
import { cellPos, cellScale, freeSides, innerShade } from './BlockGrid';
import { makeToon } from '../Materials';
import { PIECE_COLS, PIECE_COUNT, tuning } from '../ViewConfig';

const SHADE_STEPS = 4;

export function emptyPieces(truck: number, index: number, color: string): Pieces {
  return { truck, index, color, cells: new Array(PIECE_COUNT).fill(null), before: null, after: null };
}

export class BlockPieces {
  private tmp = new Vec3();
  // Per colour, the block material at each step of inner shadow (step 0 is the normal lit block).
  private shaded: Record<string, Material[]> = {};

  constructor(private stage: Stage, private shapes: BlockShapes) {}

  seat(c: Cube, p: Pieces, stack: number, col: number) {
    c.pieces = p; c.stack = stack; c.col = col;
    p.cells[stack * PIECE_COLS + col] = c;
    c.node.setPosition(cellPos(this.stage, p.truck, p.index, stack, col, this.tmp));
    c.node.setScale(cellScale(this.stage, p.truck, this.tmp));
    c.node.setRotation(this.stage.truckTurn[p.truck]);
    c.node.getComponent(MeshRenderer)!.setMaterial(this.stage.blockMats[c.color], 0);
  }

  unseat(c: Cube) {
    const p = c.pieces;
    if (!p) return;
    this.release(c);
    this.fit(p);
    // The linked units' faces against this one may now be showing.
    if (p.before) this.fit(p.before);
    if (p.after) this.fit(p.after);
  }

  release(c: Cube) {
    if (!c.pieces) return;
    c.pieces.cells[c.stack * PIECE_COLS + c.col] = null;
    c.pieces = null;
  }

  private shadeMat(color: string, shade: number): Material {
    const step = Math.round(Math.max(0, Math.min(1, shade)) * (SHADE_STEPS - 1));
    if (step === 0 || tuning.innerShadow <= 0) return this.stage.blockMats[color];
    const mats = this.shaded[color] || (this.shaded[color] = []);
    return mats[step] || (mats[step] = makeToon(this.stage.state.level.colors[color], false, true, undefined,
      1 - tuning.innerShadow * step / (SHADE_STEPS - 1)));
  }

  fit(p: Pieces) {
    for (const c of p.cells) {
      if (!c || !c.node) continue;
      const mesh = this.shapes.pieceMesh(freeSides(c.stack, c.col, p.cells, p.before, p.after));
      const mr = c.node.getComponent(MeshRenderer)!;
      if (mr.mesh !== mesh) mr.mesh = mesh;
      const mat = this.shadeMat(c.color, innerShade(c.stack, c.col, p.cells, p.before, p.after));
      if (mr.sharedMaterial !== mat) mr.setMaterial(mat, 0);
    }
  }
}
