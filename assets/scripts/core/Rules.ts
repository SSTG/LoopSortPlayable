import type { LevelData } from './Level';
import { validateLevel } from './LevelCheck';

export * from './Level';
export * from './LevelCheck';

export interface GameState {
  level: LevelData;
  gates: number[];
  trucks: string[][];
  ring: (string | null)[];
  offset: number;
  quiet: number;
}

export type GameEvent =
  | { type: 'shift'; from: number; to: number }
  | { type: 'enter'; truck: number; slot: number; color: string }
  | { type: 'drop'; truck: number; slot: number; color: string };

export const SLOW_FROM = 0.7;
export const FULL_SPEED = 1 / 3;

export function beltSpeed(load: number, capacity: number): number {
  const fill = capacity > 0 ? Math.min(1, load / capacity) : 0;
  if (fill <= SLOW_FROM) return 1;
  return 1 - (1 - FULL_SPEED) * ((fill - SLOW_FROM) / (1 - SLOW_FROM));
}

export function createState(l: LevelData, gates: number[]): GameState {
  validateLevel(l);
  const n = l.beltCapacity;
  const ring: (string | null)[] = new Array(n).fill(null);
  for (let i = 0; i < l.belt.length; i++) ring[Math.floor((i * n) / l.belt.length)] = l.belt[i];
  return {
    level: l,
    gates: gates.slice(),
    trucks: l.trucks.map(t => t.split('')),
    ring,
    offset: 0,
    quiet: 0,
  };
}

export function cloneState(s: GameState): GameState {
  return {
    level: s.level,
    gates: s.gates,
    trucks: s.trucks.map(t => t.slice()),
    ring: s.ring.slice(),
    offset: s.offset,
    quiet: s.quiet,
  };
}

export function load(s: GameState): number {
  let n = 0;
  for (const c of s.ring) if (c) n++;
  return n;
}

export function topRun(truck: string[]): number {
  if (truck.length === 0) return 0;
  const c = truck[truck.length - 1];
  let n = 0;
  while (n < truck.length && truck[truck.length - 1 - n] === c) n++;
  return n;
}

export function slotAtGate(s: GameState, truck: number): number {
  const n = s.ring.length;
  return (((s.gates[truck] - s.offset) % n) + n) % n;
}

export function isWon(s: GameState): boolean {
  if (load(s) > 0) return false;
  for (let i = 0; i < s.trucks.length; i++) if (!isComplete(s, i)) return false;
  return true;
}

export function isComplete(s: GameState, truck: number): boolean {
  const t = s.trucks[truck];
  return !!t && t.length >= s.level.truckCapacity && topRun(t) === t.length;
}

export function canTap(s: GameState, truck: number): boolean {
  const t = s.trucks[truck];
  if (!t || t.length === 0 || isWon(s) || isComplete(s, truck)) return false;
  return topRun(t) <= s.ring.length - load(s);
}

function accepts(s: GameState, truck: number, color: string): boolean {
  const t = s.trucks[truck];
  if (t.length >= s.level.truckCapacity) return false;
  return t.length === 0 || t[t.length - 1] === color;
}

function resolveGates(s: GameState, events: GameEvent[] | undefined, skipTruck: number): void {
  for (let i = 0; i < s.trucks.length; i++) {
    if (i === skipTruck) continue;
    const slot = slotAtGate(s, i);
    const color = s.ring[slot];
    if (color && accepts(s, i, color)) {
      s.trucks[i].push(color);
      s.ring[slot] = null;
      s.quiet = 0;
      if (events) events.push({ type: 'drop', truck: i, slot, color });
    }
  }
}

export function tap(s: GameState, truck: number, events?: GameEvent[]): boolean {
  if (!canTap(s, truck)) return false;
  const t = s.trucks[truck];
  const n = topRun(t), size = s.ring.length;
  for (let k = 0; k < n; k++) {
    const color = t.pop() as string;
    const gate = slotAtGate(s, truck);
    let gap = 0;
    while (s.ring[(gate + gap) % size] !== null) gap++;
    for (let j = gap; j > 0; j--) {
      const from = (gate + j - 1) % size, to = (gate + j) % size;
      s.ring[to] = s.ring[from];
      if (events) events.push({ type: 'shift', from, to });
    }
    s.ring[gate] = color;
    if (events) events.push({ type: 'enter', truck, slot: gate, color });
  }
  s.quiet = 0;

  resolveGates(s, events, truck);
  return true;
}

export function tick(s: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  s.offset = (s.offset + 1) % s.ring.length;
  s.quiet++;
  resolveGates(s, events, -1);
  return events;
}

export function isSettled(s: GameState): boolean {
  return s.quiet >= s.ring.length;
}

export function isLost(s: GameState): boolean {
  if (!isSettled(s) || isWon(s)) return false;
  for (let i = 0; i < s.trucks.length; i++) if (canTap(s, i)) return false;
  return true;
}
