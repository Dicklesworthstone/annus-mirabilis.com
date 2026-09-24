/**
 * Finds the Suspense segments React wrote out of line in a built page.
 *
 * When a Suspense boundary is still pending as its parent is written, React emits the fallback in
 * place (<!--$?--><template id="B:0"></template><!--/$-->) and the content later, in
 * <div hidden id="S:0">, with a script that moves it into place ($RC). A reader without
 * JavaScript never runs that script, so the content stays hidden. The build of 7b2ba7b1 did this
 * to all four papers' first encounters (8ce94625, fixed in 4d74814e), and nothing reported it:
 * the markup was in the HTML, so every check that looked for it passed.
 *
 * A boundary React finished in time is written inline as <!--$-->...<!--/$-->, which is fine and
 * not reported. So is any other hidden element: only a div whose id is a segment id (S:<n>).
 */
const SEGMENT = /<div hidden(?:="")? id="(S:[0-9a-z]+)"/g;

/** The ids of the out-of-line segments in a page's HTML, in document order. */
export function outlinedSegments(html: string): string[] {
  return [...html.matchAll(SEGMENT)].map((match) => match[1] ?? "");
}
