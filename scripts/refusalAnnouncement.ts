/**
 * WHICH LIVE REGION TELLS A READER THAT THE MODEL REFUSED (the deliberate-typed-refusal check).
 *
 * The candidate browser probe used to read the FIRST `[data-refusal-code]` element on the page and
 * ask for its nearest live region. On 2026-10-02 the release of 63dc6e43 was refused on that check
 * with "announced by none", although BM-06's refusal notice sits in `aria-live="polite"` and the
 * currency line beside it is `role="status"`: the first marked element had become the laboratory's
 * own `<section>` root, which carries the code as part of its run identity and is no live region.
 * The page announced the refusal; the check read the wrong element.
 *
 * So the elements judged are the INNERMOST marked ones, those holding no other marked element: the
 * notices a reader is actually given. The answer is the live region of the first of them in
 * document order, or "none" when none of them is in one. A root that marks itself and holds no
 * announced notice still reads "none", which is the defect the check exists for (dispatch 519).
 *
 * Self-contained on purpose: Playwright serializes this function into the page
 * (`page.evaluate(refusalAnnouncedBy)`), so it may use nothing from outside its own body.
 */
export function refusalAnnouncedBy(doc: Document = document): string {
  const marked = [...doc.querySelectorAll("[data-refusal-code]")];
  const innermost = marked.filter((element) => !element.querySelector("[data-refusal-code]"));
  for (const element of innermost) {
    const region = element.closest("[aria-live],[role='status'],[role='alert']");
    if (region)
      return region.getAttribute("aria-live") ?? region.getAttribute("role") ?? "a live region";
  }
  return "none";
}
