import { Node, Vec3, Quat } from 'cc';

export interface Pieces {
  truck: number;
  index: number;
  color: string;
  cells: (Cube | null)[];
}

export interface Landing {
  truck: number;
  index: number;
  cubes: Cube[];
  need: number;
  left: number;
  dead: boolean;
  pieces: Pieces;
}

export interface Cube {
  node: Node;
  color: string;
  mode: 'belt' | 'toBelt' | 'toTruck' | 'landed';
  slot: number;
  along: number;
  across: number;
  height: number;
  size: number;
  dA: number;
  dC: number;
  pdA: number;
  pdC: number;
  vmax: number;
  creep: number;
  lx: number;
  ly: number;
  lh: number;
  tx: number;
  ty: number;
  ang: number;
  spinAxis: Vec3;
  spinRate: number;
  truck: number;
  home: number;
  gateF: number;
  landDA: number;
  ride: boolean;
  launched: boolean;
  delay: number;
  t: number;
  dur: number;
  wob: number;
  from: Vec3;
  to: Vec3;
  ctrl: Vec3;
  s0: Vec3;
  s1: Vec3;
  q0: Quat;
  q1: Quat;
  group: Landing | null;
  cell: number;
  pieces: Pieces | null;
  stack: number;
  col: number;
}
