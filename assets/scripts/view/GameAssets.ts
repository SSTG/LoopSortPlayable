import { Material, EffectAsset, JsonAsset, Prefab } from 'cc';
import type { LevelData } from '../core/Rules';

export interface GameAssets {
  level: LevelData;
  baseMaterial: Material | null;
  toonEffect: EffectAsset | null;
  models: Record<string, Prefab>;
}

function baseName(name: string): string {
  const slash = name.lastIndexOf('/');
  const file = slash >= 0 ? name.slice(slash + 1) : name;
  return file.replace(/\.json$/, '');
}

export function findLevel(levels: (JsonAsset | null)[], levelName: string): LevelData {
  const want = baseName(levelName);
  const hit = levels.find(l => l && baseName(l.name) === want);
  if (!hit) throw new Error(`Level "${levelName}" is not in the Bootstrap's Levels list`);
  return hit.json as LevelData;
}

export function collectGameAssets(
  level: LevelData,
  models: Record<string, Prefab | null>,
  baseMaterial: Material | null,
  toonEffect: EffectAsset | null,
): GameAssets {
  const out: Record<string, Prefab> = {};
  for (const name in models) {
    const m = models[name];
    if (m) out[name] = m; else console.warn(`[LoopSort] model ${name} is not set on the Bootstrap`);
  }
  return { level, baseMaterial, toonEffect, models: out };
}
