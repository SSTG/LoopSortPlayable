import { game } from 'cc';

interface Box { left: number; right: number; top: number; bottom: number; width: number; height: number }

const NONE = [0, 0, 0, 0];
const MAX_SHARE = 0.4;

const share = (px: number, of: number) => (px < 1 ? 0 : Math.min(MAX_SHARE, px / of));

export function measureCanvasCut(): number[] {
  const el = game.canvas as unknown as { getBoundingClientRect?: () => Box } | null;
  if (!el || !el.getBoundingClientRect || typeof window === 'undefined' || !(window.innerWidth > 0)) return NONE;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return NONE;
  return [share(-r.left, r.width), share(r.right - window.innerWidth, r.width), share(-r.top, r.height), share(r.bottom - window.innerHeight, r.height)];
}
