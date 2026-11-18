import { Vec3 } from 'cc';
import type { Stage } from '../Stage';
import { inTruck } from '../Stage';
import type { Cube } from './CubeTypes';
import { blockSize } from '../block/BlockGrid';
import { tuning } from '../ViewConfig';

// Tapped block -> cubes: the block peels apart from its top and the cubes pour out in one single-file chain that
// snakes from side to side up the truck to its mouth (along = 0), where the normal hop onto the belt takes over.
// Every cube follows the same snaking line, so the stream reads as one rope of cubes.

const SPEED_UP = 0.07;      // seconds to reach full pour speed
const SETTLE_UNITS = 0.6;   // places travelled while a cube slides from its spot in the block onto the snaking line
const TAPER_END = 0.8;      // the sway dies away over this distance before the mouth
const GROW_TIME = 0.14;     // seconds a flat piece takes to puff up into a plump cube

const tmpV = new Vec3();

export function pourSpeed(stage: Stage, truck: number): number {
  return stage.layout.trucks[truck].length / Math.max(0.05, tuning.pourTime);
}

const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// Puff up with a little jelly overshoot; exactly 1 at t = 1.
function pop(scale: Vec3, t: number) {
  const k = tuning.popStrength, fade = (1 - t) * (1 - t);
  const swell = 1 + k * 0.6 * Math.sin(Math.PI * Math.min(1, t * 2)) * fade;
  const wobble = k * Math.sin(2.5 * Math.PI * t) * fade;
  scale.x *= swell * (1 - wobble * 0.5);
  scale.y *= swell * (1 + wobble);
  scale.z *= swell * (1 - wobble * 0.5);
}

// Moves the cube one frame along the pour. Returns true once it has reached the truck's mouth.
export function advancePour(stage: Stage, c: Cube, dt: number, now: number, out: Vec3): boolean {
  c.pourAge += dt;
  const speed = pourSpeed(stage, c.truck) * Math.min(1, c.pourAge / SPEED_UP);
  c.pourAlong = Math.max(0, c.pourAlong - speed * dt);

  const w = blockSize(stage, c.truck).w, unit = stage.layout.unit;
  const travelled = c.pourStart - c.pourAlong;
  const onLine = smooth(travelled / (SETTLE_UNITS * unit));
  const sway = tuning.pourSway * w * smooth(c.pourAlong / (TAPER_END * unit));
  const wave = sway * Math.sin((2 * Math.PI * c.pourAlong) / (tuning.pourWave * w) + now * tuning.pourDrift);
  const across = c.pourAcross + (wave - c.pourAcross) * onLine;
  const floor = stage.blockTop - stage.blockH + c.size * c.prop.y * 0.55;
  const height = c.pourHeight + (floor - c.pourHeight) * onLine;
  c.node.setPosition(inTruck(stage, c.truck, c.pourAlong, across, height, out));

  const g = Math.min(1, c.pourAge / GROW_TIME);
  Vec3.lerp(tmpV, c.s0, c.s1, smooth(g));
  pop(tmpV, g);
  c.node.setScale(tmpV);
  return c.pourAlong <= 0;
}
