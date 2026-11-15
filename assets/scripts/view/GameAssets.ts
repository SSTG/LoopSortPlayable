import { resources, Material, EffectAsset, JsonAsset, Asset, Prefab } from 'cc';
import type { LevelData } from '../core/Rules';

export interface GameAssets {
  level: LevelData;
  baseMaterial: Material | null;
  toonEffect: EffectAsset | null;
  models: Record<string, Prefab>;
}

const MODELS = ['Bus', 'ConveyorUp', 'CubeBeveled', 'CubeMiddle', 'CubeCorner', 'CubeFlat', 'Block', 'BlockCorner'];

function load<T extends Asset>(path: string, type: new (...a: any[]) => T): Promise<T | null> {
  return new Promise(resolve => {
    resources.load(path, type as any, (err, asset) => {
      if (err) { console.warn(`[LoopSort] could not load ${path}: ${err.message}`); resolve(null); } else resolve(asset as T);
    });
  });
}

export async function loadGameAssets(levelName: string): Promise<GameAssets> {
  const path = levelName.indexOf('/') >= 0 ? levelName : `levels/${levelName}`;
  const out: GameAssets = { level: null as unknown as LevelData, baseMaterial: null, toonEffect: null, models: {} };
  const jobs: Promise<void>[] = [];
  jobs.push(load(path, JsonAsset).then(json => {
    if (!json) throw new Error(`Level "${levelName}" not found at assets/resources/${path}.json`);
    out.level = json.json as LevelData;
  }));
  for (const name of MODELS) jobs.push(load(`models/${name}/${name}`, Prefab).then(m => { if (m) out.models[name] = m; }));
  jobs.push(load('effects/toon-block', EffectAsset).then(e => { out.toonEffect = e; }));
  jobs.push(load('materials/base', Material).then(m => { out.baseMaterial = m; }));
  await Promise.all(jobs);
  return out;
}
