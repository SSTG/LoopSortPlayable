import { Material, MeshRenderer, Vec3, Vec4, Mesh } from 'cc';
import type { Stage } from '../Stage';
import type { Cube, Pieces } from '../cube/CubeTypes';
import type { BlockShapes } from './BlockShapes';
import { cellPos, cellScale, freeSides, holeSides, innerShade } from './BlockGrid';
import { makeToon } from '../Materials';
import { PIECE_COLS, PIECE_LAYERS, PIECE_COUNT, tuning } from '../ViewConfig';

const SHADE_STEPS = 4;
// Seconds for the hole shade to ease most of the way to its new look when a neighbouring cube arrives or leaves.
const SHADE_EASE = 0.12;
// A landing cube settles into its place with a short squash, rather than snapping square.
const SETTLE_TIME = 0.22;
const SETTLE_SQUASH = 0.14;

export function emptyPieces(truck: number, index: number, color: string): Pieces {
  return { truck, index, color, cells: new Array(PIECE_COUNT).fill(null), before: null, after: null };
}

// Soft shade state of one seated piece: its open sides now (easing) and where they are heading.
interface Shade {
  cube: Cube;
  mat: Material;
  now: number[];
  want: number[];
  settle: number;
  // The mesh whose size the shader was last told (pieces change mesh as their neighbours come and go).
  mesh: Mesh | null;
}

export class BlockPieces {
  private tmp = new Vec3();
  private v4 = new Vec4();
  // Per colour, the block material at each step of inner shadow (step 0 is the normal lit block). Only used when
  // the block shader can't do the soft per-pixel shade.
  private shaded: Record<string, Material[]> = {};
  private shades = new Map<Cube, Shade>();
  private soft: boolean | null = null;

  constructor(private stage: Stage, private shapes: BlockShapes) {}

  // A landing cube passes settle = true to squash into place; cubes laid out at once (a block about to pour) don't.
  seat(c: Cube, p: Pieces, stack: number, col: number, settle = false) {
    c.pieces = p; c.stack = stack; c.col = col;
    p.cells[stack * PIECE_COLS + col] = c;
    c.node.setPosition(cellPos(this.stage, p.truck, p.index, stack, col, this.tmp));
    c.node.setScale(cellScale(this.stage, p.truck, this.tmp));
    c.node.setRotation(this.stage.truckTurn[p.truck]);
    const mr = c.node.getComponent(MeshRenderer)!;
    mr.setMaterial(this.stage.blockMats[c.color], 0);
    if (!this.softShade(c.color)) return;
    const mat = mr.getMaterialInstance(0)!;
    const layer = stack % PIECE_LAYERS;
    mat.setProperty('holeParams', this.v4.set(0, tuning.innerShadow, PIECE_LAYERS - 1 - layer, PIECE_LAYERS));
    mat.setProperty('holeOpen', this.v4.set(0, 0, 0, 0));
    // A piece laid out with the rest of its block starts at its true shade; a landing one eases in from fully lit.
    const shade: Shade = { cube: c, mat, now: [0, 0, 0, 0, 0], want: [0, 0, 0, 0, 0], settle: settle ? SETTLE_TIME : 0, mesh: null };
    if (!settle) holeSides(stack, col, p.cells, p.before, p.after, shade.now);
    this.shades.set(c, shade);
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
    this.shades.delete(c);
    if (!c.pieces) return;
    c.pieces.cells[c.stack * PIECE_COLS + c.col] = null;
    c.pieces = null;
  }

  // Whether the block shader has the soft hole shade (the toon effect); otherwise fall back to stepped materials.
  private softShade(color: string): boolean {
    if (this.soft === null) {
      const pass = this.stage.blockMats[color]?.passes?.[0];
      this.soft = !!(pass && pass.getHandle('holeOpen'));
    }
    return this.soft;
  }

