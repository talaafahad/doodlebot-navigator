// "How Doodlebot Thinks" — a four-step animated introduction.
//
// Every animation here is driven by the REAL game code: the practice mazes are
// run through runMission() (real sensing, real nearest-frontier exploration,
// real BFS), the frames are recorded, and the tutorial simply replays them.
// So Doodlebot never moves through a wall, never sees outside its sensor
// circle, and the green route is a real shortest path.
// The tutorial uses its own practice mazes; it never touches the student's
// maze or experiment history.

import { CELL, idx } from './algorithms.js';
import { runMission } from './simulation.js';
import { createWorld } from './world.js';
import { setupCanvas, drawMap } from './render.js';
import { createDoodlebot } from '../characters/doodlebot.js';
import { createPrincessBot } from '../characters/princess.js';

const RANGE = 2;
const CELL_PX = 64;
const MAZES = {
  rescue:  ['......', '.S.#..', '##.#o.', '...#..', '.#.#..', '.#..#P'],   // checked: Doodlebot never drives over her
  blocked: ['......', '.S....', '......', '..###.', '..#P#.', '..###.'],
};

const STEPS = [
  { title: 'Look Around!', say: 'My sensors help me see what\'s nearby!',
    note: 'The blue circle is my sensor. Black squares are places I haven\'t sensed yet. Everything inside the circle appears on my map.' },
  { title: 'Explore the Unknown!', say: 'I always drive to the nearest unknown place I can reach.',
    note: 'The orange ring is where I\'m heading. I count real steps on my map, never through walls. The dotted line is my trail.' },
  { title: 'Think and Plan!', say: 'I\'m using my map to find the shortest way!',
    note: '' },
  { title: 'Rescue or Try Again!', say: 'We did it! Princess-Bot is safe!',
    note: '' },
];

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function worldFromRows(rows) {
  const w = createWorld(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const i = idx(w.w, x, y);
    if (ch === '#') w.cells[i] = CELL.WALL;
    if (ch === 'o') w.cells[i] = CELL.OBSTACLE;
    if (ch === 'S') w.start = { x, y };
    if (ch === 'P') w.princess = { x, y };
  }));
  return w;
}

// Run the real mission and keep a frozen copy of every frame.
function record(world) {
  const frames = [];
  for (const f of runMission(world, { range: RANGE, planner: 'bfs' })) {
    frames.push({ ...f, known: f.known.slice(), trail: f.trail.slice(), pos: { ...f.pos }, from: { ...f.from }, metrics: { ...f.metrics } });
  }
  const find = phase => frames.findIndex(f => f.phase === phase);
  return {
    world, frames,
    exploreEnd: find('explorationDone'),
    sensed: frames.findIndex(f => f.event === 'princessSensed'),
    returns: frames.filter(f => f.phase === 'return'),
    plan: frames[find('plan')],
    pathFound: frames[find('pathFound')],
    rescue: frames.filter(f => f.phase === 'rescue'),
    done: frames[frames.length - 1],
  };
}

