import { _decorator, Component, Node, Vec3, Color, MeshRenderer } from 'cc';
import type { GameState, GameEvent } from '../core/Rules';
import { FULL_SPEED } from '../core/Rules';
import type { Layout } from '../core/Layout';
import type { GameAssets } from './GameAssets';
import type { Stage } from './Stage';
import type { Cube, Landing, Pieces } from './cube/CubeTypes';
import { createCube } from './cube/CubeFactory';
import { advanceFlight, rememberStart } from './cube/CubeFlight';
import { advancePour, pourSpeed } from './cube/CubePour';
import { BeltView } from './belt/BeltView';
import { BeltMotion } from './belt/BeltMotion';
import { BlockShapes } from './block/BlockShapes';
import { BlockPieces, emptyPieces } from './block/BlockPieces';
import { cellPos, cellLocal, cellScale, leftFirst, mouthPos } from './block/BlockGrid';
import { TruckView } from './truck/TruckView';
import { bake } from './mesh/ModelBake';
import { plumpCube } from './mesh/PlumpCube';
import { setEffects, makeToon, hexOf } from './Materials';
import { CUBES_PER_UNIT, PIECE_COLS, PIECE_ROWS, PIECE_COUNT, PIECE_LAYERS, PIECE_SLICES, HIT_FROM, BLOCK_TALL, BUS, tuning, crowdSpeed } from './ViewConfig';

const { ccclass, property } = _decorator;

const UNUSED_BUS_PARTS = ['polySurface3', 'TopCover'];
const POUR_SPACING = 1.1; // gap between cubes in the pouring chain, in cube sizes
const LANDED_OFF_SPOT = 0.05;

@ccclass('GameView')
export class GameView extends Component {
  @property({ group: 'Cubes' })
  cubeSize = 0.25;
  @property({ group: 'Cubes' })
  breakTime = 0.8;
  @property({ group: 'Cubes' })
  flyOutTime = 0.3;
  @property({ group: 'Cubes' })
  flyInTime = 0.38;
  @property({ group: 'Cubes' })
  collideRadius = 0.24;
  @property({ group: 'Cubes' })
  crowdDrift = 0.2;
  @property({ group: 'Cubes' })
  stragglers = 6;
  @property({ group: 'Cubes', tooltip: 'How much a tapped block puffs up and wobbles as it turns into cubes' })
  popStrength = 0.5;
  @property({ group: 'Cubes', tooltip: 'Seconds the chain of cubes takes to run from the back of the truck to its mouth' })
  pourTime = 0.3;
  @property({ group: 'Cubes', tooltip: 'How far the chain swings side to side, as a share of the truck width' })
  pourSway = 0.3;
  @property({ group: 'Cubes', tooltip: 'Length of one side-to-side swing, in truck widths' })
  pourWave = 5;
  @property({ group: 'Cubes', tooltip: 'How fast the snaking shape shifts while the chain runs' })
  pourDrift = 9;
  @property({ group: 'Cubes', tooltip: 'Edge softness: 2.5 is very round and bulging, 5 is nearly a box' })
  cubeRoundness = 3.2;
  @property({ group: 'Cubes', tooltip: 'How far each cube\'s proportions may differ from a perfect cube (0.08 = up to 8%)' })
  cubeVariety = 0.08;
  @property({ group: 'Cubes', tooltip: 'Strength of the shiny highlight on the cubes' })
  cubeShine = 6;
  @property({ group: 'Cubes', tooltip: 'Size of that highlight: higher is broader and softer' })
  cubeHighlightSize = 0.62;
  @property({ group: 'Cubes', tooltip: 'Polished sheen around the cube edges' })
  cubeSheen = 0.35;
  @property({ group: 'Cubes', tooltip: 'Waxy softness of the shading, 0 to 1' })
  cubeWax = 0.45;

  @property({ group: 'Blocks', tooltip: 'How dark the inside of a block gets where cubes are missing (0 = no shadow, 1 = black)' })
  innerShadow = 0.4;
  @property({ group: 'Blocks' })
  impressionColor = new Color(143, 134, 172, 255);
  @property({ group: 'Blocks' })
  impressionGap = 0.05;
  @property({ group: 'Blocks' })
  impressionCorner = 0.07;

  @property({ group: 'Finished truck', tooltip: 'Seconds the white outline takes to run from the headlights to the tail lights' })
  outlineRunTime = 0.45;
  @property({ group: 'Finished truck', tooltip: 'Thickness of that white outline' })
  outlineThickness = 0.045;
  @property({ group: 'Finished truck' })
  lidTime = 0.6;
  @property({ group: 'Finished truck' })
  lidExtra = 0.21;
  @property({ group: 'Finished truck' })
  tickTime = 0.9;
  @property({ group: 'Finished truck', tooltip: 'Seconds the white outline then takes to fade away' })
  outlineFadeTime = 0.4;

