import type { GameState } from '../core/Rules';
import { freeStart, fillProblem } from '../core/Rules';
import { solveFrom } from '../core/Solver';
import type { Hud } from '../view/Hud';

const ADVICE = ' - run tools/check-levels.mjs';

export function warnAboutLevel(state: GameState, levelName: string, hud: Hud) {
  const level = state.level;
  const problems: [boolean, string, string][] = [
    [!solveFrom(state), 'LEVEL UNSOLVABLE', 'has no solution'],
    [!!fillProblem(level), 'BLOCKS DO NOT FILL THE TRUCKS', String(fillProblem(level))],
    [freeStart(level).length > 0, 'BELT STARTS WITH FREE CUBES', 'starts with cubes on the belt that drop without a tap'],
  ];
  for (const [found, banner, detail] of problems) {
    if (!found) continue;
    hud.setBanner(banner + ADVICE);
    console.error(`[LoopSort] level "${levelName}": ${detail}`);
  }
}
