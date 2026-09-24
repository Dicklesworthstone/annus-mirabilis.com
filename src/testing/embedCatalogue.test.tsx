import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedLaboratoryPage from "../app/embed/lab/[experiment]/page.tsx";
import { strictParse } from "../content/schemas/strictParse.ts";
import { EMBED_INSTRUMENTS } from "../experiments/embed/catalogue.ts";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * A manifest's `embeddable: true` is a promise that /embed/lab/<id>/ exists. On 2026-09-23 29
 * manifests made it and 9 were kept, so live /embed/lab/sr-02/ was 404, and the instrument audit's
 * Embed column, which reads only the flag, passed. This ratchet keeps the gap named: an instrument
 * that claims to be embeddable is either in the catalogue or on the list below, and the list may
 * only shrink. Embed an instrument and remove it here in the same change; a new manifest that
 * claims embeddable without an embed fails.
 */
const NOT_YET_EMBEDDED = ["bm-05", "bm-07", "bm-08", "sr-06", "sr-07"];

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
      const html = await exportMarkup(element);
      expect(html).toContain(`href="/lab/${id}/"`);
      expect(html).not.toContain("prepared example did not pass its own check");
      if (!id.startsWith("shelf-")) expect(html).toContain(`data-instrument-id="${id}`);
    });
  }
});

/**
 * Every embed is one route module, so any laboratory the adapter imports directly ships in every
 * embed's first JavaScript: on live 211e9af4 each /embed/lab page loaded 44 scripts, 536,520 bytes
 * gzip. The laboratories are reached only through React.lazy in lazyEmbeddedLabs.tsx. This reads
 * the two modules with comments blanked, so a comment naming a laboratory is not an import of it.
 */
describe("an embed loads its own laboratory and no other", () => {
  const EMBED = fileURLToPath(new URL("../experiments/embed/", import.meta.url));
  const code = (name: string) =>
    readFileSync(join(EMBED, name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const LAB_MODULE = /["']\.\.\/\.\.\/components\/lab\/[^"']+\.tsx["']/g;

  test("the server adapter imports no laboratory component", () => {
    expect(code("adapters.tsx").match(LAB_MODULE) ?? []).toEqual([]);
  });

  test("the wrapper names each laboratory as a type and loads it only through lazy()", () => {
    const wrapper = code("lazyEmbeddedLabs.tsx");
    const typeOnly = wrapper.match(/import type \{ \w+ \} from ["'][^"']+["']/g) ?? [];
    const lazyLoads = wrapper.match(/lazy\(\(\) =>\s*import\(\s*["'][^"']+["']/g) ?? [];
    const all = wrapper.match(LAB_MODULE) ?? [];
    console.log(
      `[embed split] ${all.length} laboratory module references: ${typeOnly.length} type-only, ${lazyLoads.length} lazy`,
    );
    expect(lazyLoads.length).toBeGreaterThan(0);
    expect(all.length).toBe(typeOnly.length + lazyLoads.length);
  });
});
