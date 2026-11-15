import { beltSpeed } from '../core/Rules';

const SPEED_EASE = 2.5;

export class BeltClock {
  progress = 0;
  speed = 1;

  reset() {
    this.progress = 0;
    this.speed = 1;
  }

  advance(dt: number, load: number, capacity: number, fullSpeedTick: number): number {
    const want = beltSpeed(load, capacity);
    this.speed += (want - this.speed) * Math.min(1, dt * SPEED_EASE);
    this.progress += (dt * this.speed) / fullSpeedTick;
    const ticks = Math.floor(this.progress);
    this.progress -= ticks;
    return ticks;
  }
}
