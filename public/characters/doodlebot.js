// Doodlebot character — one layered SVG, every emotion drawn on its screens.
// Usage:
//   const bot = createDoodlebot(document.querySelector('#bot'));
//   bot.setEmotion('curious');   // idle | curious | thinking | excited | happy | sad
//   bot.lookAt(1, 0);            // eyes follow the direction of travel (curious / idle)
//   bot.setTalking(true);        // mouth moves while TTS is speaking

export const EMOTIONS = ['idle', 'curious', 'thinking', 'excited', 'happy', 'sad'];

const NAVY = '#1E2A5A';
const BLUE = 'url(#db-blue)';
const GLOW = '#7FF3F0';

// ---------- reusable parts ----------
function roundEye(cx, cy) {
  return `
  <g class="eye-wrap">
    <g class="pupil">
      <ellipse cx="${cx}" cy="${cy}" rx="20" ry="24" fill="${NAVY}"/>
      <ellipse cx="${cx + 2}" cy="${cy + 12}" rx="13" ry="7" fill="#9B6BE0"/>
      <circle cx="${cx - 7}" cy="${cy - 9}" r="7" fill="#fff"/>
      <circle cx="${cx + 7}" cy="${cy + 6}" r="3.5" fill="#fff"/>
    </g>
  </g>`;
}

