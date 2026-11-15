import { _decorator, Component, Node, Vec3, Color, MeshRenderer } from 'cc';
import type { GameState, GameEvent } from '../core/Rules';
import type { Layout } from '../core/Layout';
import type { GameAssets } from './GameAssets';
import type { Stage } from './Stage';
import type { Cube, Landing } from './cube/CubeTypes';
import { createCube } from './cube/CubeFactory';
import { advanceFlight, rememberStart } from './cube/CubeFlight';
import { BeltView } from './belt/BeltView';
import { BeltMotion } from './belt/BeltMotion';
import { BlockShapes } from './block/BlockShapes';
import { BlockPieces, emptyPieces } from './block/BlockPieces';
import { cellPos, cellScale, leftFirst, mouthPos } from './block/BlockGrid';
import { TruckView } from './truck/TruckView';
import { bake, toMesh, firstPart } from './mesh/ModelBake';
import { roundedBox } from './mesh/RoundedBox';
import { setEffects, makeToon, hexOf } from './Materials';
import { CUBES_PER_UNIT, PIECE_COLS, PIECE_ROWS, FILE_GAP, HIT_FROM, BLOCK_TALL, BUS, tuning, crowdSpeed } from './ViewConfig';

const { ccclass, property } = _decorator;

const UNUSED_BUS_PARTS = ['polySurface3', 'TopCover'];
const MAX_ROW_GAP = 0.2;
const LANDED_OFF_SPOT = 0.05;

@ccclass('GameView')
export class GameView extends Component {
  @property({ group: 'Cubes', tooltip: 'Size of a loose cube on the belt' })
  cubeSize = 0.25;
  @property({ group: 'Cubes', tooltip: 'Seconds from a tap until every cube it released is on the belt' })
  breakTime = 0.8;
  @property({ group: 'Cubes', tooltip: 'Seconds a cube takes from its block to the belt' })
  flyOutTime = 0.3;
  @property({ group: 'Cubes', tooltip: 'Seconds a cube takes from the belt into a truck' })
  flyInTime = 0.38;
  @property({ group: 'Cubes', tooltip: 'Cubes closer than this collide and are pushed apart (about a cube\'s width)' })
  collideRadius = 0.24;
  @property({ group: 'Cubes', tooltip: 'Speed at which cubes crowded by a new block drift back to their place' })
  crowdDrift = 0.35;
  @property({ group: 'Cubes', tooltip: 'Cubes of each block (of 24) that trail behind the rest on the belt' })
  stragglers = 6;

  @property({ group: 'Blocks', tooltip: 'Width of the black line round the top block of a truck' })
  topOutline = 0.005;
  @property({ group: 'Blocks', tooltip: 'Colour of the mark a block leaves behind in its truck' })
  impressionColor = new Color(143, 134, 172, 255);
  @property({ group: 'Blocks', tooltip: 'Length of that mark as a share of the block that left' })
  impressionSize = 0.92;

  @property({ group: 'Finished truck', tooltip: 'Seconds the white outline takes to run from the headlights to the tail lights' })
  outlineRunTime = 0.45;
  @property({ group: 'Finished truck', tooltip: 'Thickness of that white outline' })
  outlineThickness = 0.045;
  @property({ group: 'Finished truck', tooltip: 'Seconds the lid then takes to slide shut' })
  lidTime = 0.6;
  @property({ group: 'Finished truck', tooltip: 'How far the lid reaches past the blocks at the cab end' })
  lidExtra = 0.21;
  @property({ group: 'Finished truck', tooltip: 'Seconds the tick then takes to form' })
  tickTime = 0.9;
  @property({ group: 'Finished truck', tooltip: 'Seconds the white outline then takes to fade away' })
  outlineFadeTime = 0.4;

  @property({ group: 'Belt arrows', tooltip: 'Width of an arrow (the belt model is 1.2 wide)' })
  arrowWidth = 0.52;
  @property({ group: 'Belt arrows', tooltip: 'Length of an arrow' })
  arrowLength = 0.48;
  @property({ group: 'Belt arrows', tooltip: 'Belt length between one pair of arrows and the next' })
  arrowSpacing = 2;
  @property({ group: 'Belt arrows', tooltip: 'Colour of the arrows' })
  arrowColor = new Color(183, 163, 220, 255);

  onLanded: (() => void) | null = null;
  onPiece: (() => void) | null = null;
  onComplete: ((truck: number) => void) | null = null;
  onLeave: (() => void) | null = null;

  tickDur = 0.45;

