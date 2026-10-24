// Chat with Doodlebot: text or voice in (Web Speech API, transcribed and shown),
// replies shown as text and read aloud with TTS while Doodlebot's mouth moves.

import { createDoodlebot } from '../characters/doodlebot.js';
import { offlineReply } from './offline-brain.js';

const $ = sel => document.querySelector(sel);

export function initChat({ bot, getGameState }) {
  const panel = $('#chat');
  const log = $('#chat-log');
  const form = $('#chat-form');
  const input = $('#chat-input');
  const mic = $('#mic');
  const soundBtn = $('#sound');
  let soundOn = true;
  const avatar = createDoodlebot($('#chat-avatar'), { emotion: 'happy' });
  const history = [];
  let greeted = false;
  let busy = false;

  // ---------------------------------------------------------- server mode
  let mode = 'offline';
  let serverVoice = false;          // true when the server can make natural speech (OpenAI TTS)
  fetch('/api/health').then(r => r.json()).then(d => {
    mode = d.mode;
    serverVoice = d.tts === 'openai';
    $('#chat-mode').textContent = d.mode === 'offline' ? 'Offline mode · ask about sensing, maps and paths' : 'Ask me about sensing, maps and paths!';
  }).catch(() => { $('#chat-mode').textContent = 'Offline mode · ask about sensing, maps and paths'; });

  // ---------------------------------------------------------- messages
  function add(role, text, cls = '') {
    const el = document.createElement('div');
    el.className = `msg ${role} ${cls}`.trim();
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // Speech recognition often mishears the robots' names. We show the student
  // exactly what was heard, but send a cleaned-up version to Doodlebot.
  function normalise(text) {
    return text
      .replace(/\b(do+ ?boys?|doodle ?bots?|do the bots?|do de bots?|google ?bots?|noodle ?bots?|doodlebug)\b/gi, 'Doodlebot')
      .replace(/\b(prince'?s ?bot|princess ?bought|princess ?but)\b/gi, 'Princess-Bot')
      .replace(/\b(maize|mays|mace)\b/gi, 'maze')
      .replace(/\bsenser\b/gi, 'sensor');
  }

  async function ask(text, viaVoice = false) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    add('user', text, viaVoice ? 'voice' : '');
    history.push({ role: 'user', content: normalise(text) });
    const typing = add('bot', 'Doodlebot is thinking…', 'typing');
    avatar.setEmotion('thinking');
    let reply, source = 'offline';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12), gameState: getGameState() }),
      });
      if (!res.ok) throw new Error(res.status);
      ({ reply, source } = await res.json());
    } catch {
      reply = offlineReply(normalise(text), getGameState());   // works even without the server
    }
    typing.remove();
    const msg = add('bot', reply);
    msg.dataset.source = source === 'offline' ? 'offline' : 'AI';
    history.push({ role: 'assistant', content: reply });
    avatar.setEmotion('happy');
    speak(reply);
    busy = false;
  }

  // sound on / off (for quiet classrooms)
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.setAttribute('aria-label', soundOn ? "Doodlebot's voice is on" : "Doodlebot's voice is off");
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    if (!soundOn) stopSpeaking();
  });

  // suggested questions for students who don't know what to ask
  document.querySelectorAll('#chips .chip').forEach(chip => chip.addEventListener('click', () => ask(chip.textContent)));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = input.value;
    input.value = '';
    ask(t);
  });

  // ---------------------------------------------------------- TTS
  // 1st choice: natural speech from the server (OpenAI gpt-4o-mini-tts).
  // Backup: the browser's own voice, tuned to sound calm and natural.
  // Either way the words are exactly the reply shown in the chat.
  const talking = on => { bot.setTalking(on); avatar.setTalking(on); };
  let audio = null;
  let serverVoiceFailed = false;
  let speakId = 0;

  let voice = null;
  function chooseVoice() {
    const voices = speechSynthesis.getVoices().filter(v => v.lang && v.lang.startsWith('en'));
    // the most natural voices usually available in Chrome on Mac and Windows
    const preferred = [/Samantha/i, /\bAva\b/i, /Google US English/i, /Microsoft (Aria|Jenny|Ana)/i, /Karen/i, /Moira/i, /Daniel/i];
    voice = preferred.map(re => voices.find(v => re.test(v.name))).find(Boolean) || voices.find(v => v.lang === 'en-US') || voices[0] || null;
  }
  if ('speechSynthesis' in window) {
    chooseVoice();
    speechSynthesis.addEventListener?.('voiceschanged', chooseVoice);
  }

  function stopSpeaking() {
    speakId++;
    if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    talking(false);
  }

  const cleanForSpeech = text => text.replace(/[*_#`>]/g, '').replace(/\p{Extended_Pictographic}/gu, '').trim();

  async function speak(text) {
    if (!soundOn) return;
    stopSpeaking();
    const id = speakId;
    const clean = cleanForSpeech(text);
    if (!clean) return;
    if (serverVoice && !serverVoiceFailed) {
      try {
        const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: clean }) });
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const blob = await res.blob();
        if (id !== speakId || !soundOn) return;            // something newer started, or sound was muted
        audio = new Audio(URL.createObjectURL(blob));
        audio.onplaying = () => talking(true);
        audio.onended = audio.onpause = () => talking(false);
        await audio.play();
        return;
      } catch (err) {
        if (id !== speakId) return;
        console.warn('Natural voice unavailable, using the browser voice instead:', err.message);
        serverVoiceFailed = true;                          // don't keep retrying this session
      }
    }
    browserSpeak(clean);
  }

  function browserSpeak(clean) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(clean);
    if (voice) u.voice = voice;
    u.rate = 0.95;           // calm and clear for 10-year-olds
    u.pitch = 1.08;          // a touch brighter, not cartoonish
    u.onstart = () => talking(true);
    u.onend = u.onerror = () => talking(false);
    speechSynthesis.speak(u);
  }

  // ---------------------------------------------------------- voice input
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false, interimEl = null;
  if (!Recognition) {
    mic.disabled = true;
    mic.title = 'Voice input needs Chrome or Edge';
  } else {
    rec = new Recognition();
    rec.lang = 'en-US';
    rec.interimResults = true;     // show words as they are recognised
    rec.continuous = false;
    rec.onresult = e => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      if (interim) {
        if (!interimEl) interimEl = add('user', '', 'interim voice');
        interimEl.textContent = interim;
        log.scrollTop = log.scrollHeight;
      }
      if (final) {
        interimEl?.remove(); interimEl = null;
        ask(final, true);
      }
    };
    rec.onerror = e => {
      interimEl?.remove(); interimEl = null;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') add('bot', 'I need permission to use the microphone. Click the lock icon in the address bar and allow it, then try again!');
      else if (e.error === 'no-speech') add('bot', "I didn't hear anything. Press the microphone and try again!");
    };
    rec.onend = () => { listening = false; mic.classList.remove('listening'); };
    mic.addEventListener('click', () => {
      if (listening) { rec.stop(); return; }
      stopSpeaking();
      try { rec.start(); listening = true; mic.classList.add('listening'); } catch { /* already started */ }
    });
  }

  // ---------------------------------------------------------- open / close
  function open() {
    panel.hidden = false;
    if (!greeted) {
      greeted = true;
      const hello = "Beep! Hi, I'm Doodlebot. Ask me how I sense, map or plan, by typing or pressing the microphone!";
      add('bot', hello);
      speak(hello);
    }
    input.focus();
  }
  function close() {
    panel.hidden = true;
    rec?.abort?.();
    stopSpeaking();
  }
  $('#chat-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

  return { open, close, ask, get mode() { return mode; } };
}