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

// Optional look on top of the toon ramp: a broad, strong highlight, a sheen at the edges and a softer, waxier ramp.
export interface Gloss { highlight: number; size: number; rim: number; wax: number }

function dimmed(hex: string, k: number): Color {
  const c = new Color().fromHEX(hex);
  return k === 1 ? c : new Color(Math.round(c.r * k), Math.round(c.g * k), Math.round(c.b * k), c.a);
}

// dim < 1 darkens the whole colour, for surfaces in shadow (such as the inside of a block with cubes missing).
export function makeToon(nameOrHex: string, instanced: boolean, twoSided: boolean, gloss?: Gloss, dim = 1): Material {
  const c = toonColor(nameOrHex);
  if (!toonEffect) {
    const m = makeMaterial(c.base, instanced, twoSided, gloss ? 0.2 : 0.36);
    if (dim !== 1) m.setProperty('mainColor', dimmed(c.base, dim));
    return m;
  }
  const m = new Material();
  m.initialize({
    effectAsset: toonEffect,
    defines: instanced ? { USE_INSTANCING: true } : {},
    states: twoSided ? { rasterizerState: { cullMode: gfx.CullMode.NONE } } : undefined,
  });
  m.setProperty('mainColor', dimmed(c.base, dim));
  m.setProperty('highColor', dimmed(c.high, dim));
  m.setProperty('shadeColor', dimmed(c.shade, dim));
  m.setProperty('specColor', new Color().fromHEX(c.spec));
  m.setProperty('rampParams', new Vec4(c.threshold, c.smoothing, gloss ? gloss.size : c.roughness, TOON_LIGHT));
  if (gloss) m.setProperty('glossParams', new Vec4(gloss.highlight, gloss.rim, 3, gloss.wax));
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
