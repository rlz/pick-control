# pick-control

pick-control is a browser-based rhythm trainer designed for guitar practice. It generates short rhythmic exercises, provides a count-in and metronome, listens for playing through the microphone, and shows the detected attacks against the written rhythm.

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

## Publish to GitHub Pages

The repository includes a GitHub Actions deployment workflow and the custom-domain file for `takt.maslennikovdm.ru`. After pushing the repository to GitHub:

1. In **Settings → Pages**, set **Source** to **GitHub Actions**.
2. In the DNS zone for `maslennikovdm.ru`, create a `CNAME` record: host `takt`, value `<your-github-username>.github.io`.
3. Once the first deployment completes, enable **Enforce HTTPS** in **Settings → Pages**. GitHub may take some time to provision the certificate.

Every push to `main` then publishes the current build to the custom domain.
