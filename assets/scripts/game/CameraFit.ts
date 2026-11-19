import { Camera, screen } from 'cc';
import type { Layout } from '../core/Layout';
import type { Hud } from '../view/Hud';

export interface Reserves { top: number; bottom: number; wideBottom: number }

const SIDE_MARGIN = 0.8;
const END_MARGIN = 0.6;
const TILT_WIDENING = 0.45;
const DEPTH = 14;

// zoom 1 frames the whole level. Above 1 the camera comes closer, keeping the top of the level (the belt) in view and
// letting the far end go off the bottom of the screen: only the top 1/zoom of the level's height is framed, with no
// margin below it. Width never zooms past the level's full width, so trucks at the sides are not cut off.
export function fitCamera(camera: Camera, bounds: Layout['bounds'], hud: Hud, reserves: Reserves, zoom = 1) {
  const win = screen.windowSize;
  const aspect = win.width / Math.max(1, win.height);
  const tilt = ((90 + camera.node.eulerAngles.x) * Math.PI) / 180;
  const w = (bounds.maxX - bounds.minX + SIDE_MARGIN) * (1 + Math.sin(tilt) * TILT_WIDENING);
  const zoomed = zoom > 1;
  const span = (bounds.maxY - bounds.minY) / (zoomed ? zoom : 1);
  const minY = bounds.maxY - span;
  // Zoomed in, the bottom is cut off on purpose, so only the top keeps its margin.
  const margin = zoomed ? END_MARGIN / 2 : END_MARGIN;
  const h = (span + margin) * Math.cos(tilt) + margin;
  // The framed box's middle on the ground, moved up by the top margin when the bottom one is dropped.
  const midY = (minY + bounds.maxY) / 2 + (zoomed ? (margin * Math.cos(tilt) + margin) / Math.cos(tilt) / 2 : 0);
  const [hiddenLeft, hiddenRight, hiddenTop, hiddenBottom] = hud.hidden();
  const top = reserves.top + hiddenTop;
  const across = aspect * (1 - 2 * Math.max(hiddenLeft, hiddenRight));
  const halfFor = (bottom: number) => Math.max(h / (1 - top - bottom) / 2, w / across / 2);

  let bottom = reserves.bottom + hiddenBottom;
  const low = Math.min(bottom, reserves.wideBottom + hiddenBottom);
  // Zoomed in, the level runs off the bottom of the screen anyway, so the cut falls at the screen's real edge
  // (behind the bottom buttons) rather than above the space kept free for them.
  if (zoomed) bottom = hiddenBottom;
  else if (w / (2 * halfFor(low) * aspect) <= hud.bottomGap()) bottom = low;
  const half = halfFor(bottom);
  hud.setLevelScale(2 * half);

  const dist = half / Math.tan((camera.fov * Math.PI) / 360);
  const cy = midY + (top - bottom) * half;
  camera.node.setPosition((bounds.minX + bounds.maxX) / 2, dist * Math.cos(tilt), -cy + dist * Math.sin(tilt));
  camera.near = Math.max(1, dist - DEPTH);
  camera.far = dist + DEPTH;
}
