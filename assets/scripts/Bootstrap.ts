import { _decorator, Component, Camera, Vec3, geometry, sys, JsonAsset, Prefab, Material, EffectAsset } from 'cc';
import { DEBUG } from 'cc/env';
import type { GameState, GameEvent, LevelData } from './core/Rules';
import { createState, tap, tick, load, canTap, tapCount, isWon, isLost, isComplete, levelCaption, redirectDue, beltLimit } from './core/Rules';
import { buildLayout } from './core/Layout';
import type { Layout } from './core/Layout';
import { findLevel, collectGameAssets } from './view/GameAssets';
import { GameView } from './view/GameView';
import { Hud } from './view/Hud';
import { SoundManager } from './view/SoundManager';
import { fitCamera } from './game/CameraFit';
import { HintGuide } from './game/HintGuide';
import { BeltClock } from './game/BeltClock';
import { warnAboutLevel } from './game/LevelWarnings';
import { adHooks, openStore, levelFor } from './game/AdBridge';

const { ccclass, property } = _decorator;

const AIM_HEIGHT = 0.8;
const MAX_FRAME = 0.1;
const WIN_PAUSE = 1.3;
const SOUND_DELAY = 0.3;

@ccclass('Bootstrap')
export class Bootstrap extends Component {
  @property
  levelName = 'level1';

  @property
  storeUrl = '';

  @property
  leaveImpression = true;

  @property({ type: Camera })
  camera: Camera | null = null;

  @property({ type: GameView, tooltip: 'Draws the level (the GameView component on the GameView node)' })
  gameView: GameView | null = null;

  @property({ type: Hud, tooltip: 'The UI (the Hud component on the Canvas node)' })
  hud: Hud | null = null;

  @property({ type: SoundManager })
  soundManager: SoundManager | null = null;

  @property
  beltTick = 0.45;

  @property
  hintIdle = 3;

  @property
  topReserve = 0.12;

  @property
  bottomReserve = 0.15;

  @property
  wideBottomReserve = 0.03;

  @property({ type: [JsonAsset], group: 'Assets' })
  levels: JsonAsset[] = [];

  @property({ type: Material, group: 'Assets' })
  baseMaterial: Material | null = null;

  @property({ type: EffectAsset, group: 'Assets' })
  toonEffect: EffectAsset | null = null;

  @property({ type: Prefab, group: 'Models' })
  Bus: Prefab | null = null;

  @property({ type: Prefab, group: 'Models' })
  ConveyorUp: Prefab | null = null;

  @property({ type: Prefab, group: 'Models' })
  CubeBeveled: Prefab | null = null;

  @property({ type: Prefab, group: 'Models' })
  CubeMiddle: Prefab | null = null;

  @property({ type: Prefab, group: 'Models' })
  CubeCorner: Prefab | null = null;

  @property({ type: Prefab, group: 'Models' })
  CubeFlat: Prefab | null = null;

  @property({ type: Prefab, group: 'Models' })
  Block: Prefab | null = null;

  @property({ type: Prefab, group: 'Models' })
  BlockCorner: Prefab | null = null;

  private ready = false;
  private level!: LevelData;
  private layout!: Layout;
  private state!: GameState;
  private clock = new BeltClock();
  private hint = new HintGuide();
  private ended = false;
  private winHold = 0;
  private taps = 0;
  private ray = new geometry.Ray();
  private tmp = new Vec3();

  start() {
    this.boot().catch(e => console.error('[LoopSort] failed to start:', e));
  }

  onDownload() {
    this.soundManager.play('ui');
    console.log('[LoopSort] download tapped');
    openStore(adHooks(), this.storeUrl, url => sys.openURL(url));
  }

  update(dt: number) {
    if (!this.ready) return;
    dt = Math.min(dt, MAX_FRAME);
    if (this.hud.fit()) { this.fitCamera(); this.hint.refresh(); }
    if (!this.ended) this.runBelt(dt);
    this.gameView.step(dt, this.ended ? 0 : this.clock.progress);
    this.hud.setCounter(load(this.state), beltLimit(this.level));
    this.placeChecks();
    this.winHold = Math.max(0, this.winHold - dt);
    if (this.ended || this.checkEnd()) return;
    this.updateHint(dt);
  }

  private async boot() {
    const level = findLevel(this.levels, levelFor(adHooks(), this.levelName));
    const assets = collectGameAssets(level, {
      Bus: this.Bus, ConveyorUp: this.ConveyorUp, CubeBeveled: this.CubeBeveled, CubeMiddle: this.CubeMiddle,
      CubeCorner: this.CubeCorner, CubeFlat: this.CubeFlat, Block: this.Block, BlockCorner: this.BlockCorner,
    }, this.baseMaterial, this.toonEffect);
    if (!this.camera || !this.hud || !this.soundManager || !this.gameView) {
      throw new Error('The Game node needs its Camera, Game View, Hud and Sound Manager set in the Inspector');
    }
    this.level = assets.level;
    this.layout = buildLayout(this.level);
    this.state = createState(this.level, this.layout.gates);
    this.gameView.init(assets, this.layout, this.state, this.beltTick, this.leaveImpression);
    this.wireSounds();
    this.hud.init({
      onGameTouch: (x, y) => this.onTouch(x, y),
      onDownload: () => this.onDownload(),
      onRetry: () => this.restart(),
      onMute: m => this.soundManager.setMuted(m),
    }, levelCaption(this.level));
    this.gameView.onComplete = truck => this.onTruckComplete(truck);
    this.showFinishedChecks();
    this.fitCamera();
    if (DEBUG) warnAboutLevel(this.state, this.levelName, this.hud);
    this.ready = true;
    this.adEvent('ready');
    this.scheduleOnce(() => this.soundManager.load(), SOUND_DELAY);
  }

