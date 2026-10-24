// Game controller: maze editing, running the mission step by step, drawing,
// Doodlebot's emotions, the Build → Explore → Results stages and the experiments.
// All navigation logic lives in algorithms.js / simulation.js and is unchanged by the UI.

import { CELL, idx, cellsInRange, sensorReach } from './algorithms.js';
import { runMission } from './simulation.js';
import { createWorld, cloneWorld, applyTool, mazeId, randomMaze, presetWorld } from './world.js';
import { setupCanvas, drawMap, drawWall, drawObstacle, drawEraserIcon } from './render.js';
import { initChat } from './chat.js';
import { createDoodlebot } from '../characters/doodlebot.js';
import { createPrincessBot } from '../characters/princess.js';
import { createEmotionController, lineFor } from '../characters/emotions.js';
import { drawDoodlebotToken, drawPrincessToken } from '../characters/tokens.js';

const CELL_PX = 40;
const SPEED_MS = { slow: 420, normal: 220, fast: 80 };     // ms per move
const PLANNER_NAME = { astar: 'A*', bfs: 'BFS' };
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

// ------------------------------------------------------------------ state
let world = presetWorld('lesson');
let tool = 'wall';
const settings = { range: 2, planner: 'bfs', speed: 'normal' };
const game = {
  mode: 'edit',            // edit | running | paused | finished
  iter: null,
  frame: null,
  frameStart: 0,
  frameDuration: 0,
  revealedAt: null,
  revealed: null,
  runCount: 0,
  results: [],
  princessRescued: false,
  lastMetrics: null,
  sensedNoticeUntil: 0,
};

// ------------------------------------------------------------ characters
const bot = createDoodlebot($('#bot-portrait'));
const princess = createPrincessBot($('#princess-portrait'));
const bubble = $('#bubble');
const say = text => { bubble.textContent = text; };
const mood = createEmotionController(bot, {
  onChange: emotion => { if (emotion === 'curious') say(lineFor('exploreStep')); },
});

// --------------------------------------------------------------- canvases
const trueCanvas = $('#true-map');
const robotCanvas = $('#robot-map');
const trueCtx = setupCanvas(trueCanvas, world.w, world.h, CELL_PX);
const robotCtx = setupCanvas(robotCanvas, world.w, world.h, CELL_PX);

// ------------------------------------------------------------------ helpers
const runRange = () => (game.mode !== 'edit' && game.runMeta ? game.runMeta.range : settings.range);
const stepMs = () => SPEED_MS[settings.speed];

function setStatus(text, kind = '', icon = '💡') {
  $('#status-text').textContent = text;
  $('#status .tip-icon').textContent = icon;
  $('#status').className = 'tip' + (kind ? ' ' + kind : '');
}

function refreshMazeId() { $('#maze-id').textContent = mazeId(world); }

function setLocked(locked) {
  for (const el of $$('#preset, #random, #clear, .tool, #range button, #planner button')) el.disabled = locked;
}

function updateButtons() {
  const run = $('#run');
  run.textContent = { running: '⏸ Pause', paused: '▶ Continue', finished: '🔁 Explore again', edit: '▶ Start Exploring' }[game.mode];
  $('#reset').disabled = game.mode === 'edit';
}

// ---------------------------------------------------------- stages & menus
function setStage(stage) {
  if (document.body.dataset.stage === stage) return;
  document.body.dataset.stage = stage;
  const order = ['build', 'explore', 'results'];
  $$('.stepper li').forEach(li => {
    const i = order.indexOf(li.dataset.step), cur = order.indexOf(stage);
    li.classList.toggle('is-current', i === cur);
    li.classList.toggle('is-done', i < cur);
    li.toggleAttribute('aria-current', i === cur);
    if (i === cur) li.setAttribute('aria-current', 'step');
  });
  if (stage === 'build') { setSection('acc-build', true); setView('true'); }
  if (stage === 'explore') { setSection('acc-build', false); setView('robot'); }   // tools aren't usable while exploring
}

