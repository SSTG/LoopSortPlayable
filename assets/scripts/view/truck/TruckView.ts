import { Node, Vec3, Quat, MeshRenderer, tween, Tween } from 'cc';
import { isComplete } from '../../core/Rules';
import type { Stage } from '../Stage';
import { inTruck } from '../Stage';
import type { Parts } from '../mesh/ModelBake';
import { roundedBox } from '../mesh/RoundedBox';
import type { BlockShapes } from '../block/BlockShapes';
import { makeMaterial, lit } from '../Materials';
import { tuning } from '../ViewConfig';
import { buildTruckBody } from './TruckBody';
import { TruckOutline } from './TruckOutline';
import { TruckBlocks } from './TruckBlocks';

const LID_THICKNESS = 0.06;
const LID_RISE = 0.04;
const LID_WIDTH = 0.94;
const OUTLINE_HEIGHT = 0.6;
const TAP_MARGIN_SIDE = 0.15;
const TAP_MARGIN_END = 0.4;

export class TruckView {
  onComplete: ((truck: number) => void) | null = null;
  isForming: (truck: number) => boolean = () => false;

  private nodes: Node[] = [];
  private blockRoots: Node[] = [];
  private lids: Node[] = [];
  private outlines: TruckOutline[] = [];
  private done: boolean[] = [];
  private incoming: number[] = [];
  // Highest number of places in each truck that have held a block; every empty place below it shows an impression.
  private peak: number[] = [];
  private blocks: TruckBlocks;
  private tmp = new Vec3();

  constructor(private stage: Stage, shapes: BlockShapes, private busParts: Parts | null, private leaveImpression: boolean) {
    this.blocks = new TruckBlocks(stage, shapes);
  }

  build(i: number) {
    const slot = this.stage.layout.trucks[i];
    const node = new Node('Truck' + i);
    node.setPosition(inTruck(this.stage, i, slot.length / 2, 0, 0, this.tmp));
    const turn = new Quat();
    Quat.fromEuler(turn, 0, (Math.atan2(-slot.fx, slot.fy) * 180) / Math.PI, 0);
    node.setRotation(turn);
    this.stage.truckTurn.push(turn);
    this.stage.root.addChild(node);
    this.nodes.push(node);

    const hex = this.bodyColor(i);
    const box = buildTruckBody(node, this.busParts, slot.width, slot.length, hex);

    const blocks = new Node('Blocks');
    node.addChild(blocks);
    this.blockRoots.push(blocks);

    const lid = this.buildLid(slot.width, slot.length, hex);
    node.addChild(lid);
    this.lids.push(lid);

    const outline = new TruckOutline(Math.min(box.hx, slot.width / 2 + 0.004), box.z0, box.z1, Math.max(box.top, this.stage.blockTop + 0.07) * OUTLINE_HEIGHT);
    outline.node.active = false;
    node.addChild(outline.node);
    this.outlines.push(outline);
  }

  reset() {
    const state = this.stage.state;
    this.incoming = state.trucks.map(() => 0);
    this.peak = state.trucks.map(t => t.length);
    state.trucks.forEach((_, i) => {
      this.done[i] = isComplete(state, i);
      Tween.stopAllByTarget(this.lids[i]);
      this.lids[i].active = this.done[i];
      this.lids[i].setScale(1, 1, 1);
      Tween.stopAllByTarget(this.outlines[i].node);
      this.outlines[i].node.active = false;
      this.redraw(i);
    });
  }

  collecting(truck: number): boolean { return this.incoming[truck] > 0; }

  finished(truck: number): boolean { return this.done[truck]; }

  expect(truck: number) { this.incoming[truck]++; }

  arrived(truck: number) { this.incoming[truck] = Math.max(0, this.incoming[truck] - 1); }

  clearIncoming(truck: number) { this.incoming[truck] = 0; }

  blocksLeft(truck: number, _count: number, stackLenBefore: number) {
    this.peak[truck] = Math.max(this.peak[truck], stackLenBefore);
    this.redraw(truck);
  }

