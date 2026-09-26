/**
 * Where a printed page begins, marked in the text as a critical edition marks it (dispatch 255).
 *
 * Two parts: a page break for a screen reader ("Page 892"), and the page number, linked to that page
 * on the facsimile face. The number is the link's generated content (CSS `attr(data-page)`), so it
 * is not in the text: a copy, a find in page or a search reads the words alone, as the ledger has
 * them. reader.css sets it in the margin where there is one and inline where there is not.
 *
 * In the English text a turn cannot stand at a word, since English order is not German's: the mark
 * opens the English sentence whose German holds the turn, and says so ("Page 892 begins in this
 * sentence").
 */
import { facsimilePageHref } from "../facsimile/pageHref.ts";

export function PageTurnMark({
  paper,
  page,
  inSentence = false,
}: {
  paper: string;
  page: number;
  /** The English text: the page begins somewhere in the sentence this mark opens. */
  inSentence?: boolean;
}) {
  return (
    <span
      className={inSentence ? "page-turn page-turn-in-sentence" : "page-turn"}
      data-page-turn={page}
      // The plate beside the German face turns here, mid-paragraph (FollowingPlate).
      data-printed-page={inSentence ? undefined : page}
    >
      {/* biome-ignore lint/a11y/useFocusableInteractive: doc-pagebreak is a separator that marks
          structure, as a print page break does, not a widget: it takes no focus (DPUB-ARIA). */}
      <span
        role="doc-pagebreak"
        aria-label={inSentence ? `Page ${page} begins in this sentence` : `Page ${page}`}
        className="page-turn-rule"
      />
      {/* biome-ignore lint/a11y/useAnchorContent: the link's name is its aria-label, and its number
          is generated content (reader.css), so a copy or a find in page reads the words alone. */}
      <a
        className="page-turn-number"
        href={facsimilePageHref(paper, page)}
        data-page={page}
        aria-label={`Facsimile page ${page}`}
      />
    </span>
  );
}