// Each menu opens and closes on its own, so several can be open at once.
function setSection(id, open) {
  const acc = document.getElementById(id);
  acc.querySelector('.acc-head').setAttribute('aria-expanded', String(open));
  acc.querySelector('.acc-body').hidden = !open;
}
$$('.acc-head').forEach(btn => btn.addEventListener('click', () => {
  setSection(btn.closest('.acc').id, btn.getAttribute('aria-expanded') !== 'true');
}));

function setView(view) {
  $('#map-stage').dataset.view = view;
  $$('#view button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
}
$$('#view button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

// radio-button groups (sensor range, speed, algorithm)
function radioGroup(sel, onPick) {
  const buttons = $$(`${sel} button`);
  const pick = btn => {
    buttons.forEach(b => b.setAttribute('aria-checked', String(b === btn)));
    onPick(btn.dataset.value);
  };
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => pick(b));
    b.addEventListener('keydown', e => {                 // arrow keys move between options
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const next = buttons[(i + d + buttons.length) % buttons.length];
      if (!next.disabled) { next.focus(); pick(next); }
    });
  });
}
radioGroup('#range', v => { settings.range = Number(v); drawRangePreview(); if (game.mode === 'finished') resetRun(); });
radioGroup('#speed', v => { settings.speed = v; });
radioGroup('#planner', v => { settings.planner = v; if (game.mode === 'finished') resetRun(); });

// little picture of the sensing circle next to the range buttons
function drawRangePreview() {
  const c = $('#range-preview'), n = 11, px = 76;
  const dpr = window.devicePixelRatio || 1;
  c.width = px * dpr; c.height = px * dpr;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = px / n, mid = { x: 5, y: 5 };
  ctx.clearRect(0, 0, px, px);
  const inside = new Set(cellsInRange(n, n, mid, settings.range).map(p => p.y * n + p.x));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    ctx.fillStyle = inside.has(y * n + x) ? '#CDEBFA' : ((x + y) % 2 ? '#F7FBFF' : '#FFFFFF');
    ctx.fillRect(x * s, y * s, s, s);
  }
  ctx.strokeStyle = '#3478D4'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(px / 2, px / 2, sensorReach(settings.range) * s, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  drawDoodlebotToken(ctx, px / 2, px / 2, s * 1.6, {});
  $('#range-text').textContent = `Doodlebot senses everything within ${settings.range} cell${settings.range > 1 ? 's' : ''} of itself.`;
}

// tool icons are drawn with the same code as the maze, so they match exactly
function drawToolIcons() {
  for (const c of $$('.tool-icon')) {
    const px = 44, dpr = window.devicePixelRatio || 1;
    c.width = px * dpr; c.height = px * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const kind = c.dataset.icon;
    if (kind === 'wall') drawWall(ctx, 2, 2, 40);
    if (kind === 'obstacle') drawObstacle(ctx, 0, -2, 44);
    if (kind === 'start') drawDoodlebotToken(ctx, 22, 23, 48, {});
    if (kind === 'princess') drawPrincessToken(ctx, 22, 23, 48);
    if (kind === 'eraser') drawEraserIcon(ctx, 0, 0, 44);
  }
}

// --------------------------------------------------------------- editing
function selectTool(name) {
  tool = name;
  $$('.tool').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tool === name)));
}
$$('.tool').forEach(b => b.addEventListener('click', () => selectTool(b.dataset.tool)));

function cellFromEvent(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((e.clientX - r.left) / r.width) * world.w),
    y: Math.floor(((e.clientY - r.top) / r.height) * world.h),
  };
}

function edited() {
  refreshMazeId();
  if (game.mode === 'finished') resetRun();
}

