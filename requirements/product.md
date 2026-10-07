# Product requirements

## Purpose

A browser-based rhythm trainer for guitar practice. The application generates short exercises, provides a count-in and metronome, listens to the performance through the microphone, and compares detected attacks with the written rhythm.

## Functional requirements

- Generate random exercises from 2 to 8 measures with three difficulty levels.
- Support 4/4, 3/4, and 6/8 time signatures.
- Allow tempo changes from 45 to 180 BPM.
- In tempo progression modes, hold the selected BPM for every measure in the exercise and change it only between complete exercise repetitions.
- Treat the configured maximum as an upper bound: tempo progression uses only full configured step increments and never exceeds the maximum. If the next full step would exceed it, hold the last attainable tempo; in increase-and-return mode, reverse from that tempo using full steps.
- Let users select a tempo program directly with one click.
- Provide a four-click count-in before recording an attempt.
- Detect sound attacks through Web Audio and score them within a tolerance of ±150 ms.
- Show a per-measure timing map with target and detected attacks.
- Show click timing history for the complete exercise rather than only for the currently selected measure.
- Let users demonstrate playback from a selected measure through the end of the exercise.
- Provide a guitar tuner.
- Provide a chord reference.
- Provide a note-finding exercise: let the user choose a guitar tuning, prompt a note available in that tuning, and use microphone-based pitch detection to identify the played note. Advance to another prompt after a correct answer; after an incorrect answer, show the note that was actually played. Offer an optional hint showing where the prompted note can be played in the selected tuning. Only prompt notes playable in that tuning.
- Provide a chord-finding exercise analogous to the note-finding exercise: prompt a chord, use microphone-based pitch recognition to identify the played chord, give feedback after an incorrect answer, and offer an optional hint showing how to play the prompted chord.
- Display exercise notation as an SVG score.
- On narrow screens, keep the comment action and compact favorite toggle together below the top-right exercise actions. When a measure is selected, show its rhythm timeline across the full playback panel, with measure playback on the lower left and the other playback controls on the lower right.
- On mobile, make the rhythm editor full-screen, stretch its rhythm scale across the available width, and wrap step and stroke cells into rows of at most two quarter-note beats. Put each row label above its cells.
- Keep the mobile exercise header in two fixed rows: exercise type with time-signature, add-measure, and clear actions on the first row; comment and favorite actions on the second.
- When editing a measure, show all rhythmic cells for its time signature, as defined by the signature's slot count.
- Support PWA installation and offline caching after the first visit.
- Use English by default and translate the complete interface into ten supported languages. Detect the preferred language from the browser and fall back to English.

## Usage requirements

- The microphone detector evaluates attack transients, not pitch.
- For cleaner scoring, users should hear the metronome through headphones and practice in a relatively quiet room.
- Any significant interface action during count-in or exercise playback first stops the current run, then performs the action. This includes selecting a measure, opening or changing an exercise, tempo and metronome settings, previewing, and calibration.
- Exercise controls remain available during a run; a click must not be silently ignored because playback is active.
