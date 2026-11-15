import { Vec3, Quat } from 'cc';
import type { Cube } from './CubeTypes';

const WEAVE = 0.09;
const WEAVE_RATE = 7;

const tmpV = new Vec3();
const tmpQ = new Quat();

export function advanceFlight(c: Cube, target: Vec3, dt: number, out: Vec3): Vec3 {
  c.t = Math.min(1, c.t + dt / c.dur);
  const t = c.t * c.t * (3 - 2 * c.t), u = 1 - t;
  out.set(
    u * u * c.from.x + 2 * u * t * c.ctrl.x + t * t * target.x,
    u * u * c.from.y + 2 * u * t * c.ctrl.y + t * t * target.y,
    u * u * c.from.z + 2 * u * t * c.ctrl.z + t * t * target.z);
  if (c.mode === 'toBelt') out.x += Math.sin(t * Math.PI) * Math.sin(c.wob + t * WEAVE_RATE) * WEAVE;
  c.node.setPosition(out);
  Vec3.lerp(tmpV, c.s0, c.s1, t);
  c.node.setScale(tmpV);
  Quat.slerp(tmpQ, c.q0, c.q1, t);
  c.node.setRotation(tmpQ);
  return out;
}

export function rememberStart(c: Cube) {
  c.from.set(c.node.position);
  c.s0.set(c.node.scale);
  c.q0.set(c.node.rotation);
}
