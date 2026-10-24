import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELL, idx, cellsInRange, findNearestFrontier, aStarPlan, bfsPlan, trueShortest } from '../public/js/algorithms.js';
import { runMission, runToEnd } from '../public/js/simulation.js';
import { createWorld, presetWorld, randomMaze, mulberry32, applyTool } from '../public/js/world.js';

const fromRows = rows => {
  const w = createWorld(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === '#') w.cells[idx(w.w, x, y)] = CELL.WALL;
    if (c === 'S') w.start = { x, y };
    if (c === 'P') w.princess = { x, y };
  }));
  return w;
};

test('sensor range 1 is the 3×3 square; range grows with the setting', () => {
  assert.equal(cellsInRange(12, 12, { x: 5, y: 5 }, 1).length, 9);
  const r2 = cellsInRange(12, 12, { x: 5, y: 5 }, 2).length;
  const r3 = cellsInRange(12, 12, { x: 5, y: 5 }, 3).length;
  assert.ok(r2 > 9 && r3 > r2);
  assert.equal(cellsInRange(12, 12, { x: 0, y: 0 }, 1).length, 4, 'clipped at the corner');
});

test('frontier choice uses PATH distance, not straight-line distance', () => {
  // Unknown area A is 2 cells away in a straight line but behind a wall (long way round).
  // Unknown area B is further in a straight line but reachable directly.
  //  Robot at (0,0).  A = unknown (0,2): 2 cells away in a straight line, but behind a wall.
  //                   B = unknown (6,0): 6 cells away in a straight line, open corridor.
  const U = CELL.UNKNOWN, F = CELL.FREE, W = CELL.WALL;
  const known = [
    F, F, F, F, F, F, U,     // B at the end of the corridor
    W, W, W, W, W, F, F,
    U, F, F, F, F, F, F,     // A at the far left, under the robot
  ];
  const f = findNearestFrontier(known, 7, 3, { x: 0, y: 0 });
  // Frontier next to A is (1,2): path distance 5 + 2 + 4 = 11. Frontier next to B is (5,0): 5.
  assert.deepEqual(f.target, { x: 5, y: 0 }, 'goes toward B, the nearest by path');
  assert.equal(f.distance, 5);
  // Sanity check: a straight-line rule would have picked A.
  assert.ok(Math.hypot(0, 2) < Math.hypot(6, 0));
});

test('exploration stops only when no reachable unknown cell remains', () => {
  const world = presetWorld('lesson');
  const it = runMission(world, { range: 1 });
  let r, last;
  while (!(r = it.next()).done) last = r.value;
  const { known } = last;
  // every cell reachable on the true map must now be known
  const reach = bfsPlan(world.cells, world.w, world.h, world.start, { x: -1, y: -1 });
  for (const c of reach.expanded) assert.notEqual(known[idx(world.w, c.x, c.y)], CELL.UNKNOWN);
  assert.equal(r.value.outcome, 'rescued');
});

test('planned path is a shortest path (A* and BFS agree with the true map)', () => {
  const rand = mulberry32(42);
  for (let k = 0; k < 60; k++) {
    const world = randomMaze(rand);
    const truth = trueShortest(world).length - 1;
    for (const planner of ['astar', 'bfs']) {
      const { metrics } = runToEnd(world, { range: 1 + (k % 4), planner });
      assert.equal(metrics.outcome, 'rescued');
      assert.equal(metrics.pathLength, truth, `maze ${k} ${planner}`);
    }
  }
});

test('A* never searches more cells than BFS on the same map', () => {
  const rand = mulberry32(7);
  for (let k = 0; k < 40; k++) {
    const world = randomMaze(rand);
    const a = runToEnd(world, { range: 2, planner: 'astar' }).metrics;
    const b = runToEnd(world, { range: 2, planner: 'bfs' }).metrics;
    assert.ok(a.cellsSearched <= b.cellsSearched, `maze ${k}: ${a.cellsSearched} > ${b.cellsSearched}`);
  }
});

test('lesson maze: range 4 maps much faster than range 1, but the shortest path length is identical', () => {
  const world = presetWorld('lesson');
  const runs = [1, 2, 3, 4].map(range => runToEnd(world, { range }).metrics);
  const lengths = new Set(runs.map(m => m.pathLength));
  assert.equal(lengths.size, 1, 'same shortest path whatever the sensor');
  assert.ok(runs[0].explorationSteps > runs[3].explorationSteps, JSON.stringify(runs.map(m => m.explorationSteps)));
});

test('odd mazes: enclosed start, walled-in princess, empty grid', () => {
  const enclosed = runToEnd(presetWorld('enclosedStart'), { range: 1 }).metrics;
  assert.equal(enclosed.outcome, 'notFound');
  assert.equal(enclosed.pathLength, null);

  // sensor range 3 can see her through the wall, but no path exists
  const walled = runToEnd(presetWorld('walledIn'), { range: 3 }).metrics;
  assert.equal(walled.outcome, 'noPath');
  assert.ok(walled.princessSeenAtStep !== null);

  const empty = runToEnd(presetWorld('empty'), { range: 2 }).metrics;
  assert.equal(empty.outcome, 'rescued');
  assert.equal(empty.pathLength, 22);
});

test('princess right next to the start', () => {
  const world = fromRows(['SP..', '....']);
  const m = runToEnd(world, { range: 1 }).metrics;
  assert.equal(m.princessSeenAtStep, 0);
  assert.equal(m.pathLength, 1);
});

test('planner only uses Doodlebot\'s map, never unknown cells', () => {
  const U = CELL.UNKNOWN, F = CELL.FREE;
  const known = [F, U, F];
  assert.equal(aStarPlan(known, 3, 1, { x: 0, y: 0 }, { x: 2, y: 0 }).path, null);
  assert.equal(bfsPlan(known, 3, 1, { x: 0, y: 0 }, { x: 2, y: 0 }).path, null);
});

test('editor tools: placing start/princess again moves them, walls never bury robots', () => {
  const w = createWorld();
  applyTool(w, 'start', 1, 1); applyTool(w, 'start', 3, 3);
  assert.deepEqual(w.start, { x: 3, y: 3 });
  assert.equal(applyTool(w, 'wall', 3, 3), false);
  applyTool(w, 'princess', 5, 5);
  assert.equal(applyTool(w, 'start', 5, 5), false);
  applyTool(w, 'eraser', 5, 5);
  assert.equal(w.princess, null);
});

test('random mazes are always solvable', () => {
  const rand = mulberry32(99);
  for (let k = 0; k < 100; k++) assert.ok(trueShortest(randomMaze(rand)));
});
