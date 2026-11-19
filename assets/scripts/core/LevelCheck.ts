import type { LevelData } from './Level';
import { beltLimit } from './Level';

export function validateLevel(l: LevelData): void {
  if (!l.trucks || l.trucks.length === 0) throw new Error('Level needs at least one truck');
  if (!(l.truckCapacity > 0) || !(l.beltCapacity > 0)) throw new Error('truckCapacity and beltCapacity must be positive');
  if (typeof l.belt !== 'string') throw new Error('Level needs a "belt" string (use "" for an empty belt)');
  if (!l.colors) throw new Error('Level needs a "colors" map');
  if (l.truckPlaces !== undefined) {
    const tp = l.truckPlaces;
    if (!Array.isArray(tp) || tp.length !== l.trucks.length) throw new Error(`truckPlaces needs one [x, y, angle] per truck (${l.trucks.length})`);
    tp.forEach((p, i) => {
      if (!Array.isArray(p) || p.length !== 3 || p.some(v => typeof v !== 'number' || !isFinite(v))) throw new Error(`truckPlaces entry ${i + 1} must be [x, y, angle]`);
    });
  }
  if (l.caption !== undefined && typeof l.caption !== 'string') throw new Error('caption must be text');
  const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  if (l.background !== undefined && !hex(l.background)) throw new Error('background must be a hex colour like "#14004A"');
  if (l.captionColor !== undefined && !hex(l.captionColor)) throw new Error('captionColor must be a hex colour like "#2BB4E3"');
  if (l.zoom !== undefined && !(typeof l.zoom === 'number' && l.zoom >= 1)) throw new Error('zoom must be a number, 1 or more');
  const r = l.tapsToRedirect;
  if (r !== undefined && !(Number.isInteger(r) && (r === -1 || r > 0))) throw new Error('tapsToRedirect must be -1 (redirect only on completion) or a whole number of taps, 1 or more');
  const bp = l.beltPath;
  if (!bp || !Array.isArray(bp.points) || bp.points.length < 3) throw new Error('beltPath needs at least 3 points');
  bp.points.forEach((p, i) => {
    const ok = Array.isArray(p) && (p.length === 2 || p.length === 3) && p.every(v => typeof v === 'number' && isFinite(v)) && (p.length === 2 || p[2] >= 0);
    if (!ok) throw new Error(`beltPath point ${i + 1} must be [x, y] or [x, y, height] (height 0 or more)`);
  });
  if (!(bp.width > 0)) throw new Error('beltPath.width must be a positive number');
  if (!(bp.radius >= 0)) throw new Error('beltPath.radius must be 0 or more');
  const check = (str: string, what: string) => {
    for (const c of str) if (!l.colors[c]) throw new Error(`${what} uses colour "${c}" which is not in colors`);
  };
  l.trucks.forEach((t, i) => {
    if (typeof t !== 'string') throw new Error(`Truck ${i + 1} must be a string of colour letters`);
    if (t.length > l.truckCapacity) throw new Error(`Truck ${i + 1} holds ${t.length} units, truckCapacity is ${l.truckCapacity}`);
    check(t, `Truck ${i + 1}`);
  });
  if (l.belt.length > l.beltCapacity) throw new Error(`Belt holds ${l.belt.length} units, beltCapacity is ${l.beltCapacity}`);
  const lim = l.beltLimit;
  if (lim !== undefined && !(Number.isInteger(lim) && lim > 0 && lim <= l.beltCapacity)) throw new Error(`beltLimit must be a whole number from 1 to beltCapacity (${l.beltCapacity})`);
  if (l.belt.length > beltLimit(l)) throw new Error(`Belt holds ${l.belt.length} units, beltLimit is ${beltLimit(l)}`);
  check(l.belt, 'Belt');
}

export function freeStart(l: LevelData): { color: string; truck: number }[] {
  const out: { color: string; truck: number }[] = [];
  const seen: Record<string, boolean> = {};
  for (const color of l.belt) {
    if (seen[color]) continue;
    seen[color] = true;
    const truck = l.trucks.findIndex(t => t.length < l.truckCapacity && (t.length === 0 || t[t.length - 1] === color));
    if (truck >= 0) out.push({ color, truck });
  }
  return out;
}

export function fillProblem(l: LevelData): string | null {
  const count: Record<string, number> = {};
  for (const c of l.trucks.join('') + l.belt) count[c] = (count[c] || 0) + 1;
  let loads = 0;
  for (const c of Object.keys(count)) {
    const over = count[c] % l.truckCapacity;
    if (over) return `there are ${count[c]} "${c}" blocks, which does not fill whole trucks of ${l.truckCapacity}: add ${l.truckCapacity - over} or remove ${over}`;
    loads += count[c] / l.truckCapacity;
  }
  if (loads !== l.trucks.length) return `the blocks fill ${loads} of ${l.trucks.length} trucks: every truck must end up full`;
  return null;
}
