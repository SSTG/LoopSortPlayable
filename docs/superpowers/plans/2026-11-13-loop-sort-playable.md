# Loop Sort Playable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable Loop Sort ad in this Cocos Creator 3.8.8 project with data-driven, provably solvable levels.

**Architecture:** A Cocos-free, deterministic rules core (`assets/scripts/core`) is shared by the game view and by a Node solver/level tools. The 3D view and UI are assembled at runtime by one bootstrap component from a level JSON.

**Tech Stack:** Cocos Creator 3.8.8 (TypeScript), Node 26 (`node --test`, native type stripping) for core tests and tools.

**Spec:** `docs/superpowers/specs/2026-11-13-loop-sort-playable-design.md`

## Global Constraints

- Core files import nothing from `cc`, use no enums/namespaces/parameter properties (must run under Node type stripping).
- Imports between core files are extensionless (`./Rules`); Node tools load them through `tools/ts-resolve.mjs` (resolve hook appending `.ts`).
- Tests and tools live outside `assets/` (`tests/`, `tools/`).
- Level stacks are strings, bottom → top, one char per unit; colour keys come from the level's `colors` map.
- No commits unless the user asks.

## Review Focus

- Level with a truck string longer than `truckCapacity`, or `belt` longer than `beltCapacity` → `validateLevel` throws a clear message (Task 1 test).
- Level using a colour char missing from `colors` → `validateLevel` throws (Task 1 test).
- Two trucks resolving to the same gate slot (narrow belt, many trucks) → gates are made unique (Task 2 test).
- Tapping an empty truck, or tapping during the win/lose state → no-op (Task 1 test; view ignores input after end).
- Tapping rapidly while a truck is still ejecting → second run queues behind the first, counter never exceeds capacity (Task 1 test).

---

### Task 1: Rules core

**Files:** Create `assets/scripts/core/Rules.ts`, `tools/ts-resolve.mjs`, `tests/rules.test.ts`

**Interfaces — Produces:**
```ts
export interface BeltPathData { points: number[][]; radius: number; width: number }
export interface LevelData { truckCapacity: number; beltCapacity: number; colors: Record<string,string>;
  trucks: string[]; belt: string; beltPath: BeltPathData }
export interface GameState { level: LevelData; gates: number[]; trucks: string[][];   // bottom→top
  ring: (string|null)[];            // ring[slot]; slot s sits at path fraction ((s + offset) / N)
  offset: number;                   // ticks elapsed mod N
  pending: string[][];              // per truck, units waiting to enter at its gate
  quiet: number }                   // ticks since last drop/entry
export type GameEvent = { type:'enter'; truck:number; slot:number; color:string }
                      | { type:'drop';  truck:number; slot:number; color:string };
export function validateLevel(l: LevelData): void;
export function createState(l: LevelData, gates: number[]): GameState;  // belt units spread evenly on the ring
export function load(s: GameState): number;                 // ring units + pending units
export function canTap(s: GameState, truck: number): boolean;
export function tap(s: GameState, truck: number): boolean;  // ejects whole top run into pending
export function tick(s: GameState): GameEvent[];            // advance 1 slot, then drops, then entries
export function isSettled(s: GameState): boolean;           // no pending and quiet >= N
export function isWon(s: GameState): boolean;
export function isLost(s: GameState): boolean;              // settled, not won, no canTap
export function cloneState(s: GameState): GameState;
export function slotAtGate(s: GameState, truck: number): number;
```
Tick order: advance offset; for each truck in index order, if the slot at its gate holds a unit and the truck accepts it (room, and empty-or-top-matches, and `pending[truck]` is empty) → drop; then for each truck with pending, if its gate slot is empty → enter one unit.

- [ ] Write `tests/rules.test.ts`: validateLevel throws on overfull truck / overfull belt / unknown colour; tap ejects the whole top run (`"MOO"` → `"M"`, pending `OO`); tap refused when run doesn't fit, when truck empty, when game won; a belt unit drops into a matching-top truck with room within N ticks and not into a full or mismatching one; empty truck accepts any colour; double tap never pushes `load` above `beltCapacity`; `isWon` for uniform trucks + empty belt; `isLost` when settled with no legal tap.
- [ ] Run `node --import ./tools/ts-resolve.mjs --test tests/` → fails (module missing).
- [ ] Implement `Rules.ts` and `ts-resolve.mjs`.
- [ ] Run tests → pass.

### Task 2: Belt path and layout