let drawing = false, lastCell = null;
trueCanvas.addEventListener('pointerdown', e => {
  if (game.mode === 'running' || game.mode === 'paused') {
    setStatus('Press "Start over" if you want to change the maze.', '', '✋');
    return;
  }
  if (game.mode === 'finished') resetRun();
  drawing = true;
  trueCanvas.setPointerCapture(e.pointerId);
  lastCell = cellFromEvent(trueCanvas, e);
  if (applyTool(world, tool, lastCell.x, lastCell.y)) edited();
});
trueCanvas.addEventListener('pointermove', e => {
  if (!drawing || !['wall', 'obstacle', 'eraser'].includes(tool)) return;
  const c = cellFromEvent(trueCanvas, e);
  if (lastCell && c.x === lastCell.x && c.y === lastCell.y) return;
  // fill every cell between the last and current pointer position, so fast drags leave no gaps
  let changed = false;
  for (const p of lineCells(lastCell, c)) changed = applyTool(world, tool, p.x, p.y) || changed;
  lastCell = c;
  if (changed) edited();
});
const stopDrawing = () => { drawing = false; lastCell = null; };
trueCanvas.addEventListener('pointerup', stopDrawing);
trueCanvas.addEventListener('pointercancel', stopDrawing);

function lineCells(a, b) {                       // Bresenham
  const out = [];
  let x0 = a.x, y0 = a.y;
  const dx = Math.abs(b.x - x0), dy = -Math.abs(b.y - y0), sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ x: x0, y: y0 });
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}

$('#preset').addEventListener('change', e => {
  if (!e.target.value) return;
  world = presetWorld(e.target.value);
  e.target.value = '';
  resetRun(); refreshMazeId();
});
$('#random').addEventListener('click', () => { world = randomMaze(); resetRun(); refreshMazeId(); });
$('#clear').addEventListener('click', () => {
  const keep = { start: world.start, princess: world.princess };
  world = createWorld(); world.start = keep.start; world.princess = keep.princess;
  resetRun(); refreshMazeId();
});

// ------------------------------------------------------------- running
function startRun() {
  if (!world.start || !world.princess) {
    setStage('build');
    setStatus(!world.start ? 'Put Doodlebot on the maze first: Build Tools → Doodlebot.' : 'Put Princess-Bot on the maze first: Build Tools → Princess-Bot.', 'bad', '🙋');
    mood.force('sad');
    say(!world.start ? 'Where do I start? Put me on the grid!' : 'Who am I rescuing? Put Princess-Bot on the grid!');
    return false;
  }
  const n = world.w * world.h;
  game.runMeta = { range: settings.range, planner: settings.planner, maze: mazeId(world) };
  game.iter = runMission(cloneWorld(world), { range: settings.range, planner: settings.planner });
  game.revealedAt = new Float64Array(n).fill(-1e9);
  game.revealed = new Uint8Array(n);
  game.princessRescued = false;
  game.sensedNoticeUntil = 0;
  game.runCount++;
  princess.setMood('lost');
  $('#result-card').hidden = true;
  mood.reset();
  setLocked(true);
  setStage('explore');
  return true;
}

