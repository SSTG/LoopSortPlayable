import { Node, MeshRenderer, Prefab } from 'cc';
import type { Stage } from '../Stage';
import type { Geo } from '../mesh/ModelBake';
import { bake, toMesh } from '../mesh/ModelBake';
import { bendAlongPath } from '../mesh/Bend';
import { buildBeltFloor, buildBeltRims } from '../mesh/BeltMesh';
import { makeMaterial, lit } from '../Materials';
import { BELT, BELT_LOOK, tuning } from '../ViewConfig';
import { buildArrowMesh } from './ArrowMesh';

const MODEL_LOOK: Record<string, [string, boolean]> = {
  'Surface': ['#CBB6E6', false],
  'Side': ['#7462C8', true],
  'Ground Holder': ['#5A49B0', true],
};
const ARROW_LIFT = 0.012;
const SLOPE_SPAN = 0.3;

export class BeltView {
  private arrows: Node[] = [];
  private arrowGap = 0;

  constructor(private stage: Stage) {}

  build(model: Prefab | undefined) {
    const width = this.stage.state.level.beltPath.width;
    const scale = width / BELT.surfaceWidth;
    if (model) this.buildFromModel(model, scale);
    else this.buildPlain(width);
    this.buildArrows(scale);
  }

  step(visualOffset: number) {
    const path = this.stage.layout.path;
    const pairs = this.arrows.length / 2, slots = this.stage.state.ring.length;
    const e = SLOPE_SPAN / 2 / path.length;
    this.arrows.forEach((node, i) => {
      const f = (i >> 1) / pairs + (i & 1) * this.arrowGap + visualOffset / slots;
      const p = path.at(f), t = path.tangent(f);
      const slope = (path.height(f + e) - path.height(f - e)) / SLOPE_SPAN;
      node.setPosition(p.x, this.stage.beltY + path.height(f) + ARROW_LIFT, -p.y);
      node.setRotationFromEuler(0, (Math.atan2(t.y, t.x) * 180) / Math.PI, (Math.atan(slope) * 180) / Math.PI);
    });
  }

  private buildFromModel(model: Prefab, scale: number) {
    const parts = bake(model);
    this.stage.beltY = BELT.base * scale * BELT_LOOK.flat;
    for (const name of Object.keys(MODEL_LOOK)) {
      if (!parts[name]) continue;
      const [color, castsShadow] = MODEL_LOOK[name];
      const mesh = toMesh(bendAlongPath(this.flatten(parts[name]), this.stage.layout.path, scale, this.stage.beltY, BELT.section));
      this.addPart('Belt ' + name, mesh, color, castsShadow);
    }
  }

  private flatten(g: Geo): Geo {
    const half = BELT.surfaceWidth / 2;
    const positions = g.positions.slice();
    for (let k = 0; k < positions.length; k += 3) {
      const x = positions[k];
      if (Math.abs(x) > half) positions[k] = Math.sign(x) * (half + (Math.abs(x) - half) * BELT_LOOK.rim);
      positions[k + 1] *= BELT_LOOK.flat;
    }
    return { positions, normals: g.normals, indices: g.indices };
  }

  private buildPlain(width: number) {
    const path = this.stage.layout.path;
    this.addPart('BeltFloor', buildBeltFloor(path, width), '#B49EE6', false);
    this.addPart('BeltRims', buildBeltRims(path, width, 0.09, 0.42), '#6A4FD8', true);
  }

  private addPart(name: string, mesh: MeshRenderer['mesh'], color: string, castsShadow: boolean) {
    const node = new Node(name);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = mesh;
    mr.setMaterial(makeMaterial(color, false, true), 0);
    lit(mr, castsShadow);
    this.stage.root.addChild(node);
  }

  private buildArrows(scale: number) {
    const arrow = tuning.arrow, length = this.stage.layout.path.length;
    const mesh = buildArrowMesh(scale);
    const mat = makeMaterial(arrow.color, false, true, 1);
    const pairs = Math.max(1, Math.floor(length / (arrow.every * scale)));
    this.arrowGap = (arrow.pair * scale) / length;
    for (let i = 0; i < pairs * 2; i++) {
      const node = new Node('Arrow');
      const mr = node.addComponent(MeshRenderer);
      mr.mesh = mesh;
      mr.setMaterial(mat, 0);
      lit(mr, false);
      this.stage.root.addChild(node);
      this.arrows.push(node);
    }
  }
}
