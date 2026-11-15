import { Node, Vec3, UIOpacity, tween, Tween } from 'cc';
import type { RestScale } from './RestScale';

const FADE_TIME = 0.25;
const FIRST_POP = 0.15;
const POP_TIME = 0.32;
const PULSE = 1.07;

export class Cards {
  private card: Node | null = null;

  constructor(private rest: RestScale) {}

  open(card: Node | null, pulsePlay: boolean, stagger: number) {
    this.hide();
    if (!card) return;
    this.card = card;
    card.active = true;
    const op = card.getComponent(UIOpacity) || card.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 0;
    tween(op).to(FADE_TIME, { opacity: 255 }).start();
    let delay = FIRST_POP;
    card.children.forEach((child, i) => {
      if (i === 0) return;
      this.pop(child, delay, pulsePlay && child.name === 'Play');
      delay += stagger;
    });
  }

  hide() {
    const card = this.card;
    if (!card) return;
    for (const child of card.children) {
      Tween.stopAllByTarget(child);
      const s = this.rest.known(child);
      if (s) child.setScale(s);
    }
    card.active = false;
    this.card = null;
  }

  private pop(child: Node, delay: number, pulse: boolean) {
    const s = this.rest.of(child);
    Tween.stopAllByTarget(child);
    child.setScale(0, 0, 1);
    const t = tween(child).delay(delay).to(POP_TIME, { scale: s.clone() }, { easing: 'backOut' });
    if (pulse) {
      const big = new Vec3(s.x * PULSE, s.y * PULSE, s.z);
      t.delay(0.2).call(() => {
        tween(child).repeatForever(tween(child).to(0.5, { scale: big }).to(0.5, { scale: s.clone() })).start();
      });
    }
    t.start();
  }
}