  @property({ group: 'Belt arrows' })
  arrowWidth = 0.52;
  @property({ group: 'Belt arrows' })
  arrowLength = 0.48;
  @property({ group: 'Belt arrows' })
  arrowSpacing = 2;
  @property({ group: 'Belt arrows' })
  arrowColor = new Color(183, 163, 220, 255);

  onLanded: (() => void) | null = null;
  onPiece: (() => void) | null = null;
  onComplete: ((truck: number) => void) | null = null;
  onLeave: (() => void) | null = null;

  tickDur = 0.45;
  private slowestTick = 0.45 / FULL_SPEED;

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
  private clock = 0;
  private tmp2 = new Vec3();

  get root(): Node { return this.node; }

  get busy(): boolean { return this.cubes.some(c => c.mode !== 'belt'); }

  init(assets: GameAssets, layout: Layout, state: GameState, tickDur: number, leaveImpression = true) {
    this.tickDur = tickDur;
    this.slowestTick = tickDur / FULL_SPEED;
    this.applyTuning();
    setEffects(assets.baseMaterial ? assets.baseMaterial.effectAsset : null, assets.toonEffect);
    const models = assets.models;
    this.stage = {
      root: this.node, layout, state, beltY: 0, blockTop: 0.7, blockWidth: 0.79, blockH: 0.7, truckTurn: [],
      cubeShapes: [-0.35, 0, 0.35].map(d => plumpCube(Math.max(2.2, this.cubeRoundness + d))),
      colorMats: {}, blockMats: {},
    };
    const busParts = models.Bus ? bake(models.Bus, UNUSED_BUS_PARTS) : null;
    if (busParts) this.sizeBlocksToBus();
    for (const key of Object.keys(state.level.colors)) {
      this.stage.colorMats[key] = makeToon(state.level.colors[key], true, false, tuning.cubeGloss);
      this.stage.blockMats[key] = makeToon(state.level.colors[key], false, true);
    }
    const shapes = new BlockShapes(this.stage, models);
    this.pieces = new BlockPieces(this.stage, shapes);
    this.motion = new BeltMotion(this.stage);
    this.belt = new BeltView(this.stage);
    this.belt.build(models.ConveyorUp);
    this.trucks = new TruckView(this.stage, shapes, busParts, leaveImpression);
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
    // Cubes leave one after another, a cube's length apart, so they pour out as a single chain (capped at breakTime).
    const count = colors.length * PIECE_COUNT;
    const every = count > 1 ? Math.min(tuning.cubeSize * POUR_SPACING / pourSpeed(this.stage, truck), tuning.breakTime / (count - 1)) : 0;
    const fromLeft = leftFirst(this.stage, truck);
    // One tap sends a run of one colour, drawn in the truck as a single block: link its units so it breaks apart as one.
    const all: Pieces[] = [];
    colors.forEach((color, k) => {
      const index = stackLenBefore - 1 - k;
      const p = emptyPieces(truck, index, color);
      const above = all[k - 1];
      if (above && above.color === color) { p.after = above; above.before = p; }
      all.push(p);
      const unit: Cube[] = [];
      for (let row = 0; row < PIECE_ROWS; row++) for (let col = 0; col < PIECE_COLS; col++) {
        const c = this.addCube(color, row * PIECE_COLS + col);
        c.mode = 'toBelt'; c.slot = -1; c.truck = truck; c.home = index;
        c.t = 0; c.dur = tuning.flyOut; c.launched = false; c.ride = false;
        c.delay = (k * PIECE_COUNT + row * PIECE_COLS + (fromLeft ? PIECE_COLS - 1 - col : col)) * every;
        c.wob = c.delay * 45;
        c.q1.set(c.node.rotation);
        mouthPos(this.stage, truck, c.ctrl);
        this.pieces.seat(c, p, PIECE_ROWS - 1 - row, col);
        unit.push(c);
      }
      this.waiting[truck].push(unit);
    });
    for (const p of all) this.pieces.fit(p);
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
    // The state already holds every drop of this batch, and one tap can drop several blocks into the same truck,
    // so count them to give each drop its own place in the truck (bottom first) instead of all the top one.
    const later = this.stage.state.trucks.map(() => 0);
    for (const e of events) if (e.type === 'drop') later[e.truck]++;
    for (const e of events) {
      if (e.type === 'shift') this.onShift(e.from, e.to);
      else if (e.type === 'enter') this.onEnter(e.truck, e.slot, e.color);
      else this.onDrop(e.truck, e.slot, e.color, progress, this.stage.state.trucks[e.truck].length - later[e.truck]--);
    }
  }

