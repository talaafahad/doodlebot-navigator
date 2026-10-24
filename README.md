# Doodlebot – The Lost Kingdom

A web game for Grade 5 that teaches **autonomous navigation**. Students build a maze, then watch Doodlebot, a 2D social robot, **sense** its surroundings, **map** an unknown world, and **plan** the shortest path to rescue Princess-Bot. Students change the sensor range, run experiments on the same maze and compare the results side by side.

## Run it locally

Requirements: **Node.js 18 or newer** and **Google Chrome** (or Edge) for voice input.

```bash
cd doodlebot-navigator
npm start
```

Open **http://localhost:3000** in Chrome. There are no packages to install: the server uses only Node's built-in modules.

### Doodlebot's chat and voice (optional API key)

The game and the chat work without any key: Doodlebot answers from an offline script about sensing, maps and paths. For free-form answers from a language model:

1. Copy `.env.example` to `.env`.
2. Fill in **one** key: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (any OpenAI-compatible endpoint works via `OPENAI_BASE_URL`).
3. Restart `npm start`. The terminal prints the chat mode and the voice in use.

The key is only read by the local server. It never reaches the browser, and `.env` is git-ignored. Never share or submit your `.env` file.

**Doodlebot's voice:** with an OpenAI key, replies are spoken by OpenAI's `gpt-4o-mini-tts` model (voice `coral`, with instructions to sound like a cheerful, gentle robot friend for a 10-year-old). If the key can't use the speech model, or the network fails, Doodlebot switches automatically to the browser's own voice (the most natural English voice installed, rate 0.95, pitch 1.08) for the rest of the session. Change the voice with `OPENAI_TTS_VOICE` (`coral`, `nova`, `shimmer` or `sage`), or always use the browser voice with `DOODLEBOT_VOICE=browser`. Either way, Doodlebot speaks exactly the words shown in the chat, and its mouth moves only while it is speaking.

**Voice input:** click 🎤 and allow microphone access. Speech is transcribed live and shown in the chat. Common mishearings ("do boys" → Doodlebot, "mouth" → maze) are corrected before the question is sent. Speech recognition uses the browser's Web Speech API, which works in Chrome and Edge (not Firefox). Each reply is tagged **AI** or **OFFLINE** so you can see which one answered.

### Tests

```bash
npm test
```

11 automated tests check the parts that are easy to get subtly wrong:
- the frontier is chosen by path distance, not straight-line distance;
- exploration stops only when no reachable unknown cell is left;
- A\* and BFS both return a true shortest path on 60 random mazes;
- A\* never searches more cells than BFS;
- the odd mazes (enclosed start, walled-in Princess-Bot, empty grid, Princess-Bot next to the start);
- the editor rules;
- random mazes are always solvable.

## How to play

**Welcome → How Doodlebot Thinks → Game.**

- **Welcome page:** castle artwork, Doodlebot and Princess-Bot, and a **Start Adventure!** button.
- **Tutorial:** first-time players see a four-step animated tutorial: *Look Around*, *Explore the Unknown*, *Think and Plan*, and *Rescue or Try Again*, which includes a "What if the path is blocked?" example. Students move through it at their own pace with Next, Back, Replay animation and Skip for now. Each step's explanations stack up so slower readers never lose one.
- **The tutorial shows only real behaviour.** Every animation replays frames recorded from the real game code (`runMission`, real sensing, real nearest-frontier exploration, real BFS) on small practice mazes. It never shows anything the game wouldn't do, and it never touches the student's own maze or results.
- **Returning players** are remembered in the browser and go straight to the game, with the tutorial one click away.
- **🏠 Home** returns to the welcome page without resetting anything. A running mission pauses, and **Continue Adventure!** brings the student back exactly where they were. The browser's back and forward buttons also work.

The game itself guides students through three stages, shown at the top of the page:

1. **Build.** The real-world map fills the centre. Open **Build Tools**, pick a tool (wall, obstacle, Doodlebot, Princess-Bot, eraser) and click a cell. Hold and drag to draw walls and obstacles. Placing Doodlebot or Princess-Bot again moves it. Or pick one of the **Ready-made mazes**, or press 🎲 **Random maze** for a maze that always has a way through.
2. **Explore.** Press **Start Exploring**. The centre switches to *Doodlebot's map* (black = not sensed yet). Two live numbers show *steps to finish mapping* and *cells discovered*. **One step** moves one step at a time, and the main button pauses and continues.
3. **Results.** A results card shows the outcome, the sensor range, steps to finish mapping, the shortest path length, the cells searched for the path, and the step at which Princess-Bot was sensed. It also compares this run with the previous run on the same maze. **Try a different sensor range** opens Mission Settings for the next experiment.

**Mission Settings** holds:
- the sensor range, 1–5, with a small picture of the sensing circle;
- the speed: slow, normal or fast;
- under *Try another path-finding algorithm*, BFS (the default) or A\*.

