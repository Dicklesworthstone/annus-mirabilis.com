/**
 * THE PRINTED QUANTITIES WITH NO SYMBOL ENTRY (dispatch 254). Without JavaScript, a printed
 * display's term chip is a real link to /notation/ (notationLink, src/equations/printed/
 * fallbackFacts.ts). Most chips land on a concordance entry above. A quantity with no entry in its
 * paper lands on its row here: the letters as printed, its name, and what it is. The rows are the
 * chips' own targets, read from the payload the faces render, so every such link has a place. The
 * name and description come in that payload (printedDisplays, at build time): this page must not
 * import the quantity registry, whose `new URL(dir, import.meta.url)` webpack cannot bundle.
 */

import type { PrintedDisplayPayload } from "../../equations/printed/paperDisplays.ts";
import printedPayload from "../../generated/printed-displays.json";
import { QUANTITY_LABELS } from "../../generated/quantity-labels.ts";
import { notationFormula } from "./colouredGlyphs.ts";
import { hasColour, PAPER_METADATA } from "./notationData.ts";

const QUANTITY_ROW = "/notation/#";

export type UnlistedQuantity = Readonly<{
  anchor: string;
  paper: string;
  paperTitle: string;
  name: string;
  description: string | undefined;
  /**
   * Each distinct printed letter, drawn at build time from the legend's glyph in the row's
   * quantity, so it takes the paper's colour for it (colouredGlyphs.ts, dispatch 275).
   */
  glyphs: readonly string[];
}>;

/** The chips' quantity rows, one per paper and quantity, in paper and display order. */
export function unlistedQuantities(
  displays: readonly Pick<PrintedDisplayPayload, "paper" | "legend">[],
  isRegistered: (quantityId: string) => boolean = (id) => Object.hasOwn(QUANTITY_LABELS, id),
): readonly UnlistedQuantity[] {
  const rows = new Map<string, UnlistedQuantity & { glyphs: string[]; latex: string[] }>();
  for (const d of displays)
    for (const line of d.legend) {
      if (!line.href.startsWith(`${QUANTITY_ROW}quantity-`)) continue;
      const anchor = line.href.slice(QUANTITY_ROW.length);
      const row = rows.get(anchor) ?? {
        anchor,
        paper: d.paper,
        paperTitle: PAPER_METADATA[d.paper]?.title ?? d.paper,
        name: line.row?.name ?? line.quantityId,
        description: line.row?.description,
        glyphs: [],
        latex: [],
      };
      if (!row.latex.includes(line.glyph)) {
        row.latex.push(line.glyph);
        row.glyphs.push(
          notationFormula(
            {
              id: anchor,
              paper: d.paper,
              anchor: "s0",
              latex: line.glyph,
              quantityId: line.quantityId,
            },
            isRegistered,
            hasColour,
          ).html,
        );
      }
      rows.set(anchor, row);
    }
  return [...rows.values()].map(({ latex: _latex, ...row }) => row);
}

export function UnlistedQuantities() {
  const rows = unlistedQuantities(
    (printedPayload as unknown as { displays: readonly PrintedDisplayPayload[] }).displays,
  );
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="notation-unlisted-heading">
      <h2 id="notation-unlisted-heading">
        In the printed equations, without an entry of their own
      </h2>
      <p>
        These quantities appear in the papers' displayed equations but have no symbol entry above.
        Each line gives the letters as printed, the paper, the quantity, and what it is.
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.anchor} id={row.anchor} data-paper={row.paper}>
            {row.glyphs.map((html, i) => (
              <span key={html}>
                {i > 0 ? ", " : null}
                <span aria-hidden="true" {...{ dangerouslySetInnerHTML: { __html: html } }} />
              </span>
            ))}{" "}
            <strong>{row.name}</strong> ({row.paperTitle})
            {row.description ? `: ${row.description}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
