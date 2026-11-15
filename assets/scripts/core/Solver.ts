import type { GameState, LevelData } from './Rules';
import { createState, cloneState, tap, tick, isSettled, isWon, canTap, load } from './Rules';

export function settle(s: GameState): void {
  const limit = s.ring.length * (s.level.truckCapacity * s.trucks.length + s.ring.length + 4);
  for (let i = 0; i < limit && !isSettled(s); i++) tick(s);
}

function key(s: GameState): string {
  const n = s.ring.length;
  let belt = '';
  for (let p = 0; p < n; p++) belt += s.ring[(((p - s.offset) % n) + n) % n] || '.';
  return s.trucks.map(t => t.join('')).join('|') + '#' + belt;
}

function score(s: GameState): number {
  let n = load(s);
  for (const t of s.trucks) for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) n += 2;
  return n;
}

interface Node { s: GameState; score: number; parent: Node | null; move: number; depth: number }

export function solve(level: LevelData, gates: number[], maxNodes = 200000): number[] | null {
  return solveFrom(createState(level, gates), maxNodes);
}

export function solveFrom(state: GameState, maxNodes = 200000): number[] | null {
  const start = cloneState(state);
  settle(start);
  const heap: Node[] = [];
  const push = (nd: Node) => {
    heap.push(nd);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].score <= heap[i].score) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const pop = (): Node => {
    const top = heap[0], last = heap.pop() as Node;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].score < heap[m].score) m = l;
        if (r < heap.length && heap[r].score < heap[m].score) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };

  const seen = new Set<string>([key(start)]);
  push({ s: start, score: score(start), parent: null, move: -1, depth: 0 });
  let expanded = 0;
  while (heap.length > 0 && expanded < maxNodes) {
    const nd = pop();
    expanded++;
    if (isWon(nd.s)) {
      const out: number[] = [];
      for (let c: Node | null = nd; c && c.parent; c = c.parent) out.push(c.move);
      return out.reverse();
    }
    for (let i = 0; i < nd.s.trucks.length; i++) {
      if (!canTap(nd.s, i)) continue;
      const next = cloneState(nd.s);
      tap(next, i);
      settle(next);
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);

      push({ s: next, score: score(next) + (nd.depth + 1) * 0.05, parent: nd, move: i, depth: nd.depth + 1 });
    }
  }
  return null;
}
