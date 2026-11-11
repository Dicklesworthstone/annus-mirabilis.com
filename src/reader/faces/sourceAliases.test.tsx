/** Retired links must land beside the same paragraph on every published source face. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { type AliasRecord, resolveAlias } from "../../content/aliases.ts";
import { parseAnchor, sectionAnchorOf } from "../../content/anchors.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

const PAPERS = ["mass-energy", "brownian-motion", "light-quanta", "special-relativity"] as const;

function retiredAddresses(paper: string) {
  const raw = parseYaml(
    readFileSync(join(process.cwd(), "content/aliases", `${paper}.yaml`), "utf8"),
  ) as { aliases: AliasRecord[] };
  return raw.aliases.flatMap((alias) => {
    const resolved = resolveAlias(alias.retiredId, raw.aliases);
    if (!resolved.ok) throw new Error(resolved.error);
    const target = resolved.targetIds[0];
    return target && parseAnchor(alias.retiredId).ok && parseAnchor(target).ok
      ? [{ retired: alias.retiredId, target }]
      : [];
  });
}

async function face(paperId: string, name: string, section?: string) {
  const window = new Window();
  window.document.body.innerHTML = await exportMarkup(
    await PaperPage({
      paperId,
      face: name,
      ...(section ? { section } : {}),
    }),
  );
  return window;
}

function assertLanding(document: Document, retired: string, target: string) {
  const aliases = [...document.querySelectorAll("[id]")].filter(
    (element) => element.id === retired,
  );
  const targets = [...document.querySelectorAll("[id]")].filter((element) => element.id === target);
  expect(aliases.length).toBe(1);
  expect(targets.length).toBe(1);
  const anchor = aliases[0];
  expect(anchor?.getAttribute("data-alias-of")).toBe(target);
  expect(anchor?.hasAttribute("hidden")).toBe(false);
  expect(anchor?.closest("[hidden]")).toBeNull();
}

describe("published retired addresses across source faces", () => {
  for (const paper of PAPERS) {
    for (const name of ["german", "english", "parallel", "facsimile"]) {
      test(`${paper}: ${name} publishes unique, visible aliases and their current targets`, async () => {
        const aliases = retiredAddresses(paper);
        expect(aliases.length).toBeGreaterThan(0);
        const window = await face(paper, name);
        try {
          const document = window.document as unknown as Document;
          for (const { retired, target } of aliases) assertLanding(document, retired, target);
          console.log(
            `[source-aliases] ${paper}/${name}: ${aliases.length} retired addresses and their successors checked`,
          );
        } finally {
          await window.happyDOM.close();
        }
      }, 60_000);
    }

    const aliases = retiredAddresses(paper);
    for (const section of new Set(aliases.map(({ target }) => sectionAnchorOf(target)))) {
      if (!section) throw new Error("An authored paragraph alias needs a section.");
      test(`${paper}/${section}: gloss keeps aliases beside their own paragraph only`, async () => {
        let checked = 0;
        const window = await face(paper, "gloss", section);
        try {
          const document = window.document as unknown as Document;
          for (const { retired, target } of aliases) {
            if (sectionAnchorOf(target) === section) {
              assertLanding(document, retired, target);
              expect(
                document
                  .getElementById(retired)
                  ?.closest("[data-block-id]")
                  ?.getAttribute("data-block-id"),
              ).toBe(target);
              checked++;
            } else {
              expect(document.getElementById(retired)).toBeNull();
            }
          }
        } finally {
          await window.happyDOM.close();
        }
        expect(checked).toBeGreaterThan(0);
        console.log(
          `[source-aliases] ${paper}/${section}/gloss: ${checked} retired addresses checked`,
        );
      }, 60_000);
    }
  }
});
