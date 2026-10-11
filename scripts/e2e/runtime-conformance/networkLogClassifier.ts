/**
 * Classify one request from the runtime-conformance harness's network log.
 *
 * THE WORKER ARM USED TO BE A BARE SUBSTRING (am-xyxk). It read
 *
 *     if (lower.includes("worker") || lower.startsWith("blob:")) return "worker";
 *
 * ahead of the `.js` arm, so ANY url whose path, query or fragment contained the word "worker"
 * was classified as a worker request -- a reading page about workers, a `?view=worker`
 * parameter, a `#worker` anchor. The direction is the one this repository keeps paying for: an
 * unanchored pattern fails toward the prose ABOUT a thing, and here that inflates the worker
 * count and deflates the script count.
 *
 * It was invisible because the two arms were never separated. The test's only worker case was
 * `classifyNetworkRequest("blob:http://127.0.0.1/worker")`, which satisfies BOTH conditions, so
 * the substring arm could have been deleted outright and the test would still have passed.
 *
 * WHAT THE QUESTION ACTUALLY IS: not "does this url mention a worker" but "is this url a worker
 * script, or a blob a worker was created from". So the filename is what is asked, after query and
 * fragment are removed, and it must also BE a script. The conventions in this tree are
 * `bm06Worker.ts`, `worker.ts` and `pdf.worker.min.mjs`, all of which are script filenames
 * containing the token; `/foundations/worker-explainer/` and `/lab/bm-01/?view=worker` are not
 * script filenames at all and are no longer mistaken for one.
 *
 * This is still a substring test, deliberately -- camel case does not survive lowercasing, so
 * `bm06Worker.ts` offers no token boundary to anchor on. What changed is the POPULATION it is
 * asked of: the filename of a script, rather than the whole url.
 */
export type NetworkKind = "worker" | "wasm" | "page" | "other";

/** The last path segment, with any query string and fragment removed, lowercased. */
function fileNameOf(url: string): string {
  const path = url.split("?")[0]?.split("#")[0] ?? "";
  const segments = path.split("/");
  return (segments[segments.length - 1] ?? "").toLowerCase();
}

/** Extensions a worker script can have here. `.wasm` is handled before this is consulted. */
const SCRIPT_FILE = /\.(js|mjs|cjs|ts|mts)$/;

/**
 * Does this filename NAME a worker, rather than merely mention one (am-worker-predicate-tautology-9jyk)?
 *
 * `file.includes("worker")` was the test, and it still called `worker-protocol.js` a worker: a module
 * DEFINING the worker protocol, loaded on the main thread, counted as a worker request. That was the
 * one case of this bead's two that survived the earlier repair, because that repair narrowed the
 * POPULATION from the whole url to the filename and left the match itself a bare substring.
 *
 * The convention is measurable rather than guessed. Every worker in this repository is
 * `<something>Worker.ts` -- bm01Worker, bm08Worker, hostWorker, sr03Worker, 10 of them under
 * src/workers/host/ -- plus the vendored `pdf.worker.min.mjs`, and NO file anywhere in src, scripts
 * or public begins `worker-`. So the token sits at the END of a dot-separated segment of the
 * filename, and a name that merely begins with it and carries on ("worker-protocol",
 * "workerLabDraftTapes") is talking about workers rather than being one.
 *
 * Why segments and not just "ends with worker": `pdf.worker.min.mjs` carries the token in a MIDDLE
 * segment, and a rule anchored only at the end of the basename would miss the one real worker in the
 * tree that nobody here wrote.
 *
 * THE LIMIT, stated rather than discovered later: a worker named `worker-foo.js` would be missed.
 * Nothing in this repository is named that way, and if that changes this is the function to change;
 * the blob arm above is unaffected either way, and in the conformance fixture it is the only arm that
 * fires, because the fixture builds its worker with `new Blob` and `URL.createObjectURL`
 * (src/testing/runtime-fixtures/app/channel.ts).
 */
function namesAWorker(file: string): boolean {
  return file.split(".").some((segment) => segment === "worker" || segment.endsWith("worker"));
}

export function classifyNetworkRequest(url: string): NetworkKind {
  const lower = url.toLowerCase();
  // EVERY EXTENSION TEST READS THE FILENAME, never the whole url. The arms below were written as
  // `lower.endsWith(".html")` and so on, which a query string or a fragment defeats: a served page
  // requested as `/runtime-conformance.html?mode=worker` does not END with `.html`, so it fell
  // through to "other". That was true of the wasm, html, js and css arms alike, and it is the same
  // defect as the worker arm's one layer along -- asking a question of the whole string when the
  // answer lives in one part of it. Found by the negatives for the worker arm, which is the only
  // reason it is fixed here too.
  const file = fileNameOf(url);
  if (file.endsWith(".wasm") || lower.includes("/wasm/")) return "wasm";

  // A blob url has no path to read, and a worker constructed from one is the case that cannot be
  // recognised any other way. Kept as its own arm so it is separable from the filename test.
  if (lower.startsWith("blob:")) return "worker";

  if (SCRIPT_FILE.test(file) && namesAWorker(file)) return "worker";

  if (
    file.endsWith(".html") ||
    file.endsWith(".js") ||
    file.endsWith(".css") ||
    lower.includes("/apps/")
  ) {
    return "page";
  }
  return "other";
}
