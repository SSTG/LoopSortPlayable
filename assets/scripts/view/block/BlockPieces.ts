import { MeshRenderer, Vec3 } from 'cc';
import type { Stage } from '../Stage';
import type { Cube, Pieces } from '../cube/CubeTypes';
import type { BlockShapes } from './BlockShapes';
import { cellPos, cellScale, freeSides } from './BlockGrid';
import { PIECE_COLS, PIECE_COUNT } from '../ViewConfig';

export function emptyPieces(truck: number, index: number, color: string): Pieces {
  return { truck, index, color, cells: new Array(PIECE_COUNT).fill(null) };
}

export class BlockPieces {
  private tmp = new Vec3();

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
  }

  release(c: Cube) {
    if (!c.pieces) return;
    c.pieces.cells[c.stack * PIECE_COLS + c.col] = null;
    c.pieces = null;
  }

  fit(p: Pieces) {
    for (const c of p.cells) {
      if (!c || !c.node) continue;
      const mesh = this.shapes.pieceMesh(freeSides(c.stack, c.col, p.cells));
      const mr = c.node.getComponent(MeshRenderer)!;
      if (mr.mesh !== mesh) mr.mesh = mesh;
    }
  }
}
