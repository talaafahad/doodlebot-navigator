// Which game event shows which emotion, plus the speech-bubble lines.
// The lines are DRAFTS — rewrite them in Doodlebot's (your) own voice.

export const EVENT_TO_EMOTION = {
  editing: 'idle',              // student is building the maze
  exploreStep: 'curious',       // moving toward the nearest unknown area
  princessSensed: 'excited',    // Princess-Bot entered the sensor range
  explorationDone: 'thinking',  // map complete, driving home
  planning: 'thinking',         // path planner is searching
  pathFound: 'happy',           // a shortest path exists on the finished map
  rescued: 'excited',           // Doodlebot actually reached Princess-Bot (celebration)
  noPath: 'sad',                // planner proved there is no path
};

// Higher = more important. An important emotion is shown immediately and can't
// be replaced by a less important one until it has been on screen long enough.
export const PRIORITY = { idle: 0, curious: 1, thinking: 2, happy: 3, excited: 3, sad: 4 };

export const LINES = {
  idle:           ['Build me a maze! I\'m ready to explore.', 'Where do you think Princess-Bot is hiding?'],
  exploreStep:    ['Hmm… what\'s over there?', 'My sensors want to see that dark corner!', 'New cells! Adding them to my map.'],
  princessSensed: ['I SEE HER! Princess-Bot is on my map!', 'There she is! Hang on, Princess-Bot!'],
  explorationDone:['My map is finished! Driving back to my start…'],
  planning:       ['Now I plan the shortest way on my map…', 'Checking routes… hmm…'],
  pathFound:      ['I found the shortest path! Here I come!'],
  rescued:        ['We made it! Princess-Bot is safe!', 'Rescue complete! High five!'],
  noPath:         ['Every way is blocked… I can\'t reach her. Can you open a path for me?'],
  notFound:       ['I explored everywhere I could reach… but I never saw Princess-Bot. Is she walled in?'],
};

export function lineFor(key) {
  const options = LINES[key] || LINES.idle;
  return options[Math.floor(Math.random() * options.length)];
}

// Keeps each emotion on screen long enough for a 10-year-old to notice it,
// without ever letting a routine emotion hide an important one:
//  - a MORE important emotion is shown immediately;
//  - an equal or less important one waits until the current one has been
//    visible for minHoldMs;
//  - while waiting, a pending emotion can only be replaced by one at least as
//    important (so "curious" can never cancel a queued "excited").
export function createEmotionController(bot, { minHoldMs = 1200, onChange } = {}) {
  let lastChange = -Infinity;
  let pending = null;
  let timer = null;
  const now = () => performance.now();
  const prio = e => PRIORITY[e] ?? 0;

  function apply(emotion) {
    clearTimeout(timer); timer = null; pending = null;
    if (bot.getEmotion() !== emotion) bot.setEmotion(emotion);
    lastChange = now();
    onChange?.(emotion);
  }

  return {
    request(emotion) {
      const current = bot.getEmotion();
      if (emotion === current && !pending) return;
      const elapsed = now() - lastChange;
      if (prio(emotion) > prio(current) || elapsed >= minHoldMs) {
        if (!pending || prio(emotion) >= prio(pending)) return apply(emotion);
      }
      if (pending && prio(emotion) < prio(pending)) return;   // never downgrade a queued emotion
      pending = emotion;
      if (!timer) {
        timer = setTimeout(() => { timer = null; if (pending) apply(pending); }, Math.max(0, minHoldMs - elapsed));
      }
    },
    event(name) { this.request(EVENT_TO_EMOTION[name] ?? 'idle'); },
    // Terminal results and resets bypass the hold.
    force(emotion) { apply(emotion); },
    reset() { clearTimeout(timer); timer = null; pending = null; lastChange = -Infinity; bot.setEmotion('idle'); },
  };
}
