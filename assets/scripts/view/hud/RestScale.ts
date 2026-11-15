import { Node, Vec3 } from 'cc';

export class RestScale {
  private scales = new Map<Node, Vec3>();

  of(n: Node): Vec3 {
    let s = this.scales.get(n);
    if (!s) { s = n.scale.clone(); this.scales.set(n, s); }
    return s;
  }

  known(n: Node): Vec3 | undefined {
    return this.scales.get(n);
  }
}
