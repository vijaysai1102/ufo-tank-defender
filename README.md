# UFO Tank Defender

UFO Tank Defender is a low-poly browser game built with Three.js. You control a
tank on a ridge, aim into the sky with the mouse, and shoot down UFOs before
their plasma attacks destroy your hull.

The game is intentionally lightweight: it is a static site with no build step,
no package install, and no backend server beyond a simple local HTTP server.

## Features

- Low-poly 3D tank, UFOs, terrain, rocks, clouds, stars, particles, and plasma
  effects.
- Mouse aiming with screen-space UFO aim assist.
- Tank movement with keyboard controls.
- Projectile combat with swept collision, so fast shells can still hit UFOs
  reliably.
- UFO wave progression, scoring, health, pause, restart, and game-over flow.
- Responsive full-screen layout with HUD and controls.
- Local Three.js dependency files, so the game does not need a CDN at runtime.
- SVG renderer fallback for browsers that do not expose WebGL.

## Demo

Run the project locally and open:

```text
http://127.0.0.1:4173/
```

## Controls

| Action | Input |
| --- | --- |
| Move tank left/right | `A` / `D` or Left / Right arrow |
| Aim turret | Mouse |
| Fire | Mouse click or `Space` |
| Pause/resume | `P` |
| Start/restart mission | Start Mission / Restart Mission button |

## Getting Started

### Requirements

- A modern browser.
- Python 3, or any other static file server.

### Run Locally

From the project root:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then visit:

```text
http://127.0.0.1:4173/
```

Serving over HTTP is important because the game uses JavaScript ES modules.
Opening `index.html` directly from the filesystem may not work in every browser.

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- README.md
|-- src/
|   `-- main.js
`-- vendor/
    |-- three.module.js
    |-- SVGRenderer.js
    `-- Projector.js
```

## Important Files

- `index.html` contains the page shell, canvas, HUD, control labels, overlay,
  and module script entry point.
- `styles.css` handles the full-screen game layout, HUD, overlay, buttons, and
  SVG fallback renderer positioning.
- `src/main.js` contains all game logic: scene setup, tank controls, aiming,
  shooting, UFO spawning, enemy attacks, collision, scoring, waves, particles,
  renderer setup, pause, restart, and resizing.
- `vendor/three.module.js` is the local Three.js module used by the game.
- `vendor/SVGRenderer.js` and `vendor/Projector.js` provide a local Three.js
  fallback renderer for browsers where WebGL is unavailable.

## How It Works

The game creates a Three.js scene with a low-poly tank, UFOs, terrain, rocks,
clouds, stars, lights, and particle bursts. The tank moves horizontally across
the ridge while the turret follows the mouse.

When the player fires, the game projects UFO positions into screen space and
uses aim assist when the mouse is visually near a UFO. Bullets also use swept
collision checks with `THREE.Line3`, which helps prevent fast projectiles from
skipping through UFOs between frames.

The preferred renderer is `THREE.WebGLRenderer`. If WebGL is not available, the
game dynamically loads `SVGRenderer` and renders the same Three.js scene as SVG.
That fallback is useful in restricted browser environments.

## Gameplay Tuning

Most balancing values live in `src/main.js`:

- Tank movement speed is in `createTank()`.
- UFO speed, health, spawn timing, and attack timing are in `createUfo()` and
  `updateUfos()`.
- Player shell speed, lifetime, and hit radius are in `createShot()`.
- UFO damage to the tank is in `updateProjectiles()`.
- Wave progression and hull repair are in `nextWave()`.

## Troubleshooting

### The page loads but the game does not start

Check the browser console for module-loading errors. Make sure these files are
served successfully:

- `src/main.js`
- `vendor/three.module.js`
- `vendor/SVGRenderer.js`
- `vendor/Projector.js`

### The scene is blank

Make sure you are running the project from a local HTTP server rather than
opening the HTML file directly. Also confirm the browser supports WebGL or can
load the SVG fallback modules.

### Old code still appears after changes

The script tag in `index.html` includes a cache-busting query string:

```html
<script type="module" src="./src/main.js?v=11"></script>
```

Increase the version number if a browser keeps serving an older copy during
development.

## Development Notes

This project does not use npm or a bundler. That keeps the repo simple, but it
also means vendored dependency files live in `vendor/`. Do not edit the vendored
Three.js files unless you are intentionally updating the local renderer setup.

Before committing changes, a quick syntax check is useful:

```powershell
node --check src\main.js
```

## License

Add your preferred license before publishing publicly. If you are unsure, MIT is
a common choice for small open-source browser games.