function advance(now) {
  const r = game.iter.next();
  if (r.done) { finish(r.value); return; }
  const f = r.value;
  game.frame = f;
  game.frameStart = now;
  game.lastMetrics = f.metrics;

  for (const c of f.seen || []) {
    const i = idx(world.w, c.x, c.y);
    if (!game.revealed[i]) { game.revealed[i] = 1; game.revealedAt[i] = now; }
  }
  const dx = f.pos.x - f.from.x, dy = f.pos.y - f.from.y;
  if (dx || dy) { bot.lookAt(dx, dy); game.dir = [dx, dy]; }

  const ms = stepMs();
  const m = f.metrics;
  switch (f.phase) {
    case 'explore':
      game.frameDuration = ms;
      if (f.event === 'princessSensed') {
        mood.event('princessSensed'); say(lineFor('princessSensed'));
        game.sensedNoticeUntil = now + 2500;
        setStatus('I can sense Princess-Bot! I\'ll finish my map first, then plan.', 'good', '✨');
      } else {
        mood.event('exploreStep');
        if (now > game.sensedNoticeUntil) setStatus('I\'m checking what\'s nearby, then heading to the nearest unknown area.', '', '🔦');
      }
      break;
    case 'explorationDone':
      game.frameDuration = Math.max(1100, ms * 4);
      mood.event('explorationDone'); say(lineFor('explorationDone'));
      setStatus(`My map is finished after ${m.explorationSteps} steps! There are no unknown places I can reach.`, 'good', '🗺️');
      break;
    case 'return':
      game.frameDuration = ms;
      setStatus('Driving back to my start…', '', '🏠');
      break;
    case 'plan':
      game.searchStep = Math.max(14, ms / 5);
      game.frameDuration = f.expanded.length * game.searchStep + 500;
      mood.event('planning'); say(lineFor('planning'));
      setStatus(`Finding the shortest path on my map with ${PLANNER_NAME[m.planner]}…`, 'think', '🤔');
      break;
    case 'pathFound':
      game.frameDuration = Math.max(1400, ms * 6);
      mood.force('happy'); say(lineFor('pathFound'));
      setStatus(`Found it! The shortest path is ${m.pathLength} steps.`, 'good', '✅');
      break;
    case 'rescue':
      game.frameDuration = ms;
      setStatus('On my way to Princess-Bot!', 'good', '🚀');
      break;
    case 'done':
      game.frameDuration = 0;
      if (f.reason === 'rescued') {
        game.princessRescued = true;
        princess.setMood('rescued');
        mood.force('excited'); say(lineFor('rescued'));
        setStatus('Rescued! Princess-Bot is safe.', 'good', '🎉');
        confetti();
      } else if (f.reason === 'noPath') {
        mood.force('sad'); say(lineFor('noPath'));
        setStatus('No path yet! Princess-Bot is walled in. Can you open a way?', 'bad', '🧱');
      } else {
        mood.force('sad'); say(lineFor('notFound'));
        setStatus('I explored everywhere I could reach, but never sensed Princess-Bot.', 'bad', '🔍');
      }
      break;
  }
  showLive(m);
}

function showLive(m) {
  $('#m-steps').textContent = m ? m.explorationSteps : 0;
  $('#m-cells').innerHTML = `${m ? m.cellsKnown : 0}<small>/${world.w * world.h}</small>`;
}

function finish(metrics) {
  game.mode = 'finished';
  game.iter = null;
  setLocked(false);
  updateButtons();
  addResult(metrics);
  showResultCard(metrics);
  setStage('results');
}

function showResultCard(m) {
  const card = $('#result-card');
  const ok = m.outcome === 'rescued';
  card.className = 'card result-card ' + (ok ? 'ok' : 'no');
  $('#result-title').textContent = ok ? 'Rescued! 🎉' : m.outcome === 'noPath' ? 'No path yet' : 'Never found her';
  $('#result-sub').textContent = ok ? 'Princess-Bot is safe.' : m.outcome === 'noPath' ? 'Doodlebot sensed her, but walls block every route.' : 'She is somewhere Doodlebot can\'t reach.';
  $('#r-range').textContent = `${m.sensorRange} cell${m.sensorRange > 1 ? 's' : ''}`;
  $('#r-steps').textContent = m.explorationSteps;
  $('#r-path').textContent = m.pathLength ?? 'no path';
  $('#r-searched').textContent = m.cellsSearched ?? '–';
  $('#r-seen').textContent = m.princessSeenAtStep ?? 'never';

  // compare with the previous run on the SAME maze, if there is one
  const prev = game.results.slice(0, -1).reverse().find(r => r.maze === game.runMeta.maze && r.outcome === 'rescued');
  const cmp = $('#r-compare');
  if (prev && ok) {
    const fewer = prev.explore - m.explorationSteps;
    const steps = fewer > 0 ? `${fewer} fewer steps to finish mapping` : fewer < 0 ? `${-fewer} more steps to finish mapping` : 'the same number of mapping steps';
    const path = prev.path === m.pathLength ? `The shortest path stayed ${m.pathLength} steps.` : `The path changed from ${prev.path} to ${m.pathLength} steps.`;
    cmp.textContent = `Compared with run #${prev.run} (sensor ${prev.range}): ${steps}. ${path}`;
    cmp.hidden = false;
  } else cmp.hidden = true;
  card.hidden = false;
}

