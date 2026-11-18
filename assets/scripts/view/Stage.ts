import { Node, Vec3, Quat, Mesh, Material } from 'cc';
import type { GameState } from '../core/Rules';
import type { Layout } from '../core/Layout';

export interface Stage {
  root: Node;
  layout: Layout;
  state: GameState;
  beltY: number;
  blockTop: number;
  blockWidth: number;
  blockH: number;
  truckTurn: Quat[];
  // Plump cube shapes, a little different from each other; each cube picks one.
  cubeShapes: Mesh[];
  colorMats: Record<string, Material>;
  blockMats: Record<string, Material>;
}

export function inTruck(stage: Stage, truck: number, along: number, across: number, height: number, out: Vec3): Vec3 {
  const t = stage.layout.trucks[truck];
  return out.set(t.mx - t.fx * along + t.fy * across, height, -(t.my - t.fy * along - t.fx * across));
}
