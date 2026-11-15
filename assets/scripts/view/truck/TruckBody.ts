import { Node, Color, Material, MeshRenderer } from 'cc';
import type { Parts } from '../mesh/ModelBake';
import { toMesh } from '../mesh/ModelBake';
import { stretchZ } from '../mesh/Bend';
import { roundedBox } from '../mesh/RoundedBox';
import { makeMaterial, lit } from '../Materials';
import { BUS } from '../ViewConfig';

export interface TruckBox { hx: number; z0: number; z1: number; top: number }

const BODY_ROUGHNESS = 0.45;
const PART_COLORS: Record<string, string> = {
  lambert3: '#2B2238', lambert9: '#E9E4F2', lambert12: '#3A3048', lambert4: '#F4F0FA', standardSurface2: '#FFF3C4',
};

function shade(hex: string, k: number): string {
  const c = new Color().fromHEX(hex);
  return '#' + new Color(c.r * k, c.g * k, c.b * k, 255).toHEX('#rrggbb');
}

function buildFromModel(parent: Node, parts: Parts, width: number, length: number, frameHex: string): TruckBox {
  const s = width / BUS.outerWidth;
  const extra = Math.max(0, (length + 0.1) / s - (BUS.bedCab - BUS.bedTail));
  const offset = -((BUS.bedTail + BUS.bedCab) / 2) * s;
  const colors: Record<string, string> = { ...PART_COLORS, CarTop: frameHex, CarBottom: shade(frameHex, 0.78) };
  const model = new Node('Body');
  model.setScale(s, s, s);
  model.setPosition(0, 0, offset);
  const box: TruckBox = { hx: 0, z0: Infinity, z1: -Infinity, top: 0 };
  for (const name of Object.keys(parts)) {
    const geo = stretchZ(parts[name], BUS.stretchLo, BUS.stretchHi, extra);
    for (let k = 0; k < geo.positions.length; k += 3) {
      const z = geo.positions[k + 2] * s + offset;
      box.hx = Math.max(box.hx, Math.abs(geo.positions[k]) * s);
      box.top = Math.max(box.top, geo.positions[k + 1] * s);
      box.z0 = Math.min(box.z0, z);
      box.z1 = Math.max(box.z1, z);
    }
    const node = new Node(name);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = toMesh(geo);
    mr.setMaterial(makeMaterial(colors[name] || frameHex, false, true, BODY_ROUGHNESS), 0);
    lit(mr);
    model.addChild(node);
  }
  parent.addChild(model);
  return box;
}

function buildPlain(parent: Node, width: number, length: number, frameHex: string): TruckBox {
  const add = (mat: Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, r: number) => {
    const n = new Node();
    const mr = n.addComponent(MeshRenderer);
    mr.mesh = roundedBox(sx, sy, sz, r);
    mr.setMaterial(mat, 0);
    lit(mr);
    n.setPosition(x, y, z);
    parent.addChild(n);
  };
  const frame = makeMaterial(frameHex, false, false, BODY_ROUGHNESS), floor = makeMaterial('#C3B6DA'), tyre = makeMaterial('#2B2238');
  const L = length + 0.24, wall = width * 0.1, rimH = 0.56;
  add(frame, width, 0.16, L, 0, 0.08, 0, 0.05);
  add(floor, width - wall * 1.6, 0.05, L - wall * 1.6, 0, 0.18, 0, 0.02);
  add(frame, wall, rimH, L, -width / 2 + wall / 2, rimH / 2, 0, wall * 0.45);
  add(frame, wall, rimH, L, width / 2 - wall / 2, rimH / 2, 0, wall * 0.45);
  add(frame, width, rimH, wall, 0, rimH / 2, -L / 2 + wall / 2, wall * 0.45);
  add(frame, width, rimH, wall, 0, rimH / 2, L / 2 - wall / 2, wall * 0.45);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(tyre, 0.13, 0.36, 0.36, sx * (width / 2 + 0.03), 0.18, sz * (L / 2 - 0.6), 0.06);
  }
  return { hx: width / 2 + 0.1, z0: -L / 2, z1: L / 2, top: rimH };
}

export function buildTruckBody(parent: Node, parts: Parts | null, width: number, length: number, frameHex: string): TruckBox {
  return parts ? buildFromModel(parent, parts, width, length, frameHex) : buildPlain(parent, width, length, frameHex);
}
