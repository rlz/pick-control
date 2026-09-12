# TaktControl implementation notes

## Triplet notation

- A triplet is a 3:2 tuplet. In the editor, its starting cell has the `triplet` state and the immediately following `continue` cells set the group's total duration. Three equal note glyphs then occupy that complete span; never assume a triplet has a fixed one-beat duration.
- Keep the `Tuplet` instance in `EngravedMeasure.tsx`: constructing it attaches VexFlow's tick multiplier and preserves the correct rhythmic spacing.
- The visible `3` and its bracket must be drawn explicitly with `TextBracket` **after** the beams. Do not rely on `Tuplet.draw()` alone: its glyph has previously disappeared in this compact, manually-beamed SVG score.
- A complete triplet is exactly three adjacent `ExerciseNote`s with `isTriplet: true`. Any renderer or editor change must preserve that grouping and its visible `3` marker.
