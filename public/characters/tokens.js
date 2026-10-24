// Small canvas versions for the 12×12 grid. Full detail turns to mush at ~40px,
// so these keep only what reads at that size: silhouette, colour, eyes, mouth.
//   drawDoodlebotToken(ctx, cx, cy, cellSize, { dir: [dx, dy], emotion })
//   drawPrincessToken(ctx, cx, cy, cellSize)

const NAVY = '#1E2A5A';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const LIGHT = { idle: '#7FF3F0', curious: '#7FF3F0', thinking: '#FFD54A', excited: '#FFD54A', happy: '#7CF29A', sad: '#8A90A8' };

export function drawDoodlebotToken(ctx, cx, cy, cell, { dir = [0, 1], emotion = 'idle' } = {}) {
  const s = cell * 0.84;             // overall size
  const lw = Math.max(1.5, s * 0.055);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = lw;

  // tracks
  ctx.fillStyle = '#4A4F63';
  roundRect(ctx, -s * 0.5, -s * 0.12, s * 0.16, s * 0.56, s * 0.07); ctx.fill(); ctx.stroke();
  roundRect(ctx, s * 0.34, -s * 0.12, s * 0.16, s * 0.56, s * 0.07); ctx.fill(); ctx.stroke();

  // antenna
  ctx.beginPath(); ctx.moveTo(0, -s * 0.38); ctx.lineTo(0, -s * 0.48); ctx.stroke();
  ctx.fillStyle = LIGHT[emotion] || LIGHT.idle;
  ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // head / body block
  ctx.fillStyle = '#3B7BE8';
  roundRect(ctx, -s * 0.38, -s * 0.38, s * 0.76, s * 0.8, s * 0.18); ctx.fill(); ctx.stroke();

  // screen face
  ctx.fillStyle = '#6EDAD8';
  roundRect(ctx, -s * 0.28, -s * 0.28, s * 0.56, s * 0.42, s * 0.11); ctx.fill();
  ctx.lineWidth = lw * 0.7; ctx.stroke(); ctx.lineWidth = lw;

  // eyes look toward the direction of travel
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ox = (dir[0] / len) * s * 0.05, oy = (dir[1] / len) * s * 0.04;
  const ey = -s * 0.1 + (emotion === 'sad' ? s * 0.02 : 0);
  ctx.fillStyle = NAVY;
  if (emotion === 'happy') {
    ctx.lineWidth = lw * 1.1;
    for (const ex of [-s * 0.12, s * 0.12]) { ctx.beginPath(); ctx.arc(ex, ey + s * 0.03, s * 0.06, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    ctx.lineWidth = lw;
  } else {
    for (const ex of [-s * 0.12, s * 0.12]) {
      ctx.beginPath(); ctx.ellipse(ex + ox, ey + oy, s * 0.055, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex + ox - s * 0.018, ey + oy - s * 0.025, s * 0.02, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = NAVY;
    }
  }

  // mouth
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  if (emotion === 'sad') ctx.arc(0, s * 0.1, s * 0.06, Math.PI * 1.2, Math.PI * 1.8);
  else if (emotion === 'happy' || emotion === 'excited') ctx.arc(0, s * 0.02, s * 0.07, Math.PI * 0.2, Math.PI * 0.8);
  else ctx.arc(0, s * 0.03, s * 0.045, Math.PI * 0.25, Math.PI * 0.75);
  ctx.stroke();

  // chest light strip
  ctx.fillStyle = LIGHT[emotion] || LIGHT.idle;
  roundRect(ctx, -s * 0.12, s * 0.22, s * 0.24, s * 0.08, s * 0.04); ctx.fill();
  ctx.restore();
}

export function drawPrincessToken(ctx, cx, cy, cell) {
  const s = cell * 0.84;
  const lw = Math.max(1.5, s * 0.055);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = lw;

  // egg body
  ctx.fillStyle = '#F27AB8';
  ctx.beginPath(); ctx.ellipse(0, s * 0.08, s * 0.32, s * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // visor
  ctx.fillStyle = '#4E2A75';
  roundRect(ctx, -s * 0.22, -s * 0.06, s * 0.44, s * 0.3, s * 0.14); ctx.fill();
  ctx.fillStyle = '#FFE3F2';
  for (const ex of [-s * 0.09, s * 0.09]) { ctx.beginPath(); ctx.ellipse(ex, s * 0.08, s * 0.045, s * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }

  // crown — the key silhouette difference from Doodlebot
  ctx.fillStyle = '#FFC94A';
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.26);
  ctx.lineTo(-s * 0.22, -s * 0.5);
  ctx.lineTo(-s * 0.1, -s * 0.38);
  ctx.lineTo(0, -s * 0.55);
  ctx.lineTo(s * 0.1, -s * 0.38);
  ctx.lineTo(s * 0.22, -s * 0.5);
  ctx.lineTo(s * 0.2, -s * 0.26);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
