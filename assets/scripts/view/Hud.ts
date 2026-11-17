import { _decorator, Component, Node, Camera, UITransform, Label, Color, Graphics, Vec3, tween, Tween, EventTouch } from 'cc';
import { ScreenFit } from './hud/ScreenFit';
import { RestScale } from './hud/RestScale';
import { CheckMarks } from './hud/CheckMarks';
import { Cards } from './hud/Cards';
import { HintHand } from './hud/HintHand';
import { drawMuteIcon } from './hud/MuteIcon';

const { ccclass, property } = _decorator;

export interface HudHandlers {
  onGameTouch(screenX: number, screenY: number): void;
  onDownload(): void;
  onRetry(): void;
  onMute(muted: boolean): void;
}

const COUNTER_BOUNCE = 1.18;
const COUNTER_BOUNCE_TIME = 0.15;

@ccclass('Hud')
export class Hud extends Component {
  @property({ type: Node })
  touchCatcher: Node | null = null;

  @property({ type: Node, tooltip: 'The pointing hand of the tutorial. Its anchor point is the fingertip.' })
  hint: Node | null = null;

  @property({ type: Node, tooltip: 'Empty node the ticks and confetti of finished trucks are put under' })
  checks: Node | null = null;

  @property({ type: Node })
  counter: Node | null = null;

  @property({ type: Label })
  counterLabel: Label | null = null;

  @property({ type: Label })
  caption: Label | null = null;

  @property({ type: Node })
  download: Node | null = null;

  @property({ type: Node })
  mute: Node | null = null;

  @property({ type: Node, tooltip: 'Logo; tapping it also opens the store' })
  logo: Node | null = null;

  @property({ type: Label })
  banner: Label | null = null;

  @property({ type: Node })
  winCard: Node | null = null;

  @property({ type: Node })
  failCard: Node | null = null;

  @property
  shortSide = 720;

  @property
  fullColor = new Color(255, 90, 90, 255);

  @property
  cardStagger = 0.06;

  @property({ tooltip: 'Size the pointing hand shrinks to as it pulses (1 = no pulse)' })
  hintPulse = 0.8;

  @property
  worldUnit = 70;

  private screenFit: ScreenFit | null = null;
  private rest = new RestScale();
  private checkMarks = new CheckMarks();
  private cards = new Cards(this.rest);
  private hand = new HintHand(this.rest);
  private overlayScale = 1;
  private muted = false;
  private normalColor = new Color(255, 255, 255, 255);
  private tmp = new Vec3();

  private get screen(): ScreenFit {
    return this.screenFit || (this.screenFit = new ScreenFit(this.node));
  }

  init(handlers: HudHandlers, captionText: string) {
    if (this.touchCatcher) {
      this.touchCatcher.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
        const p = e.getLocation();
        handlers.onGameTouch(p.x, p.y);
      });
    }
    if (this.caption) this.caption.string = captionText;
    if (this.counterLabel) this.normalColor = this.counterLabel.color.clone();
    this.press(this.download, () => handlers.onDownload());
    this.press(this.logo, () => handlers.onDownload());
    this.initMute(handlers);
    this.initCards(handlers);
    if (this.hint) this.hint.active = false;
    if (this.banner) this.banner.node.active = false;
    this.fit();
  }

  fit(): boolean {
    return this.screen.fit(this.shortSide);
  }

  hidden(): number[] {
    return this.screen.cut;
  }

  bottomGap(): number {
    const w = this.screen.w;
    const edge = (n: Node | null, right: boolean) => {
      const ut = n && n.activeInHierarchy ? n.getComponent(UITransform) : null;
      if (!ut) return right ? w : 0;
      const box = ut.getBoundingBoxToWorld();
      return right ? box.xMin : box.xMax;
    };
    const left = Math.max(edge(this.download, false), edge(this.mute, false)), right = edge(this.logo, true);
    return Math.max(0, (2 * Math.min(w / 2 - left, right - w / 2)) / w);
  }

  setLevelScale(worldHeight: number) {
    const k = Math.min(1, this.screen.h / Math.max(0.001, worldHeight) / this.worldUnit / this.screen.scale);
    if (Math.abs(k - this.overlayScale) < 0.001) return;
    this.overlayScale = k;
    this.checkMarks.setScale(k);
    this.setHint(null, null);
  }

  setCounter(load: number, capacity: number) {
    const label = this.counterLabel;
    if (!label) return;
    const text = `${load}/${capacity}`;
    if (label.string === text) return;
    label.string = text;
    label.color = load >= capacity ? this.fullColor : this.normalColor;
    if (!this.counter) return;
    const s = this.rest.of(this.counter);
    Tween.stopAllByTarget(this.counter);
    this.counter.setScale(s.x * COUNTER_BOUNCE, s.y * COUNTER_BOUNCE, s.z);
    tween(this.counter).to(COUNTER_BOUNCE_TIME, { scale: s.clone() }).start();
  }

  setHint(camera: Camera | null, world: Vec3 | null) {
    if (!this.hint) return;
    if (!world || !camera) this.hand.hide(this.hint);
    else this.hand.show(this.hint, this.screen.toCanvas(camera, world, this.tmp), this.overlayScale, this.hintPulse);
  }

  showCheck(id: number, animate = true, delay = 0) {
    if (this.checks) this.checkMarks.show(this.checks, id, animate, delay);
  }

  placeCheck(id: number, camera: Camera, world: Vec3) {
    this.checkMarks.place(id, this.screen.toCanvas(camera, world, this.tmp));
  }

  clearChecks() {
    this.checkMarks.clear();
  }

  setBanner(text: string | null) {
    if (!this.banner) return;
    this.banner.node.active = !!text;
    if (text) this.banner.string = text;
  }

  hideCard() {
    this.cards.hide();
  }

  showWin() {
    this.openCard(this.winCard, true);
  }

  showFail() {
    this.openCard(this.failCard, false);
  }

  private openCard(card: Node | null, pulsePlay: boolean) {
    this.cards.hide();
    this.setHint(null, null);
    this.cards.open(card, pulsePlay, this.cardStagger);
  }

  private press(n: Node | null, cb: () => void) {
    if (n) n.on(Node.EventType.TOUCH_END, cb);
  }

  private initMute(handlers: HudHandlers) {
    if (!this.mute) return;
    const g = this.mute.getComponent(Graphics) || this.mute.addComponent(Graphics);
    this.press(this.mute, () => {
      this.muted = !this.muted;
      drawMuteIcon(g, this.muted);
      handlers.onMute(this.muted);
    });
    drawMuteIcon(g, this.muted);
  }

  private initCards(handlers: HudHandlers) {
    for (const card of [this.winCard, this.failCard]) {
      if (!card) continue;
      card.active = false;
      for (const child of card.children) {
        if (child.name === 'Play') this.press(child, () => handlers.onDownload());
        else if (child.name === 'Retry') this.press(child, () => handlers.onRetry());
      }
    }
  }
}
