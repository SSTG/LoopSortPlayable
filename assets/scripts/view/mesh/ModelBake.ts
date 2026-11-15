import { Prefab, Node, Mesh, MeshRenderer, Mat4, Vec3, utils, instantiate, gfx } from 'cc';

export interface Geo { positions: number[]; normals: number[]; indices: number[] }

export type Parts = Record<string, Geo>;

export function bake(prefab: Prefab, skipNodes: string[] = []): Parts {
  const root = instantiate(prefab) as Node;
  const parts: Parts = {};
  const p = new Vec3(), nrm = new Vec3();
  const walk = (node: Node, parent: Mat4) => {
    if (skipNodes.indexOf(node.name) >= 0) return;
    const m = new Mat4();
    Mat4.fromRTS(m, node.rotation, node.position, node.scale);
    Mat4.multiply(m, parent, m);
    const mr = node.getComponent(MeshRenderer);
    const mesh = mr && mr.mesh;
    if (mr && mesh) {
      for (let i = 0; i < mesh.struct.primitives.length; i++) {
        const pos = mesh.readAttribute(i, gfx.AttributeName.ATTR_POSITION) as ArrayLike<number> | null;
        const nor = mesh.readAttribute(i, gfx.AttributeName.ATTR_NORMAL) as ArrayLike<number> | null;
        const idx = mesh.readIndices(i) as ArrayLike<number> | null;
        if (!pos || !nor || !idx) continue;
        const mat = mr.sharedMaterials[i];
        const key = (mat && mat.name) || 'default';
        const g = parts[key] || (parts[key] = { positions: [], normals: [], indices: [] });
        const base = g.positions.length / 3;
        for (let k = 0; k < pos.length; k += 3) {
          Vec3.transformMat4(p, p.set(pos[k], pos[k + 1], pos[k + 2]), m);
          Vec3.transformMat4Normal(nrm, nrm.set(nor[k], nor[k + 1], nor[k + 2]), m);
          nrm.normalize();
          g.positions.push(p.x, p.y, p.z);
          g.normals.push(nrm.x, nrm.y, nrm.z);
        }
        for (let k = 0; k < idx.length; k++) g.indices.push(base + idx[k]);
      }
    }
    node.children.forEach(c => walk(c, m));
  };
  walk(root, new Mat4());
  root.destroy();
  return parts;
}

export function firstPart(parts: Parts): Geo {
  return parts[Object.keys(parts)[0]];
}

export function toMesh(g: Geo): Mesh {
  return utils.MeshUtils.createMesh({ positions: g.positions, normals: g.normals, indices: g.indices });
}
