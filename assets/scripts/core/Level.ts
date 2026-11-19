export interface BeltPathData { points: number[][]; radius: number; width: number }

export interface LevelData {
  truckCapacity: number;
  beltCapacity: number;
  beltLimit?: number;
  colors: Record<string, string>;
  trucks: string[];
  belt: string;
  beltPath: BeltPathData;
  truckColors?: string[];
  truckPlaces?: number[][];

  caption?: string;
  tapsToRedirect?: number;
  // Background colour of the game as a hex code ('#RRGGBB'); the scene camera's clear colour if left out.
  background?: string;
  // Text colour of the caption as a hex code ('#RRGGBB'); the caption label's colour in the scene if left out.
  captionColor?: string;
  // How close the camera sits: 1 frames the whole level; above 1 comes closer, keeping the belt at the top and
  // letting the far end of the level go off the bottom of the screen (only the top 1/zoom of its height shows).
  zoom?: number;
}

export function beltLimit(l: LevelData): number {
  return l.beltLimit === undefined ? l.beltCapacity : l.beltLimit;
}

export const DEFAULT_CAPTION = 'Harder than you think';

export function levelCaption(l: LevelData): string {
  return typeof l.caption === 'string' ? l.caption : DEFAULT_CAPTION;
}

export function levelBackground(l: LevelData): string | null {
  return typeof l.background === 'string' ? l.background : null;
}

export function levelCaptionColor(l: LevelData): string | null {
  return typeof l.captionColor === 'string' ? l.captionColor : null;
}

export function levelZoom(l: LevelData): number {
  return typeof l.zoom === 'number' && l.zoom > 0 ? l.zoom : 1;
}

export function redirectDue(l: LevelData, taps: number): boolean {
  const n = l.tapsToRedirect === undefined ? -1 : l.tapsToRedirect;
  return n > 0 && taps >= n;
}