const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerpPos = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function initTutorial({ onFinish, onSkip }) {
  const $ = s => document.querySelector(s);
  const canvas = $('#tut-canvas');
  const bot = createDoodlebot($('#tut-bot'), { emotion: 'curious' });
  const princess = createPrincessBot($('#tut-princess'));
  const runs = { rescue: record(worldFromRows(MAZES.rescue)), blocked: record(worldFromRows(MAZES.blocked)) };
  const ctx = setupCanvas(canvas, 6, 6, CELL_PX);

  let step = 0;
  let variant = 'rescue';       // step 4 can show the blocked example
  let raf = 0, token = 0;
  let revealedAt = new Float64Array(36).fill(-1e9);
  let lastLook = '';

  // ---------------------------------------------------------- drawing
  function draw(run, s, now) {
    drawMap(ctx, {
      world: run.world, cell: CELL_PX, view: 'robot', now, emotion: bot.getEmotion(),
      known: s.known, revealedAt, robot: s.robot, dir: s.dir, sensorRange: s.sensorRange ?? RANGE,
      trail: s.trail, target: s.target, route: s.route, expanded: s.expanded, path: s.path,
      princessRescued: s.rescued,
    });
  }
  function look(dx, dy) {
    const k = `${dx},${dy}`;
    if (k !== lastLook) { bot.lookAt(dx, dy); lastLook = k; }
  }
  function markRevealed(cells, now) {
    for (const c of cells || []) { const i = idx(6, c.x, c.y); if (revealedAt[i] < 0) revealedAt[i] = now; }
  }
  // Doodlebot's speech bubble shows what it is saying right now. Every note is
  // also ADDED to a list below, so slower readers never lose an explanation.
  // The list only clears when the student moves to another step.
  function say(text, note, label = text) {
    $('#tut-say').textContent = text;
    if (!note) return;
    const log = $('#tut-log');
    const last = log.lastElementChild;
    if (last && last.dataset.note === note) return;
    log.querySelectorAll('li').forEach(li => li.classList.remove('is-new'));
    const li = document.createElement('li');
    li.className = 'is-new';
    li.dataset.note = note;
    li.innerHTML = '<b></b><span></span>';
    li.querySelector('b').textContent = label;
    li.querySelector('span').textContent = note;
    log.appendChild(li);
  }
  const clearLog = () => { $('#tut-log').innerHTML = ''; };

  // A timeline is a list of segments {ms, enter?, frame(t, now)} played in order.
  function play(segments) {
    const my = ++token;
    cancelAnimationFrame(raf);
    if (reduceMotion()) {                         // no animation: show the end state of every segment
      const now = performance.now();
      for (const seg of segments) { seg.enter?.(now); seg.frame(1, now + 10000); }
      return;
    }
    let i = 0, segStart = performance.now();
    segments[0].enter?.(segStart);
    const tick = now => {
      if (my !== token) return;                   // a newer animation took over
      let seg = segments[i];
      let t = (now - segStart) / seg.ms;
      while (t >= 1 && i < segments.length - 1) {
        seg.frame(1, now);
        i++; segStart += seg.ms; seg = segments[i]; seg.enter?.(segStart);
        t = (now - segStart) / seg.ms;
      }
      seg.frame(Math.min(1, Math.max(0, t)), now);
      raf = requestAnimationFrame(tick);          // keep drawing so flashes and pulses fade naturally
    };
    raf = requestAnimationFrame(tick);
  }

  // Segments that replay recorded movement frames one cell at a time.
  function moveSegments(run, frames, ms, base, onFrame) {
    return frames.map(f => ({
      ms,
      enter: now => { markRevealed(f.seen, now); onFrame?.(f, now); const dx = f.pos.x - f.from.x, dy = f.pos.y - f.from.y; if (dx || dy) look(dx, dy); },
      frame: (t, now) => {
        const dx = f.pos.x - f.from.x, dy = f.pos.y - f.from.y;
        draw(run, { ...base(f), known: f.known, robot: lerpPos(f.from, f.pos, ease(t)), dir: dx || dy ? [dx, dy] : [0, 1] }, now);
      },
    }));
  }

  // ---------------------------------------------------------- the four steps
  const builders = [
    // 1 — Look Around: the sensor circle grows and reveals exactly the cells the real sensor sees
    () => {
      const run = runs.rescue, first = run.frames[0], start = run.world.start;
      const blank = new Array(36).fill(CELL.UNKNOWN); blank[idx(6, start.x, start.y)] = CELL.FREE;
      const partial = blank.slice();
      const dirs = [[-1, 0], [0, -1], [1, 0], [0, 1], [0, 0]];
      bot.setEmotion('curious'); princess.setMood('lost');
      return [
        { ms: 700, enter: () => look(0, 0), frame: (t, now) => draw(run, { known: blank, robot: start, sensorRange: 0 }, now) },
        { ms: 1700, frame: (t, now) => {
            const r = (RANGE + 0.5) * ease(t);   // radius in cells
            for (const c of first.seen) {
              if (Math.hypot(c.x - start.x, c.y - start.y) <= r) {
                const i = idx(6, c.x, c.y);
                if (partial[i] === CELL.UNKNOWN) { partial[i] = first.known[i]; revealedAt[i] = now; }
              }
            }
            draw(run, { known: t >= 1 ? first.known : partial, robot: start, sensorRange: r - 0.5 }, now);
          } },
        { ms: 2200, frame: (t, now) => {
            const d = dirs[Math.min(dirs.length - 1, Math.floor(t * dirs.length))];
            look(d[0], d[1]);
            draw(run, { known: first.known, robot: start }, now);
          } },
      ];
    },

    // 2 — Explore: replay every real exploration move until the map is complete
    () => {
      const run = runs.rescue;
      const frames = run.frames.slice(1, run.exploreEnd);
      bot.setEmotion('curious'); princess.setMood('lost');
      say(STEPS[1].say, STEPS[1].note);
      let calmTimer = 0;
      const segs = moveSegments(run, frames, 300, f => ({ trail: f.trail, target: f.target, route: f.plannedRoute }), f => {
        if (f.event === 'princessSensed') {
          bot.setEmotion('excited');
          say('I found Princess-Bot! I\'ll finish exploring my map first.', 'She\'s inside my sensor circle, so she\'s on my map now. But I keep exploring until there\'s no unknown place left that I can reach.');
          clearTimeout(calmTimer);
          calmTimer = setTimeout(() => { if (bot.getEmotion() === 'excited' && step === 1) bot.setEmotion('curious'); }, 1600);
        }
      });
      const end = run.frames[run.exploreEnd];
      segs.push({ ms: 800, enter: () => { clearTimeout(calmTimer); bot.setEmotion('happy'); }, frame: (t, now) => draw(run, { known: end.known, robot: end.pos, trail: end.trail }, now) });
      return segs;
    },

    // 3 — Think and Plan: drive home, then replay BFS's real search order, then the real shortest path
    () => {
      const run = runs.rescue, end = run.frames[run.exploreEnd], plan = run.plan, found = run.pathFound;
      revealedAt.fill(-1e9);
      bot.setEmotion('thinking'); princess.setMood('lost');
      say('My map is finished! First I drive back to my start.', 'There are no unknown places left that I can reach, so exploring is done.');
      const segs = [{ ms: 700, frame: (t, now) => draw(run, { known: end.known, robot: end.pos, trail: end.trail }, now) }];
      segs.push(...moveSegments(run, run.returns, 240, f => ({ trail: end.trail })));
      const searchMs = 75 * plan.expanded.length;
      segs.push({
        ms: searchMs,
        enter: () => { look(1, 1); say(STEPS[2].say, `The yellow squares are places I check, spreading out like ripples. I only use cells on MY map. I checked ${plan.expanded.length} cells.`); },
        frame: (t, now) => draw(run, { known: plan.known, robot: plan.pos, expanded: plan.expanded.slice(0, Math.max(1, Math.ceil(t * plan.expanded.length))) }, now),
      });
      segs.push({
        ms: 1100,
        enter: () => say(STEPS[2].say, `The green line is the shortest path: ${found.metrics.pathLength} steps. No path on my map is shorter.`, 'Found it!'),
        frame: (t, now) => draw(run, { known: found.known, robot: found.pos, expanded: plan.expanded, path: found.path.slice(0, Math.max(2, Math.ceil(ease(t) * found.path.length))) }, now),
      });
      return segs;
    },

    // 4 — Rescue (or the blocked example)
    () => (variant === 'rescue' ? rescueSegments() : blockedSegments()),
  ];

  function rescueSegments() {
    const run = runs.rescue, found = run.pathFound, done = run.done;
    revealedAt.fill(-1e9);
    bot.setEmotion('curious'); princess.setMood('lost');
    say('Here I come, Princess-Bot!', 'I follow the green path, one step at a time.');
    const segs = moveSegments(run, run.rescue, 330, () => ({ path: found.path }));
    segs.push({
      ms: 2400,
      enter: () => { bot.setEmotion('happy'); princess.setMood('rescued'); look(0, 0); say(STEPS[3].say, 'Sense, map, plan, move: that\'s how a robot finds its way all by itself!'); },
      frame: (t, now) => draw(run, { known: done.known, robot: done.pos, path: found.path, rescued: true }, now),
    });
    return segs;
  }

  function blockedSegments() {
    const run = runs.blocked, end = run.frames[run.exploreEnd], plan = run.plan, home = run.done.pos;
    revealedAt.fill(-1e9);
    bot.setEmotion('thinking'); princess.setMood('lost');
    say('I can see her on my map… but is there a way in?', 'I sensed her through the walls, then finished my whole map and went back to my start.');
    return [
      { ms: 1300, enter: () => look(1, 1), frame: (t, now) => draw(run, { known: end.known, robot: home }, now) },
      { ms: 75 * plan.expanded.length, enter: () => say('Let me check every route on my map…', 'The yellow squares are every place I can reach.'),
        frame: (t, now) => draw(run, { known: plan.known, robot: home, expanded: plan.expanded.slice(0, Math.max(1, Math.ceil(t * plan.expanded.length))) }, now) },
      { ms: 1500, enter: () => { bot.setEmotion('sad'); look(0, 1); say('Oh no! The path is blocked. Can you help me find another way?', `I checked all ${plan.expanded.length} cells I can reach, and none of them leads to Princess-Bot. In the game, you can erase a wall to open a path!`); },
        frame: (t, now) => draw(run, { known: plan.known, robot: home, expanded: plan.expanded }, now) },
    ];
  }

  // ---------------------------------------------------------- navigation
  function show(n) {
    step = Math.max(0, Math.min(STEPS.length - 1, n));
    if (step !== 3) variant = 'rescue';
    lastLook = '';
    revealedAt = new Float64Array(36).fill(-1e9);
    clearLog();
    const s = STEPS[step];
    $('#tut-title').textContent = s.title;
    $('#tut-kicker').textContent = `Step ${step + 1} of ${STEPS.length}`;
    say(s.say, s.note);
    document.querySelectorAll('#tut-steps li').forEach((li, i) => {
      li.classList.toggle('is-current', i === step);
      li.classList.toggle('is-done', i < step);
      if (i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('#tut-back').disabled = step === 0;
    $('#tut-next').hidden = step === STEPS.length - 1;
    $('#tut-play').hidden = step !== STEPS.length - 1;
    $('#tut-blocked').hidden = step !== STEPS.length - 1;
    $('#tut-blocked').textContent = variant === 'rescue' ? '🧱 What if the path is blocked?' : '💖 Show the rescue again';
    play(builders[step]());
  }

  $('#tut-next').addEventListener('click', () => show(step + 1));
  $('#tut-back').addEventListener('click', () => show(step - 1));
  $('#tut-replay').addEventListener('click', () => show(step));
  $('#tut-blocked').addEventListener('click', () => { variant = variant === 'rescue' ? 'blocked' : 'rescue'; show(3); });
  $('#tut-skip').addEventListener('click', () => onSkip?.());
  $('#tut-play').addEventListener('click', () => onFinish?.());

  return {
    start() { show(0); },
    stop() { token++; cancelAnimationFrame(raf); bot.setTalking(false); },
  };
}