  private stage!: Stage;
  private belt!: BeltView;
  private motion!: BeltMotion;
  private pieces!: BlockPieces;
  private trucks!: TruckView;
  private cubes: Cube[] = [];
  private waiting: Cube[][][] = [];
  private landings: Landing[] = [];
  private beltList: Cube[] = [];
  private arriveList: Cube[] = [];
  private tmp = new Vec3();
  private tmp2 = new Vec3();

  get root(): Node { return this.node; }

  get busy(): boolean { return this.cubes.some(c => c.mode !== 'belt'); }

  init(assets: GameAssets, layout: Layout, state: GameState, tickDur: number, leaveImpression = true) {
    this.tickDur = tickDur;
    this.applyTuning();
    setEffects(assets.baseMaterial ? assets.baseMaterial.effectAsset : null, assets.toonEffect);
    const models = assets.models;
    const cube = models.CubeBeveled ? bake(models.CubeBeveled) : null;
    this.stage = {
      root: this.node, layout, state, beltY: 0, blockTop: 0.7, blockWidth: 0.79, blockH: 0.7, truckTurn: [],
      cubeMesh: cube ? toMesh(firstPart(cube)) : roundedBox(1, 1, 1, 0.3, 2),
      colorMats: {}, blockMats: {},
    };
    const busParts = models.Bus ? bake(models.Bus, UNUSED_BUS_PARTS) : null;
    if (busParts) this.sizeBlocksToBus();
    for (const key of Object.keys(state.level.colors)) {
      this.stage.colorMats[key] = makeToon(state.level.colors[key], true, false);
      this.stage.blockMats[key] = makeToon(state.level.colors[key], false, true);
    }
    const shapes = new BlockShapes(this.stage, models);
    this.pieces = new BlockPieces(this.stage, shapes);
    this.motion = new BeltMotion(this.stage);
    this.belt = new BeltView(this.stage);
    this.belt.build(models.ConveyorUp);
    this.trucks = new TruckView(this.stage, shapes, busParts, leaveImpression);
    this.trucks.isForming = truck => this.landings.some(g => g.truck === truck && !g.dead && g.left < g.need);
    this.trucks.onComplete = truck => { if (this.onComplete) this.onComplete(truck); };
    state.trucks.forEach((_, i) => this.trucks.build(i));
    this.reset(state);
  }

  reset(state: GameState) {
    this.stage.state = state;
    for (const c of this.cubes) c.node.destroy();
    this.landings = [];
    this.cubes = [];
    this.waiting = state.trucks.map(() => []);
    state.ring.forEach((color, slot) => { if (color) this.spawnBeltUnit(slot, color); });
    this.trucks.reset();
  }

  collecting(truck: number): boolean { return this.trucks.collecting(truck); }

  finished(truck: number): boolean { return this.trucks.finished(truck); }

  truckWorldPos(i: number, out: Vec3): Vec3 { return this.trucks.worldPos(i, out); }

  truckAt(worldX: number, worldZ: number): number { return this.trucks.at(worldX, worldZ); }

  shake(truck: number) { this.trucks.shake(truck); }

  eject(truck: number, colors: string[], stackLenBefore: number) {
    this.trucks.blocksLeft(truck, colors.length, stackLenBefore);
    const stacks = colors.length * PIECE_ROWS;
    const lastStart = Math.max(0, tuning.breakTime - tuning.flyOut - (PIECE_COLS - 1) * FILE_GAP);
    const every = stacks > 1 ? Math.min(MAX_ROW_GAP, lastStart / (stacks - 1)) : 0;
    const fromLeft = leftFirst(this.stage, truck);
    colors.forEach((color, k) => {
      const index = stackLenBefore - 1 - k;
      const p = emptyPieces(truck, index, color);
      const unit: Cube[] = [];
      for (let row = 0; row < PIECE_ROWS; row++) for (let col = 0; col < PIECE_COLS; col++) {
        const c = this.addCube(color, row * PIECE_COLS + col);
        c.mode = 'toBelt'; c.slot = -1; c.truck = truck; c.home = index;
        c.t = 0; c.dur = tuning.flyOut; c.launched = false; c.ride = false;
        c.delay = (k * PIECE_ROWS + row) * every + (fromLeft ? PIECE_COLS - 1 - col : col) * FILE_GAP;
        c.wob = c.delay * 45;
        c.q1.set(c.node.rotation);
        mouthPos(this.stage, truck, c.ctrl);
        this.pieces.seat(c, p, PIECE_ROWS - 1 - row, col);
        unit.push(c);
      }
      this.pieces.fit(p);
      this.waiting[truck].push(unit);
    });
  }

