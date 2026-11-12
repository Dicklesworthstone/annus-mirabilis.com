import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { DISCOVERY_NOTE_KEYS } from "../../platform/storage/keys.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { journeyNoteManifest } from "../journeys/noteCompatibility.ts";
import { MASS_ENERGY_STAGES } from "../massEnergy/stages.ts";
import { decodeNotebook, emptyNotebook, encodeNotebook, recordPrediction } from "../notebook.ts";
import { createNotebookSession, type NotebookStoragePort } from "../notebookSession.ts";
import { SPECIAL_RELATIVITY_STAGES } from "../relativity/stages.ts";
import { DiscoveryNotebookProvider } from "./context.tsx";
import { notebookHtml } from "./files.ts";
import { stageNoteManifest } from "./manifest.ts";
import { DiscoveryNotebookControls } from "./NotebookControls.tsx";

const published = [
  { paper: "mass-energy", stages: MASS_ENERGY_STAGES },
  { paper: "special-relativity", stages: SPECIAL_RELATIVITY_STAGES },
] as const;

function memory(raw: string) {
  let value = raw;
  const writes: string[] = [];
  const port: NotebookStoragePort = {
    read: () => ({ status: "ok", value }),
    write(next) {
      writes.push(next);
      value = next;
      return { status: "ok" };
    },
  };
  return { port, writes, raw: () => value };
}

describe("keeping stage notes through verified move-only guide revisions", () => {
  for (const { paper, stages } of published) {
    const prior = stageNoteManifest(paper, 4, stages);
    const current = journeyNoteManifest(paper, 5, stages);
    const first = stages[0];
    if (!first) throw new Error("The published guide must have a first stage.");
    const old = recordPrediction(
      emptyNotebook(prior),
      prior,
      first.id,
      "My earlier prediction",
      null,
    );
    const raw = JSON.stringify(old, null, 2);

    test(`${paper}: opening preserves the original bytes, revision and answers`, () => {
      expect(current.compatibleRevisions).toEqual(["4"]);
      const storage = memory(raw);
      const session = createNotebookSession(current, storage.port);
      session.load();
      expect(session.getSnapshot().blocked).toBe(false);
      expect(session.getSnapshot().document).toEqual(old);
      expect(storage.raw()).toBe(raw);
      expect(storage.writes).toHaveLength(0);

      expect(session.observe(first.id, 0, "What I noticed in the updated guide")).toBe(true);
      expect(session.capture(first.id, "A second attempt", null)).toBe(true);
      const saved = decodeNotebook(storage.raw(), current);
      expect(saved.journeyRevision).toBe("4");
      expect(saved.entries[0]?.attempts).toEqual([
        {
          prediction: "My earlier prediction",
          alternativeId: null,
          observation: "What I noticed in the updated guide",
        },
        { prediction: "A second attempt", alternativeId: null, observation: "" },
      ]);
      expect(JSON.parse(session.exportNotes()).journeyRevision).toBe("4");
      const printable = notebookHtml(saved, current);
      expect(printable).toContain("Original guide revision: 4.");
      expect(printable).toContain("Compatible current guide revision: 5.");
    });

    test(`${paper}: compatible imports keep identity and new notebooks use today's revision`, () => {
      const storage = memory(encodeNotebook(emptyNotebook(current), current));
      const session = createNotebookSession(current, storage.port);
      session.load();
      expect(session.getSnapshot().document.journeyRevision).toBe("5");
      expect(session.completeImport(session.beginImport(), raw)).toBe(true);
      expect(session.getSnapshot().document.journeyRevision).toBe("4");
      expect(session.getSnapshot().document.entries).toEqual(old.entries);
    });

    test(`${paper}: a changed question or prediction disables old-revision admission`, () => {
      for (const changed of [
        [{ ...first, question: `${first.question} A different question.` }, ...stages.slice(1)],
        [
          {
            ...first,
            support: {
              ...first.support,
              explanation: `${first.support.explanation} A changed explanation.`,
            },
          },
          ...stages.slice(1),
        ],
      ]) {
        const altered = journeyNoteManifest(paper, 5, changed);
        expect(altered.compatibleRevisions).toBeUndefined();
        expect(() => decodeNotebook(raw, altered)).toThrow("different guide revision");
      }
    });

    test(`${paper}: compatibility never means any earlier or later revision`, () => {
      for (const revision of ["3", "6", "5.1"]) {
        const other = JSON.stringify({ ...old, journeyRevision: revision });
        const storage = memory(other);
        const session = createNotebookSession(current, storage.port);
        session.load();
        expect(session.getSnapshot().blocked).toBe(true);
        expect(session.getSnapshot().retainedRaw).toBe(other);
        expect(session.capture(first.id, "Do not overwrite the original", null)).toBe(false);
        expect(storage.raw()).toBe(other);
        expect(storage.writes).toHaveLength(0);
      }
      const futureGuide = journeyNoteManifest(paper, 6, stages);
      expect(futureGuide.compatibleRevisions).toBeUndefined();
      expect(() => decodeNotebook(raw, futureGuide)).toThrow("different guide revision");
      expect(() =>
        decodeNotebook(JSON.stringify({ ...old, paper: "light-quanta" }), current),
      ).toThrow("different paper");
      expect(() =>
        decodeNotebook(
          JSON.stringify({
            ...old,
            entries: [
              {
                ...old.entries[0],
                attempts: [{ prediction: "A choice", alternativeId: "invented", observation: "" }],
              },
            ],
          }),
          current,
        ),
      ).toThrow("alternative does not belong");
    });
  }
});

describe("original revision identity in the live notes controls", () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    container = createContainer();
    const { createRoot } = await import("react-dom/client");
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  test("an existing mass-energy notebook remains usable and is identified as originating in revision4", async () => {
    const oldManifest = stageNoteManifest("mass-energy", 4, MASS_ENERGY_STAGES);
    const current = journeyNoteManifest("mass-energy", 5, MASS_ENERGY_STAGES);
    const raw = encodeNotebook(
      recordPrediction(
        emptyNotebook(oldManifest),
        oldManifest,
        "step-01",
        "My saved prediction",
        null,
      ),
      oldManifest,
    );
    const key = DISCOVERY_NOTE_KEYS["mass-energy"];
    window.localStorage.setItem(key, raw);
    await act(async () => {
      root.render(
        <StrictMode>
          <DiscoveryNotebookProvider manifest={current}>
            <DiscoveryNotebookControls />
          </DiscoveryNotebookProvider>
        </StrictMode>,
      );
    });
    expect(window.localStorage.getItem(key)).toBe(raw);
    expect(container.querySelector("[data-notes-compatible-revision]")?.textContent).toContain(
      "notes began with guide revision 4",
    );
    expect(container.querySelector("[data-notes-compatible-revision]")?.textContent).toContain(
      "unchanged in revision 5",
    );
    const exportButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Show copyable notes JSON",
    );
    expect(exportButton?.disabled).toBe(false);
    await act(async () => exportButton?.click());
    const copy = container.querySelector<HTMLTextAreaElement>('textarea[id$="-export"]');
    expect(JSON.parse(copy?.value ?? "{}").journeyRevision).toBe("4");
    expect(window.localStorage.getItem(key)).toBe(raw);
  });
});