function resetRun() {
  game.mode = 'edit';
  game.iter = null;
  game.frame = null;
  game.dir = [0, 1];
  game.princessRescued = false;
  game.lastMetrics = null;
  setLocked(false);
  updateButtons();
  showLive(null);
  $('#result-card').hidden = true;
  mood.reset();
  bot.lookAt(0, 0);
  princess.setMood('lost');
  say(lineFor('idle'));
  setStage('build');
  setStatus('Pick a tool, then click or drag on the maze.');
}

$('#run').addEventListener('click', () => {
  if (game.mode === 'running') {
    game.mode = 'paused'; game.pausedAt = performance.now();
    setStatus('Paused. Press Continue, or take one step at a time.', '', '⏸');
  } else if (game.mode === 'paused') {
    game.frameStart += performance.now() - game.pausedAt; game.mode = 'running';
  } else {
    if (game.mode === 'finished') resetRun();
    if (startRun()) { game.mode = 'running'; advance(performance.now()); }
  }
  updateButtons();
});
$('#step').addEventListener('click', () => {
  if (game.mode === 'edit' || game.mode === 'finished') {
    if (game.mode === 'finished') resetRun();
    if (!startRun()) return;
    game.mode = 'paused';
  } else if (game.mode === 'running') game.mode = 'paused';
  const now = performance.now();
  if (game.iter) advance(now);
  if (game.mode === 'paused' && game.frame) { game.frameStart = now - game.frameDuration; game.pausedAt = now; } // show the step fully
  updateButtons();
});
$('#reset').addEventListener('click', resetRun);
$('#try-again').addEventListener('click', () => {
  resetRun();
  setSection('acc-settings', true);
  $('#range button[aria-checked="true"]').focus();
});

// --------------------------------------------------------------- experiments
function addResult(m) {
  game.results.push({
    run: game.runCount, ...game.runMeta,
    explore: m.explorationSteps, seen: m.princessSeenAtStep, path: m.pathLength,
    searched: m.cellsSearched, outcome: m.outcome,
  });
  renderResults(true);
}

function renderResults(fresh = false) {
  const n = game.results.length;
  $('#run-count').hidden = !n;
  $('#run-count').textContent = n;
  $('#exp-question').hidden = n < 2;
  $('#exp-details').hidden = !n;
  if (!n) {
    $('#exp-cards').innerHTML = '<div class="exp-empty"><b>No experiments yet</b>Finish a mission to see your results here. Then try the same maze with a different sensor range!</div>';
    $('#results').innerHTML = '';
    return;
  }
  const outcome = { rescued: '<span class="tag ok">Rescued</span>', noPath: '<span class="tag no">No path</span>', notFound: '<span class="tag no">Never sensed</span>' };
  $('#exp-cards').innerHTML = game.results.slice(-4).map((r, i, arr) => `
    <div class="exp ${fresh && i === arr.length - 1 ? 'fresh' : ''}">
      <span class="exp-title">Run ${r.run} ${outcome[r.outcome]}</span>
      <span class="exp-meta">Sensor: ${r.range} cell${r.range > 1 ? 's' : ''} · Maze ${r.maze}</span>
      <span class="exp-meta">Path: ${r.path ?? 'none'}${r.path ? ' steps' : ''}</span>
      <span class="exp-num">${r.explore}<small>mapping steps</small></span>
    </div>`).join('');
  $('#results').innerHTML = game.results.map(r => `
    <tr><td>#${r.run}</td><td>${r.maze}</td><td>${r.range}</td><td>${PLANNER_NAME[r.planner]}</td>
      <td><b>${r.explore}</b></td><td>${r.seen ?? '–'}</td><td><b>${r.path ?? '–'}</b></td>
      <td>${r.searched ?? '–'}</td><td>${outcome[r.outcome]}</td></tr>`).join('');
}
$('#clear-results').addEventListener('click', () => { game.results = []; renderResults(); });