  private shadeMat(color: string, shade: number): Material {
    const step = Math.round(Math.max(0, Math.min(1, shade)) * (SHADE_STEPS - 1));
    if (step === 0 || tuning.innerShadow <= 0) return this.stage.blockMats[color];
    const mats = this.shaded[color] || (this.shaded[color] = []);
    return mats[step] || (mats[step] = makeToon(this.stage.state.level.colors[color], false, true, undefined,
      1 - tuning.innerShadow * step / (SHADE_STEPS - 1)));
  }

  private extent(mesh: Mesh) {
    const lo = mesh.struct.minPosition, hi = mesh.struct.maxPosition;
    if (!lo || !hi) return this.v4.set(0.5, 0.5, 0.5, 0);
    return this.v4.set((hi.x - lo.x) / 2, (hi.y - lo.y) / 2, (hi.z - lo.z) / 2, 0);
  }

  fit(p: Pieces) {
    for (const c of p.cells) {
      if (!c || !c.node) continue;
      const mesh = this.shapes.pieceMesh(freeSides(c.stack, c.col, p.cells, p.before, p.after));
      const mr = c.node.getComponent(MeshRenderer)!;
      const shade = this.shades.get(c);
      if (shade) {
        if (mr.mesh !== mesh) mr.mesh = mesh;
        if (shade.mesh !== mesh) { shade.mesh = mesh; shade.mat.setProperty('holeExtent', this.extent(mesh)); }
        holeSides(c.stack, c.col, p.cells, p.before, p.after, shade.want);
        this.apply(shade);
        continue;
      }
      if (mr.mesh !== mesh) mr.mesh = mesh;
      const mat = this.shadeMat(c.color, innerShade(c.stack, c.col, p.cells, p.before, p.after));
      if (mr.sharedMaterial !== mat) mr.setMaterial(mat, 0);
    }
  }

  // Eases each seated piece's hole shade towards its target and plays out landing squashes.
  step(dt: number) {
    if (this.shades.size === 0) return;
    const k = 1 - Math.exp(-dt / SHADE_EASE);
    this.shades.forEach(s => {
      if (!s.cube.node || !s.cube.node.isValid) { this.shades.delete(s.cube); return; }
      let moved = false;
      for (let i = 0; i < 5; i++) {
        const d = s.want[i] - s.now[i];
        if (Math.abs(d) < 1e-3) { if (d !== 0) { s.now[i] = s.want[i]; moved = true; } continue; }
        s.now[i] += d * k;
        moved = true;
      }
      if (moved) this.apply(s);
      if (s.settle > 0) this.settle(s, dt);
    });
  }

  private apply(s: Shade) {
    s.mat.setProperty('holeParams', this.v4.set(s.now[0], tuning.innerShadow, PIECE_LAYERS - 1 - s.cube.stack % PIECE_LAYERS, PIECE_LAYERS));
    s.mat.setProperty('holeOpen', this.v4.set(s.now[1], s.now[2], s.now[3], s.now[4]));
  }

  // Squash down and spread a little on touchdown, then spring back to fill the cell exactly. The piece stays sitting
  // on whatever is under it, so it squashes onto it rather than lifting off.
  private settle(s: Shade, dt: number) {
    const c = s.cube, p = c.pieces;
    if (!p) { s.settle = 0; return; }
    s.settle = Math.max(0, s.settle - dt);
    const t = 1 - s.settle / SETTLE_TIME, fade = (1 - t) * (1 - t);
    const squash = SETTLE_SQUASH * Math.cos(t * Math.PI * 1.5) * fade;
    cellScale(this.stage, p.truck, this.tmp);
    const h = this.tmp.y;
    this.tmp.x *= 1 + squash * 0.5;
    this.tmp.y *= 1 - squash;
    this.tmp.z *= 1 + squash * 0.5;
    c.node.setScale(this.tmp);
    cellPos(this.stage, p.truck, p.index, c.stack, c.col, this.tmp);
    this.tmp.y -= h * squash / 2;
    c.node.setPosition(this.tmp);
  }
}
