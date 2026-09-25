import { facsimilePageHref } from "../facsimile/pageHref.ts";

/**
 * A source block's printed pages, as one label in page order (dispatch 210).
 *
 * Each page used to be its own `float: right` span, and floats stack from the right, so a block on
 * pp. 891-892 printed "[p. 892][p. 891]". One span now carries the whole label: a single page is
 * "[p. 891]", one link as before; several are "[pp. 891–892]", each number a link to its page on
 * the facsimile face, and a run of consecutive pages is written first–last.
 */
export function PageLocators({ paper, pages }: { paper: string; pages: readonly number[] }) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const first = sorted[0];
  if (first === undefined) return null;
  const link = (page: number, text: string) => (
    <a
      key={page}
      href={facsimilePageHref(paper, page)}
      data-facsimile-link={page}
      aria-label={`Facsimile page ${page}`}
      className="locator-link"
    >
      {text}
    </a>
  );
  if (sorted.length === 1)
    return <span className="block-locator">{link(first, `[p. ${first}]`)}</span>;

  // Consecutive pages as runs: [891, 892, 893, 895] reads "891–893, 895".
  const runs: number[][] = [];
  for (const page of sorted) {
    const run = runs[runs.length - 1];
    if (run && page === (run[run.length - 1] ?? Number.NaN) + 1) run.push(page);
    else runs.push([page]);
  }
  return (
    <span className="block-locator">
      [pp.{" "}
      {runs.map((run, i) => {
        const start = run[0] ?? first;
        const end = run[run.length - 1] ?? start;
        return (
          <span key={start}>
            {i > 0 ? ", " : null}
            {link(start, String(start))}
            {end !== start ? <>–{link(end, String(end))}</> : null}
          </span>
        );
      })}
      ]
    </span>
  );
}
