import { Vec3 } from 'cc';
import type { Stage } from '../Stage';
import { inTruck } from '../Stage';
import type { Cube, Pieces } from '../cube/CubeTypes';
import { PIECE_COLS, PIECE_LAYERS, PIECE_SLICES, BLOCK_GAP } from '../ViewConfig';

const MOUTH_OUT = 0.1;
const MOUTH_RISE = 0.25;

export function blockSize(stage: Stage, truck: number) {
  return { w: stage.layout.trucks[truck].width * stage.blockWidth, len: stage.layout.unit - BLOCK_GAP };
}

// Where a piece of a block sits, in the truck's own terms (distance in from the mouth, offset across, height).
export function cellLocal(stage: Stage, truck: number, index: number, stack: number, col: number) {
  const slot = stage.layout.trucks[truck], { w, len } = blockSize(stage, truck);
  const slice = Math.floor(stack / PIECE_LAYERS), layer = stack % PIECE_LAYERS;
  return {
    along: slot.length - (index + 0.5) * stage.layout.unit + ((PIECE_SLICES - 1) / 2 - slice) * (len / PIECE_SLICES),
    across: (col - (PIECE_COLS - 1) / 2) * (w / PIECE_COLS),
    height: stage.blockTop - stage.blockH + (layer + 0.5) * (stage.blockH / PIECE_LAYERS),
  };
}

export function cellPos(stage: Stage, truck: number, index: number, stack: number, col: number, out: Vec3): Vec3 {
  const p = cellLocal(stage, truck, index, stack, col);
  return inTruck(stage, truck, p.along, p.across, p.height, out);
}

export function cellScale(stage: Stage, truck: number, out: Vec3): Vec3 {
  const { w, len } = blockSize(stage, truck);
  return out.set(w / PIECE_COLS, stage.blockH / PIECE_LAYERS, len / PIECE_SLICES);
}

export function leftFirst(stage: Stage, truck: number): boolean {
  return stage.layout.trucks[truck].fy >= 0;
}

export function mouthPos(stage: Stage, truck: number, out: Vec3): Vec3 {
  return inTruck(stage, truck, -MOUTH_OUT, 0, stage.blockTop + MOUTH_RISE, out);
}

// How shaded a piece of a partly-there block should look (0 = fully lit, 1 = deepest shade). A piece next to a gap
// inside the block - a cube that has already left, or not landed yet - forms a wall or the floor of that hole, so it
// is in the hole's shadow, more so the lower it sits. The block's own outside faces don't count.
export function innerShade(stack: number, col: number, cells: (Cube | null)[], before: Pieces | null, after: Pieces | null): number {
  const gap = (slice: number, layer: number, c: number) => {
    if (layer < 0 || layer >= PIECE_LAYERS || c < 0 || c >= PIECE_COLS) return false;
    let from = cells;
    if (slice < 0) { if (!before) return false; from = before.cells; slice += PIECE_SLICES; }
    else if (slice >= PIECE_SLICES) { if (!after) return false; from = after.cells; slice -= PIECE_SLICES; }
    return !from[(slice * PIECE_LAYERS + layer) * PIECE_COLS + c];
  };
  const slice = Math.floor(stack / PIECE_LAYERS), layer = stack % PIECE_LAYERS;
  // A gap above makes this piece the floor of a hole; gaps beside it make it a wall. A gap below is out of sight.
  const open = [gap(slice, layer + 1, col), gap(slice, layer, col - 1), gap(slice, layer, col + 1),
    gap(slice + 1, layer, col), gap(slice - 1, layer, col)].filter(Boolean).length;
  if (open === 0) return 0;
  const depth = PIECE_LAYERS > 1 ? (PIECE_LAYERS - 1 - layer) / (PIECE_LAYERS - 1) : 1;
  return Math.min(1, open / 2) * (0.55 + 0.45 * depth);
}

// Which sides of a piece face a gap inside the block, for the soft hole shading in the block shader:
// [above, -x (col - 1), +x (col + 1), -z (slice + 1), +z (slice - 1)], each 1 when open. Written into `out`.
export function holeSides(stack: number, col: number, cells: (Cube | null)[], before: Pieces | null, after: Pieces | null, out: number[]): number[] {
  const gap = (slice: number, layer: number, c: number) => {
    if (layer < 0 || layer >= PIECE_LAYERS || c < 0 || c >= PIECE_COLS) return 0;
    let from = cells;
    if (slice < 0) { if (!before) return 0; from = before.cells; slice += PIECE_SLICES; }
    else if (slice >= PIECE_SLICES) { if (!after) return 0; from = after.cells; slice -= PIECE_SLICES; }
    return from[(slice * PIECE_LAYERS + layer) * PIECE_COLS + c] ? 0 : 1;
  };
  const slice = Math.floor(stack / PIECE_LAYERS), layer = stack % PIECE_LAYERS;
  out[0] = gap(slice, layer + 1, col);
  out[1] = gap(slice, layer, col - 1);
  out[2] = gap(slice, layer, col + 1);
  out[3] = gap(slice + 1, layer, col);
  out[4] = gap(slice - 1, layer, col);
  return out;
}

export function freeSides(stack: number, col: number, cells?: (Cube | null)[], before?: Pieces | null, after?: Pieces | null): number {
  const taken = (slice: number, layer: number, c: number) => {
    if (layer < 0 || layer >= PIECE_LAYERS || c < 0 || c >= PIECE_COLS) return false;
    let from = cells;
    // Slices past either end belong to the linked unit next to this one, if there is one.
    if (slice < 0) { if (!before) return false; from = before.cells; slice += PIECE_SLICES; }
    else if (slice >= PIECE_SLICES) { if (!after) return false; from = after.cells; slice -= PIECE_SLICES; }
    return !from || !!from[(slice * PIECE_LAYERS + layer) * PIECE_COLS + c];
  };
  const slice = Math.floor(stack / PIECE_LAYERS), layer = stack % PIECE_LAYERS;
  const free = [
    !taken(slice, layer, col - 1), !taken(slice, layer, col + 1),
    !taken(slice, layer - 1, col), !taken(slice, layer + 1, col),
    !taken(slice + 1, layer, col), !taken(slice - 1, layer, col),
  ];
  let mask = 0;
  for (let k = 0; k < 6; k++) if (free[k]) mask |= 1 << k;
  return mask;
}