**Files:** Create `assets/scripts/core/Layout.ts`, `tests/layout.test.ts`

**Interfaces — Produces:**
```ts
export interface Pt { x: number; y: number }
export interface Path { length: number; at(f: number): Pt; tangent(f: number): Pt; nearest(p: Pt): number } // f in [0,1)
export function buildPath(d: BeltPathData): Path;            // closed polyline with rounded corners
export interface Layout { path: Path; trucks: { x:number; top:number; bottom:number; width:number }[];
  gates: number[]; bounds: { minX:number; maxX:number; minY:number; maxY:number }; unit: number }
export function buildLayout(l: LevelData): Layout;
```
Trucks sit in a row centred on the path's x-centre, mouths `0.6` below the path's lowest point, pitch `1.25`, width `0.9`, unit height `0.55`. Gate = `round(path.nearest(mouth) * N) mod N`, bumped forward to the next free slot on clashes.

- [ ] Tests: rounded-rect path length ≈ perimeter formula (±1%); `at(0)` ≈ `at(0.9999)`; `nearest(at(f)) ≈ f`; gates unique for 10 trucks on a 12-slot belt; truck count equals `trucks.length`.
- [ ] Run → fail; implement; run → pass.

### Task 3: Solver, level file, tools

**Files:** Create `assets/scripts/core/Solver.ts`, `assets/resources/levels/level1.json`, `tools/check-levels.mjs`, `tools/make-level.mjs`, `tests/solver.test.ts`

**Interfaces — Produces:**
```ts
export function settle(s: GameState): void;                              // tick until settled
export function solve(l: LevelData, gates: number[], maxNodes?: number): number[] | null; // truck index per tap, each made at a settled state
```
Search: best-first over settled states keyed by trucks+ring+offset, scored by number of colour boundaries in trucks plus belt load; default `maxNodes` 200000.

- `level1.json`: 6 trucks, capacity 15, belt 16 with 14 units at start, 3 colours, rounded-rect path — arranged like the recording and accepted by the solver.
- `check-levels.mjs`: for every `assets/resources/levels/*.json` print `OK <n> taps: …` or `UNSOLVABLE`, exit 1 on any failure.
- `make-level.mjs --trucks N --colors K --capacity C --belt B [--seed S]`: scramble from a solved arrangement, keep the first candidate the solver accepts, print JSON.

- [ ] Tests: trivially solved level → `[]`; a 2-truck hand level with known 2-tap solution is solved and replaying the taps through `tap`/`settle` yields `isWon`; an impossible level (odd colour locked under a full belt) → `null`; `level1.json` solves and its solution replays to a win.
- [ ] Run → fail; implement; run → pass; run `node --import ./tools/ts-resolve.mjs tools/check-levels.mjs` → `OK`.

### Task 4: Scene, assets, 3D view

**Files:** Copy needed assets into `assets/resources/{models,textures,audio,fonts}`; create `assets/scene/main.scene` (+meta), `assets/scripts/Bootstrap.ts`, `assets/scripts/view/GameView.ts`, `assets/scripts/view/BeltMesh.ts`

- `Bootstrap` (the only component in the scene): loads `levels/level1`, builds layout + state, creates camera/light, `GameView`, `Hud`; drives `tick` every 0.12 s; runs `solve` in preview and passes the result to the HUD.
- `GameView`: belt mesh from path; trucks (LongBus model if it imports at a usable orientation/scale, else generated boxes — decide by looking at the preview); blocks as merged boxes per run; each belt unit as a cluster of 10 small cubes following its slot along the path; enter/drop flights; tap picking by truck x-range; shake on refused tap.
- [ ] Verify in the editor preview (`http://localhost:7456`): level renders like the recording, taps eject, cubes circulate and drop, no console errors.

### Task 5: HUD, audio, end states

**Files:** Create `assets/scripts/view/Hud.ts`, `assets/scripts/view/Sfx.ts`

- HUD: counter `n/16` with `CubeShape` icon, caption "Harder than you think", green Download button, mute toggle, logo, tutorial hand on the solver's first tap until first input, win card ("Well Done" letters + Download), fail card (broken heart + Retry + Download), red "LEVEL UNSOLVABLE" banner in preview. `Bootstrap.onDownload()` is the single store hook.
- Sfx: music loop, pop on drop, click on tap, win jingle, fail gong; mute toggle.
- [ ] Verify in preview: play the solver's solution to the win card; fill the belt to reach the fail card; Retry restarts; mute works; portrait and landscape both fit.