  private adEvent(name: 'ready' | 'end') {
    const call = adHooks()[name];
    if (call) call();
  }

  private wireSounds() {
    this.gameView.onLanded = () => this.soundManager.play('pop', 0.7);
    this.gameView.onPiece = () => this.soundManager.playStream('cube', 0.5);
    this.gameView.onLeave = () => this.soundManager.playStream('cube', 0.35);
  }

  private onTruckComplete(truck: number) {
    const closed = this.gameView.outlineRunTime + this.gameView.lidTime;
    const ticked = closed + this.gameView.tickTime;
    this.hud.showCheck(truck, true, closed);
    this.scheduleOnce(() => this.soundManager.play('complete', 0.8), closed);
    this.scheduleOnce(() => this.soundManager.play('confetti', 0.9), ticked);
    this.winHold = ticked + WIN_PAUSE;
  }

  private showFinishedChecks() {
    this.state.trucks.forEach((_, t) => { if (this.gameView.finished(t)) this.hud.showCheck(t, false); });
  }

  private placeChecks() {
    this.state.trucks.forEach((_, t) => {
      if (this.gameView.finished(t)) this.hud.placeCheck(t, this.camera, this.gameView.truckWorldPos(t, this.tmp));
    });
  }

  private restart() {
    this.soundManager.play('ui');
    this.hud.hideCard();
    this.hud.clearChecks();
    this.state = createState(this.level, this.layout.gates);
    this.gameView.reset(this.state);
    this.showFinishedChecks();
    this.winHold = 0;
    this.clock.reset();
    this.hint.reset();
    this.ended = false;
    this.taps = 0;
  }

  private truckUnder(x: number, y: number): number {
    this.camera.screenPointToRay(x, y, this.ray);
    if (Math.abs(this.ray.d.y) < 1e-6) return -1;
    const k = (AIM_HEIGHT - this.ray.o.y) / this.ray.d.y;
    return this.gameView.truckAt(this.ray.o.x + this.ray.d.x * k, this.ray.o.z + this.ray.d.z * k);
  }

  private onTouch(x: number, y: number) {
    if (!this.ready || this.ended) return;
    this.soundManager.unlock();
    const truck = this.truckUnder(x, y);
    if (truck < 0 || isComplete(this.state, truck) || this.gameView.collecting(truck)) return;
    this.hint.onTap();
    if (!canTap(this.state, truck)) {
      this.gameView.shake(truck);
      this.soundManager.play('ui', 0.5);
      return;
    }
    this.sendOff(truck);
    this.soundManager.play('click');
    if (redirectDue(this.level, ++this.taps)) this.onDownload();
  }

  private sendOff(truck: number) {
    this.gameView.flushIncoming(truck);
    const stack = this.state.trucks[truck];
    const before = stack.length;
    const colors = stack.slice(before - tapCount(this.state, truck)).reverse();
    const events: GameEvent[] = [];
    tap(this.state, truck, events);
    this.gameView.eject(truck, colors, before);
    this.gameView.onEvents(events, this.clock.progress);
  }

  private fitCamera() {
    fitCamera(this.camera, this.layout.bounds, this.hud, { top: this.topReserve, bottom: this.bottomReserve, wideBottom: this.wideBottomReserve });
  }

  private runBelt(dt: number) {
    const ticks = this.clock.advance(dt, load(this.state), beltLimit(this.level), this.beltTick);
    this.gameView.tickDur = this.beltTick / this.clock.speed;
    for (let left = ticks - 1; left >= 0; left--) {
      const events = tick(this.state);
      if (events.some(e => e.type === 'drop')) this.hint.onActivity();
      this.gameView.onEvents(events, this.clock.progress + left);
    }
  }

  private checkEnd(): boolean {
    if (this.gameView.busy) return false;
    if (isWon(this.state) && this.winHold <= 0) {
      this.ended = true;
      this.soundManager.stopMusic();
      this.soundManager.play('win');
      this.hud.showWin();
      this.adEvent('end');
      this.onDownload();
      return true;
    }
    if (isLost(this.state)) {
      this.ended = true;
      this.soundManager.play('fail');
      this.hud.showFail();
      this.adEvent('end');
      return true;
    }
    return false;
  }

  private updateHint(dt: number) {
    if (this.gameView.busy) this.hint.onActivity();
    const truck = this.hint.update(dt, this.state, this.hintIdle);
    this.hud.setHint(this.camera, truck >= 0 ? this.gameView.truckWorldPos(truck, this.tmp) : null);
  }
}
