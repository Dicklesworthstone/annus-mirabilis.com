# Segmentation rules

Executable copy: `src/content/editions/segmentSentences.ts` and `src/content/editions/tokenizeGerman.ts`.
This file is the editorial statement of those rules. The code is the check.

## Alignable units

Sentence-level: paragraph sentences (`s<n>-p<m>-s<k>`).
Block-level (English unit id equals the block id, split suffix if English splits):
masthead (`masthead-title`, `masthead-author`), section headings (`s<n>`), part headings (`part-1`, `part-2`), footnotes (`s<n>-fn<k>`), closings (`closing-dateline`, `closing-ack`, `closing-received`).

Permanent ids are defined in `src/content/ids.ts`. This tooling classifies them; it does not invent a second grammar.

## Sentence boundaries

A sentence ends at `.`, `?`, or `!` followed by whitespace and an uppercase letter or an opening quotation mark, or by the end of the paragraph.

Never a boundary: colons and semicolons; anything inside inline math; listed abbreviations (`z. B.`, `d. h.`, `u. s. w.`, `usw.`, `vgl.`, `bzw.`, `ca.`, `resp.`, `a. a. O.`, `l. c.`, `S.`, `p.`, `Bd.`, `Ann.`, `d.`, `Phys.`, `Sek.`, `sec.`, `cm.`, `mm.`, `gr.`, `Fig.`, `Gl.`, `Nr.`, `Proc.`, `Wied.`, `Ber.`, `Sitzungsber.`, `Akad.`, `Wiss.`); single-letter initials; ordinals before a month or noun; a section sign with its number; a bibliographic citation string.

The facsimile decides every doubtful case.

## German word tokens

A token is a maximal run of letters (including `ä ö ü ß`), with internal apostrophes and printed hyphens. Composite tokens: listed abbreviations with internal spaces, `§` with its number, an ordinal with its period, a decimal comma, a printed unit word. Math and footnote marks are atoms, not tokens. Punctuation is not a token. Indices are 0-based among word tokens.
