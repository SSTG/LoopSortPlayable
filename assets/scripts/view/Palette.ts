export interface ToonColor { base: string; high: string; shade: string; spec: string; threshold: number; smoothing: number; roughness: number }

export const PALETTE: Record<string, ToonColor> = {
  Black: { base: '#303030', high: '#676767', shade: '#464646', spec: '#BFBFBF', threshold: 0.7, smoothing: 0.1, roughness: 0.56 },
  Blue: { base: '#258BE0', high: '#6AD3FF', shade: '#0D59A6', spec: '#BFBFBF', threshold: 0.792, smoothing: 0.149, roughness: 0.5 },
  Brown: { base: '#A4724F', high: '#D9B8A1', shade: '#6A3E26', spec: '#BFBFBF', threshold: 0.792, smoothing: 0.149, roughness: 0.5 },
  Cyan: { base: '#32DDE6', high: '#6FCBFF', shade: '#227A9E', spec: '#BFBFBF', threshold: 0.7, smoothing: 0.1, roughness: 0.56 },
  Green: { base: '#3FDB17', high: '#80F273', shade: '#80F273', spec: '#BFBFBF', threshold: 0.792, smoothing: 0.149, roughness: 0.5 },
  Grey: { base: '#8E8E93', high: '#B5B5BA', shade: '#5C5C60', spec: '#BFBFBF', threshold: 0.7, smoothing: 0.1, roughness: 0.56 },
  Magenta: { base: '#E64DB1', high: '#FFA4DC', shade: '#9B2A77', spec: '#BFBFBF', threshold: 0.792, smoothing: 0.149, roughness: 0.5 },
  Orange: { base: '#EC7F2B', high: '#FFBB7A', shade: '#B65F10', spec: '#BFBFBF', threshold: 0.792, smoothing: 0.149, roughness: 0.5 },
  Pink: { base: '#FE2DFF', high: '#FF7095', shade: '#B81D3B', spec: '#BFBFBF', threshold: 0.7, smoothing: 0.1, roughness: 0.56 },
  Purple: { base: '#BB62E0', high: '#E7A6FF', shade: '#8132A6', spec: '#BFBFBF', threshold: 0.792, smoothing: 0.149, roughness: 0.5 },
  Red: { base: '#DD0705', high: '#D68568', shade: '#800402', spec: '#E2E2E2', threshold: 0.792, smoothing: 0.149, roughness: 0.5 },
  White: { base: '#FFFFFF', high: '#CCCCCC', shade: '#787878', spec: '#BFBFBF', threshold: 0.7, smoothing: 0.1, roughness: 0.56 },
  Yellow: { base: '#F5C52A', high: '#FFE770', shade: '#BB8F0F', spec: '#BFBFBF', threshold: 0.75, smoothing: 0.1, roughness: 0.273 },
};

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

export function toonColor(nameOrHex: string): ToonColor {
  if (PALETTE[nameOrHex]) return PALETTE[nameOrHex];
  const want = rgb(nameOrHex);
  let best = PALETTE.White, bestD = Infinity;
  for (const key of Object.keys(PALETTE)) {
    const c = rgb(PALETTE[key].base);
    const d = (c[0] - want[0]) ** 2 + (c[1] - want[1]) ** 2 + (c[2] - want[2]) ** 2;
    if (d < bestD) { bestD = d; best = PALETTE[key]; }
  }
  return best;
}