**My Experiments** keeps every finished run as a card, asks *What changed?* once there are two runs, and has a full table of every number for the facilitator. The menus open and close independently.

The toggle above the maze switches between the real world, Doodlebot's map, or **both side by side**, at any time. The **Maze ID** next to it shows when two runs used the same maze. **What do the colours mean?** under the maze explains the overlays, and the **?** button opens a short how-to-play guide.

Click the floating Doodlebot (or Doodlebot on its own map) to chat. Suggested questions help students who don't know what to ask, and 🔊 turns Doodlebot's voice on or off for quiet classrooms.

## How Doodlebot navigates

| Stage | What happens |
|---|---|
| Start | Doodlebot knows only the grid size and its start cell, then senses once. |
| Sensing | Every step, every cell whose centre is within *range + 0.5* cells is copied from the real world onto Doodlebot's map (range 1 = the 3×3 square around it). The dashed circle shows the range, and newly sensed cells flash. The sensor sees through walls, because the brief says it senses *every* cell within range. |
| Exploring | BFS from Doodlebot over cells it **knows** are free. The first *frontier* cell it reaches (a known free cell next to an unknown cell) is the nearest unexplored area **by path distance on its own map**. Doodlebot moves one step toward it, senses, and replans. The orange ring marks the target. |
| Stopping | Exploration ends when BFS finds no reachable frontier, meaning no reachable unknown cell is left. Cells sealed off by walls stay black. |
| Finding Princess-Bot | She is found the moment her cell enters the sensor range. Doodlebot still finishes the whole map first, because an unsensed cell could be a gap in the walls. |
| Returning | Doodlebot drives back to its start along a shortest path on its finished map. |
| Planning | BFS (default) or A\* (Manhattan heuristic), on Doodlebot's map only: never on the real map, never through unknown cells. The yellow cells replay the planner's real expansion order, then the green line shows the path. |
| Rescue | Doodlebot follows the path to Princess-Bot. If there is no path, or she was never sensed, Doodlebot says so and is sad. |

Movement is 4-directional and every step costs 1, so the Manhattan heuristic never overestimates and A\* returns a shortest path. Ties are broken in a fixed order (up, right, down, left), so the same maze and settings always give the same run. That is what makes the experiments repeatable.

### Metrics

| Metric | Where | Meaning |
|---|---|---|
| Steps to finish mapping | Live and results | Moves until no reachable unknown cell was left |
| Cells discovered | Live | Cells on Doodlebot's map, out of 144 |
| Shortest path length | Results | Moves on the planned rescue path (or "no path") |
| Cells searched for the path | Results | Cells the planner took off its queue before reaching her |
| Sensed Princess-Bot at step | Results | Exploration step when she entered the sensor range |

**Reference experiment (Lesson maze, Maze ID 1X6Y, BFS):**

| | Sensor 1 | Sensor 4 |
|---|---|---|
| Steps to finish mapping | 78 | 29 |
| Shortest path length | 21 | 21 |
| Cells searched (BFS) | 74 | 74 |
| Sensed Princess-Bot at step | 24 | 15 |

A bigger sensor maps this maze in 49 fewer steps, but the shortest path is 21 both times, because the finished map is the same. With A\* the planner searches 28 cells instead of 74 for the same 21-step path.

### Odd mazes

| Case | Behaviour |
|---|---|
| No Doodlebot or no Princess-Bot | Run is blocked with a friendly message |
| Doodlebot boxed in | Exploration ends almost immediately; "never sensed" |
| Princess walled in | Sensed through the wall (range ≥ 2); the planner proves there is no path; Doodlebot is sad |
| Empty field | Explores everything and rescues her |
| Princess-Bot next to Doodlebot | Sensed at step 0, path length 1 |

*Doodlebot boxed in*, *Princess walled in* and *Empty field* are in **Build Tools → Ready-made mazes**, next to the *Lesson maze*.

## Optional items attempted

