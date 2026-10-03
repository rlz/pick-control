# Design and technical decisions

## Tailwind CSS

- Use Tailwind utility classes in components for ordinary layout, spacing, typography, colors, and interactive states. Prefer standard utilities and scales; small adjustments to spacing and size are acceptable.
- Keep global foundations and specialized notation, VexFlow, and rhythmic timeline rules in `src/styles.css`. Preserve specialized notation styles so VexFlow behavior and rhythmic display remain stable.

## Triplet notation

- A triplet is a 3:2 group. Its starting editor cell has the `triplet` state; following `continue` cells define the group's total duration. Three equal notes occupy that complete span, so a triplet is not assumed to have a fixed one-beat duration.
- Keep the `Tuplet` instance in `EngravedMeasure.tsx`; creating it sets VexFlow's tick multiplier and preserves correct rhythmic spacing.
- Draw the visible `3` and bracket explicitly with `TextBracket` after the beams. In this compact manually beamed score, `Tuplet.draw()` alone may omit the number.
- A complete triplet is exactly three adjacent `ExerciseNote`s with `isTriplet: true`. Editor and renderer changes must preserve that grouping and its visible `3` marker.

## Publishing

- Publish through GitHub Actions to GitHub Pages. The custom domain is `takt.maslennikovdm.ru`.
- Enable GitHub Actions as the Pages source and configure a DNS CNAME for `takt` to `<github-username>.github.io`. Enable Enforce HTTPS after the first successful deployment.

## Measure editor

- Derive the number of editor cells from `signatures[signature].slots`, not from the number of beats. The grid must cover a complete measure in 4/4, 3/4, and 6/8, including triplet durations.
- Style the time-signature selector with standard Tailwind classes, hide the system arrow, and show a chevron inset by `right-3`.

## Application state and component structure

- Use Valtio for shared session and application state read by multiple components. Exercise data, tempo, tempo program, and favorites stay in the existing `exerciseStore` and `favoritesStore`; do not create duplicate sources of truth.
- Playback and recording state (`ready`, `count-in`, `playing`, `finished`), current score, active BPM, playback position, preview, hit results, and loop history belong to `sessionStore`.
- Shared interface flags used by multiple screen areas (selected measure, open primary dialog or panel) belong to `uiStore`. State used by only one dialog or editor stays local to its owning component.
- Keep `AudioContext`/`Metronome`, stop functions, timer and animation IDs, microphone permission requests, temporary tempo ramp data, and DOM references in refs/controllers outside Valtio.
- `AppHeader`, `ExerciseWorkspace`, `PlaybackControls`, and `AppDialogs` are split from `App.tsx`; audio coordination is in `useSessionController`. Preserve stop-on-interaction behavior and correct triplet display.
- Components read only the state slice they need through `useSnapshot`; state changes go through named store/controller actions. Do not move local drafts or purely visual disclosures into global state without a cross-component consumer.

## Audio input calibration

- Do not show a decorative “Input signal” microphone label, explanatory signal-level text, or a separate connected message in the calibration modal. Show microphone access errors while they apply.

## Preset thumbnails

- Give the preset thumbnail container an explicit block width and divide it evenly between its two measures so `ResizeObserver` can measure VexFlow graphics.
- In preset cards, keep the preset number compact and fixed-width, with notation filling the remaining space beside it.

## Interface language and localization

- English is the default and fallback language. Use `i18next` with `react-i18next` for interface strings and `i18next-browser-languagedetector` to choose the initial locale from browser preferences.
- Support English, Spanish, Simplified Chinese, Hindi, Arabic, Brazilian Portuguese, Bengali, Russian, Japanese, and French (`en`, `es`, `zh-CN`, `hi`, `ar`, `pt-BR`, `bn`, `ru`, `ja`, `fr`). Unsupported browser languages fall back to English.
- Normalize regional browser tags to their supported locale before selection, preserving browser preference order (`en-US` → `en`, `pt-PT` → `pt-BR`). This ensures the first supported browser language wins over later exact regional matches.
- Keep README and project requirements in English. Localize user-facing text, including accessible labels and dynamic feedback, through the same translation resources.