  step(dt: number, tickProgress: number) {
    this.clock += dt;
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
          if (c.ride) {
            this.ride(c, visualOffset, dt);
            // Fly in the moment the cube reaches its truck's mouth: the belt may have sped up since the drop was timed.
            if (c.mode === 'toTruck' && this.motion.atGate(c, visualOffset, c.gateF)) c.delay = 0;
          }
          continue;
        }
        if (!c.launched) this.launch(c);
        if (c.pouring) {
          if (!advancePour(this.stage, c, dt, this.clock, this.tmp2)) continue;
          c.pouring = false;
          rememberStart(c);
        }
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
    tuning.popStrength = Math.max(0, this.popStrength);
    tuning.pourTime = Math.max(0.05, this.pourTime);
    tuning.pourSway = Math.max(0, this.pourSway);
    tuning.pourWave = Math.max(0.5, this.pourWave);
    tuning.pourDrift = this.pourDrift;
    tuning.cubeVariety = Math.max(0, this.cubeVariety);
    tuning.cubeGloss = { highlight: this.cubeShine, size: Math.max(0.05, this.cubeHighlightSize), rim: this.cubeSheen, wax: Math.max(0, Math.min(1, this.cubeWax)) };
    tuning.impressionColor = hexOf(this.impressionColor);
    tuning.innerShadow = Math.max(0, Math.min(1, this.innerShadow));
    tuning.impressionGap = this.impressionGap;
    tuning.impressionCorner = this.impressionCorner;
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
      if (c.slot !== from || c.group || (c.mode !== 'belt' && c.mode !== 'toBelt')) continue;
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

  private onDrop(truck: number, slot: number, color: string, progress: number, index: number) {
    // Skip cubes an earlier drop already claimed (still flying out of their truck): one tap can drop several blocks at the same slot.
    const claimed = this.cubes.filter(c => !c.group && (c.mode === 'belt' || c.mode === 'toBelt') && c.slot === slot && c.color === color);
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
      if (c.mode === 'belt') this.startDrop(c, this.motion.timeToGate(c, visualOffset, gateF, this.slowestTick));
    }
  }

  private ride(c: Cube, visualOffset: number, dt: number) {
    c.node.setPosition(this.motion.position(c, visualOffset, this.tmp));
    this.motion.tumble(c, dt);
  }

  // delay is only a safety limit (worked out at the belt's slowest speed): step() launches the cube as soon as it
  // reaches the mouth of its truck.
  private startDrop(c: Cube, delay: number) {
    c.mode = 'toTruck'; c.truck = c.group!.truck; c.ride = true; c.gateF = this.motion.gateFraction(c.truck);
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
    // Fill the block one row at a time, each row from the right of the screen to the left: the bottom layer's back
    // row, then its front row, then the same for the layer above, so the block builds up evenly to the last cube.
    const cell = c.cell % PIECE_COUNT, row = Math.floor(cell / PIECE_COLS), step = cell % PIECE_COLS;
    const layer = Math.floor(row / PIECE_SLICES), slice = row % PIECE_SLICES;
    c.stack = slice * PIECE_LAYERS + layer;
    // leftFirst trucks have column 0 on the left of the screen, the others on the right.
    c.col = leftFirst(this.stage, g.truck) ? PIECE_COLS - 1 - step : step;
    cellPos(this.stage, g.truck, g.index, c.stack, c.col, c.to);
    cellScale(this.stage, g.truck, c.s1);
    c.q1.set(this.stage.truckTurn[g.truck]);
    mouthPos(this.stage, g.truck, c.ctrl);
  }

  private leaveBlock(c: Cube) {
    this.pieces.unseat(c);
    if (this.onLeave) this.onLeave();
    const mr = c.node.getComponent(MeshRenderer)!;
    mr.mesh = c.shape;
    mr.setMaterial(this.stage.colorMats[c.color], 0);
    c.s1.set(c.size * c.prop.x, c.size * c.prop.y, c.size * c.prop.z);
  }

  private launch(c: Cube) {
    c.launched = true;
    if (c.mode === 'toTruck') this.takePlace(c);
    else this.leaveBlock(c);
    rememberStart(c);
    if (c.mode === 'toBelt') this.startPour(c);
  }

  private startPour(c: Cube) {
    const p = cellLocal(this.stage, c.truck, c.home, c.stack, c.col);
    c.pouring = true; c.pourAge = 0;
    c.pourStart = c.pourAlong = p.along; c.pourAcross = p.across; c.pourHeight = p.height;
    // Settle into line, upright and facing along the truck, before the hop onto the belt.
    c.q0.set(this.stage.truckTurn[c.truck]);
    c.node.setRotation(c.q0);
  }

  private joinBelt(c: Cube, visualOffset: number) {
    c.mode = 'belt'; c.dA = c.landDA; c.dC = 0; c.ang = NaN; c.pdA = c.dA; c.pdC = 0;
    if (Math.abs(c.landDA) > LANDED_OFF_SPOT) c.creep = crowdSpeed();
    if (c.group) this.startDrop(c, this.motion.timeToGate(c, visualOffset, this.motion.gateFraction(c.group.truck), this.slowestTick));
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
