export type Point = { x: number; y: number };
export type Stroke = { points: Point[]; color: string; width: number };

export function drawColorStrip(ctx: CanvasRenderingContext2D, handX: number): string {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const stripX = 60;
  const stripW = cw - 120;
  const stripY = ch - 80;
  const stripH = 40;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  // roundRect may not exist on all contexts; approximate with rounded rect path
  const r = 18;
  const x = stripX - 16;
  const y = stripY - 44;
  const w = stripW + 32;
  const h = stripH + 60;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();

  const grad = ctx.createLinearGradient(stripX, 0, stripX + stripW, 0);
  for (let i = 0; i <= 12; i++) {
    grad.addColorStop(i / 12, `hsl(${(i / 12) * 360}, 100%, 60%)`);
  }
  ctx.fillStyle = grad;
  // inner rounded rect
  ctx.beginPath();
  const r2 = 10;
  ctx.moveTo(stripX + r2, stripY);
  ctx.arcTo(stripX + stripW, stripY, stripX + stripW, stripY + stripH, r2);
  ctx.arcTo(stripX + stripW, stripY + stripH, stripX, stripY + stripH, r2);
  ctx.arcTo(stripX, stripY + stripH, stripX, stripY, r2);
  ctx.arcTo(stripX, stripY, stripX + stripW, stripY, r2);
  ctx.closePath();
  ctx.fill();

  const clampedX = Math.max(stripX, Math.min(stripX + stripW, handX));
  const hue = ((clampedX - stripX) / stripW) * 360;
  const pendingWheelColor = `hsl(${hue.toFixed(0)}, 100%, 60%)`;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(clampedX, stripY - 2);
  ctx.lineTo(clampedX, stripY + stripH + 2);
  ctx.stroke();
  ctx.fillStyle = pendingWheelColor;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(clampedX, stripY - 14, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('\u270C Move hand across strip \u00B7 Lower index finger to apply', cw / 2, stripY - 34);
  ctx.restore();
  return pendingWheelColor;
}

export function drawClearIndicator(ctx: CanvasRenderingContext2D, progress: number) {
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;
  const r = 72;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff18';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🖐 🖐', cx, cy - 12);
  ctx.fillText('Hold to clear', cx, cy + 14);
  ctx.restore();
}

export function drawCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: string,
  brushSize: number,
  brushColor: string,
  pendingWheelColor: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, brushSize / 2 + 6, 0, Math.PI * 2);
  ctx.strokeStyle =
    g === 'draw' ? '#00f5ff' : g === 'erase' ? '#ff4444' : g === 'color-select' ? pendingWheelColor : g === 'l_shape' ? '#ffdd57' : g === 'thumb_up' ? '#4eff91' : g === 'thumb_down' ? '#4eff91' : '#ffffff44';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawPeerStroke(canvas: HTMLCanvasElement, stroke: Stroke) {
  const ctx = canvas.getContext('2d')!;
  if (stroke.points.length < 2) return;
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.beginPath();
    ctx.moveTo(stroke.points[i - 1].x, stroke.points[i - 1].y);
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
