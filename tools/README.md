# Loop Sort level tools

Levels live in `assets/resources/levels/*.json`. The `Bootstrap` component on the `Game` node in
`assets/scene/main.scene` has a `levelName` field that picks which one to load.

```json
{
  "caption": "Harder than you think", // text shown at the top of the screen
  "captionColor": "#2BB4E3",           // optional: text colour of the caption; default is the label's colour in the scene
  "background": "#14004A",             // optional: background colour of the game; default is the scene camera's colour
  "zoom": 1,                           // optional: camera closeness. 1 fits the whole level; above 1 keeps the belt at the top
                                       // and lets the truck ends go off the bottom (only the top 1/zoom of the level shows)
  "tapsToRedirect": -1,                // the store opens on this tap and every later one; -1 = only when the level is completed
  "truckCapacity": 15,                 // units one truck can hold
  "beltCapacity": 16,                  // units the belt can hold (the x/16 counter)
  "beltLimit": 12,                     // optional: most units allowed on the belt (the x/12 counter); default beltCapacity
  "colors": { "M": "#F224F2", "O": "#F2682A", "W": "#FFF1F8" },
  "trucks": ["OMMW", "W", "..."],      // one string per truck, bottom -> top, one letter per unit
  "belt": "OWWO",                      // units riding the belt at the start
  "truckPlaces": [[0, -0.35, 90], [0, 7.35, -90]],  // optional, one [x, y, angle] per truck: where its mouth (open end) is and
                                       // which way it faces (90 up, 0 right, -90 down, 180 left). Leave out for an even row under the belt
  "beltPath": {                        // conveyor shape: corner points of a closed loop
    "points": [[-3.1, 6], [3.1, 6], [3.1, 1], [-3.1, 1]],
    "radius": 1.3,                     // corner rounding
    "width": 1.0                       // belt width
  }
}
```
(Comments are for this README only; JSON files cannot contain them.)

- Number of trucks = number of strings in `trucks`. By default they stand in a row under the belt; with
  `truckPlaces` each can stand anywhere, outside or inside the loop, at any angle. Keep a truck's mouth about
  1.35 from the belt's centre line. The game refuses a level whose trucks overlap each other or the belt.
  The camera fits whatever you build.
- Belt shape = any closed polygon in `beltPath.points` (x to the right, y up). The belt travels in
  the order the points are listed.

## Always solvable

After editing or adding a level, run from the project root:

    node --import ./tools/ts-resolve.mjs tools/check-levels.mjs

The check also fails a level whose belt starts with a cube some truck would take without a tap (a truck with
room whose top block is that colour, or an empty truck): every merge must be the player's doing. `make-level.mjs`
only writes levels that obey this, so the belt may start with fewer cubes than `--onbelt` asks for.

`beltCapacity` must be in proportion to the belt's length - about one block per 1.26 units of belt (`SLOT_LENGTH`
in `core/Layout.ts`; anything from 1.15 to 1.4 passes) - so that a full counter means a belt packed with cubes.
The check fails a level that is off and says what capacity suits its belt; `make-level.mjs` picks the capacity
from the shape when `--belt` is left out. A lengthened or shortened belt needs its `beltCapacity` changed to match.
To make a level harder without thinning out the belt, keep `beltCapacity` (the number of slots, matched to the
belt's length) and set a lower `beltLimit`: the counter, the slow-down and how many blocks a tap may send all use
the limit. A tap sends the truck's whole top run of one colour, or only as many as still fit under the limit (the rest
stay in the truck); a tap on a full belt is refused. It must be a whole number from 1 to `beltCapacity`, and the starting belt must fit under it.
The belt also slows down as it fills: above 70% full it eases down to a third of its speed when packed.

It plays every level with the game's own rules and prints one winning tap sequence (each tap made once the belt has settled; in-game hints re-solve from wherever the player is), or `UNSOLVABLE`
/ `INVALID` (exit code 1). The game also shows a red banner in preview if a level has no solution.

To generate a new solvable level:

    node --import ./tools/ts-resolve.mjs tools/make-level.mjs --trucks 6 --colors 3 --capacity 15 \
      --onbelt 14 --mix 120 --seed 1 > assets/resources/levels/level2.json

`--mix` = how scrambled, `--onbelt` = blocks that start on the belt, `--minload` = minimum belt
load once the opening cubes have settled. `--limit` writes `beltLimit` (most blocks allowed on the belt) and builds the level around it.

