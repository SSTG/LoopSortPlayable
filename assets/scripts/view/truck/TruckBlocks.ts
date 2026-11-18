import { Node, Material, Mesh, MeshRenderer } from 'cc';
import type { Stage } from '../Stage';
import type { BlockShapes } from '../block/BlockShapes';
import { makeMaterial, lit } from '../Materials';
import { tuning } from '../ViewConfig';

const IMPRESSION_LIFT = 0.012;

export class TruckBlocks {
  private impressionMat: Material;

  constructor(private stage: Stage, private shapes: BlockShapes) {
    this.impressionMat = makeMaterial(tuning.impressionColor, false, false, 1);
  }

  draw(root: Node, truck: number, shown: number, impressions: number[]) {
    root.destroyAllChildren();
    for (const at of impressions) this.addImpression(root, truck, at);
    const stack = this.stage.state.trucks[truck];
    // Consecutive places of the same colour are drawn as one long block.
    for (let from = 0; from < shown;) {
      let to = from + 1;
      while (to < shown && stack[to] === stack[from]) to++;
      this.addBlock(root, truck, from, to - from, stack[from]);
      from = to;
    }
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

  // A block covering `count` places starting at place `at`, centred on the middle of those places.
  private addBlock(root: Node, truck: number, at: number, count: number, color: string) {
    const z = this.placeZ(truck, at + (count - 1) / 2);
    this.add(root, 'Block', this.shapes.blockMesh(truck, count), this.stage.blockMats[color], true, this.stage.blockTop - this.stage.blockH / 2, z);
  }
}
