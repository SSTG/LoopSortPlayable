import { Vec3 } from 'cc';

export const CUBE_ROWS = 6;
export const CUBE_COLS = 4;
export const CUBES_PER_UNIT = CUBE_ROWS * CUBE_COLS;

export const PIECE_COLS = 4;
export const PIECE_LAYERS = 3;
export const PIECE_SLICES = 2;
export const PIECE_ROWS = PIECE_LAYERS * PIECE_SLICES;
export const PIECE_COUNT = PIECE_ROWS * PIECE_COLS;

export const PIECE_RULES = [[3, 0, 5], [3, 1, 5], [2, 0, 5], [2, 1, 5], [3, 0, 4], [3, 1, 4], [2, 0, 4], [2, 1, 4],
  [3, 0], [3, 1], [2, 0], [2, 1], [5, 3], [5, 2], [5, 0], [5, 1], [4, 3], [4, 2], [4, 0], [4, 1]];

export const GLIDE = 7;
export const HIT_FROM = 0.6;
export const BLOCK_TALL = 1;
export const BLOCK_GAP = 0.001;
export const BLOCK_ROUND = 0.045;
export const UP = new Vec3(0, 1, 0);
export const TOON_LIGHT = Math.pow(0.65, 2.2);

export const BUS = { outerWidth: 2.06, innerWidth: 1.72, floor: 0.75, bedTail: -2.2, bedCab: 1.65, stretchLo: -0.5, stretchHi: 0.25 };
export const BLOCK_NATIVE = { half: [1.5, 1.5, 1], bevel: 0.25 };
export const BELT = { surfaceWidth: 1.2, base: 0.71, section: 0.15 };
export const BELT_LOOK = { flat: 0.4, rim: 0.5 };

export const tuning = {
  cubeSize: 0.25,
  breakTime: 0.8,
  flyOut: 0.3,
  flyIn: 0.38,
  creep: 0.2,
  pushRadius: 0.24,
  stragglers: 6,
  cubeVariety: 0.08,
  popStrength: 0.5,
  pourTime: 0.3,
  pourSway: 0.3,
  pourWave: 5,
  pourDrift: 9,
  cubeGloss: { highlight: 6, size: 0.62, rim: 0.35, wax: 0.45 },
  outlineThick: 0.045,
  outlineRise: 0.45,
  outlineFade: 0.4,
  lidExtra: 0.21,
  lidTime: 0.6,
  tickTime: 0.9,
  innerShadow: 0.4,
  impressionColor: '#8F86AC',
  impressionGap: 0.05,
  impressionCorner: 0.07,
  arrow: { every: 2, pair: 1.1, width: 0.52, length: 0.48, round: 0.08, color: '#B7A3DC' },
};

export const crowdSpeed = () => tuning.creep * (0.7 + Math.random() * 0.6);
