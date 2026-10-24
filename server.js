// Zero-dependency local server: serves the game and proxies Doodlebot's chat
// to a language model, so the API key stays on this machine (never in the browser
// or the repository).
//
//   npm start            → http://localhost:3000
//
// Put a key in a .env file (see .env.example). With no key, Doodlebot answers
// from its offline script, so the game always works.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { offlineReply } from './public/js/offline-brain.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = resolve(ROOT, 'public');
const PROMPT_FILE = join(ROOT, 'prompts', 'doodlebot.md');

// ---- tiny .env loader
if (existsSync(join(ROOT, '.env'))) {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT) || 3000;
const PROVIDER = process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : 'offline';
// Natural speech needs an OpenAI key. Set DOODLEBOT_VOICE=browser to always use the browser voice.
const TTS = process.env.OPENAI_API_KEY && process.env.DOODLEBOT_VOICE !== 'browser' ? 'openai' : 'browser';
const TTS_INSTRUCTIONS = 'Speak like a cheerful, gentle animated robot friend helping a 10-year-old learn. '
  + 'Use a natural conversational voice, a slightly playful tone, clear pronunciation and short expressive pauses. '
  + 'Avoid mechanical or exaggerated robotic speech.';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.md': 'text/markdown; charset=utf-8',
};

// ---- language model calls
async function systemPrompt(gameState) {
  const persona = (await readFile(PROMPT_FILE, 'utf8')).replace(/<!--[\s\S]*?-->/g, '').trim();
  return `${persona}\n\n# Live game state (JSON, read-only — use it for questions about the current maze and runs)\n${JSON.stringify(gameState ?? {}, null, 1)}`;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 600) }));
  while (out.length && out[0].role !== 'user') out.shift();   // conversations must start with the user
  return out;
}

async function askAnthropic(system, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 220,
      temperature: 0.7,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
}

async function askOpenAI(system, messages) {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 220,
      temperature: 0.7,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function handleChat(body) {
  const messages = cleanMessages(body.messages);
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  if (PROVIDER === 'offline' || !messages.length) return { reply: offlineReply(lastUser, body.gameState), source: 'offline' };
  try {
    const system = await systemPrompt(body.gameState);
    const reply = PROVIDER === 'anthropic' ? await askAnthropic(system, messages) : await askOpenAI(system, messages);
    return { reply: reply || offlineReply(lastUser, body.gameState), source: PROVIDER };
  } catch (err) {
    console.error('[chat] model call failed, using offline reply:', err.message);
    return { reply: offlineReply(lastUser, body.gameState), source: 'offline' };
  }
}

// ---- natural speech: the same words as the chat reply, spoken by OpenAI's TTS model
async function speech(text) {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: process.env.OPENAI_TTS_VOICE || 'coral',
      input: text,
      instructions: TTS_INSTRUCTIONS,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---- HTTP
function readBody(req, limit = 64 * 1024) {
  return new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { fail(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health') return send(res, 200, { mode: PROVIDER, tts: TTS });
    if (url.pathname === '/api/tts' && req.method === 'POST') {
      if (TTS !== 'openai') return send(res, 404, { error: 'natural voice not configured' });
      const { text } = JSON.parse((await readBody(req)) || '{}');
      if (typeof text !== 'string' || !text.trim()) return send(res, 400, { error: 'no text' });
      try {
        return send(res, 200, await speech(text.slice(0, 800)), 'audio/mpeg');
      } catch (err) {
        console.error('[tts] natural voice failed, the browser voice will be used:', err.message);
        return send(res, 502, { error: 'tts failed' });
      }
    }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      return send(res, 200, await handleChat(body));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });

    // static files, never outside /public
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = resolve(PUBLIC, '.' + normalize(rel));
    if (file !== PUBLIC && !file.startsWith(PUBLIC + sep)) return send(res, 403, 'Forbidden', 'text/plain');
    const data = await readFile(file);
    return send(res, 200, data, MIME[extname(file).toLowerCase()] || 'application/octet-stream');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return send(res, 404, 'Not found', 'text/plain');
    console.error(err);
    return send(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Doodlebot is ready → http://localhost:${PORT}`);
  console.log(`  Chat mode: ${PROVIDER === 'offline' ? 'offline (no API key found — scripted answers)' : PROVIDER}`);
  console.log(`  Doodlebot's voice: ${TTS === 'openai' ? 'natural (OpenAI ' + (process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts') + ', ' + (process.env.OPENAI_TTS_VOICE || 'coral') + '), browser voice as backup' : 'browser voice'}\n`);
});