// --------------------------------------------------------------- drawing
function previewKnown() {
  const k = new Array(world.w * world.h).fill(CELL.UNKNOWN);
  if (world.start) k[idx(world.w, world.start.x, world.start.y)] = CELL.FREE;
  return k;
}

function frame(now) {
  if (document.body.dataset.screen !== 'game') { requestAnimationFrame(frame); return; }   // hidden: don't run or draw
  if (game.mode === 'running' && game.iter && now - game.frameStart >= game.frameDuration) advance(now);

  const f = game.frame;
  const tnow = game.mode === 'paused' ? game.pausedAt : now;     // a paused run freezes in place
  let robot = world.start, known = null, extra = {};
  if (f) {
    const t = Math.min(1, (tnow - game.frameStart) / (stepMs() * 0.85));
    const moving = ['explore', 'return', 'rescue'].includes(f.phase);
    robot = moving ? { x: f.from.x + (f.pos.x - f.from.x) * t, y: f.from.y + (f.pos.y - f.from.y) * t } : f.pos;
    known = f.known;
    let expanded = f.expanded;
    if (f.phase === 'plan') expanded = f.expanded.slice(0, Math.min(f.expanded.length, Math.floor((tnow - game.frameStart) / game.searchStep) + 1));
    if (f.phase === 'rescue' || (f.phase === 'done' && f.reason === 'rescued')) expanded = null;
    extra = {
      trail: f.trail, target: f.phase === 'explore' ? f.target : null,
      route: f.phase === 'explore' ? f.plannedRoute : null,
      expanded, path: f.path,
    };
  }
  const common = {
    world, cell: CELL_PX, now, robot, dir: game.dir, emotion: bot.getEmotion(),
    sensorRange: robot ? runRange() : 0, princessRescued: game.princessRescued, ...extra,
  };
  drawMap(trueCtx, { ...common, view: 'true', trail: null, target: null, route: null, expanded: null });
  drawMap(robotCtx, { ...common, view: 'robot', known: known || previewKnown(), revealedAt: game.revealedAt });
  requestAnimationFrame(frame);
}

// --------------------------------------------------------------- confetti
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('#confetti');
  const colors = ['#3478D4', '#8FE9E6', '#FFE08A', '#FFB3CF', '#B9E8D0', '#D9CCFF'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    p.style.animationDelay = Math.random() * 0.4 + 's';
    box.appendChild(p);
    setTimeout(() => p.remove(), 4200);
  }
}

// ------------------------------------------------------------------ chat & help
const chat = initChat({
  bot,
  getGameState: () => ({
    mode: game.mode,
    phase: game.frame?.phase ?? 'editing',
    sensorRange: runRange(),
    planner: PLANNER_NAME[game.mode !== 'edit' && game.runMeta ? game.runMeta.planner : settings.planner],
    mazeId: mazeId(world),
    hasStart: !!world.start,
    hasPrincess: !!world.princess,
    currentRun: game.lastMetrics,
    previousRuns: game.results.slice(-6),
  }),
});
$('#bot-button').addEventListener('click', () => chat.open());
robotCanvas.addEventListener('click', e => {
  // clicking Doodlebot on its own map also opens the chat
  const f = game.frame, p = f ? f.pos : world.start;
  if (!p) return;
  const c = cellFromEvent(robotCanvas, e);
  if (c.x === p.x && c.y === p.y) chat.open();
});
$('#help-open').addEventListener('click', () => $('#help').showModal());

// ------------------------------------------------------------------ boot
selectTool('wall');
drawToolIcons();
drawRangePreview();
refreshMazeId();
renderResults();
document.body.dataset.stage = '';
resetRun();
requestAnimationFrame(frame);
window.__doodlebot = { game, settings, get world() { return world; } };   // handy for debugging in the console

// Used by the screen router (app.js): leaving the game pauses it but keeps everything.
export const gameApi = {
  pause() {
    if (game.mode !== 'running') return;
    game.mode = 'paused'; game.pausedAt = performance.now();
    setStatus('Paused while you were away. Press Continue when you\'re ready!', '', '⏸');
    updateButtons();
  },
  closeChat() { chat.close(); },
};
