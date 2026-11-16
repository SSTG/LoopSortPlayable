import { Node, Material, Mesh, MeshRenderer } from 'cc';
import type { Stage } from '../Stage';
import type { BlockShapes } from '../block/BlockShapes';
import { makeMaterial, lit } from '../Materials';
import { BLOCK_GAP, BLOCK_ROUND, OUTLINE_H, tuning } from '../ViewConfig';

const IMPRESSION_LIFT = 0.012;
const OUTLINE_DROP = 0.02;

export class TruckBlocks {
  private outlineMat: Material;
  private impressionMat: Material;

  constructor(private stage: Stage, private shapes: BlockShapes) {
    this.outlineMat = makeMaterial('#0B0810', false, false, 1);
    this.impressionMat = makeMaterial(tuning.impressionColor, false, false, 1);
  }

  draw(root: Node, truck: number, shown: number, impressions: number[], outlineTop: boolean) {
    root.destroyAllChildren();
    for (const at of impressions) this.addImpression(root, truck, at);
    const stack = this.stage.state.trucks[truck];
    for (let k = 0; k < shown; k++) this.addBlock(root, truck, k, stack[k]);
    if (outlineTop && shown > 0) this.addOutline(root, truck, shown - 1);
  }

  private placeZ(truck: number, at: number): number {
    return this.stage.layout.trucks[truck].length / 2 - (at + 0.5) * this.stage.layout.unit;
  }

  private bedWidth(truck: number): number {
    return this.stage.layout.trucks[truck].width * this.stage.blockWidth;
  }

  private add(root: Node, name: string, mesh: Mesh, material: Material, castsShadow: boolean, y: number, z: number): MeshRenderer {
    const node = new Node(name);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = mesh;
    mr.setMaterial(material, 0);
    lit(mr, castsShadow);
    node.setPosition(0, y, z);
    root.addChild(node);
    return mr;
  }

  private addImpression(root: Node, truck: number, at: number) {
    const gap = Math.max(0, tuning.impressionGap);
    const mesh = this.shapes.roundedPlate(this.bedWidth(truck), this.stage.layout.unit - gap, tuning.impressionCorner);
    this.add(root, 'Impression', mesh, this.impressionMat, false, this.stage.blockTop - this.stage.blockH + IMPRESSION_LIFT, this.placeZ(truck, at));
  }

  private addBlock(root: Node, truck: number, at: number, color: string) {
    this.add(root, 'Block', this.shapes.blockMesh(truck), this.stage.blockMats[color], true, this.stage.blockTop - this.stage.blockH / 2, this.placeZ(truck, at));
  }

  private addOutline(root: Node, truck: number, at: number) {
    const line = tuning.topOutline;
    const wide = this.bedWidth(truck) + line * 2, len = this.stage.layout.unit - BLOCK_GAP + line * 2;
    const mesh = this.shapes.box(wide, OUTLINE_H, len, Math.min(BLOCK_ROUND + line, OUTLINE_H / 2, wide / 2, len / 2));
    const mr = this.add(root, 'Outline', mesh, this.outlineMat, false, this.stage.blockTop - OUTLINE_H / 2 - OUTLINE_DROP, this.placeZ(truck, at));
    mr.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
  }
}
