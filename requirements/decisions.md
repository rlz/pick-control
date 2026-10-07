# Design and technical decisions

## npm dependencies

- Declare direct dependencies with explicit caret semver ranges based on the versions captured in `package-lock.json`; do not use the floating `latest` tag. Commit the lockfile so installs use its exact resolved versions.

## Tailwind CSS

- Use Tailwind utility classes in components for ordinary layout, spacing, typography, colors, and interactive states. Prefer standard utilities and scales; small adjustments to spacing and size are acceptable.
- Keep `src/styles.css` for global foundations and visual rules that are difficult to express with Tailwind, especially staff/notation rendering. Use Tailwind classes in components for ordinary layout, spacing, typography, colors, and interactive states; do not add routine UI styling to the global stylesheet.
- Preserve specialized notation and VexFlow styles so score rendering remains stable.
- Use Font Awesome for ordinary interface icons when a matching icon exists; avoid hand-drawn inline SVGs for those icons.

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
- Keep the selected step kind visibly distinct for notes, triplets, palm mutes, continuation cells, and rests; selected-state styling must not depend on conflicting utility text colors.
- Align the rhythm timeline's start with the left edge of the first editor cell by sharing the same label column and gap as the step rows.
- Use a custom time-signature selector with a full-width button trigger and a separate Font Awesome chevron. Its popup options must be easy to select across the full row and support keyboard navigation.

## Application state and component structure

- Use Valtio for shared session and application state read by multiple components. Exercise data, tempo, tempo program, and favorites stay in the existing `exerciseStore` and `favoritesStore`; do not create duplicate sources of truth.
- Playback and recording state (`ready`, `count-in`, `playing`, `finished`), current score, active BPM, playback position, preview, hit results, and loop history belong to `sessionStore`.
- Shared interface flags used by multiple screen areas (selected measure, open primary dialog or panel) belong to `uiStore`. State used by only one dialog or editor stays local to its owning component.
- Keep `AudioContext`/`Metronome`, stop functions, timer and animation IDs, microphone permission requests, temporary tempo ramp data, and DOM references in refs/controllers outside Valtio.
- `AppHeader`, `ExerciseWorkspace`, `PlaybackControls`, and `AppDialogs` are split from `App.tsx`; audio coordination is in `useSessionController`. Preserve stop-on-interaction behavior and correct triplet display.
- Components read only the state slice they need through `useSnapshot`; state changes go through named store/controller actions. Do not move local drafts or purely visual disclosures into global state without a cross-component consumer.

## Audio input calibration

- Do not show a decorative “Input signal” microphone label, explanatory signal-level text, or a separate connected message in the calibration modal. Show microphone access errors while they apply.

## Tempo program controls

- Present the three tempo programs as a compact, icon-only one-click button group in the tempo panel, with the current choice visibly distinct from hover and each icon explained by a localized accessible label and tooltip.
- Keep one BPM for the full configured exercise. Apply progression steps only between complete exercise repetitions, and describe the controls in those terms.
- Treat the maximum as an inclusive ceiling, not a target that permits a shortened final step. Increase by exactly the configured step while the next value remains at or below the ceiling; the increase mode holds the last reachable tempo, and increase-and-return descends from there in full steps.
- Use sentence case for tempo progression details and show a localized explanation that changes with the selected program.
- Let the playback footer grow to fit all timing-history rows; keep a minimum height for its controls and let the exercise workspace use the remaining viewport height.
- Show a timing-history row for every completed exercise repetition, including repetitions with no detected hits.

## Preset thumbnails

- Give the preset thumbnail container an explicit block width and divide it evenly between its two measures so `ResizeObserver` can measure VexFlow graphics.
- In preset cards, keep the preset number compact and fixed-width, with notation filling the remaining space beside it.

## Interface language and localization

- English is the default and fallback language. Use `i18next` with `react-i18next` for interface strings and `i18next-browser-languagedetector` to choose the initial locale from browser preferences.
- Support English, Spanish, Simplified Chinese, Hindi, Arabic, Brazilian Portuguese, Bengali, Russian, Japanese, and French (`en`, `es`, `zh-CN`, `hi`, `ar`, `pt-BR`, `bn`, `ru`, `ja`, `fr`). Unsupported browser languages fall back to English.
- Normalize regional browser tags to their supported locale before selection, preserving browser preference order (`en-US` → `en`, `pt-PT` → `pt-BR`). This ensures the first supported browser language wins over later exact regional matches.
- Keep README and project requirements in English. Localize user-facing text, including accessible labels and dynamic feedback, through the same translation resources.
