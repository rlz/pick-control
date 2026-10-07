# Current tasks

## Open tasks

- Display click timing history for the complete exercise, not just the selected measure.
- Add demonstration playback from a selected measure through the end of the exercise.
- Add a guitar tuner.
- Add a chord reference.
- Add a note-finding exercise with selectable guitar tuning, microphone-based pitch recognition, feedback showing the played note after an incorrect answer, and an optional note-location hint. Restrict prompts to notes playable in the selected tuning.
- Add an analogous chord-finding exercise with microphone-based chord recognition, feedback after an incorrect answer, and an optional fingering hint.

## Completed in this iteration

- Replaced the external distortion-guitar SoundFont preview with two locally bundled recordings for ordinary and palm-muted attacks; compressed the supplied WAVs to mono MP3 (about 34 KB total) and removed `soundfont-player`.

- Updated six direct dependencies and their compatible transitive dependencies in `package-lock.json`; then moved `@types/node` to 26.6.4 at the user's request. Build and lint pass after both updates.
- Replaced floating `latest` dependency declarations with explicit caret ranges matching the versions in `package-lock.json`.

- Fixed disappearing preset score thumbnails by assigning explicit flex sizes to the container and both measures, giving `ResizeObserver` a nonzero width.
- Fixed preset thumbnail alignment: the number has a compact width and notation fills the remaining space beside it.
- Moved the main interface styling to standard Tailwind utility classes; `src/styles.css` retains global foundations and specialized notation and rhythmic graphics.
- Replaced the time-signature selector's native select with a custom full-button selector and a separate Font Awesome chevron; options are selectable across each full row.
- Added `sessionStore` and `uiStore`; audio resources and timers remain outside the proxy.
- Split `App.tsx` into screen components and `AppDialogs`; moved audio coordination to `useSessionController`.
- Kept editor steps and strokes, comment drafts, and action confirmations in their owning components.
- Fixed the editor grid so it shows every cell in a measure according to the current time signature. The user manually verified this fix.
- `npm run build` passed before this iteration.
- `npm run build` passes with the initial i18n integration.
- Removed the decorative input-signal label and icon, signal-level explanation, and connection message from the audio calibration modal while retaining microphone access errors.
- Added `i18next`, `react-i18next`, and browser language detection. English is the fallback; the app detects browser language preferences and updates the document language.
- Added initial localized resources for ten languages and translated the header, playback controls, calibration dialog, and exercise confirmations.
- Rewrote README and requirements documents in English and recorded the localization decision.
- Localized the remaining settings, generator, favorites, editor, comments, measure actions, timing details, confirmations, and accessibility labels in all ten supported languages.
- Set the document language from the detected locale and enabled right-to-left document direction for Arabic.
- Confirmed every interface translation key resolves in all ten locale resources; the remaining strings identical to English are shared terms such as `BPM`.
- Fixed browser locale matching so regional tags map to a supported language before selection; verified that `en-US, ru-RU, ru, en` selects English after a page reload.
- Cleared all TypeScript and ESLint findings: removed unused session values, keyed the document language effect to the active locale, and kept the notation scroll ref out of the workspace's general props object to satisfy React Hooks ref analysis.
- `npm run lint` and `npm run build` pass after the cleanup.
- Updated the metronome tempo program labels to say tempo changes happen after a complete exercise; recorded the behavior requirement.
- Replaced the tempo program dropdown with a one-click button group showing the selected mode.
- Made the tempo program buttons compact and icon-only, with localized tooltips and accessible names.
- Separated hover styling from selected styling on the tempo program buttons and removed the enclosing label behavior.
- Changed the tempo step caption to sentence case and added a localized, mode-specific explanation for each tempo program.
- Initially constrained the playback footer and added internal history scrolling; revised in this iteration per user preference so the footer grows to fit all history rows.
- Kept a timing-history row for every completed repetition, even when no hits were detected.
- Changed tempo progression so every step is exactly the configured size; a non-aligned maximum acts as a ceiling and the ramp uses the highest reachable tempo below it.
- Constrained the playback footer and timing history flex items so the full history can scroll inside its available height instead of being clipped.
- Removed history scrolling and made the footer grow with its history, preserving a minimum height for the playback controls.
- Fixed selected-state visibility for note, triplet, palm-mute, continuation, and rest cells in the rhythm editor.
- Aligned the rhythm timeline's first tick with the left edge of the first editor cell.
- Moved rhythm-cell selection colors and timeline spacing into Tailwind classes; clarified that `src/styles.css` is reserved for global foundations and complex notation/staff styling.
- Adjusted the mobile exercise comment/favorite actions to stay compact below the top-right actions, and reorganized the selected-measure playback footer so its rhythm history spans the width above the playback buttons.
- Made the mobile rhythm editor full-screen, wrapped step and stroke cells at two quarter-note beats per row, moved row labels above the cells, and expanded the preview scale to full width.
- Grouped the mobile workspace header into an exercise-type/actions row and a comment/favorite row, outside the scrolling score area.
- Kept playback controls pinned to the right on wide layouts when no measure is selected.
