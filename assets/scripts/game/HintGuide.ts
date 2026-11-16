import type { GameState } from '../core/Rules';
import { cloneState } from '../core/Rules';
import { solveFrom, settle } from '../core/Solver';

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

  // Blocks moving on their own (dropping or flying into a truck) are activity too: hide the hand and restart the wait.
  onActivity() {
    this.idle = 0;
    this.dirty = true;
    this.truck = NONE;
  }

  refresh() {
    this.dirty = true;
  }

  update(dt: number, state: GameState, idleBeforeHint: number): number {
    this.idle += dt;
    // Always idleBeforeHint seconds of calm first; before the first tap, also wait for the opening cubes to settle.
    const wanted = this.idle >= idleBeforeHint && (this.tapped || this.openingDone(state));
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
