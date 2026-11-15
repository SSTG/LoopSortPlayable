export interface BeltPathData { points: number[][]; radius: number; width: number }

export interface LevelData {
  truckCapacity: number;
  beltCapacity: number;
  colors: Record<string, string>;
  trucks: string[];
  belt: string;
  beltPath: BeltPathData;
  truckColors?: string[];
  truckPlaces?: number[][];

  caption?: string;
  tapsToRedirect?: number;
}

export const DEFAULT_CAPTION = 'Harder than you think';

export function levelCaption(l: LevelData): string {
  return typeof l.caption === 'string' ? l.caption : DEFAULT_CAPTION;
}

export function redirectDue(l: LevelData, taps: number): boolean {
  const n = l.tapsToRedirect === undefined ? -1 : l.tapsToRedirect;
  return n > 0 && taps >= n;
}