  flushIncoming(truck: number) {
    if (!this.trucks.collecting(truck)) return;
    this.cubes = this.cubes.filter(c => {
      const claimed = c.group && c.group.truck === truck;
      if (!claimed && !((c.mode === 'toTruck' || c.mode === 'landed') && c.truck === truck)) return true;
      this.pieces.release(c);
      if (c.node) c.node.destroy();
      return false;
    });
    for (const g of this.landings) if (g.truck === truck) g.dead = true;
    this.landings = this.landings.filter(g => !g.dead);
    this.trucks.clearIncoming(truck);
    this.trucks.redraw(truck);
  }

  onEvents(events: GameEvent[], progress: number) {
    for (const e of events) {
      if (e.type === 'shift') this.onShift(e.from, e.to);
      else if (e.type === 'enter') this.onEnter(e.truck, e.slot, e.color);
      else this.onDrop(e.truck, e.slot, e.color, progress);
    }
  }

  step(dt: number, tickProgress: number) {
    const visualOffset = this.stage.state.offset + tickProgress;
    this.belt.step(visualOffset);
    let removed = false;
    const onBelt = this.beltList, arriving = this.arriveList;
    onBelt.length = 0; arriving.length = 0;
    for (const c of this.cubes) {
      if (c.mode === 'belt') {
        this.ride(c, visualOffset, dt);
        onBelt.push(c);
      } else if (c.mode === 'toBelt' || c.mode === 'toTruck') {
        if (c.delay > 0) {
          c.delay -= dt;
          if (c.ride) this.ride(c, visualOffset, dt);
          continue;
        }
        if (!c.launched) this.launch(c);
        const target = c.mode === 'toBelt' ? this.motion.entry(c, visualOffset, this.tmp) : c.to;
        const at = advanceFlight(c, target, dt, this.tmp2);
        if (c.mode === 'toBelt' && c.t >= HIT_FROM) { c.lx = at.x; c.ly = -at.z; arriving.push(c); }
        if (c.t < 1) continue;
        if (c.mode === 'toBelt') this.joinBelt(c, visualOffset);
        else { this.land(c); removed = true; }
      }
    }
    this.motion.settle(dt, onBelt, arriving);
    if (removed) this.cubes = this.cubes.filter(c => c.node);
  }

  private applyTuning() {
    tuning.cubeSize = this.cubeSize;
    tuning.breakTime = this.breakTime;
    tuning.flyOut = this.flyOutTime;
    tuning.flyIn = this.flyInTime;
    tuning.pushRadius = this.collideRadius;
    tuning.creep = this.crowdDrift;
    tuning.stragglers = Math.max(0, Math.min(CUBES_PER_UNIT, Math.round(this.stragglers)));
    tuning.topOutline = this.topOutline;
    tuning.impressionColor = hexOf(this.impressionColor);
    tuning.impressionSize = this.impressionSize;
    tuning.outlineRise = this.outlineRunTime;
    tuning.outlineThick = this.outlineThickness;
    tuning.lidTime = this.lidTime;
    tuning.lidExtra = this.lidExtra;
    tuning.tickTime = this.tickTime;
    tuning.outlineFade = this.outlineFadeTime;
    tuning.arrow.width = this.arrowWidth;
    tuning.arrow.length = this.arrowLength;
    tuning.arrow.every = this.arrowSpacing;
    tuning.arrow.color = hexOf(this.arrowColor);
    tuning.arrow.round = Math.min(this.arrowWidth, this.arrowLength) / 6;
  }

  private sizeBlocksToBus() {
    const stage = this.stage, width = stage.layout.trucks[0].width;
    const s = width / BUS.outerWidth;
    stage.blockWidth = (BUS.innerWidth * s - 0.05) / width;
    stage.blockH = width * stage.blockWidth * BLOCK_TALL;
    stage.blockTop = BUS.floor * s + stage.blockH;
  }

  private addCube(color: string, index: number): Cube {
    const cube = createCube(this.stage, color, index);
    this.cubes.push(cube);
    return cube;
  }

  private spawnBeltUnit(slot: number, color: string) {
    for (let i = 0; i < CUBES_PER_UNIT; i++) this.addCube(color, i).slot = slot;
  }

  private onShift(from: number, to: number) {
    const pitch = this.stage.layout.path.length / this.stage.state.ring.length;
    for (const c of this.cubes) {
      if (c.slot !== from || (c.mode !== 'belt' && c.mode !== 'toBelt')) continue;
      c.slot = to;
      if (c.mode === 'belt') { c.dA -= pitch; c.creep = crowdSpeed(); }
    }
  }

