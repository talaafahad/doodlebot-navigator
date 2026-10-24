# Doodlebot & Princess-Bot: character design

## What changed from the reference images

| Reference image | What we kept | What we changed and why |
|---|---|---|
| All three | Screen-face robot, blue + teal + light-grey palette, tracks, chest screen | Redrawn as **one layered SVG** made in code, so every face is drawn on the screen and the body never jumps between poses. Transparent background. |
| Image 1 (hand on chin) | The pose and the "o" mouth | Renamed **Thinking** and used while the planner searches. A separate **Curious** state was added (head tilt, eyes look where it drives, arm points, "?" on chest). |
| Image 2 (crying) | Worried brows, tears, broken heart on chest | Speech line invites the student to fix the maze: "Can you open a path for me?" |
| Image 3 (smiling) | Open smile, blush, waving arm | Eyes changed to ^ ^ so Happy is unmistakable at small sizes; arm waves continuously. |
| New | — | **Excited** (star eyes, both arms up, jump) for Princess-Bot entering the sensor range. **Idle** for maze editing. Antenna light added as a second emotion signal. |

## The six states and the events that trigger them

| State | Game event | Face screen | Chest screen | Antenna | Motion |
|---|---|---|---|---|---|
| Idle | Building the maze | Round eyes, small smile | Heartbeat line | Cyan | Gentle hover, blink |
| Curious | Exploring the nearest unknown area | Eyes follow the travel direction, raised brow, "o" mouth | ? | Cyan, blinking | Head tilt, arm points |
| Thinking | Map done, planner searching | Eyes up-right, squiggle mouth | Bouncing dots | Yellow, blinking | Hand to chin, head tilt |
| Excited | Princess-Bot sensed | Star eyes, big smile, blush | Sparkles | Yellow | Jumping, arms cheering |
| Happy | Shortest path found | ^ ^ eyes, big smile, blush | Heart | Green | Bouncing, waving |
| Sad | No path exists | Worried brows, falling tears, frown | Broken heart | Grey (dim) | Head droops, slow sway |
| *Talking* | TTS speaking in chat | Mouth opens and closes **only while speech plays** | — | — | — |

Readability rules for 10-year-olds:
- Every emotion is shown three ways: face, chest icon, antenna colour. Plus a speech-bubble line. Never colour alone.
- `createEmotionController` holds each emotion for at least 1.2 s, so a fast run never flickers through faces.
- Animations switch off for users with "reduce motion" set in their system.

## Princess-Bot: distinct by shape, not only colour

Doodlebot is boxy with a separate head, tracks and a teal screen. Princess-Bot is a single tall egg, hovers on a ring, has a plum visor and a gold crown. She stays distinct even printed in black and white.

- **Lost**: worried eyes looking up, small "o" mouth, faint sparkles. Shown before she is rescued.
- **Rescued**: ^ ^ eyes, smile, floating hearts. Shown when the path reaches her.

## Grid tokens

`tokens.js` draws simplified versions on the canvas at cell size. Doodlebot's eyes point in the direction of travel and its antenna and chest strip use the emotion colour. Princess-Bot keeps the crown silhouette.

## Files

```
public/characters/doodlebot.js    createDoodlebot(el) → setEmotion, lookAt, setTalking
characters/doodlebot.css   all states and animations
characters/princess.js     createPrincessBot(el) → setMood('lost' | 'rescued')
characters/princess.css
characters/emotions.js     EVENT_TO_EMOTION, LINES (drafts, rewrite in your voice), createEmotionController
characters/tokens.js       drawDoodlebotToken, drawPrincessToken (canvas, for the grid)
preview.html               interactive sheet (needs a local server: python3 -m http.server)
preview-standalone.html    same sheet, opens by double-click
exports/                   transparent PNGs for slides, worksheet, README, video
```

## Using it in the game

```js
import { createDoodlebot } from './characters/doodlebot.js';
import { createEmotionController, lineFor } from './characters/emotions.js';

const bot = createDoodlebot(document.querySelector('#doodlebot-panel'));
const mood = createEmotionController(bot, { onChange: e => bubble.textContent = lineFor(e) });

// in the exploration loop
bot.lookAt(next.x - cur.x, next.y - cur.y);
mood.event('exploreStep');
if (princessJustSensed) mood.event('princessSensed');

// in chat TTS
utterance.onstart = () => bot.setTalking(true);
utterance.onend   = () => bot.setTalking(false);
```
