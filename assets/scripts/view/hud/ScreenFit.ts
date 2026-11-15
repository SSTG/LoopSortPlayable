import { Node, Camera, Vec3, UITransform, Widget, Size, view, screen, ResolutionPolicy } from 'cc';
import { measureCanvasCut } from './CanvasCut';

const CUT_CHANGE = 0.002;
const MOVED = 0.5;

export class ScreenFit {
  w = 720;
  h = 1280;
  scale = 1;
  cut = [0, 0, 0, 0];

  private ox = 0;
  private oy = 0;
  private setW = 0;
  private setH = 0;
  private setX = 0;
  private setY = 0;
  private lastWin = new Size(0, 0);

  constructor(private node: Node) {}

  fit(shortSide: number): boolean {
    const win = screen.windowSize;
    const cut = measureCanvasCut();
    const sameCut = cut.every((v, i) => Math.abs(v - this.cut[i]) < CUT_CHANGE);
    if (win.width === this.lastWin.width && win.height === this.lastWin.height && sameCut && !this.wasMoved()) return false;
    this.lastWin.set(win.width, win.height);
    this.cut = cut;
    this.matchDesignToWindow(win.width / Math.max(1, win.height), shortSide);
    this.coverVisibleArea(shortSide);
    this.node.getComponentsInChildren(Widget).forEach(w => w.updateAlignment());
    return true;
  }

  toCanvas(camera: Camera, world: Vec3, out: Vec3): Vec3 {
    camera.worldToScreen(world, out);
    const win = screen.windowSize;
    return out.set(((out.x / win.width - 0.5) * this.w - this.ox) / this.scale, ((out.y / win.height - 0.5) * this.h - this.oy) / this.scale, 0);
  }

  private wasMoved(): boolean {
    const ut = this.node.getComponent(UITransform);
    if (!ut) return false;
    const p = this.node.position;
    return Math.abs(ut.width - this.setW) > MOVED || Math.abs(ut.height - this.setH) > MOVED || Math.abs(p.x - this.setX) > MOVED || Math.abs(p.y - this.setY) > MOVED;
  }

  private matchDesignToWindow(aspect: number, shortSide: number) {
    if (aspect < 1) { this.w = shortSide; this.h = Math.round(shortSide / aspect); }
    else { this.h = shortSide; this.w = Math.round(shortSide * aspect); }
    view.setDesignResolutionSize(this.w, this.h, ResolutionPolicy.SHOW_ALL);
  }

  private coverVisibleArea(shortSide: number) {
    const [l, r, t, b] = this.cut;
    const vw = this.w * (1 - l - r), vh = this.h * (1 - t - b);
    this.scale = Math.min(vw, vh) / shortSide;
    this.node.setScale(this.scale, this.scale, 1);
    this.setW = vw / this.scale;
    this.setH = vh / this.scale;
    const ut = this.node.getComponent(UITransform);
    if (ut) ut.setContentSize(this.setW, this.setH);
    this.ox = (this.w * (l - r)) / 2;
    this.oy = (this.h * (b - t)) / 2;
    this.setX = this.w / 2 + this.ox;
    this.setY = this.h / 2 + this.oy;
    this.node.setPosition(this.setX, this.setY, 0);
  }
}
