// The whole mission as a generator: each `yield` is one visible step.
// The UI pulls steps on a timer; the tests pull them all at once.
//
// Phases: explore → return (drive back to start) → plan → rescue → done
// Doodlebot only ever plans on ITS map (`known`), never on the true map.

import { CELL, idx, sense, findNearestFrontier, PLANNERS, samePos } from './algorithms.js';

export function emptyMetrics(range, planner) {
  return {
    sensorRange: range,
    planner,
    explorationSteps: 0,      // moves until the map was complete
    princessSeenAtStep: null, // exploration step when she entered the sensor range
    returnSteps: 0,           // moves to drive back to the start
    pathLength: null,         // moves on the planned path (null = no path)
    cellsSearched: null,      // cells the planner took off its queue
    cellsKnown: 0,
    outcome: null,            // 'rescued' | 'noPath' | 'notFound'
  };
}

export function* runMission(world, { range = 2, planner = 'astar', maxSteps = 5000 } = {}) {
  const { w, h } = world;
  const known = new Array(w * h).fill(CELL.UNKNOWN);
  const metrics = emptyMetrics(range, planner);
  const trail = [{ ...world.start }];
  let pos = { ...world.start };
  let princessSeen = false;

  const snap = (extra) => ({ known, pos: { ...pos }, trail, metrics, ...extra });

  // Doodlebot starts knowing only the grid size and its start cell — then senses once.
  let s = sense(world, known, pos, range);
  metrics.cellsKnown = countKnown(known);
  if (s.sawPrincess) { princessSeen = true; metrics.princessSeenAtStep = 0; }
  yield snap({ phase: 'explore', event: princessSeen ? 'princessSensed' : 'exploreStep', from: { ...pos }, seen: s.seen });

  // ---- 1. frontier exploration
  for (let step = 0; step < maxSteps; step++) {
    const f = findNearestFrontier(known, w, h, pos);
    if (!f) break;                                    // no reachable unknown cells left
    const from = { ...pos };
    pos = { ...f.path[1] };                           // one move toward the nearest frontier
    trail.push({ ...pos });
    metrics.explorationSteps++;
    s = sense(world, known, pos, range);
    metrics.cellsKnown = countKnown(known);
    let event = 'exploreStep';
    if (s.sawPrincess && !princessSeen) {
      princessSeen = true;
      metrics.princessSeenAtStep = metrics.explorationSteps;
      event = 'princessSensed';
    }
    yield snap({ phase: 'explore', event, from, target: f.target, plannedRoute: f.path, seen: s.seen });
  }
  yield snap({ phase: 'explorationDone', event: 'explorationDone', from: { ...pos } });

  // ---- 2. drive back to the start on the finished map
  const home = PLANNERS.bfs(known, w, h, pos, world.start).path || [pos];
  for (let i = 1; i < home.length; i++) {
    const from = { ...pos };
    pos = { ...home[i] };
    metrics.returnSteps++;
    yield snap({ phase: 'return', event: 'explorationDone', from, plannedRoute: home.slice(i) });
  }

  // ---- 3. plan a path to Princess-Bot on Doodlebot's completed map
  if (!princessSeen) {
    metrics.outcome = 'notFound';
    yield snap({ phase: 'done', event: 'noPath', reason: 'notFound', from: { ...pos } });
    return metrics;
  }
  const plan = PLANNERS[planner](known, w, h, world.start, world.princess);
  metrics.cellsSearched = plan.expanded.length;
  yield snap({ phase: 'plan', event: 'planning', from: { ...pos }, expanded: plan.expanded });

  if (!plan.path) {
    metrics.outcome = 'noPath';
    yield snap({ phase: 'done', event: 'noPath', reason: 'noPath', from: { ...pos }, expanded: plan.expanded });
    return metrics;
  }
  metrics.pathLength = plan.path.length - 1;
  yield snap({ phase: 'pathFound', event: 'pathFound', from: { ...pos }, path: plan.path, expanded: plan.expanded });

  // ---- 4. drive the planned path to rescue her
  for (let i = 1; i < plan.path.length; i++) {
    const from = { ...pos };
    pos = { ...plan.path[i] };
    yield snap({ phase: 'rescue', event: 'pathFound', from, path: plan.path });
  }
  metrics.outcome = 'rescued';
  yield snap({ phase: 'done', event: 'rescued', reason: 'rescued', from: { ...pos }, path: plan.path });
  return metrics;
}

function countKnown(known) { let n = 0; for (const c of known) if (c !== CELL.UNKNOWN) n++; return n; }

// Convenience for tests: run to completion and return the final metrics.
export function runToEnd(world, opts) {
  const it = runMission(world, opts);
  let r, last;
  while (!(r = it.next()).done) last = r.value;
  return { metrics: r.value, last };
}

export { samePos };
