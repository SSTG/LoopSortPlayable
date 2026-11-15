import type { LevelData } from '../assets/scripts/core/Rules';

export function mk(p: Partial<LevelData>): LevelData {
  return {
    truckCapacity: 4,
    beltCapacity: 6,
    colors: { M: '#f0f', O: '#f60', W: '#fff' },
    trucks: [],
    belt: '',
    beltPath: { points: [[-3, 6], [3, 6], [3, 1], [-3, 1]], radius: 1.2, width: 0.9 },
    ...p,
  };
}