A level is won only when **every truck is full of one colour**, so its blocks (in the trucks plus on the belt)
must fill the trucks exactly: each colour a whole number of truckloads, trucks x `truckCapacity` blocks in all.
The check fails a level that does not add up and says which colour is short; `make-level.mjs` always writes
levels that do. `--shape` picks the conveyor outline: `rect` (level1), `house`
(level2), `horseshoe` (level3), `hourglass` (level4), `crown` (level5), `horns`, `dog`, `infinity`,
`clover` or `spiral`; add your own to `SHAPES` in
`make-level.mjs`, or edit `beltPath` by hand afterwards, and re-run the check. A longer belt wants a
higher `--belt`. `--places "0,-0.35,90;0,7.35,-90"` writes `truckPlaces`; `--width 1.2` sets the belt's width (about one unit per 1.26 of belt length keeps the cubes as dense as level1).

The `infinity` belt crosses over itself. A point of `beltPath.points` may carry a third number, the height the
belt is raised to there (`[x, y, height]`); the belt slopes evenly between points, and cubes ride up and over.
A height of about 0.75 clears the cubes passing underneath.

`--palette "M,O,W"` chooses the block colours by letter: M magenta, O orange, W white, B blue, G green,
Y yellow, R red, C cyan, P purple (one letter per colour; it replaces `--colors`).

**Final levels** live in `assets/resources/FinalLevels` (`horns`, `dog`, `infinity`, `clover`, `spiral`).
To play one, set **Level Name** on the Game node to the folder and name, e.g. `FinalLevels/clover`; a
plain name such as `level3` still loads from `assets/resources/levels`. The check and the tests cover
both folders.

Rule tests: `node --import ./tools/ts-resolve.mjs --test tests/*.test.ts`

## Ad network builds

**In the editor:** menu **Playable Ads > Build Settings...** opens a panel (the `extensions/playable-build`
extension). Choose the level (one, all final levels, or the one saved in the scene), tick the ad networks, fill
in the store pages and press **Build and pack**. **Pack only** reuses the last build, which is enough when only
the level choice, networks or store pages changed. The panel saves the networks and store pages to
`tools/playable.config.json` and runs the same commands as below. If the menu is missing, enable the extension
in **Extension > Extension Manager > Project** or restart the editor. It needs Node.js installed.

**From a terminal:** one command builds the game and packs it for every ad network:

    node tools/build-playable.mjs --level FinalLevels/clover

It copies the project to `build/.playable-project`, builds that copy for Web Mobile with the engine parts the
game does not use left out (`tools/playable/engine-modules.json`: no physics, spine, particles...), then packs
the result. The editor can stay open; the build never touches the real project's `library` or `temp`.
Do not run Cocos Creator's own `--build` on the real project while the editor is open: the two share those
folders and the editor's preview breaks.

To pack more levels from the same build (no rebuild needed):

    node tools/pack-playable.mjs --level FinalLevels/dog
    node tools/pack-playable.mjs --level FinalLevels/dog --networks applovin,google
    node tools/pack-playable.mjs --level FinalLevels/dog,FinalLevels/horns

Without `--level` the ad plays the level saved in the scene. Output goes to `build/playable/<network>/`:

| Network | File | Store call |
| --- | --- | --- |
| applovin, unity, ironsource | one `.html` | `mraid.open(store url)` |
| google | `.zip` | `ExitApi.exit()` |
| facebook | `.zip` | `FbPlayableAd.onCTAClick()` |
| mintegral | `.zip` | `window.install()`, plus `gameReady()` / `gameEnd()` |
| tiktok | `.zip` with `config.json` | `playableSDK.openAppStore()` |
| vungle | `.zip` | `parent.postMessage('download', '*')` |
| preview | one `.html` for a browser | `window.open(store url)` |

Every package is a single `index.html` with the whole game inside it, compressed (about 3.9 MB as HTML,
2.9 MB zipped; the networks allow 5 MB). The packer prints `TOO BIG` if one goes over.

Settings are in `tools/playable.config.json`:

- `iosUrl`, `androidUrl`: the store pages. **Fill these in**; applovin, unity and ironsource open them directly.
- `networks`: which packages to make by default.
- `musicKbps`, `soundKbps`: the sounds are re-encoded to mono at these bitrates to save space (0 = leave alone; needs `ffmpeg`).
- `cubeMapSize`: the unused sky textures are shrunk to this many pixels.
- `splashMs`: how long the Cocos splash screen shows (0 = off).
- `background`: page colour shown for the instant before the game draws (the level's own background colour).
- `creator`: path to the Cocos Creator program, if it is not in `/Applications/Cocos/Creator/<version>`.

A new network is one entry in `tools/playable/networks.mjs`. The game reaches the network through
`window.playableAd` (`cta`, `ready`, `end`, `level`), read in `assets/scripts/game/AdBridge.ts`.

**Start-up time.** The sounds are not part of the scene: `SoundManager` loads `music`, `pop`, `cube`, `click`,
`win`, `fail`, `ui`, `complete` and `confetti` (.mp3) from `assets/resources/audio` a moment after the level
appears. To change a sound, replace the file and keep its name. Keep textures small (the logo is 823 x 526)
and do not put audio clips or large images straight into the scene, or the start slows down again.
