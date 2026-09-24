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
  return <p className="fine">Not modeled: {list.join("; ")}.</p>;
}
