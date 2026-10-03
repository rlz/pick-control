# Current tasks

## Open tasks

There are no open tasks from this localization work.

## Completed in this iteration

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
