import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import EmbeddedLaboratoryPage from "../app/embed/lab/[experiment]/page.tsx";
import { strictParse } from "../content/schemas/strictParse.ts";
import { EMBED_INSTRUMENTS } from "../experiments/embed/catalogue.ts";

/**
 * A manifest's `embeddable: true` is a promise that /embed/lab/<id>/ exists. On 2026-09-23 29
 * manifests made it and 9 were kept, so live /embed/lab/sr-02/ was 404, and the instrument audit's
 * Embed column, which reads only the flag, passed. This ratchet keeps the gap named: an instrument
 * that claims to be embeddable is either in the catalogue or on the list below, and the list may
 * only shrink. Embed an instrument and remove it here in the same change; a new manifest that
 * claims embeddable without an embed fails.
 */
const NOT_YET_EMBEDDED = [
  "bm-01",
  "bm-04",
  "bm-05",
  "bm-06",
  "bm-07",
  "bm-08",
  "lq-01",
  "lq-03",
  "lq-04",
  "lq-07",
  "lq-08",
  "lq-09",
  "sr-06",
  "sr-07",
];

const MANIFESTS = fileURLToPath(new URL("../../content/experiments", import.meta.url));

function manifestsClaimingEmbeddable(): string[] {
  const ids: string[] = [];
  for (const name of readdirSync(MANIFESTS)) {
    if (!name.endsWith(".yaml")) continue;
    const m = strictParse(readFileSync(join(MANIFESTS, name), "utf8"), "yaml") as {
      id?: string;
      embeddable?: boolean;
    } | null;
    if (m?.embeddable === true && typeof m.id === "string") ids.push(m.id);
  }
  return ids.sort();
}

describe("the embed catalogue keeps the manifests' embeddable promise", () => {
  test("every manifest that claims embeddable is embedded or named as not yet", () => {
    const claimed = manifestsClaimingEmbeddable();
    const embedded = new Set<string>(EMBED_INSTRUMENTS.map((i) => i.id));
    console.log(
      `[embed catalogue] ${claimed.length} manifests claim embeddable; ${claimed.filter((id) => embedded.has(id)).length} embedded; ${NOT_YET_EMBEDDED.length} not yet`,
    );
    expect(claimed.length).toBeGreaterThan(0);
    expect(claimed.filter((id) => !embedded.has(id))).toEqual([...NOT_YET_EMBEDDED].sort());
  });

  for (const { id } of EMBED_INSTRUMENTS) {
    test(`/embed/lab/${id}/ renders the real laboratory with a link back`, async () => {
      const element = await EmbeddedLaboratoryPage({ params: Promise.resolve({ experiment: id }) });
      const html = renderToStaticMarkup(element);
      expect(html).toContain(`href="/lab/${id}/"`);
      expect(html).not.toContain("prepared example did not pass its own check");
      if (!id.startsWith("shelf-")) expect(html).toContain(`data-instrument-id="${id}`);
    });
  }
});
