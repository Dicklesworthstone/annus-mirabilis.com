import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";

/**
 * A laboratory's notModeled list as a plain line under the instrument, read from its manifest when
 * the page is built. AGENTS.md: notModeled is "shown as a plain line". On 2026-09-24 a sweep of the
 * live lab routes found BM-01, BM-04, BM-05 and BM-08 showing no such line: their lists lived in
 * the manifests (11, 6, 8 and 8 entries) and, for three of them, as a single entry inside the
 * closed model note. So a reader saw no limits without opening a disclosure, and a printed page had
 * none. This prints the manifest's own list; nothing is restated here.
 *
 * Every laboratory page shows its manifest's whole list visibly, outside any closed disclosure
 * (src/testing/notModeledVisible.test.tsx; this cited ./notModeledShown.test.tsx, a path that has
 * never existed in any commit, so the guarantee named no reachable guard. The guard is real and
 * passes: it strips closed <details> innermost-first, accepts "leaves out" as well as "not
 * modelled" -- which is how bm-02, lq-01 and sr-03 state theirs -- floors the manifest-backed
 * count above 25, and declares its two exceptions with reasons). On 2026-10-01 seven did not: lq-01 and sr-03 printed hand-written
 * paraphrases, bm-07 a list in other words, lq-04 and lq-06 constants that had drifted from their
 * manifests, and bm-06 and sr-05 a part of it.
 */
export function NotModeledLine({ instrumentId }: { instrumentId: string }) {
  const manifest = strictParse(
    readFileSync(join(process.cwd(), "content/experiments", `${instrumentId}.yaml`), "utf8"),
    "yaml",
  ) as { notModeled?: unknown } | null;
  const list = Array.isArray(manifest?.notModeled)
    ? manifest.notModeled.filter((item): item is string => typeof item === "string")
    : [];
  if (list.length === 0) return null;
  return (
    <p className="fine" data-not-modeled={instrumentId}>
      Not modeled: {notModeledSentence(list)}
    </p>
  );
}

/**
 * The items as one line: each item's own closing full stop is dropped so the joins read "a; b."
 * and never "a.; b.". Some manifests write their items as sentences (sr-03), most as phrases.
 */
export function notModeledSentence(items: readonly string[]): string {
  return `${items.map((item) => item.trim().replace(/\.$/, "")).join("; ")}.`;
}
