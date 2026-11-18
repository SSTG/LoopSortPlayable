import { Mesh, Prefab, Vec3, utils } from 'cc';
import type { Stage } from '../Stage';
import type { Geo } from '../mesh/ModelBake';
import { bake, toMesh, firstPart } from '../mesh/ModelBake';
import { roundOff, sliceBox } from '../mesh/BoxFit';
import { turnPiece } from '../mesh/CubeTurns';
import { roundedBox } from '../mesh/RoundedBox';
import { cellScale } from './BlockGrid';
import { PIECE_COLS, PIECE_LAYERS, PIECE_SLICES, PIECE_RULES, BLOCK_NATIVE, BLOCK_ROUND } from '../ViewConfig';

const RAW_MODELS = ['CubeBeveled', 'CubeCorner', 'CubeMiddle', 'CubeFlat', 'Block'];
const CORNER_SIDES = [0, 3, 4];
const EDGE_SIDES = [3, 4];
const CORNER_STEPS = 8;

const modelGeo = (model: Prefab): Geo => firstPart(bake(model));

export class BlockShapes {
  private blockGeo: Geo | null = null;
  private blockEndGeo: Geo | null = null;
  private rawGeo: Record<string, Geo> = {};
  private pieceGeos: Record<string, Geo> = {};
  private pieceMeshes: (Mesh | null)[] = [];
  private plateMeshes: Record<string, Mesh> = {};
  private tmp = new Vec3();

  constructor(private stage: Stage, models: Record<string, Prefab>) {
    if (models.Block) this.blockGeo = roundOff(modelGeo(models.Block), BLOCK_NATIVE.half, BLOCK_NATIVE.bevel, 2);
    if (models.BlockCorner) this.blockEndGeo = roundOff(modelGeo(models.BlockCorner), BLOCK_NATIVE.half, BLOCK_NATIVE.bevel, 2, true);
    for (const name of RAW_MODELS) if (models[name]) this.rawGeo[name] = modelGeo(models[name]);
  }

  box(w: number, h: number, l: number, r: number, flatFront = false): Mesh {
    if (flatFront && this.blockEndGeo) return sliceBox(this.blockEndGeo, 'end', BLOCK_NATIVE.half, BLOCK_NATIVE.bevel, w, h, l, r);
    if (this.blockGeo) return sliceBox(this.blockGeo, 'block', BLOCK_NATIVE.half, BLOCK_NATIVE.bevel, w, h, l, r);
    return roundedBox(w, h, l, r);
  }

  // A truck block spanning `units` places in a row (a merged run of one colour).
  blockMesh(truck: number, units = 1): Mesh {
    const s = cellScale(this.stage, truck, this.tmp);
    const w = s.x * PIECE_COLS, h = s.y * PIECE_LAYERS, l = s.z * PIECE_SLICES + (units - 1) * this.stage.layout.unit;
    const raw = this.rawGeo.Block;
    if (!raw) return this.box(w, h, l, BLOCK_ROUND);
    return sliceBox(raw, 'rawBlock', BLOCK_NATIVE.half, BLOCK_NATIVE.bevel, w, h, l, 0.25 * s.z);
  }

  pieceMesh(mask: number): Mesh {
    return this.pieceMeshes[mask] || (this.pieceMeshes[mask] = toMesh(this.pieceGeo(mask)));
  }

  // Flat rectangle w x l (x by z) lying face up, its corners rounded to radius r.
  roundedPlate(w: number, l: number, r: number): Mesh {
    r = Math.max(0, Math.min(r, w / 2, l / 2));
    const key = w.toFixed(3) + '_' + l.toFixed(3) + '_' + r.toFixed(3);
    if (this.plateMeshes[key]) return this.plateMeshes[key];
    const positions = [0, 0, 0], normals = [0, 1, 0], indices: number[] = [];
    const hx = w / 2 - r, hz = l / 2 - r;
    const corners = [[hx, -hz], [-hx, -hz], [-hx, hz], [hx, hz]];
    corners.forEach(([cx, cz], q) => {
      for (let k = 0; k <= CORNER_STEPS; k++) {
        const a = (q + k / CORNER_STEPS) * Math.PI / 2;
        positions.push(cx + Math.cos(a) * r, 0, cz - Math.sin(a) * r);
        normals.push(0, 1, 0);
      }
    });
    const n = positions.length / 3 - 1;
    for (let k = 0; k < n; k++) indices.push(0, 1 + k, 1 + (k + 1) % n);
    return (this.plateMeshes[key] = utils.MeshUtils.createMesh({ positions, normals, indices }));
  }

  private pieceGeo(mask: number): Geo {
    const rule = PIECE_RULES.find(r => r.every(side => mask & (1 << side)));
    const key = rule ? rule.slice().sort().join() : 'flat';
    if (this.pieceGeos[key]) return this.pieceGeos[key];
    const raw = this.rawGeo;
    let geo = raw.CubeFlat || raw.CubeBeveled;
    if (rule && rule.length === 3 && raw.CubeCorner) geo = turnPiece(raw.CubeCorner, CORNER_SIDES, rule);
    else if (rule && rule.length === 2 && raw.CubeMiddle) geo = turnPiece(raw.CubeMiddle, EDGE_SIDES, rule);
    return (this.pieceGeos[key] = geo);
  }
}
