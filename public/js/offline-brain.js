// Doodlebot's offline answers, used when no API key is configured or the
// network fails, so the chat always works. Same personality and facts as
// prompts/doodlebot.md, written as short scripted replies.
// Shared by the server and the browser (no DOM, no Node-only APIs).

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function runSummary(s) {
  const m = s.currentRun;
  if (!m) return null;
  return m;
}

const INTENTS = [
  {
    test: /\b(keep|keeps|still|why).*(mov|explor|going|driv)\w*.*(block|wall|stuck|can'?t reach|reach)|\b(block|walled|wall).*(still|keep|why).*(mov|explor)/,
    reply: () => "I could sense Princess-Bot through the walls, but I can't be sure there's no secret gap until every square I can reach is on my map. When my map is finished, I plan, and if there's really no way in, I'll ask you to open a path!",
  },
  {
    test: /\b(hi|hello|hey|salam|who are you|your name|what are you)\b/,
    reply: () => pick([
      "Beep! Hi, I'm Doodlebot, a maze explorer with a heart on my chest. I'm on a mission to find Princess-Bot. Want to build me a maze?",
      "Hello, friend! I'm Doodlebot. I sense, I map, and I plan paths. Ask me anything about how I find Princess-Bot!",
    ]),
  },
  {
    test: /\b(compare|experiment|results?|difference|bigger sensor|larger|more range|why (did|does|is).*(fewer|less|faster|more|slower))\b/,
    reply: s => {
      const runs = (s.previousRuns || []).filter(r => r.outcome === 'rescued');
      if (runs.length >= 2) {
        const a = runs[runs.length - 2], b = runs[runs.length - 1];
        const same = a.path === b.path ? `my path was ${a.path} steps both times` : `my paths were ${a.path} and ${b.path} steps`;
        return `With sensor range ${a.range} I needed ${a.explore} steps to map, and with range ${b.range} I needed ${b.explore}. But ${same}, because the finished map was the same. A bigger sensor helps me learn the map faster!`;
      }
      return "Try the same maze twice: once with sensor range 1 and once with range 4. Watch the steps to finish mapping, and the path length. One changes and one doesn't. Can you guess which?";
    },
  },
  {
    test: /\bwhat (can|do) you see\b/,
    reply: s => {
      const m = s.currentRun;
      if (!m) return `Right now I only know my start square! When you press Start Exploring, I'll sense everything within ${s.sensorRange} cells of me, like shining a flashlight.`;
      const pct = Math.round((100 * m.cellsKnown) / 144);
      const her = m.princessSeenAtStep != null ? 'and I can sense Princess-Bot on my map!' : "but I haven't sensed Princess-Bot yet.";
      return `I've discovered ${m.cellsKnown} of the 144 cells so far, about ${pct} percent of the maze, ${her}`;
    },
  },
  {
    test: /\b(sensor|sense|sensing|range|see|circle|flashlight)\b/,
    reply: s => `My sensor is like a flashlight in a dark room: the dashed blue circle shows everything I can sense right now. My range is set to ${s.sensorRange}. Try changing it in the menu and see what happens to my steps!`,
  },
  {
    test: /\b(black|dark|unknown|my map|two maps|right map|left map|real|real world)\b/,
    reply: () => "The Real world view is the maze you built. Doodlebot's map is MY map: black squares are places I haven't sensed yet. Every step, I turn some black into map!",
  },
  {
    test: /\b(explor\w*|frontier|nearest|where are you going|orange|next|choose|chose|decide|which way|that way|direction|go there|went)\b/,
    reply: () => "I always drive to the nearest unknown spot, counting the steps it really takes on my map, not a straight line through walls. The orange circle shows where I'm heading. When no unknown spot is left that I can reach, my map is done!",
  },
  {
    test: /\b(a\*|a star|astar|bfs|breadth|algorithm|search|yellow)\b/,
    reply: () => "BFS searches outward in rings, like ripples in a pond. A star uses a guess of how far Princess-Bot is, so it usually searches fewer cells. Both find a shortest path! Try switching the planner and compare the cells searched.",
  },
  {
    test: /\b(path|plan|shortest|route|green)\b/,
    reply: s => {
      const m = runSummary(s);
      if (m && m.pathLength != null) return `When my map is finished, I go back to my start and plan the shortest path on my own map. This time it is ${m.pathLength} steps long, the green line!`;
      return "When my map is finished, I drive back to my start and plan the shortest path to Princess-Bot on my own map. Press Run and watch for the green line!";
    },
  },
  {
    test: /\b(steps?|how many|how long|numbers?|metrics?|score)\b/,
    reply: s => {
      const m = runSummary(s);
      if (!m) return "I haven't explored yet! Press Run and my mission numbers will appear on the right.";
      const seen = m.princessSeenAtStep != null ? `I sensed Princess-Bot at step ${m.princessSeenAtStep}` : "I haven't sensed Princess-Bot yet";
      return `So far I took ${m.explorationSteps} steps to explore, and ${seen}. Check the mission numbers on the right!`;
    },
  },
  {
    test: /\b(stuck|blocked|can'?t|cannot|no path|sad|walled|why.*(cry|sad))\b/,
    reply: () => "If walls block every route, I can't reach Princess-Bot, and that makes me sad. Can you open a gap in the walls for me? Then press Run again!",
  },
  {
    test: /\b(princess|rescue|find her|where is she)\b/,
    reply: () => "I find Princess-Bot the moment she is inside my sensor circle. Then I finish my map, go back to my start, and plan the shortest way to rescue her!",
  },
  {
    test: /\b(wall|obstacle|rock|crate|box)\b/,
    reply: () => "Walls are the dark blocks and obstacles are the round grey rocks. Both block my tracks, so I have to drive around them!",
  },
  {
    test: /\b(ai|artificial|intelligen|smart|robot|think)\b/,
    reply: () => "I'm an AI because I sense the world, build my own map and make decisions by myself. Nobody tells me each move. Pretty cool, right?",
  },
  {
    test: /\b(thank|thanks|cool|awesome|great|love)\b/,
    reply: () => pick(["Beep! You're awesome too! Want to try a tricky maze?", "Thank you! Exploring with you is my favorite thing."]),
  },
];

export function offlineReply(message, gameState = {}) {
  const text = (message || '').toLowerCase();
  for (const intent of INTENTS) if (intent.test.test(text)) return intent.reply(gameState);
  return "Hmm, that's outside my maze! I'm best at questions about sensing, my map, exploring and paths. Try asking: how do you choose where to go?";
}
