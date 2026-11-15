import { Node, Vec3, Color, Graphics, UIOpacity, tween } from 'cc';
import { makeUiNode } from './UiNode';

const COLORS = ['#FFFFFF', '#FFD84A', '#FF5AD9', '#5AC8FF', '#7CF07C', '#FF8A3D'];
const PIECES = 44;
const FLY_TIME = 0.45;
const FALL_TIME = 0.9;

function makePiece(parent: Node, i: number): Node {
  const n = makeUiNode('Confetti', parent, 14, 14);
  const g = n.addComponent(Graphics);
  g.fillColor = new Color().fromHEX(COLORS[i % COLORS.length]);
  if (i % 3 === 0) g.circle(0, 0, 5); else g.rect(-7, -4, 14, 8);
  g.fill();
  return n;
}

export function burstConfetti(parent: Node, at: Vec3, k: number) {
  for (let i = 0; i < PIECES; i++) {
    const n = makePiece(parent, i);
    const op = n.addComponent(UIOpacity);
    const ang = Math.random() * Math.PI * 2, far = (50 + Math.random() * 120) * k;
    const out = new Vec3(at.x + Math.cos(ang) * far, at.y + Math.sin(ang) * far + 30 * k, 0);
    const down = new Vec3(out.x + (Math.random() - 0.5) * 30 * k, out.y - (70 + Math.random() * 50) * k, 0);
    n.setPosition(at);
    n.setScale(k, k, 1);
    n.angle = Math.random() * 360;
    tween(n).to(FLY_TIME, { position: out, angle: n.angle + 260 }, { easing: 'quadOut' })
      .to(FALL_TIME, { position: down, angle: n.angle + 620 }, { easing: 'quadIn' })
      .call(() => n.destroy()).start();
    tween(op).delay(FALL_TIME).to(FLY_TIME, { opacity: 0 }).start();
  }
}
