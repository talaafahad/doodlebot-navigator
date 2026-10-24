// Screen router: Welcome → How Doodlebot Thinks → Game.
// The game keeps running in memory the whole time, so going Home never resets
// the student's maze or experiments. Leaving the game only pauses a running mission.

import { gameApi } from './main.js';
import { initTutorial } from './tutorial.js';
import { createDoodlebot } from '../characters/doodlebot.js';
import { createPrincessBot } from '../characters/princess.js';

const $ = s => document.querySelector(s);
const SEEN_KEY = 'doodlebot.introSeen';
const HASH = { welcome: '#welcome', tutorial: '#learn', game: '#play' };

const store = {
  get seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } },
  markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: fine */ } },
};
let sessionStarted = false;    // has the student opened the game yet (this visit)?

// ---- welcome characters: gentle idle animations only
const welcomeBot = createDoodlebot($('#welcome-bot'), { emotion: 'idle' });
welcomeBot.lookAt(1, -0.4);    // looking toward the castle, where Princess-Bot is
createPrincessBot($('#welcome-princess'), { mood: 'lost' });

const tutorial = initTutorial({
  onFinish: () => { store.markSeen(); go('game'); },
  onSkip: () => { store.markSeen(); go('game'); },
});

function refreshWelcome() {
  $('#start-adventure').textContent = sessionStarted ? 'Continue Adventure!' : 'Start Adventure!';
  $('#watch-tutorial').hidden = !(store.seen || sessionStarted);
  $('#skip-intro').hidden = store.seen || sessionStarted;
}

function go(screen, { replace = false } = {}) {
  const from = document.body.dataset.screen;
  if (from === screen) return;
  if (from === 'game') { gameApi.pause(); gameApi.closeChat(); }
  if (from === 'tutorial') tutorial.stop();

  document.body.dataset.screen = screen;
  window.scrollTo(0, 0);
  if (screen === 'welcome') refreshWelcome();
  if (screen === 'tutorial') tutorial.start();
  if (screen === 'game') sessionStarted = true;

  const hash = HASH[screen];
  if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
  // move focus to the new screen's heading for keyboard and screen-reader users
  const heading = { welcome: '#welcome-title', tutorial: '#tut-heading', game: '.brand h1' }[screen];
  const h = $(heading); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

$('#start-adventure').addEventListener('click', () => go(sessionStarted || store.seen ? 'game' : 'tutorial'));
$('#watch-tutorial').addEventListener('click', () => go('tutorial'));
$('#skip-intro').addEventListener('click', () => { store.markSeen(); go('game'); });
$('#home-btn').addEventListener('click', () => go('welcome'));

// browser back / forward buttons
window.addEventListener('popstate', () => {
  const screen = Object.keys(HASH).find(k => HASH[k] === location.hash) || 'welcome';
  go(screen, { replace: true });
});

// first load: a direct link to #play or #learn still works
const initial = Object.keys(HASH).find(k => HASH[k] === location.hash) || 'welcome';
document.body.dataset.screen = '';
go(initial, { replace: true });