function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.48;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="#FFD54A" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>`;
}

function sparkle(cx, cy, r, fill = '#FFD54A') {
  const s = r, t = r * 0.28;
  return `<path d="M${cx} ${cy - s} Q${cx + t} ${cy - t} ${cx + s} ${cy} Q${cx + t} ${cy + t} ${cx} ${cy + s} Q${cx - t} ${cy + t} ${cx - s} ${cy} Q${cx - t} ${cy - t} ${cx} ${cy - s}Z" fill="${fill}"/>`;
}

const HEART = 'M200 318 C170 300 176 278 192 280 C198 281 200 286 200 288 C200 286 202 281 208 280 C224 278 230 300 200 318Z';

function arm(side) {
  // drawn hanging straight down from the shoulder at (0,0); rotated by CSS
  const thumbX = side === 'l' ? 15 : -15;   // thumb stays inside the hand's width, so the shoulder is the fill-box centre
  return `
  <g class="arm arm-${side}">
    <rect x="-12" y="10" width="24" height="56" rx="10" fill="#E9ECF6" stroke="${NAVY}" stroke-width="5"/>
    <line x1="-9" y1="28" x2="9" y2="28" stroke="#9AA3C0" stroke-width="4" stroke-linecap="round"/>
    <line x1="-9" y1="44" x2="9" y2="44" stroke="#9AA3C0" stroke-width="4" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="19" fill="${BLUE}" stroke="${NAVY}" stroke-width="5"/>
    <ellipse cx="${thumbX}" cy="78" rx="9" ry="13" fill="${BLUE}" stroke="${NAVY}" stroke-width="5"/>
    <ellipse cx="0" cy="92" rx="24" ry="26" fill="${BLUE}" stroke="${NAVY}" stroke-width="5"/>
    <ellipse cx="-8" cy="82" rx="7" ry="5" fill="#fff" opacity=".45"/>
  </g>`;
}

function track(x, rimX) {
  return `
  <g>
    <rect x="${x}" y="318" width="74" height="112" rx="30" fill="#4A4F63" stroke="${NAVY}" stroke-width="6"/>
    ${[342, 364, 386, 408].map(y => `<line x1="${x + 8}" y1="${y}" x2="${x + 66}" y2="${y}" stroke="#2E3245" stroke-width="4" stroke-linecap="round"/>`).join('')}
    <ellipse cx="${rimX}" cy="374" rx="20" ry="46" fill="${BLUE}" stroke="${NAVY}" stroke-width="6"/>
    <ellipse cx="${rimX}" cy="374" rx="9" ry="28" fill="#E9ECF6" stroke="${NAVY}" stroke-width="4"/>
  </g>`;
}

// ---------- faces (drawn on the teal screen, centre ≈ 200,132) ----------
const BLUSH = `<ellipse cx="128" cy="162" rx="12" ry="7" fill="#FF8FB1" opacity=".75"/>
               <ellipse cx="272" cy="162" rx="12" ry="7" fill="#FF8FB1" opacity=".75"/>`;

const FACES = {
  idle: `
    ${roundEye(160, 126)}${roundEye(240, 126)}
    <path class="mouth" d="M184 166 Q200 180 216 166" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>`,

  curious: `
    <path d="M140 94 Q160 82 182 92" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>
    <path d="M222 100 Q240 96 260 102" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>
    ${roundEye(160, 126)}${roundEye(240, 126)}
    <g class="mouth">
      <ellipse cx="200" cy="172" rx="9" ry="11" fill="${NAVY}"/>
      <ellipse cx="200" cy="177" rx="5" ry="4" fill="#FF7A9A"/>
    </g>`,

  thinking: `
    <path d="M140 100 Q160 92 180 98" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>
    <path d="M220 92 Q242 86 262 96" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>
    ${roundEye(160, 126)}${roundEye(240, 126)}
    <path class="mouth" d="M188 172 Q196 165 204 172 T220 170" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>`,

  excited: `
    ${star(160, 124, 27)}${star(240, 124, 27)}
    <circle cx="152" cy="114" r="4" fill="#fff"/><circle cx="232" cy="114" r="4" fill="#fff"/>
    ${BLUSH}
    <g class="mouth">
      <path d="M170 156 Q200 200 230 156 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M186 176 Q200 190 214 176 Q200 168 186 176Z" fill="#FF7A9A"/>
    </g>`,

  happy: `
    <path d="M138 134 Q160 104 182 134" fill="none" stroke="${NAVY}" stroke-width="8" stroke-linecap="round"/>
    <path d="M218 134 Q240 104 262 134" fill="none" stroke="${NAVY}" stroke-width="8" stroke-linecap="round"/>
    ${BLUSH}
    <g class="mouth">
      <path d="M174 154 Q200 190 226 154 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M188 172 Q200 184 212 172 Q200 166 188 172Z" fill="#FF7A9A"/>
    </g>`,

  sad: `
    <path d="M140 102 Q158 96 178 86" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>
    <path d="M222 86 Q242 96 260 102" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>
    ${roundEye(160, 128)}${roundEye(240, 128)}
    <path class="tear tear-1" d="M146 146 Q134 166 146 174 Q158 166 146 146Z" fill="#7CC8FF" stroke="${NAVY}" stroke-width="3"/>
    <path class="tear tear-2" d="M254 146 Q242 166 254 174 Q266 166 254 146Z" fill="#7CC8FF" stroke="${NAVY}" stroke-width="3"/>
    <path class="mouth" d="M184 178 Q200 162 216 178" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>`,
};

// ---------- chest screen (centre ≈ 200,300) ----------
const CHEST = {
  idle: `<polyline points="160,300 180,300 188,286 198,314 206,292 214,300 240,300" fill="none" stroke="${GLOW}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  curious: `<text x="200" y="317" text-anchor="middle" font-family="Trebuchet MS, Arial Rounded MT Bold, sans-serif" font-weight="900" font-size="48" fill="${GLOW}">?</text>`,
  thinking: `<g class="dots"><circle cx="178" cy="300" r="7" fill="${GLOW}"/><circle cx="200" cy="300" r="7" fill="${GLOW}"/><circle cx="222" cy="300" r="7" fill="${GLOW}"/></g>`,
  excited: `${sparkle(200, 298, 20)}${sparkle(172, 284, 9, GLOW)}${sparkle(230, 316, 8, GLOW)}`,
  happy: `<path d="${HEART}" fill="${GLOW}"/>
          <g stroke="${GLOW}" stroke-width="3.5" stroke-linecap="round"><line x1="164" y1="290" x2="174" y2="294"/><line x1="164" y1="308" x2="174" y2="304"/><line x1="236" y1="290" x2="226" y2="294"/><line x1="236" y1="308" x2="226" y2="304"/></g>`,
  sad: `<path d="${HEART}" fill="#FF8FA3"/>
        <polyline points="200,284 193,296 205,304 196,318" fill="none" stroke="#2B57B8" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`,
};

