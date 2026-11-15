import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLevel, freeStart, fillProblem } from '../assets/scripts/core/Rules.ts';
import { buildLayout, beltFits, beltCapacityFor } from '../assets/scripts/core/Layout.ts';
import { solve } from '../assets/scripts/core/Solver.ts';

const res = join(dirname(fileURLToPath(import.meta.url)), '../assets/resources');
const dirs = ['levels', 'FinalLevels'].map(d => join(res, d));
const files = process.argv.length > 2 ? process.argv.slice(2) : dirs.flatMap(dir => readdirSync(dir).filter(f => f.endsWith('.json')).map(f => join(dir, f)));
let bad = 0;
for (const f of files) {
  try {
    const level = JSON.parse(readFileSync(f, 'utf8'));
    validateLevel(level);
    if (!beltFits(level)) throw new Error(`beltCapacity ${level.beltCapacity} does not suit this belt's length: a full belt must look full, use about ${beltCapacityFor(level.beltPath)}`);
    const fill = fillProblem(level);
    if (fill) throw new Error(fill);
    const free = freeStart(level);
    if (free.length) throw new Error('the belt starts with cubes that drop without a tap: ' + free.map(f => `"${f.color}" into truck ${f.truck + 1}`).join(', '));
    const sol = solve(level, buildLayout(level).gates);
    if (sol) console.log(`OK          ${f}\n            ${sol.length} taps (truck numbers, each made once the belt has settled): ${sol.map(t => t + 1).join(' ')}`);
    else { bad++; console.log(`UNSOLVABLE  ${f}\n            no winning line found within the search budget`); }
  } catch (e) { bad++; console.log(`INVALID     ${f}\n            ${e.message}`); }
}
process.exit(bad ? 1 : 0);
