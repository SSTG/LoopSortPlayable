import { Graphics, Color } from 'cc';

const WHITE = new Color(255, 255, 255, 255);

export function drawMuteIcon(g: Graphics, muted: boolean) {
  g.clear();
  g.fillColor = WHITE;
  g.strokeColor = WHITE;
  g.lineWidth = 4;
  g.moveTo(-18, -7); g.lineTo(-9, -7); g.lineTo(2, -17); g.lineTo(2, 17); g.lineTo(-9, 7); g.lineTo(-18, 7); g.close(); g.fill();
  if (muted) { g.moveTo(9, -9); g.lineTo(23, 9); g.moveTo(23, -9); g.lineTo(9, 9); g.stroke(); }
  else { g.arc(4, 0, 9, -0.9, 0.9, true); g.stroke(); g.arc(4, 0, 17, -0.9, 0.9, true); g.stroke(); }
}
