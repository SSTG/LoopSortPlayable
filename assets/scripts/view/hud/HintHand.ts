import { Node, Vec3, tween, Tween } from 'cc';
import type { RestScale } from './RestScale';

const PULSE_TIME = 0.4;

export class HintHand {
  constructor(private rest: RestScale) {}

  show(hint: Node, position: Vec3, size: number, pulse: number) {
    hint.setPosition(position);
    if (hint.active) return;
    const s = this.rest.of(hint).clone().multiplyScalar(size);
    const small = new Vec3(s.x * pulse, s.y * pulse, s.z);
    hint.active = true;
    hint.setScale(s);
    tween(hint).repeatForever(
      tween(hint).to(PULSE_TIME, { scale: small }, { easing: 'sineInOut' }).to(PULSE_TIME, { scale: s.clone() }, { easing: 'sineInOut' })).start();
  }

  hide(hint: Node) {
    if (!hint.active) return;
    Tween.stopAllByTarget(hint);
    hint.active = false;
  }
}
