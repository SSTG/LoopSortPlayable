import { Mesh, Prefab, Vec3, utils } from 'cc';
import type { Stage } from '../Stage';
import type { Geo } from '../mesh/ModelBake';
import { bake, toMesh, firstPart } from '../mesh/ModelBake';
import { roundOff, sliceBox } from '../mesh/BoxFit';
import { turnPiece } from '../mesh/CubeTurns';
import { roundedBox } from '../mesh/RoundedBox';
import { cellScale } from './BlockGrid';
import { PIECE_COLS, PIECE_LAYERS, PIECE_SLICES, PIECE_RULES, BLOCK_NATIVE, BLOCK_ROUND, IMPRESSION_OVAL } from '../ViewConfig';

const RAW_MODELS = ['CubeBeveled', 'CubeCorner', 'CubeMiddle', 'CubeFlat', 'Block'];
const CORNER_SIDES = [0, 3, 4];
const EDGE_SIDES = [3, 4];
const OVAL_STEPS = 48;

const modelGeo = (model: Prefab): Geo => firstPart(bake(model));

export class BlockShapes {
  private blockGeo: Geo | null = null;
  private blockEndGeo: Geo | null = null;
  private rawGeo: Record<string, Geo> = {};
  private pieceGeos: Record<string, Geo> = {};
  private pieceMeshes: (Mesh | null)[] = [];
  private ovalMeshes: Record<string, Mesh> = {};
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

  blockMesh(truck: number): Mesh {
    const s = cellScale(this.stage, truck, this.tmp);
    const w = s.x * PIECE_COLS, h = s.y * PIECE_LAYERS, l = s.z * PIECE_SLICES;
    const raw = this.rawGeo.Block;
    if (!raw) return this.box(w, h, l, BLOCK_ROUND);
    return sliceBox(raw, 'rawBlock', BLOCK_NATIVE.half, BLOCK_NATIVE.bevel, w, h, l, 0.25 * s.z);
  }

  pieceMesh(mask: number): Mesh {
    return this.pieceMeshes[mask] || (this.pieceMeshes[mask] = toMesh(this.pieceGeo(mask)));
  }

  ovalPlate(w: number, l: number): Mesh {
    const key = w.toFixed(3) + '_' + l.toFixed(3);
    if (this.ovalMeshes[key]) return this.ovalMeshes[key];
    const e = 2 / IMPRESSION_OVAL;
    const positions = [0, 0, 0], normals = [0, 1, 0], indices: number[] = [];
    for (let k = 0; k < OVAL_STEPS; k++) {
      const a = (k / OVAL_STEPS) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      positions.push(Math.sign(c) * Math.pow(Math.abs(c), e) * w / 2, 0, -Math.sign(sn) * Math.pow(Math.abs(sn), e) * l / 2);
      normals.push(0, 1, 0);
      indices.push(0, 1 + k, 1 + (k + 1) % OVAL_STEPS);
    }
    return (this.ovalMeshes[key] = utils.MeshUtils.createMesh({ positions, normals, indices }));
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
