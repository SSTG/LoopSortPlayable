import { Node, Vec3, Color, Graphics, tween } from 'cc';
import { makeUiNode } from './UiNode';
import { burstConfetti } from './Confetti';

const GREEN = new Color(54, 196, 74, 255);
const WHITE = new Color(255, 255, 255, 255);
const TICK = [[-14, 0], [-4, -11], [15, 11]];
const FIRST = Math.hypot(TICK[1][0] - TICK[0][0], TICK[1][1] - TICK[0][1]);
const SECOND = Math.hypot(TICK[2][0] - TICK[1][0], TICK[2][1] - TICK[1][1]);
const POP_TIME = 0.4;
const DRAW_TIME = 0.5;

function drawTick(g: Graphics, progress: number) {
  g.clear();
  g.fillColor = GREEN;
  g.circle(0, 0, 30); g.fill();
  g.lineWidth = 5; g.strokeColor = WHITE;
  g.circle(0, 0, 30); g.stroke();
  if (progress <= 0) return;
  const len = progress * (FIRST + SECOND), a = Math.min(1, len / FIRST), b = Math.max(0, (len - FIRST) / SECOND);
  g.lineWidth = 9; g.lineCap = Graphics.LineCap.ROUND; g.lineJoin = Graphics.LineJoin.ROUND;
  g.moveTo(TICK[0][0], TICK[0][1]);
  g.lineTo(TICK[0][0] + (TICK[1][0] - TICK[0][0]) * a, TICK[0][1] + (TICK[1][1] - TICK[0][1]) * a);
  if (b > 0) g.lineTo(TICK[1][0] + (TICK[2][0] - TICK[1][0]) * b, TICK[1][1] + (TICK[2][1] - TICK[1][1]) * b);
  g.stroke();
}

export class CheckMarks {
  private nodes: Record<number, Node> = {};
  private k = 1;

  show(parent: Node, id: number, animate: boolean, delay: number) {
    if (this.nodes[id]) return;
    const n = makeUiNode('Check' + id, parent, 64, 64);
    const g = n.addComponent(Graphics);
    this.nodes[id] = n;
    if (!animate) { drawTick(g, 1); n.setScale(this.k, this.k, 1); return; }
    drawTick(g, 0);
    n.setScale(0, 0, 1);
    const pen = { p: 0 };
    const finish = () => { if (n.isValid) { drawTick(g, 1); burstConfetti(parent, n.position, this.k); } };
    tween(n).delay(delay).to(POP_TIME, { scale: new Vec3(this.k, this.k, 1) }, { easing: 'backOut' })
      .call(() => {
        tween(pen).to(DRAW_TIME, { p: 1 }, { onUpdate: () => { if (n.isValid) drawTick(g, pen.p); } }).call(finish).start();
      }).start();
  }

  place(id: number, position: Vec3) {
    const n = this.nodes[id];
    if (n) n.setPosition(position);
  }

  setScale(k: number) {
    this.k = k;
    for (const id of Object.keys(this.nodes)) this.nodes[+id].setScale(k, k, 1);
  }

  clear() {
    for (const id of Object.keys(this.nodes)) this.nodes[+id].destroy();
    this.nodes = {};
  }
}