function svgMarkup() {
  return `
<svg class="db-svg" viewBox="0 0 400 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Doodlebot">
  <defs>
    <linearGradient id="db-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F6FC"/><stop offset="1" stop-color="#C9CFE2"/></linearGradient>
    <linearGradient id="db-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9BF7"/><stop offset="1" stop-color="#2F67D6"/></linearGradient>
    <linearGradient id="db-screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FE9E6"/><stop offset="1" stop-color="#5ACDCB"/></linearGradient>
    <linearGradient id="db-chest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A6CD6"/><stop offset="1" stop-color="#244FA8"/></linearGradient>
  </defs>

  <ellipse class="db-shadow" cx="200" cy="440" rx="125" ry="13" fill="#C9CFF5"/>

  <g class="db-bob">
    ${track(72, 92)}
    ${track(254, 308)}

    <!-- body -->
    <rect x="118" y="236" width="164" height="158" rx="40" fill="url(#db-body)" stroke="${NAVY}" stroke-width="6"/>
    <path d="M124 350 Q200 378 276 350 L276 356 Q274 388 240 391 L160 391 Q126 388 124 356Z" fill="#B7BDD3" opacity=".55"/>
    <rect x="134" y="246" width="44" height="9" rx="4.5" fill="#fff" opacity=".7"/>
    <rect x="150" y="262" width="100" height="74" rx="14" fill="url(#db-chest)" stroke="${NAVY}" stroke-width="5"/>
    <g class="chest-layer">
      ${EMOTIONS.map(e => `<g class="chest chest-${e}">${CHEST[e]}</g>`).join('')}
    </g>

    <!-- neck -->
    <rect x="184" y="212" width="32" height="30" rx="6" fill="#C3C8DB" stroke="${NAVY}" stroke-width="5"/>

    <!-- head -->
    <g class="db-head">
      <line x1="200" y1="48" x2="200" y2="22" stroke="${NAVY}" stroke-width="6" stroke-linecap="round"/>
      <circle class="db-light" cx="200" cy="16" r="11" stroke="${NAVY}" stroke-width="5"/>
      <circle cx="86" cy="130" r="28" fill="${BLUE}" stroke="${NAVY}" stroke-width="6"/>
      <circle cx="314" cy="130" r="28" fill="${BLUE}" stroke="${NAVY}" stroke-width="6"/>
      <rect x="92" y="46" width="216" height="172" rx="40" fill="url(#db-body)" stroke="${NAVY}" stroke-width="6"/>
      <rect x="110" y="64" width="180" height="136" rx="26" fill="url(#db-screen)" stroke="${NAVY}" stroke-width="5"/>
      <path d="M126 80 Q128 72 138 72 L170 72 Q160 76 152 84 L132 108 Q124 112 124 102Z" fill="#fff" opacity=".35"/>
      <g class="face-layer">
        ${EMOTIONS.map(e => `<g class="face face-${e}">${FACES[e]}</g>`).join('')}
        <g class="talk-mouth">
          <ellipse class="talk-shape" cx="200" cy="172" rx="14" ry="11" fill="${NAVY}"/>
          <ellipse class="talk-shape" cx="200" cy="178" rx="7" ry="4" fill="#FF7A9A"/>
        </g>
      </g>
    </g>

    <!-- arms (in front of the body) -->
    <g transform="translate(118 272)">${arm('l')}</g>
    <g transform="translate(282 272)">${arm('r')}</g>
  </g>
</svg>`;
}

export function createDoodlebot(container, { emotion = 'idle' } = {}) {
  const root = document.createElement('div');
  root.className = 'doodlebot';
  root.innerHTML = svgMarkup();
  container.appendChild(root);

  // Gradient ids must be unique per page when several bots are mounted.
  const uid = 'db' + Math.random().toString(36).slice(2, 8);
  root.querySelectorAll('[id^="db-"]').forEach(el => {
    const old = el.id;
    el.id = `${uid}-${old}`;
    root.querySelectorAll(`[fill="url(#${old})"]`).forEach(n => n.setAttribute('fill', `url(#${uid}-${old})`));
  });

  const api = {
    el: root,
    setEmotion(name) {
      if (!EMOTIONS.includes(name)) throw new Error(`Unknown emotion: ${name}`);
      root.dataset.emotion = name;
    },
    getEmotion() { return root.dataset.emotion; },
    setTalking(on) { root.classList.toggle('is-talking', !!on); },
    // dx, dy in grid units (e.g. 1,0 = moving right). Eyes shift up to 7px.
    lookAt(dx = 0, dy = 0) {
      const len = Math.hypot(dx, dy) || 1;
      root.style.setProperty('--look-x', `${(dx / len) * 7}px`);
      root.style.setProperty('--look-y', `${(dy / len) * 6}px`);
    },
    destroy() { root.remove(); },
  };
  api.setEmotion(emotion);
  return api;
}
