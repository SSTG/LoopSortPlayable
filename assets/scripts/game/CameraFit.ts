import { Camera, screen } from 'cc';
import type { Layout } from '../core/Layout';
import type { Hud } from '../view/Hud';

export interface Reserves { top: number; bottom: number; wideBottom: number }

const SIDE_MARGIN = 0.8;
const END_MARGIN = 0.6;
const TILT_WIDENING = 0.45;
const DEPTH = 14;

export function fitCamera(camera: Camera, bounds: Layout['bounds'], hud: Hud, reserves: Reserves) {
  const win = screen.windowSize;
  const aspect = win.width / Math.max(1, win.height);
  const tilt = ((90 + camera.node.eulerAngles.x) * Math.PI) / 180;
  const w = (bounds.maxX - bounds.minX + SIDE_MARGIN) * (1 + Math.sin(tilt) * TILT_WIDENING);
  const h = (bounds.maxY - bounds.minY + END_MARGIN) * Math.cos(tilt) + END_MARGIN;
  const [hiddenLeft, hiddenRight, hiddenTop, hiddenBottom] = hud.hidden();
  const top = reserves.top + hiddenTop;
  const across = aspect * (1 - 2 * Math.max(hiddenLeft, hiddenRight));
  const halfFor = (bottom: number) => Math.max(h / (1 - top - bottom) / 2, w / across / 2);

  let bottom = reserves.bottom + hiddenBottom;
  const low = Math.min(bottom, reserves.wideBottom + hiddenBottom);
  if (w / (2 * halfFor(low) * aspect) <= hud.bottomGap()) bottom = low;
  const half = halfFor(bottom);
  hud.setLevelScale(2 * half);

  const dist = half / Math.tan((camera.fov * Math.PI) / 360);
  const cy = (bounds.minY + bounds.maxY) / 2 + (top - bottom) * half;
  camera.node.setPosition((bounds.minX + bounds.maxX) / 2, dist * Math.cos(tilt), -cy + dist * Math.sin(tilt));
  camera.near = Math.max(1, dist - DEPTH);
  camera.far = dist + DEPTH;
}