- [x] **Random solvable maze** (checked with BFS on the real map before it is shown)
- [x] **Animated planner search** (replays the planner's actual expansion order)
- [x] **Second path-planning algorithm** (BFS and A\*, selectable, compared by cells searched)
- [x] **Results panel** keeping previous runs side by side, with a Maze ID for fair comparisons
- [x] **All expressive states animated** (six states: idle, curious, thinking, excited, happy, sad, plus a talking mouth synced to speech)
- [x] **Story and tutorial:** a welcome page and an animated four-step "How Doodlebot Thinks" introduction
- [x] **Engagement elements:** Doodlebot narrates in a speech bubble, Princess-Bot has lost and rescued moods, a rescue celebration, a pencil-doodle exploring trail (Doodlebot is a drawing robot), and a natural speaking voice
- [x] **Doodlebot design files** (`public/characters/`, `design/`, see `CHARACTER_DESIGN.md`)
- [x] **Student worksheet** (curriculum materials)
- [ ] Tele-operated mode
- [ ] Movable obstacles, terrains, limited battery
- [ ] Deployed URL

## Doodlebot as a character

Every emotion is tied to a real game event and is shown three ways (face, chest screen icon and antenna colour), plus a line in the speech bubble.

| Event | Emotion |
|---|---|
| Building the maze | Idle |
| Exploring toward the nearest unknown area | Curious, eyes looking where it drives |
| Princess-Bot enters the sensor range | Excited |
| Map complete, planning | Thinking |
| Shortest path found | Happy |
| Princess-Bot reached | Excited celebration; Princess-Bot rescued |
| No path / never sensed | Sad; asks the student to open a path |

An emotion controller keeps each face on screen for at least 1.2 s and gives important emotions priority, so a fast run never flickers and a routine "curious" can never hide "excited" or "sad".

Princess-Bot has a different silhouette (a tall hovering egg with a crown) as well as different colours, so the two are distinct even in black and white.

The chat personality, answer rules and example answers live in **`prompts/doodlebot.md`**. The server reads that file on every message, so edits apply without a restart. The live game state (sensor range, current run, previous results) is sent with each message, so Doodlebot can answer about *this* maze with real numbers.

**Image credit:** Doodlebot's look is based on the "Cute robot rocking out" vector illustration from Magnific (Freepik), used as a style reference: https://www.magnific.com/premium-vector/cute-robot-rocking-out-cartoon-character-with-gesturing-hand_422239699.htm. ChatGPT was used to generate emotion variations; the in-game character is redrawn in SVG.

## Project structure

```
server.js                  local server: static files, /api/chat and /api/tts (keeps the key server-side)
.env.example               settings template: copy to .env and add your own key
prompts/doodlebot.md       Doodlebot's personality, answer rules, game facts and example answers
public/index.html          welcome page, tutorial and game
public/css/style.css       calm pastel theme, large targets, responsive, reduced-motion aware
public/assets/             welcome-page artwork
public/js/app.js           screen router: welcome, tutorial, game; Home without losing progress
public/js/tutorial.js      animated "How Doodlebot Thinks" tutorial (replays real simulation frames)
public/js/main.js          game controller, stages, emotions, metrics, experiments
public/js/algorithms.js    sensing, frontier search, BFS, A* (pure, tested)
public/js/simulation.js    the mission as a step-by-step generator
public/js/world.js         editor rules, random solvable mazes, ready-made mazes, Maze ID
public/js/render.js        canvas drawing of both maps
public/js/chat.js          chat UI, speech recognition, natural voice with browser fallback
public/js/offline-brain.js scripted answers when no API key is set
public/characters/         Doodlebot and Princess-Bot (SVG + CSS states, grid tokens, emotion controller)
design/                    character sheet, transparent PNG of every state, character preview page
CHARACTER_DESIGN.md        character design decisions and the event-to-emotion map
test/navigation.test.js    11 automated tests
```

## Curriculum materials

A 30-minute Grade 5 lesson built around one fair-test experiment: the Lesson maze (Maze ID 1X6Y) run with sensor range 1, then 4.

| File | What it is |
|---|---|
| `Doodlebot_Lesson_Plan` (.pdf / .docx) | 2-page facilitator lesson plan: objectives, timing, what to say and do, experiment, metrics, reflection questions, answer key, rubric, troubleshooting |
| `Doodlebot_Lesson_Slides.pptx` | 16 slides with speaker notes: warm-up (Mystery Map), concept and gameplay, wrap-up and reflection |
| `Doodlebot_Student_Worksheet` (.pdf / .docx) | 1-page printable worksheet: Predict, Test, Reflect |

## Interface and accessibility

- One large map at a time, matched to the stage. Secondary menus stay collapsed until needed, and there is one primary action button.
- Soft cream background with white cards and pastel accents, and dark navy text for contrast. Unknown cells on Doodlebot's map stay black.
- Every button, tab and option is at least 48px tall (chips 40px). Body text is 17px and helper text 16px.
- Keyboard: every control is a real button, option groups also move with the arrow keys, focus rings are visible, there is a *Skip to the maze* link, and Escape closes the chat.
- Animations (characters, confetti, microphone pulse) switch off under the system "reduce motion" setting.
- The layout adapts to desktop, tablet and phone widths.

## Known limitations

- Voice input needs Chrome or Edge and an internet connection (the browser sends audio to its speech service).
- The natural voice adds a short pause (about a second) before Doodlebot speaks, and each spoken reply is a small paid API call.
- "Go to the nearest unknown area" is a greedy rule, so a larger sensor range *usually*, but not *always*, means fewer mapping steps. On the Lesson maze, range 3 takes 54 steps, slightly more than range 2's 49. This is real behaviour of frontier exploration, not a bug.
- The fonts (Fredoka, Nunito) load from Google Fonts. Offline, the page falls back to a system font.
- On a small landscape tablet, the Start Exploring button sits just below the maze, so students scroll once to reach it.