  private onEnter(truck: number, slot: number, color: string) {
    const unit = this.waiting[truck].shift();
    if (!unit) { this.spawnBeltUnit(slot, color); return; }
    const gateF = this.motion.gateFraction(truck);
    for (const c of unit) { c.slot = slot; c.gateF = gateF; }
  }

  private onDrop(truck: number, slot: number, color: string, progress: number) {
    const index = this.stage.state.trucks[truck].length - 1;
    const claimed = this.cubes.filter(c => (c.mode === 'belt' || c.mode === 'toBelt') && c.slot === slot && c.color === color);
    if (claimed.length === 0) {
      this.trucks.redraw(truck);
      this.trucks.checkComplete(truck);
      return;
    }
    this.trucks.expect(truck);
    const g: Landing = { truck, index, cubes: [], need: claimed.length, left: claimed.length, dead: false, pieces: emptyPieces(truck, index, color) };
    this.landings.push(g);
    const visualOffset = this.stage.state.offset + progress, gateF = this.motion.gateFraction(truck);
    for (const c of claimed) {
      c.group = g;
      if (c.mode === 'belt') this.startDrop(c, this.motion.timeToGate(c, visualOffset, gateF, this.tickDur));
    }
  }

  private ride(c: Cube, visualOffset: number, dt: number) {
    c.node.setPosition(this.motion.position(c, visualOffset, this.tmp));
    this.motion.tumble(c, dt);
  }

  private startDrop(c: Cube, delay: number) {
    c.mode = 'toTruck'; c.truck = c.group!.truck; c.ride = true;
    c.t = 0; c.dur = tuning.flyIn; c.delay = delay; c.launched = false;
  }

  private takePlace(c: Cube) {
    let g = c.group!;
    for (const x of this.landings) {
      if (x.truck === c.truck && !x.dead && x.cubes.length < x.need && (g.cubes.length >= g.need || x.index < g.index)) g = x;
    }
    c.group = g;
    c.cell = g.cubes.length;
    g.cubes.push(c);
    c.stack = Math.floor(c.cell / PIECE_COLS) % PIECE_ROWS;
    c.col = leftFirst(this.stage, g.truck) ? c.cell % PIECE_COLS : PIECE_COLS - 1 - c.cell % PIECE_COLS;
    cellPos(this.stage, g.truck, g.index, c.stack, c.col, c.to);
    cellScale(this.stage, g.truck, c.s1);
    c.q1.set(this.stage.truckTurn[g.truck]);
    mouthPos(this.stage, g.truck, c.ctrl);
  }

  private leaveBlock(c: Cube) {
    this.pieces.unseat(c);
    if (this.onLeave) this.onLeave();
    const mr = c.node.getComponent(MeshRenderer)!;
    mr.mesh = this.stage.cubeMesh;
    mr.setMaterial(this.stage.colorMats[c.color], 0);
    c.s1.set(c.size, c.size, c.size);
  }

  private launch(c: Cube) {
    c.launched = true;
    if (c.mode === 'toTruck') this.takePlace(c);
    else this.leaveBlock(c);
    rememberStart(c);
  }

  private joinBelt(c: Cube, visualOffset: number) {
    c.mode = 'belt'; c.dA = c.landDA; c.dC = 0; c.ang = NaN; c.pdA = c.dA; c.pdC = 0;
    if (Math.abs(c.landDA) > LANDED_OFF_SPOT) c.creep = crowdSpeed();
    if (c.group) this.startDrop(c, this.motion.timeToGate(c, visualOffset, this.motion.gateFraction(c.group.truck), this.tickDur));
  }

  private land(c: Cube) {
    const g = c.group!;
    c.mode = 'landed';
    this.pieces.seat(c, g.pieces, c.stack, c.col);
    this.pieces.fit(g.pieces);
    if (this.onPiece) this.onPiece();
    if (--g.left === g.need - 1 && g.left > 0) this.trucks.redraw(g.truck);
    if (g.left > 0) return;
    for (const p of g.cubes) if (p.node && p.mode === 'landed') { p.node.destroy(); p.node = null!; }
    g.dead = true;
    this.landings = this.landings.filter(x => !x.dead);
    this.trucks.arrived(g.truck);
    this.trucks.redraw(g.truck);
    if (this.onLanded) this.onLanded();
    this.trucks.checkComplete(g.truck);
  }
}
