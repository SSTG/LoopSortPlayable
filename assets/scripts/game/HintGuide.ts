import type { GameState } from '../core/Rules';
import { cloneState } from '../core/Rules';
import { solveFrom, settle } from '../core/Solver';

const FIRST_HINT_DELAY = 0.6;
const SOLVER_BUDGET = 30000;
const NONE = -1;
const NO_MOVE = -2;

export class HintGuide {
  truck = NONE;

  private idle = 0;
  private dirty = true;
  private tapped = false;

  reset() {
    this.idle = 0;
    this.dirty = true;
    this.truck = NONE;
    this.tapped = false;
  }

  onTap() {
    this.idle = 0;
    this.dirty = true;
    this.truck = NONE;
    this.tapped = true;
  }

  refresh() {
    this.dirty = true;
  }

  update(dt: number, state: GameState, idleBeforeHint: number): number {
    this.idle += dt;
    const wanted = this.tapped ? this.idle >= idleBeforeHint : this.idle > FIRST_HINT_DELAY && this.openingDone(state);
    if (wanted && this.dirty) {
      this.dirty = false;
      const solution = solveFrom(state, SOLVER_BUDGET);
      this.truck = solution && solution.length > 0 ? solution[0] : NO_MOVE;
    }
    return this.truck;
  }

  private openingDone(state: GameState): boolean {
    const calm = cloneState(state);
    settle(calm);
    return calm.trucks.every((t, i) => t.length === state.trucks[i].length);
  }
}
