// The student's maze (the true map), random maze generation and preset mazes.

import { CELL, idx, inBounds, trueShortest } from './algorithms.js';

export const SIZE = 12;

export function createWorld(w = SIZE, h = SIZE) {
  return { w, h, cells: new Array(w * h).fill(CELL.FREE), start: null, princess: null };
}

export function cloneWorld(world) {
  return { ...world, cells: world.cells.slice(), start: world.start && { ...world.start }, princess: world.princess && { ...world.princess } };
}

// Tools: 'wall' | 'obstacle' | 'start' | 'princess' | 'eraser'
// Returns true if the world changed.
export function applyTool(world, tool, x, y) {
  if (!inBounds(world.w, world.h, x, y)) return false;
  const i = idx(world.w, x, y);
  const onStart = world.start && world.start.x === x && world.start.y === y;
  const onPrincess = world.princess && world.princess.x === x && world.princess.y === y;
  switch (tool) {
    case 'wall':
    case 'obstacle': {
      if (onStart || onPrincess) return false;          // never bury a robot
      const t = tool === 'wall' ? CELL.WALL : CELL.OBSTACLE;
      if (world.cells[i] === t) return false;
      world.cells[i] = t; return true;
    }
    case 'start':
      if (onPrincess || onStart) return false;
      world.cells[i] = CELL.FREE; world.start = { x, y }; return true;   // placing again just moves it
    case 'princess':
      if (onStart || onPrincess) return false;
      world.cells[i] = CELL.FREE; world.princess = { x, y }; return true;
    case 'eraser':
      if (onStart) { world.start = null; return true; }
      if (onPrincess) { world.princess = null; return true; }
      if (world.cells[i] === CELL.FREE) return false;
      world.cells[i] = CELL.FREE; return true;
  }
  return false;
}

// Short id so students can check they ran the SAME maze in each experiment.
export function mazeId(world) {
  let hsh = 2166136261;
  const feed = v => { hsh ^= v + 3; hsh = Math.imul(hsh, 16777619); };
  world.cells.forEach(feed);
  feed(world.start ? world.start.x * 31 + world.start.y : -9);
  feed(world.princess ? world.princess.x * 31 + world.princess.y : -9);
  return (hsh >>> 0).toString(36).slice(0, 4).toUpperCase();
}

// Seedable RNG so tests are repeatable.
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random solvable maze: scatter walls and obstacles, put Doodlebot and
// Princess-Bot far apart, and keep it only if a path exists on the true map.
export function randomMaze(rand = Math.random, w = SIZE, h = SIZE) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const world = createWorld(w, h);
    for (let i = 0; i < w * h; i++) {
      const r = rand();
      world.cells[i] = r < 0.26 ? CELL.WALL : r < 0.33 ? CELL.OBSTACLE : CELL.FREE;
    }
    const corner = Math.floor(rand() * 4);
    const pick = (xr, yr) => ({ x: xr[0] + Math.floor(rand() * (xr[1] - xr[0])), y: yr[0] + Math.floor(rand() * (yr[1] - yr[0])) });
    const lo = [0, 3], hi = [w - 3, w];
    const sx = corner & 1 ? hi : lo, sy = corner & 2 ? hi : lo;
    world.start = pick(sx, sy);
    world.princess = pick(corner & 1 ? lo : hi, corner & 2 ? lo : hi);
    world.cells[idx(w, world.start.x, world.start.y)] = CELL.FREE;
    world.cells[idx(w, world.princess.x, world.princess.y)] = CELL.FREE;
    const path = trueShortest(world);
    if (path && path.length - 1 >= w) return world;     // solvable and not trivially short
  }
  return createWorld(w, h);
}

// Hand-made mazes for the lesson and for odd cases.
const PRESET_ROWS = {
  lesson: [
    'S..#........',
    '.#.#.####.#.',
    '.#...#....#.',
    '.####.#.###.',
    '......#...#.',
    '.###o.###.#.',
    '...#......#.',
    '##.#.####.#.',
    '...#.#..#...',
    '.#.#.#.##o#.',
    '.#...#....#P',
    '.#####.####.',
  ],
  walledIn: [
    'S...........',
    '............',
    '............',
    '......####..',
    '......#..#..',
    '......#.P#..',
    '......#..#..',
    '......####..',
    '............',
    '............',
    '............',
    '............',
  ],
  enclosedStart: [
    '#####.......',
    '#S..#.......',
    '#...#.......',
    '#####.......',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '...........P',
    '............',
  ],
};

export const PRESET_NAMES = {
  lesson: 'Lesson maze',
  walledIn: 'Princess walled in (no path)',
  enclosedStart: 'Enclosed start',
  empty: 'Empty grid',
};

export function presetWorld(name) {
  const world = createWorld();
  if (name === 'empty') { world.start = { x: 0, y: 0 }; world.princess = { x: 11, y: 11 }; return world; }
  const rows = PRESET_ROWS[name];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const i = idx(world.w, x, y);
    if (ch === '#') world.cells[i] = CELL.WALL;
    else if (ch === 'o') world.cells[i] = CELL.OBSTACLE;
    else if (ch === 'S') world.start = { x, y };
    else if (ch === 'P') world.princess = { x, y };
  }));
  return world;
}
