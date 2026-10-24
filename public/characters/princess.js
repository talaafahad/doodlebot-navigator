// Princess-Bot — deliberately a different silhouette from Doodlebot:
// tall egg body (not boxy), hovers (no tracks), crown, plum visor (not a teal screen), pink/lavender palette.
//   const pb = createPrincessBot(el); pb.setMood('lost' | 'rescued');

const NAVY = '#1E2A5A';

function sparkle(cx, cy, r, cls = '') {
  const t = r * 0.28;
  return `<path class="pb-sparkle ${cls}" d="M${cx} ${cy - r} Q${cx + t} ${cy - t} ${cx + r} ${cy} Q${cx + t} ${cy + t} ${cx} ${cy + r} Q${cx - t} ${cy + t} ${cx - r} ${cy} Q${cx - t} ${cy - t} ${cx} ${cy - r}Z" fill="#FFD54A" stroke="${NAVY}" stroke-width="2.5"/>`;
}

function smallHeart(x, y, s, cls) {
  // wrapper <g> carries the CSS animation so it doesn't override the positioning transform
  return `<g class="${cls}"><path transform="translate(${x} ${y}) scale(${s})" d="M0 10 C-14 2 -11 -9 -4 -8 C-1 -8 0 -5 0 -4 C0 -5 1 -8 4 -8 C11 -9 14 2 0 10Z" fill="#FF6FA8" stroke="${NAVY}" stroke-width="${2.5 / s}"/></g>`;
}

const FACES = {
  lost: `
    <path d="M118 150 Q128 144 140 148" fill="none" stroke="#FFC6E3" stroke-width="4" stroke-linecap="round"/>
    <path d="M160 148 Q172 144 182 150" fill="none" stroke="#FFC6E3" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="129" cy="170" rx="12" ry="15" fill="#FFE3F2"/><circle cx="125" cy="164" r="6" fill="${NAVY}"/><circle cx="123" cy="162" r="2.2" fill="#fff"/>
    <ellipse cx="171" cy="170" rx="12" ry="15" fill="#FFE3F2"/><circle cx="167" cy="164" r="6" fill="${NAVY}"/><circle cx="165" cy="162" r="2.2" fill="#fff"/>
    <path d="M114 160 l-6 -4 M116 168 l-7 0" stroke="#FFC6E3" stroke-width="3" stroke-linecap="round"/>
    <path d="M186 160 l6 -4 M184 168 l7 0" stroke="#FFC6E3" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="150" cy="195" rx="6" ry="7" fill="#FFC6E3"/>`,
  rescued: `
    <path d="M116 174 Q129 156 142 174" fill="none" stroke="#FFE3F2" stroke-width="6" stroke-linecap="round"/>
    <path d="M158 174 Q171 156 184 174" fill="none" stroke="#FFE3F2" stroke-width="6" stroke-linecap="round"/>
    <path d="M110 162 l-6 -5 M184 162 l6 -5" stroke="#FFC6E3" stroke-width="3" stroke-linecap="round"/>
    <path d="M136 188 Q150 204 164 188" fill="none" stroke="#FFE3F2" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="112" cy="190" rx="8" ry="5" fill="#FF8FC4" opacity=".8"/><ellipse cx="188" cy="190" rx="8" ry="5" fill="#FF8FC4" opacity=".8"/>`,
};

function svgMarkup() {
  return `
<svg class="pb-svg" viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Princess-Bot">
  <defs>
    <linearGradient id="pb-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC4E1"/><stop offset="1" stop-color="#EE6FB0"/></linearGradient>
    <linearGradient id="pb-visor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A3C95"/><stop offset="1" stop-color="#3E2160"/></linearGradient>
    <linearGradient id="pb-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE07A"/><stop offset="1" stop-color="#F5B82E"/></linearGradient>
    <radialGradient id="pb-glow"><stop offset="0" stop-color="#E9B8FF" stop-opacity=".9"/><stop offset="1" stop-color="#E9B8FF" stop-opacity="0"/></radialGradient>
  </defs>

  <ellipse cx="150" cy="402" rx="70" ry="10" fill="#E6D3FA"/>
  <g class="pb-float">
    <ellipse cx="150" cy="372" rx="78" ry="26" fill="url(#pb-glow)"/>
    <ellipse cx="150" cy="352" rx="58" ry="15" fill="#C8B3F5" stroke="${NAVY}" stroke-width="5"/>
    <ellipse cx="150" cy="349" rx="34" ry="7" fill="#EDE3FF"/>

    <!-- little arms -->
    <ellipse cx="62" cy="252" rx="16" ry="26" transform="rotate(20 62 252)" fill="url(#pb-body)" stroke="${NAVY}" stroke-width="5"/>
    <ellipse cx="238" cy="252" rx="16" ry="26" transform="rotate(-20 238 252)" fill="url(#pb-body)" stroke="${NAVY}" stroke-width="5"/>

    <!-- egg body -->
    <path d="M150 84 C228 84 246 206 242 254 C238 312 200 338 150 338 C100 338 62 312 58 254 C54 206 72 84 150 84Z" fill="url(#pb-body)" stroke="${NAVY}" stroke-width="6"/>
    <path d="M86 132 Q96 104 122 96" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".6"/>
    <path d="M70 262 Q150 296 230 262" fill="none" stroke="#C94F93" stroke-width="5" stroke-linecap="round" opacity=".7"/>
    ${smallHeart(150, 286, 1.4, 'pb-gem')}

    <!-- visor face -->
    <rect x="92" y="126" width="116" height="98" rx="46" fill="url(#pb-visor)" stroke="${NAVY}" stroke-width="5"/>
    <path d="M106 150 Q112 136 128 134" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    <g class="pb-face pb-face-lost">${FACES.lost}</g>
    <g class="pb-face pb-face-rescued">${FACES.rescued}</g>

    <!-- crown -->
    <path d="M108 92 L114 48 L132 70 L150 36 L168 70 L186 48 L192 92 Q150 104 108 92Z" fill="url(#pb-gold)" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="114" cy="46" r="6" fill="#FF6FA8" stroke="${NAVY}" stroke-width="3"/>
    <circle cx="150" cy="34" r="7" fill="#7FF3F0" stroke="${NAVY}" stroke-width="3"/>
    <circle cx="186" cy="46" r="6" fill="#FF6FA8" stroke="${NAVY}" stroke-width="3"/>

    ${sparkle(44, 120, 12, 's1')}${sparkle(258, 96, 10, 's2')}${sparkle(262, 196, 7, 's3')}
    ${smallHeart(56, 66, 1.1, 'pb-heart h1')}${smallHeart(246, 46, 0.9, 'pb-heart h2')}
  </g>
</svg>`;
}

export function createPrincessBot(container, { mood = 'lost' } = {}) {
  const root = document.createElement('div');
  root.className = 'princessbot';
  root.innerHTML = svgMarkup();
  container.appendChild(root);
  const uid = 'pb' + Math.random().toString(36).slice(2, 8);
  root.querySelectorAll('[id^="pb-"]').forEach(el => {
    const old = el.id;
    el.id = `${uid}-${old}`;
    root.querySelectorAll(`[fill="url(#${old})"]`).forEach(n => n.setAttribute('fill', `url(#${uid}-${old})`));
  });
  const api = {
    el: root,
    setMood(m) { root.dataset.mood = m === 'rescued' ? 'rescued' : 'lost'; },
    destroy() { root.remove(); },
  };
  api.setMood(mood);
  return api;
}
