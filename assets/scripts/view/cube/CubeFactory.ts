import { Node, Vec3, Quat, Mesh, MeshRenderer } from 'cc';
import type { Stage } from '../Stage';
import type { Cube } from './CubeTypes';
import { lit } from '../Materials';
import { CUBE_ROWS, CUBE_COLS, CUBES_PER_UNIT, tuning } from '../ViewConfig';

const jitter = () => Math.random() - 0.5;

function createNode(stage: Stage, color: string, shape: Mesh, scale: Vec3): Node {
  const node = new Node('Cube');
  const mr = node.addComponent(MeshRenderer);
  mr.mesh = shape;
  mr.setMaterial(stage.colorMats[color], 0);
  lit(mr);
  node.setScale(scale);
  node.setRotationFromEuler(Math.random() * 44 - 22, Math.random() * 360, Math.random() * 44 - 22);
  stage.root.addChild(node);
  return node;
}

export function createCube(stage: Stage, color: string, index: number): Cube {
  const size = tuning.cubeSize * (0.95 + Math.random() * 0.1);
  const v = tuning.cubeVariety;
  const prop = new Vec3(1 + jitter() * 2 * v, 1 + jitter() * 1.5 * v, 1 + jitter() * 2 * v);
  const shape = stage.cubeShapes[Math.floor(Math.random() * stage.cubeShapes.length)];
  const look = new Vec3(size * prop.x, size * prop.y, size * prop.z);
  const node = createNode(stage, color, shape, look);
  const half = stage.state.level.beltPath.width / 2 - tuning.cubeSize * 0.62;
  const row = Math.floor(index / CUBE_COLS) % CUBE_ROWS, col = index % CUBE_COLS;
  const onTop = (row + col) % 2 === 0;
  const cube: Cube = {
    node, shape, prop, color, mode: 'belt', slot: 0, truck: -1, size, ride: false, launched: false,
    dA: 0, dC: 0, creep: 0, vmax: 2.0 + Math.random() * 1.4, gateF: 0, landDA: 0, cell: 0,
    lx: 0, ly: 0, lh: 0, tx: 1, ty: 0,
    pieces: null, stack: 0, col: 0, ctrl: new Vec3(),
    s0: look.clone(), s1: look.clone(), q0: new Quat(), q1: new Quat(),
    along: (row + 0.5) / CUBE_ROWS - 0.5 + jitter() * 0.12,
    across: (col - (CUBE_COLS - 1) / 2) * (half * 2 / CUBE_COLS) * 1.15 + jitter() * 0.14,
    height: onTop ? tuning.cubeSize * 1.35 + Math.random() * 0.04 : tuning.cubeSize * 0.56 + Math.random() * 0.03,
    from: new Vec3(), to: new Vec3(), t: 0, dur: 0.3, delay: 0, group: null,
    spinAxis: new Vec3(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5).normalize(),
    spinRate: (0.25 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1),
    ang: NaN, pdA: 0, pdC: 0, wob: 0, home: 0,
    pouring: false, pourAge: 0, pourStart: 0, pourAlong: 0, pourAcross: 0, pourHeight: 0,
  };
  if (index >= CUBES_PER_UNIT - tuning.stragglers) {
    cube.along -= 0.7 + Math.random() * 1.3;
    cube.vmax = 0.5 + Math.random() * 0.3;
  }
  return cube;
}
