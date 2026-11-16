import { Vec3, Quat } from 'cc';
import type { Stage } from '../Stage';
import type { Cube } from '../cube/CubeTypes';
import { GLIDE, UP, tuning, crowdSpeed } from '../ViewConfig';

const CATCH_UP_FROM = 1.2;
const CATCH_UP_SPEED = 2.6;
const SIDE_SPEED = 1.5;
const SAME_LAYER = 0.08;
const SAME_LEVEL = 0.2;
const ENTRY_REACH = 0.12;
const PASSED_GATE = 0.6;
const MAX_WAIT_TICKS = 5;

export class BeltMotion {
  private tmpQ = new Quat();
  private tmpQ2 = new Quat();

  constructor(private stage: Stage) {}

  position(c: Cube, visualOffset: number, out: Vec3): Vec3 {
    const path = this.stage.layout.path;
    const f = this.fraction(c, visualOffset);
    const p = path.at(f), t = path.tangent(f);
    const reach = this.stage.state.level.beltPath.width / 2 - tuning.cubeSize * 0.62;
    const across = Math.max(-reach, Math.min(reach, c.across + c.dC));
    c.tx = t.x; c.ty = t.y;
    c.lx = p.x - t.y * across; c.ly = p.y + t.x * across; c.lh = path.height(f);
    return out.set(c.lx, this.stage.beltY + c.lh + c.height, -c.ly);
  }

  entry(c: Cube, visualOffset: number, out: Vec3): Vec3 {
    const n = this.stage.state.ring.length, path = this.stage.layout.path;
    let d = this.slotFraction(c, visualOffset) - c.gateF;
    d -= Math.round(d);
    const reach = Math.max(-ENTRY_REACH / n, Math.min(ENTRY_REACH / n, d));
    c.landDA = (reach - d) * path.length;
    const f = c.gateF + reach;
    const p = path.at(f), t = path.tangent(f);
    return out.set(p.x - t.y * c.across, this.stage.beltY + path.height(f) + c.height, -(p.y + t.x * c.across));
  }

  gateFraction(truck: number): number {
    return (this.stage.state.gates[truck] + this.stage.layout.phase) / this.stage.state.ring.length;
  }

  timeToGate(c: Cube, visualOffset: number, gateF: number, tickDur: number): number {
    let d = gateF - this.fraction(c, visualOffset);
    d -= Math.floor(d);
    if (d > PASSED_GATE) return 0;
    return Math.min(d * this.stage.state.ring.length * tickDur, tickDur * MAX_WAIT_TICKS);
  }

  // True once the cube, riding the belt, has reached (or just passed) the gate at gateF.
  atGate(c: Cube, visualOffset: number, gateF: number): boolean {
    let d = gateF - this.fraction(c, visualOffset);
    d -= Math.floor(d);
    return d > PASSED_GATE;
  }

  tumble(c: Cube, dt: number) {
    const a = Math.atan2(c.ty, c.tx);
    let turn = isNaN(c.ang) ? 0 : a - c.ang;
    if (turn > Math.PI) turn -= Math.PI * 2; else if (turn < -Math.PI) turn += Math.PI * 2;
    c.ang = a;
    const jostle = Math.abs(c.dA - c.pdA) + Math.abs(c.dC - c.pdC);
    c.pdA = c.dA; c.pdC = c.dC;
    Quat.fromAxisAngle(this.tmpQ, UP, turn);
    Quat.multiply(this.tmpQ2, this.tmpQ, c.node.rotation);
    Quat.fromAxisAngle(this.tmpQ, c.spinAxis, c.spinRate * dt + jostle * 3 * Math.sign(c.spinRate));
    Quat.multiply(this.tmpQ2, this.tmpQ2, this.tmpQ);
    Quat.normalize(this.tmpQ2, this.tmpQ2);
    c.node.setRotation(this.tmpQ2);
  }

  settle(dt: number, onBelt: Cube[], arriving: Cube[]) {
    this.glideHome(dt, onBelt);
    for (let pass = 0; pass < 2; pass++) {
      this.separate(onBelt);
      this.makeRoom(arriving, onBelt);
    }
  }

  private slotFraction(c: Cube, visualOffset: number): number {
    return (c.slot + c.along + visualOffset - 0.5 + this.stage.layout.phase) / this.stage.state.ring.length;
  }

  private fraction(c: Cube, visualOffset: number): number {
    return this.slotFraction(c, visualOffset) + c.dA / this.stage.layout.path.length;
  }

  private glideHome(dt: number, onBelt: Cube[]) {
    const pitch = this.stage.layout.path.length / this.stage.state.ring.length;
    for (const c of onBelt) {
      const vmax = c.creep > 0 ? c.creep * Math.max(1, Math.abs(c.dA) / pitch)
        : Math.abs(c.dA) > CATCH_UP_FROM ? Math.max(c.vmax, CATCH_UP_SPEED) : c.vmax;
      const stepA = Math.max(-vmax, Math.min(vmax, -c.dA * GLIDE)) * dt;
      c.dA = Math.abs(stepA) >= Math.abs(c.dA) ? 0 : c.dA + stepA;
      if (c.dA === 0) c.creep = 0;
      const stepC = Math.max(-SIDE_SPEED, Math.min(SIDE_SPEED, -c.dC * GLIDE)) * dt;
      c.dC = Math.abs(stepC) >= Math.abs(c.dC) ? 0 : c.dC + stepC;
    }
  }

  private overlap(a: Cube, b: Cube): number {
    const sx = b.lx - a.lx, sy = b.ly - a.ly, d2 = sx * sx + sy * sy;
    const r = tuning.pushRadius;
    if (d2 >= r * r || d2 < 1e-8) return 0;
    if (Math.abs(a.height - b.height) > SAME_LAYER || Math.abs(a.lh - b.lh) > SAME_LEVEL) return 0;
    const d = Math.sqrt(d2);
    return (r - d) / d;
  }

  private separate(onBelt: Cube[]) {
    for (let i = 0; i < onBelt.length; i++) {
      const a = onBelt[i];
      for (let j = i + 1; j < onBelt.length; j++) {
        const b = onBelt[j];
        const push = this.overlap(a, b) * 0.5;
        if (push === 0) continue;
        const px = (b.lx - a.lx) * push, py = (b.ly - a.ly) * push;
        this.shove(a, -px, -py);
        this.shove(b, px, py);
        if (a.creep > 0 && b.creep === 0) b.creep = crowdSpeed();
        else if (b.creep > 0 && a.creep === 0) a.creep = crowdSpeed();
      }
    }
  }

  private makeRoom(arriving: Cube[], onBelt: Cube[]) {
    for (const a of arriving) {
      for (const b of onBelt) {
        const push = this.overlap(a, b);
        if (push === 0) continue;
        this.shove(b, (b.lx - a.lx) * push, (b.ly - a.ly) * push);
        if (b.creep === 0) b.creep = crowdSpeed();
      }
    }
  }

  private shove(c: Cube, px: number, py: number) {
    c.dA += px * c.tx + py * c.ty;
    c.dC += -px * c.ty + py * c.tx;
    c.lx += px;
    c.ly += py;
  }
}