  redraw(i: number) {
    const shown = this.stage.state.trucks[i].length - this.incoming[i];
    this.peak[i] = Math.max(this.peak[i], shown);
    const marks: number[] = [];
    if (this.leaveImpression) for (let at = shown; at < this.peak[i]; at++) marks.push(at);
    this.blocks.draw(this.blockRoots[i], i, shown, marks, !this.isForming(i) && !this.done[i]);
  }

  checkComplete(truck: number) {
    if (this.done[truck] || this.incoming[truck] > 0 || !isComplete(this.stage.state, truck)) return;
    this.done[truck] = true;
    this.redraw(truck);
    this.closeLid(this.lids[truck]);
    this.runOutline(this.outlines[truck]);
    if (this.onComplete) this.onComplete(truck);
  }

  shake(truck: number) {
    const node = this.nodes[truck], len = this.stage.layout.trucks[truck].length / 2;
    Tween.stopAllByTarget(node);
    const at = (side: number) => inTruck(this.stage, truck, len, side, 0, new Vec3());
    tween(node)
      .to(0.05, { position: at(-0.09) }).to(0.05, { position: at(0.09) })
      .to(0.05, { position: at(-0.05) }).to(0.05, { position: at(0) })
      .start();
  }

  worldPos(i: number, out: Vec3): Vec3 {
    return inTruck(this.stage, i, this.stage.layout.trucks[i].length / 2, 0, 1, out);
  }

  at(worldX: number, worldZ: number): number {
    const y = -worldZ, trucks = this.stage.layout.trucks;
    for (let i = 0; i < trucks.length; i++) {
      const t = trucks[i];
      const along = -((worldX - t.mx) * t.fx + (y - t.my) * t.fy), across = (worldX - t.mx) * t.fy - (y - t.my) * t.fx;
      if (Math.abs(across) <= t.width / 2 + TAP_MARGIN_SIDE && along >= -TAP_MARGIN_END && along <= t.length + TAP_MARGIN_END) return i;
    }
    return -1;
  }

  private bodyColor(i: number): string {
    const level = this.stage.state.level, keys = Object.keys(level.colors);
    const pick = level.truckColors && level.truckColors[i];
    return pick ? (level.colors[pick] || pick) : level.colors[keys[i % keys.length]];
  }

  private buildLid(width: number, length: number, hex: string): Node {
    const lid = new Node('Lid');
    const lidLength = length + tuning.lidExtra + 0.06;
    lid.setPosition(0, this.stage.blockTop + LID_RISE, -length / 2 - 0.03 + lidLength);
    const plate = new Node('Plate');
    const mr = plate.addComponent(MeshRenderer);
    const height = this.stage.blockH + LID_RISE + LID_THICKNESS;
    mr.mesh = roundedBox(width * LID_WIDTH, height, lidLength, 0.028);
    mr.setMaterial(makeMaterial(hex, false, true, 0.45), 0);
    lit(mr, false);
    plate.setPosition(0, (LID_THICKNESS - height) / 2, -lidLength / 2);
    lid.addChild(plate);
    lid.active = false;
    return lid;
  }

  private closeLid(lid: Node) {
    lid.active = true;
    lid.setScale(0, 0, 0);
    tween(lid).delay(tuning.outlineRise).call(() => { lid.setScale(1, 1, 0.02); })
      .to(tuning.lidTime, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' }).start();
  }

  private runOutline(outline: TruckOutline) {
    const node = outline.node, sweep = { f: 0 }, fade = { a: 255 };
    node.active = true;
    node.setScale(1, outline.top, 1);
    outline.draw(0);
    outline.setAlpha(255);
    tween(sweep).to(tuning.outlineRise, { f: 1 }, { easing: 'sineInOut', onUpdate: () => outline.draw(sweep.f) })
      .call(() => outline.draw(1)).start();
    tween(node).delay(tuning.outlineRise + tuning.lidTime + tuning.tickTime)
      .call(() => {
        tween(fade).to(tuning.outlineFade, { a: 0 }, { onUpdate: () => outline.setAlpha(fade.a) })
          .call(() => { node.active = false; }).start();
      }).start();
  }
}
