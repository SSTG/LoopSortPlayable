# Loop Sort playable — design

## Intent
A playable ad for Loop Sort in this Cocos Creator 3.8.8 project, matching the reference recording.
Packaging/build for ad networks is handled by the user; this delivers the playable project.

## Goals
- Core loop from the recording: trucks of stacked coloured blocks under a rotating conveyor loop;
  tap a truck to break its top block into small cubes that ride the belt; cubes drop into a truck
  whose top colour matches and which has room; counter shows belt load / capacity.
- Levels are data the user edits later: number of trucks, their stacks, belt capacity,
  and the conveyor's shape.
- Every level is provably solvable: a checker finds a concrete winning tap sequence or rejects the level.
- Overlay as in the recording: caption, counter, Download button, mute, logo; win and fail end cards.

## Non-goals
- Ad-network packaging, store-redirect SDK calls (a single `onDownload()` hook is left for this).
- Blockers (screw, rock, glass, lock), boosters, coins, multiple-level progression.

## Rules (user-described, formalised — formalisation is my call)
- Unit = one block slot. Truck holds `truckCapacity` units; adjacent same-colour units draw as one tall block.
- Belt is a ring of `beltCapacity` slots, advancing one slot per tick. Each truck has a gate slot
  (the belt point nearest its mouth).
- Tap a truck: its whole top same-colour run goes onto the belt at once, at the truck's gate. Units
  already there are pushed one slot forward to make room. If the belt has no room for the whole run
  the truck shakes instead.
- When a belt unit reaches a gate (by riding there or by being pushed there), it drops in if the truck
  has room and its top colour matches. An empty truck accepts any colour, but a tapped truck does not
  take its own block back in the same instant.
- Counter = units on the belt.
- Win: belt empty and every truck holds one colour (or is empty).
- Lose: belt settled (a full lap with no drop), not won, and no truck's top run fits on the belt.

## Approaches
1. **Pure deterministic rules core + thin 3D view (chosen).** The rules above live in a
   Cocos-free TypeScript module. The game renders it; the solver runs the very same code, so
   "solvable" means solvable in the real game, and the solution doubles as the tutorial hint.
2. Physics-driven cubes on the belt. Looks closest to the recording but is non-deterministic, so
   solvability can't be proven. Rejected for that reason; the look is approximated with jittered cube clusters.
3. Use the supplied Track FBX per level. Rejected as the main path: shape would not be editable.
   The belt mesh is generated from the level's path instead.

## Level format (`assets/resources/levels/level1.json`)
```json
{
  "truckCapacity": 15,
  "beltCapacity": 16,
  "colors": { "M": "#F020F0", "O": "#F06A2A", "W": "#FBEFF6" },
  "trucks": ["MOW...", "W", "..."],          // bottom → top, one string per truck
  "belt": "MMOOWW...",                        // units on the belt at start
  "beltPath": { "points": [[-3,6],[3,6],[3,1],[-3,1]], "radius": 1.2, "width": 0.9 }
}
```
Number of trucks = length of `trucks`; they are laid out in a row and the camera fits the whole level.

## Solvability
- `node tools/check-levels.mjs` runs the solver over every level and prints the tap sequence or fails.
- `node tools/make-level.mjs` generates a random level for given truck count/colours and keeps only solvable ones.
- In editor preview the game also runs the solver at load and shows a red banner if the level is unsolvable.

## View
- 3D, top-down-ish orthographic camera. Trucks use the supplied `LongBus` model if it fits cleanly
  after import, otherwise generated geometry; belt mesh generated from the path; small cubes use the
  supplied cube model. UI uses the supplied sprites, Fredoka font, and audio.
- Scene is assembled at runtime by one bootstrap component.

## Left to the builder
Tick rate, cube cluster look, exact colours, animation timing, end-card layout.
