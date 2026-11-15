import { Vec3 } from 'cc';
import type { Stage } from '../Stage';
import { inTruck } from '../Stage';
import type { Cube } from '../cube/CubeTypes';
import { PIECE_COLS, PIECE_LAYERS, PIECE_SLICES, BLOCK_GAP } from '../ViewConfig';

const MOUTH_OUT = 0.1;
const MOUTH_RISE = 0.25;

export function blockSize(stage: Stage, truck: number) {
  return { w: stage.layout.trucks[truck].width * stage.blockWidth, len: stage.layout.unit - BLOCK_GAP };
}

export function cellPos(stage: Stage, truck: number, index: number, stack: number, col: number, out: Vec3): Vec3 {
  const slot = stage.layout.trucks[truck], { w, len } = blockSize(stage, truck);
  const slice = Math.floor(stack / PIECE_LAYERS), layer = stack % PIECE_LAYERS;
  const along = slot.length - (index + 0.5) * stage.layout.unit + ((PIECE_SLICES - 1) / 2 - slice) * (len / PIECE_SLICES);
  const across = (col - (PIECE_COLS - 1) / 2) * (w / PIECE_COLS);
  const height = stage.blockTop - stage.blockH + (layer + 0.5) * (stage.blockH / PIECE_LAYERS);
  return inTruck(stage, truck, along, across, height, out);
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

export function freeSides(stack: number, col: number, cells?: (Cube | null)[]): number {
  const taken = (slice: number, layer: number, c: number) =>
    slice >= 0 && slice < PIECE_SLICES && layer >= 0 && layer < PIECE_LAYERS && c >= 0 && c < PIECE_COLS &&
    (!cells || !!cells[(slice * PIECE_LAYERS + layer) * PIECE_COLS + c]);
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
