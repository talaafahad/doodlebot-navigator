// Canvas drawing for both maps. Pure drawing: it never changes game state.

import { CELL, idx, sensorReach } from './algorithms.js';
import { drawDoodlebotToken, drawPrincessToken } from '../characters/tokens.js';

const COLORS = {
  floorTrue: '#FFFFFF',
  floorTrueAlt: '#F7FBFF',     // gentle checkerboard so cells are easy to count
  floorKnown: '#EEF9F3',       // pastel mint: "Doodlebot knows this cell"
  floorKnownAlt: '#E6F6EE',
  grid: '#DCE8F2',
  unknown: '#10132A',          // unknown cells stay black (assessment requirement)
  unknownGrid: '#1B2040',
  wall: '#56648C',
  wallTop: '#7280A6',
  wallEdge: '#45527A',
  rock: '#C9C2DA',
  rockShade: '#A79FBD',
  rockEdge: '#7E7699',
  trail: 'rgba(52,120,212,0.6)',
  sensorFill: 'rgba(160,230,245,0.28)',
  sensorStroke: '#3478D4',
  target: '#F2A31B',
  searched: 'rgba(255,214,102,0.62)',
  searchHead: '#F2A31B',
  path: '#2FA37A',
  home: '#3478D4',
};

export function setupCanvas(canvas, w, h, cell) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * cell * dpr;
  canvas.height = h * cell * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A soft slate block: fills the whole cell, so walls join into solid lines.
export function drawWall(ctx, x, y, c) {
  ctx.fillStyle = COLORS.wall;
  rr(ctx, x + 1.5, y + 1.5, c - 3, c - 3, c * 0.18); ctx.fill();
  ctx.fillStyle = COLORS.wallTop;
  rr(ctx, x + c * 0.14, y + c * 0.12, c * 0.72, c * 0.3, c * 0.12); ctx.fill();
}

// A round lavender-grey rock: a different SHAPE from a wall, not just a colour.
export function drawObstacle(ctx, x, y, c) {
  const cx = x + c / 2, cy = y + c * 0.56;
  ctx.fillStyle = COLORS.rock;
  ctx.strokeStyle = COLORS.rockEdge; ctx.lineWidth = Math.max(1.5, c * 0.05); ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - c * 0.36, cy + c * 0.26);
  ctx.bezierCurveTo(cx - c * 0.44, cy - c * 0.04, cx - c * 0.3, cy - c * 0.36, cx - c * 0.04, cy - c * 0.36);
  ctx.bezierCurveTo(cx + c * 0.24, cy - c * 0.38, cx + c * 0.44, cy - c * 0.12, cx + c * 0.38, cy + c * 0.26);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COLORS.rockShade;
  ctx.beginPath(); ctx.ellipse(cx + c * 0.12, cy + c * 0.1, c * 0.14, c * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.ellipse(cx - c * 0.12, cy - c * 0.16, c * 0.08, c * 0.045, -0.5, 0, Math.PI * 2); ctx.fill();
}

// Small eraser icon for the tool palette.
export function drawEraserIcon(ctx, x, y, c) {
  ctx.save();
  ctx.translate(x + c / 2, y + c / 2); ctx.rotate(-0.6);
  ctx.lineWidth = Math.max(1.5, c * 0.05); ctx.strokeStyle = '#24365B'; ctx.lineJoin = 'round';
  ctx.fillStyle = '#FFB3CF'; rr(ctx, -c * 0.34, -c * 0.17, c * 0.4, c * 0.34, c * 0.08); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; rr(ctx, c * 0.06, -c * 0.17, c * 0.28, c * 0.34, c * 0.08); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawHome(ctx, x, y, c) {
  // start pad: a little house outline
  const cx = x + c / 2, cy = y + c / 2, s = c * 0.32;
  ctx.strokeStyle = COLORS.home; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s * 0.1); ctx.lineTo(cx, cy - s); ctx.lineTo(cx + s, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.75, cy - s * 0.1); ctx.lineTo(cx + s * 0.75, cy + s * 0.8);
  ctx.lineTo(cx - s * 0.75, cy + s * 0.8); ctx.lineTo(cx - s * 0.75, cy - s * 0.1); ctx.closePath();
  ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
}

// Doodlebot may drive across Princess-Bot's square while mapping (it is open floor),
// so when they overlap we draw them side by side.
const sharesCell = (r, p) => !!r && !!p && Math.abs(r.x - p.x) < 0.5 && Math.abs(r.y - p.y) < 0.5;

const centre = (p, c) => ({ x: p.x * c + c / 2, y: p.y * c + c / 2 });

