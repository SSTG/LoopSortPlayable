import { Node, Color, Material, MeshRenderer, utils } from 'cc';
import { makeFadingWhite } from '../Materials';
import { tuning } from '../ViewConfig';

const CORNER_RADIUS = 0.12;
const CORNER_STEPS = 6;
const LIP_FROM = 0.94;
const EXTRA_HEIGHT = 0.05;

type Point = number[];

function ring(hx: number, hz: number, grow: number): Point[] {
  const pts: Point[] = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], q) => {
    for (let k = 0; k <= CORNER_STEPS; k++) {
      const a = (q + k / CORNER_STEPS) * Math.PI / 2;
      pts.push([sx * (hx - CORNER_RADIUS) + Math.cos(a) * (CORNER_RADIUS + grow), sz * (hz - CORNER_RADIUS) + Math.sin(a) * (CORNER_RADIUS + grow)]);
    }
  });
  return pts;
}

function frameQuads(hx: number, hz: number, thickness: number): Point[][] {
  const inner = ring(hx, hz, 0), outer = ring(hx, hz, thickness), n = inner.length;
  const quads: Point[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quads.push([[inner[i][0], 1, inner[i][1]], [outer[i][0], 1, outer[i][1]], [outer[j][0], 1, outer[j][1]], [inner[j][0], 1, inner[j][1]]]);
    quads.push([[outer[i][0], LIP_FROM, outer[i][1]], [outer[i][0], 1, outer[i][1]], [outer[j][0], 1, outer[j][1]], [outer[j][0], LIP_FROM, outer[j][1]]]);
  }
  return quads;
}

export class TruckOutline {
  readonly node = new Node('Outline');
  readonly top: number;
  private renderer: MeshRenderer;
  private material: Material;
  private quads: Point[][];
  private reach: number;
  private drawn = -1;

  constructor(hx: number, z0: number, z1: number, top: number) {
    const hz = (z1 - z0) / 2;
    this.quads = frameQuads(hx, hz, tuning.outlineThick);
    this.reach = hz + tuning.outlineThick;
    this.top = top + EXTRA_HEIGHT;
    this.material = makeFadingWhite();
    this.renderer = this.node.addComponent(MeshRenderer);
    this.renderer.setMaterial(this.material, 0);
    this.renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    this.node.setPosition(0, 0, (z0 + z1) / 2);
    this.node.setScale(1, this.top, 1);
    this.draw(1);
  }

  draw(f: number) {
    if (f === this.drawn) return;
    this.drawn = f;
    const cut = this.reach - f * 2 * this.reach - (f >= 1 ? 1 : 0);
    const positions: number[] = [], normals: number[] = [], indices: number[] = [];
    for (const q of this.quads) {
      if (q.every(p => p[2] <= cut)) continue;
      const base = positions.length / 3;
      for (const p of q) { positions.push(p[0], p[1], Math.max(p[2], cut)); normals.push(0, 1, 0); }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
    }
    if (!positions.length) { positions.push(0, 0, 0, 0, 0, 0, 0, 0, 0); normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0); indices.push(0, 1, 2); }
    const old = this.renderer.mesh;
    this.renderer.mesh = utils.MeshUtils.createMesh({ positions, normals, indices });
    if (old) old.destroy();
  }

  setAlpha(alpha: number) {
    this.material.setProperty('mainColor', new Color(255, 255, 255, Math.round(alpha)));
  }
}
