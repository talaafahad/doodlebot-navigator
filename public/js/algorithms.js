// Pure navigation algorithms — no DOM, so they run in the browser and in `npm test`.
//
// Grids are flat arrays indexed by y * w + x.
// True map cells:       FREE | WALL | OBSTACLE
// Doodlebot's map cells: UNKNOWN | FREE | WALL | OBSTACLE
// Movement is 4-connected (up, right, down, left). That order is also the
// tie-break order, so the same maze always gives the same run.

export const CELL = { UNKNOWN: -1, FREE: 0, WALL: 1, OBSTACLE: 2 };
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const idx = (w, x, y) => y * w + x;
export const inBounds = (w, h, x, y) => x >= 0 && y >= 0 && x < w && y < h;
export const isBlocked = t => t === CELL.WALL || t === CELL.OBSTACLE;
export const samePos = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;

// ---------------------------------------------------------------- sensing
// A cell is inside the sensor range if its centre is within (range + 0.5)
// cells of Doodlebot's centre. Range 1 = the 3×3 square around Doodlebot,
// bigger ranges look like circles. The sensor sees through walls (no line of
// sight) because the brief says it senses *every* cell within range.
export function sensorReach(range) { return range + 0.5; }

export function cellsInRange(w, h, pos, range) {
  const r = sensorReach(range), r2 = r * r, out = [];
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = pos.x + dx, y = pos.y + dy;
      if (inBounds(w, h, x, y) && dx * dx + dy * dy <= r2) out.push({ x, y });
    }
  }
  return out;
}

// Copies what the sensor sees from the true map into Doodlebot's map.
export function sense(world, known, pos, range) {
  const { w, h } = world;
  let newlyKnown = 0, sawPrincess = false;
  const seen = cellsInRange(w, h, pos, range);
  for (const c of seen) {
    const i = idx(w, c.x, c.y);
    if (known[i] === CELL.UNKNOWN) { known[i] = world.cells[i]; newlyKnown++; }
    if (samePos(c, world.princess)) sawPrincess = true;
  }
  return { newlyKnown, sawPrincess, seen };
}

// --------------------------------------------------------- frontier search
// A frontier cell is a known free cell that touches at least one unknown cell.
// BFS from Doodlebot over known free cells visits cells in order of path
// distance, so the FIRST frontier cell it dequeues is the nearest one by path
// distance on Doodlebot's own map — never by straight-line distance.
// Returns null when no frontier is reachable: exploration is complete.
export function findNearestFrontier(known, w, h, from) {
  const start = idx(w, from.x, from.y);
  const prev = new Int32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const queue = [start];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % w, cy = (cur - cx) / w;
    if (cur !== start && touchesUnknown(known, w, h, cx, cy)) {
      return { target: { x: cx, y: cy }, path: rebuild(prev, cur, w), distance: pathLen(prev, cur) };
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(w, h, nx, ny)) continue;
      const n = idx(w, nx, ny);
      if (seen[n] || known[n] !== CELL.FREE) continue;
      seen[n] = 1; prev[n] = cur; queue.push(n);
    }
  }
  return null;
}

function touchesUnknown(known, w, h, x, y) {
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy;
    if (inBounds(w, h, nx, ny) && known[idx(w, nx, ny)] === CELL.UNKNOWN) return true;
  }
  return false;
}

function rebuild(prev, end, w) {
  const path = [];
  for (let c = end; c !== -1; c = prev[c]) path.push({ x: c % w, y: Math.floor(c / w) });
  return path.reverse();                       // includes the start cell
}
function pathLen(prev, end) { let n = 0; for (let c = prev[end]; c !== -1; c = prev[c]) n++; return n; }

// ------------------------------------------------------------- planners
// Both planners only travel through cells Doodlebot KNOWS are free.
// `expanded` is the exact order cells were taken off the queue — the search
// animation replays this list, so what students see is what the algorithm did.

export function bfsPlan(known, w, h, from, to) {
  const start = idx(w, from.x, from.y), goal = idx(w, to.x, to.y);
  const prev = new Int32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const queue = [start], expanded = [];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % w, cy = (cur - cx) / w;
    expanded.push({ x: cx, y: cy });
    if (cur === goal) return { path: rebuild(prev, cur, w), expanded };
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(w, h, nx, ny)) continue;
      const n = idx(w, nx, ny);
      if (seen[n] || known[n] !== CELL.FREE) continue;
      seen[n] = 1; prev[n] = cur; queue.push(n);
    }
  }
  return { path: null, expanded };
}

// A* with the Manhattan-distance heuristic. On a 4-connected grid where every
// step costs 1, Manhattan distance never overestimates, so A* returns a
// shortest path (same length as BFS) while usually searching fewer cells.
export function aStarPlan(known, w, h, from, to) {
  const start = idx(w, from.x, from.y), goal = idx(w, to.x, to.y);
  const hfn = i => { const x = i % w, y = (i - x) / w; return Math.abs(x - to.x) + Math.abs(y - to.y); };
  const g = new Float64Array(w * h).fill(Infinity);
  const prev = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  const heap = new MinHeap();
  let order = 0;
  g[start] = 0;
  heap.push({ i: start, f: hfn(start), h: hfn(start), o: order++ });
  const expanded = [];
  while (heap.size) {
    const { i: cur } = heap.pop();
    if (closed[cur]) continue;                 // stale queue entry
    closed[cur] = 1;
    const cx = cur % w, cy = (cur - cx) / w;
    expanded.push({ x: cx, y: cy });
    if (cur === goal) return { path: rebuild(prev, cur, w), expanded };
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(w, h, nx, ny)) continue;
      const n = idx(w, nx, ny);
      if (closed[n] || known[n] !== CELL.FREE) continue;
      const ng = g[cur] + 1;
      if (ng < g[n]) {
        g[n] = ng; prev[n] = cur;
        const hn = hfn(n);
        heap.push({ i: n, f: ng + hn, h: hn, o: order++ });
      }
    }
  }
  return { path: null, expanded };
}

export const PLANNERS = { astar: aStarPlan, bfs: bfsPlan };

// Ties: lowest f, then lowest h (closer to goal), then first inserted.
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  less(p, q) { return p.f !== q.f ? p.f < q.f : p.h !== q.h ? p.h < q.h : p.o < q.o; }
  push(x) {
    const a = this.a; a.push(x);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}

// Shortest path on the TRUE map (used by tests and to check maze solvability).
export function trueShortest(world) {
  if (!world.start || !world.princess) return null;
  return bfsPlan(world.cells, world.w, world.h, world.start, world.princess).path;
}
