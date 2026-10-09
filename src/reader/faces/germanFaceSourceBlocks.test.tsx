/**
 * EVERY PAPER'S GERMAN FACE RENDERS ITS SOURCE BLOCKS (dispatch 255, step 0; TanElk's mail 40854).
 *
 * Until dispatch 255, light quanta's, Brownian's and mass-energy's German faces rendered the ledger
 * drafts (GermanDraftFace), and relativity's the source blocks (GermanFace). Measured on live
 * 0bda925c: the three draft faces carried no sentence spans, so Brownian's 91 frozen sentence ids
 * (s0-p1-s1 …) had no anchor on its German face and a link to one landed nowhere. The draft face
 * existed because segmented blocks had no page locators; every source block of all four papers now
 * has them (LQ 129 blocks, Brownian 88, mass-energy 25, relativity 214).
 *
 * So every German face now renders its source blocks, keeping what the draft face gave a reader:
 * - the printed page beside the text (the plate), where the paper's plates are published;
 * - "Explained in" (or "Not yet explained") under the paragraphs;
 * - the footnotes set apart from the running text;
 * - every frozen manifest id as an anchor, and each retired id only as an alias on the block that
 *   absorbed it (content/aliases).
 * The manifest and the aliases are read here from their files, not from what the face renders.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

const ROOT = process.cwd();
const PAPERS = [
  { slug: "special-relativity", key: "ap-17-891" },
  { slug: "light-quanta", key: "ap-17-132" },
  { slug: "brownian-motion", key: "ap-17-549" },
  { slug: "mass-energy", key: "ap-18-639" },
] as const;

type Alias = Readonly<{ retiredId: string; replacementIds?: readonly string[] }>;

/**
 * UNIT KINDS THE ANCHOR GRAMMAR DEFINES NO ANCHOR FOR.
 *
 * AGENTS.md's anchor list is `#s<n>`, `#s<n>-p<m>`, `#s<n>-p<m>-s<k>`, `#eq-...`, `#result-...`,
 * `#arg-...`, `#lab-...`, `#entry-...`. There is no `#s<n>-p<m>-s<k>-m<i>` in it, so an inline
 * equation is a unit of the INVENTORY with no address on a reading face, which is the right
 * reading: the formula is inside its sentence's text, and that sentence's anchor is where a reader
 * arrives. Giving 270 of them their own anchors would be a reader-facing change to the German
 * face, which no inventory bead implies.
 *
 * Excluded BY KIND, read from the manifest, never by matching the id. An id-pattern exclusion
 * would also swallow a genuinely missing sentence anchor whose id happened to look similar, and
 * this check exists to catch exactly that.
 */
const UNANCHORED_KINDS = new Set(["inline-equation"]);

function manifestUnits(paper: string): readonly { id: string; kind?: string }[] {
  const raw = parseYaml(
    readFileSync(join(ROOT, "content", "source-blocks", paper, "manifest.yaml"), "utf8"),
  ) as { units?: readonly { id: string; kind?: string }[] };
  return raw.units ?? [];
}

function manifestIds(paper: string): string[] {
  return manifestUnits(paper)
    .filter((u) => !UNANCHORED_KINDS.has(u.kind ?? ""))
    .map((u) => u.id);
}

function aliases(paper: string): Alias[] {
  const path = join(ROOT, "content", "aliases", `${paper}.yaml`);
  if (!existsSync(path)) return [];
  const raw = parseYaml(readFileSync(path, "utf8")) as { aliases?: readonly Alias[] } | null;
  return [...(raw?.aliases ?? [])];
}

async function germanFace(paper: string) {
  const html = await exportMarkup(await PaperPage({ paperId: paper, face: "german" } as never));
  const { document } = new Window();
  document.body.innerHTML = html;
  return document as unknown as Document;
}

describe("every German face renders its source blocks (dispatch 255, step 0)", () => {
  for (const { slug, key } of PAPERS) {
    test(`${slug}: the German face is the source blocks', with every anchor, alias, plate and line the draft face had`, async () => {
      const document = await germanFace(slug);
      const problems: string[] = [];

      if (!document.querySelector('[data-face="german"] [data-source-body]'))
        problems.push("the German face does not render the source blocks");
      if (document.querySelector("[data-german-draft]"))
        problems.push("the German face still renders the ledger draft");

      // The exclusion is not allowed to be vacuous: if no unit of an unanchored kind existed, the
      // filter above would be doing nothing and this check would silently become the old, stronger
      // one. Each paper carries inline-equation units since 2026-10-09, so this holds and says so.
      const unanchored = manifestUnits(slug).filter((u) => UNANCHORED_KINDS.has(u.kind ?? ""));
      if (unanchored.length === 0)
        problems.push("no unit of an unanchored kind: the kind filter is doing nothing");

      const retired = aliases(slug);
      const retiredIds = new Set(retired.map((a) => a.retiredId));
      const live = manifestIds(slug).filter((id) => !retiredIds.has(id));
      const missing = live.filter((id) => {
        const el = document.getElementById(id);
        return !el || el.hasAttribute("data-alias-of");
      });
      if (missing.length > 0)
        problems.push(
          `${missing.length} of ${live.length} manifest ids have no anchor: ${missing.slice(0, 8).join(", ")}`,
        );

      // An alias is published for a retired id whose replacement the face publishes (a block or a
      // sentence), as manifestAnchors.ts has it; a reference occurrence (s2-p2-s1-r3) is no anchor,
      // so an alias to it would lead nowhere, and it is counted rather than required.
      let unpublished = 0;
      for (const a of retired) {
        const el = document.getElementById(a.retiredId);
        const target = a.replacementIds?.[0];
        const targetEl = target ? document.getElementById(target) : null;
        if (!targetEl || targetEl.hasAttribute("data-alias-of")) {
          unpublished++;
          if (el)
            problems.push(`retired ${a.retiredId} is an alias of ${target}, which is no anchor`);
          continue;
        }
        if (!el) problems.push(`retired ${a.retiredId} has no alias`);
        else if (el.getAttribute("data-alias-of") !== target)
          problems.push(
            `retired ${a.retiredId} is not an alias of ${target} (${el.tagName.toLowerCase()} data-alias-of=${el.getAttribute("data-alias-of")})`,
          );
      }

      const platesDir = join(ROOT, "public", "figures", "plates", "pages", key);
      const hasPlates =
        existsSync(platesDir) && readdirSync(platesDir).some((f) => f.endsWith(".webp"));
      if (hasPlates && !document.querySelector(".source-plate"))
        problems.push("the plate is missing, though the paper's plates are published");

      const explained = document.querySelectorAll(
        "[data-explained-by], [data-not-explained]",
      ).length;
      if (explained === 0) problems.push("no paragraph says where it is explained");

      const footnotes = [...document.querySelectorAll('[id*="-fn"]')].filter(
        (el) => !el.hasAttribute("data-alias-of") && /^s\d+-fn\d+$/.test(el.id),
      );
      const outside = footnotes.filter((el) => !el.closest(".reader-footnotes, .source-footnotes"));
      if (outside.length > 0)
        problems.push(
          `${outside.length} footnotes stand in the running text: ${outside.map((el) => el.id).join(", ")}`,
        );

      console.log(
        `[german face] ${slug}: ${live.length} anchorable manifest ids (${unanchored.length} inline-equation units excluded, no anchor in the grammar), ${retired.length - unpublished} aliases published (${unpublished} to reference occurrences, not anchors), ${explained} explained lines, ${footnotes.length} footnotes; ${problems.length} problems`,
      );
      expect(problems).toEqual([]);
    });
  }
});
