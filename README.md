# Rithme

Rithme is a browser-based rhythm trainer designed for guitar practice. It generates short rhythmic exercises, provides a count-in and metronome, listens for playing through the microphone, and shows the detected attacks against the written rhythm.

The interface is styled with Tailwind CSS and the score is engraved with VexFlow.

## Run locally

```bash
npm install
npm run dev
```

## Code quality

The project uses ESLint and Prettier. Prettier formats source code with four spaces.

```bash
npm run lint
npm run format:check
npm run lint:fix
npm run format
```

## Features

- Random exercises across 2–8 measures, three difficulties, and 4/4, 3/4, or 6/8.
- Adjustable tempo from 45 to 180 BPM.
- Four-click count-in before each recorded attempt.
- Web Audio microphone onset detection and hit scoring (±150 ms).
- Per-measure timing map with target and detected attacks.
- Engraved SVG notation powered by VexFlow.
- Installable PWA with offline caching after the first visit.

## Notes

The microphone detector looks for attack transients, not pitch. For the clearest results, use headphones for the metronome and play in a relatively quiet room.