function polyline(ctx, pts, c) {
  ctx.beginPath();
  pts.forEach((p, i) => { const q = centre(p, c); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
}

/**
 * opts: {
 *   world, cell, view: 'true' | 'robot', known, revealedAt (Float64Array), now,
 *   robot: {x,y} (float, interpolated), dir, emotion, sensorRange,
 *   trail, target, route, expanded (array shown so far), path, princessRescued
 * }
 */
export function drawMap(ctx, o) {
  const { world, cell: c } = o;
  const { w, h } = world;
  const robotView = o.view === 'robot';
  ctx.clearRect(0, 0, w * c, h * c);

  // cells
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(w, x, y);
      const t = robotView ? o.known[i] : world.cells[i];
      const px = x * c, py = y * c;
      if (t === CELL.UNKNOWN) {
        ctx.fillStyle = COLORS.unknown; ctx.fillRect(px, py, c, c);
        ctx.strokeStyle = COLORS.unknownGrid; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, c - 1, c - 1);
        continue;
      }
      const alt = (x + y) % 2 === 1;
      ctx.fillStyle = robotView ? (alt ? COLORS.floorKnownAlt : COLORS.floorKnown) : (alt ? COLORS.floorTrueAlt : COLORS.floorTrue);
      ctx.fillRect(px, py, c, c);
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, c - 1, c - 1);
      if (t === CELL.WALL) drawWall(ctx, px, py, c);
      else if (t === CELL.OBSTACLE) drawObstacle(ctx, px, py, c);
      // newly sensed cells flash so students SEE the sensor revealing them
      if (robotView && o.revealedAt) {
        const age = o.now - o.revealedAt[i];
        if (age >= 0 && age < 600) { ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - age / 600)})`; ctx.fillRect(px, py, c, c); }
      }
    }
  }

  if (world.start && (!robotView || o.known[idx(w, world.start.x, world.start.y)] !== CELL.UNKNOWN)) drawHome(ctx, world.start.x * c, world.start.y * c, c);

  // planner search animation (replays the exact expansion order)
  if (o.expanded && o.expanded.length) {
    ctx.fillStyle = COLORS.searched;
    for (const p of o.expanded) ctx.fillRect(p.x * c + 3, p.y * c + 3, c - 6, c - 6);
    const head = o.expanded[o.expanded.length - 1];
    if (!o.path) { ctx.strokeStyle = COLORS.searchHead; ctx.lineWidth = 3; ctx.strokeRect(head.x * c + 3, head.y * c + 3, c - 6, c - 6); }
  }

  // Doodlebot's pencil trail — it is a drawing robot, after all
  if (robotView && o.trail && o.trail.length > 1) {
    ctx.strokeStyle = COLORS.trail; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([6, 5]);
    polyline(ctx, o.trail, c); ctx.stroke();
    ctx.setLineDash([]);
  }

  // where exploration is heading next (nearest frontier by path distance)
  if (robotView && o.route && o.route.length > 1) {
    ctx.strokeStyle = 'rgba(242,163,27,0.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([2, 6]);
    polyline(ctx, o.route, c); ctx.stroke(); ctx.setLineDash([]);
  }
  if (robotView && o.target) {
    const q = centre(o.target, c), pulse = 0.5 + 0.5 * Math.sin(o.now / 180);
    ctx.strokeStyle = COLORS.target; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(q.x, q.y, c * (0.28 + 0.08 * pulse), 0, Math.PI * 2); ctx.stroke();
  }

  // final planned path
  if (o.path && o.path.length > 1) {
    ctx.strokeStyle = COLORS.path; ctx.lineWidth = Math.max(4, c * 0.14); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    polyline(ctx, o.path, c); ctx.stroke();
    ctx.fillStyle = COLORS.path;
    for (const p of o.path) { const q = centre(p, c); ctx.beginPath(); ctx.arc(q.x, q.y, c * 0.09, 0, Math.PI * 2); ctx.fill(); }
  }

  // Princess-Bot: always on the true map; on Doodlebot's map only once sensed
  if (world.princess) {
    const seen = !robotView || o.known[idx(w, world.princess.x, world.princess.y)] !== CELL.UNKNOWN;
    if (seen) {
      const q = centre(world.princess, c);
      if (o.princessRescued || sharesCell(o.robot, world.princess)) q.x += c * 0.2;   // stand side by side, never hidden under Doodlebot
      if (o.princessRescued) {
        ctx.fillStyle = 'rgba(255,111,168,0.25)';
        ctx.beginPath(); ctx.arc(q.x, q.y, c * 0.62, 0, Math.PI * 2); ctx.fill();
      }
      drawPrincessToken(ctx, q.x, q.y, c);
    }
  }

  // sensor range + Doodlebot
  if (o.robot) {
    const q = { x: o.robot.x * c + c / 2, y: o.robot.y * c + c / 2 };
    if (o.princessRescued || (world.princess && sharesCell(o.robot, world.princess) && (!robotView || o.known[idx(w, world.princess.x, world.princess.y)] !== CELL.UNKNOWN))) q.x -= c * 0.2;
    if (o.sensorRange) {
      const r = sensorReach(o.sensorRange) * c;
      ctx.fillStyle = COLORS.sensorFill;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COLORS.sensorStroke; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
      ctx.stroke(); ctx.setLineDash([]);
    }
    drawDoodlebotToken(ctx, q.x, q.y, c, { dir: o.dir || [0, 1], emotion: o.emotion || 'idle' });
  }
}
