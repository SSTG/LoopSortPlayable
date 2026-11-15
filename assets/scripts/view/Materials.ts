import { Material, EffectAsset, Color, Vec4, MeshRenderer, gfx } from 'cc';
import { toonColor } from './Palette';
import { TOON_LIGHT } from './ViewConfig';

let baseEffect: EffectAsset | null = null;
let toonEffect: EffectAsset | null = null;

export function setEffects(base: EffectAsset | null, toon: EffectAsset | null) {
  baseEffect = base;
  toonEffect = toon;
}

export function makeMaterial(hex: string, instanced = false, twoSided = false, roughness = 0.6): Material {
  const m = new Material();
  m.initialize({
    effectAsset: baseEffect,
    effectName: baseEffect ? undefined : 'builtin-standard',
    defines: instanced ? { USE_INSTANCING: true } : {},
    states: twoSided ? { rasterizerState: { cullMode: gfx.CullMode.NONE } } : undefined,
  });
  m.setProperty('mainColor', new Color().fromHEX(hex));
  m.setProperty('roughness', roughness);
  m.setProperty('metallic', 0);
  return m;
}

export function makeToon(nameOrHex: string, instanced: boolean, twoSided: boolean): Material {
  const c = toonColor(nameOrHex);
  if (!toonEffect) return makeMaterial(c.base, instanced, twoSided, 0.36);
  const m = new Material();
  m.initialize({
    effectAsset: toonEffect,
    defines: instanced ? { USE_INSTANCING: true } : {},
    states: twoSided ? { rasterizerState: { cullMode: gfx.CullMode.NONE } } : undefined,
  });
  m.setProperty('mainColor', new Color().fromHEX(c.base));
  m.setProperty('highColor', new Color().fromHEX(c.high));
  m.setProperty('shadeColor', new Color().fromHEX(c.shade));
  m.setProperty('specColor', new Color().fromHEX(c.spec));
  m.setProperty('rampParams', new Vec4(c.threshold, c.smoothing, c.roughness, TOON_LIGHT));
  return m;
}

export function makeFadingWhite(): Material {
  const m = new Material();
  m.initialize({
    effectAsset: baseEffect,
    effectName: baseEffect ? undefined : 'builtin-standard',
    technique: 1,
    states: { rasterizerState: { cullMode: gfx.CullMode.NONE } },
  });
  m.setProperty('mainColor', new Color(255, 255, 255, 255));
  m.setProperty('emissive', new Color(255, 255, 255, 255));
  m.setProperty('roughness', 1);
  m.setProperty('metallic', 0);
  return m;
}

export function lit(mr: MeshRenderer, cast = true) {
  mr.shadowCastingMode = cast ? MeshRenderer.ShadowCastingMode.ON : MeshRenderer.ShadowCastingMode.OFF;
  mr.receiveShadow = MeshRenderer.ShadowReceivingMode.ON;
}

export const hexOf = (c: Color) => '#' + c.toHEX('#rrggbb').replace('#', '');
