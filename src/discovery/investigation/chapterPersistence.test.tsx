import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { clearNamespacesWithReport, exportNamespaces } from "../../platform/storage/exportClear.ts";
import {
  CHAPTER_INVESTIGATION_KEYS,
  INVESTIGATION_KEYS,
  storageKeyRegistry,
} from "../../platform/storage/keys.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { CHAPTER_INVESTIGATIONS } from "./chapterTasks.ts";
import { DiscoveryInvestigationProvider, useDiscoveryInvestigation } from "./context.tsx";
import {
  createInvestigationStore,
  type InvestigationReport,
  type InvestigationSpec,
  type InvestigationStore,
  type InvestigationTask,
} from "./core.ts";
import { KeptInvestigations } from "./KeptInvestigations.tsx";
import {
  createInvestigationPersistence,
  readStoredInvestigation,
  saveStoredInvestigation,
} from "./persistence.ts";
import { INVESTIGATIONS } from "./specs.ts";

/** The real report producer over a labelled fixture; these tests exercise storage, not physics. */
function pinned(spec: InvestigationSpec, task?: InvestigationTask): InvestigationReport {
  const identity = {
    experimentId: spec.experimentId,
    instanceId: `fixture-${spec.promptId}`,
    runId: "fixture-run",
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { fixtureSetting: 1 },
  };
  const view = {
    status: "accepted",
    pending: false,
    requested: identity,
    accepted: {
      ...identity,
      snapshotVersion: 1,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: spec.quantities.map(({ id }) => ({
        quantityId: id,
        ownerId: "fixture.storage-boundary",
        unit: "1",
        semanticKind: "fixture",
        status: "value",
        value: 1,
      })),
    },
  };
  const store = createInvestigationStore(spec);
  store.connect({ getSnapshot: () => view, subscribe: () => () => {} }, "fixture-source");
  assert.ok(store.begin(`Prediction for ${spec.promptId}`, task ?? {
    promptId: spec.promptId,
    task: "Predict a change.",
    perturbPrompt: "Change a setting.",
    explainPrompt: "Explain what changed.",
  }).ok);
  const report = store.getSnapshot().report;
  assert.ok(report);
  return report;
}

const ALL = [
  ...Object.entries(INVESTIGATIONS).map(([id, spec]) => ({ id, report: pinned(spec) })),
  ...CHAPTER_INVESTIGATIONS.map((chapter) => ({
    id: chapter.id,
    report: pinned(chapter.spec, chapter.task),
  })),
];
const seen = new Map<string, InvestigationStore>();
function Probe({ id }: { id: string }) {
  const store = useDiscoveryInvestigation();
  if (store) seen.set(id, store);
  return null;
}

describe("chapter investigations keep independent, reachable copies", () => {
  let root: Root;
  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    seen.clear();
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    await uninstallDom();
  });

  test("all seven slots export and a chapter clear leaves every other saved report byte-for-byte", () => {
    expect(INVESTIGATION_KEYS).toEqual({
      "light-quanta": "am:investigations:v1:light-quanta",
      "brownian-motion": "am:investigations:v1:brownian-motion",
      "special-relativity": "am:investigations:v1:special-relativity",
      "mass-energy": "am:investigations:v1:mass-energy",
    });
    const ctx = createStorageContext();
    for (const item of ALL) expect(saveStoredInvestigation(item.id, item.report, ctx)).toBe("saved");
    const before = new Map<string, string | null>(
      [...Object.values(INVESTIGATION_KEYS), ...Object.values(CHAPTER_INVESTIGATION_KEYS)].map(
        (key) => [key, window.localStorage.getItem(key)],
      ),
    );
    for (const key of Object.values(CHAPTER_INVESTIGATION_KEYS)) {
      const registration = storageKeyRegistry.get(key);
      expect(registration?.exportable).toBe(true);
      expect(registration?.clearable).toBe(true);
      expect(exportNamespaces(ctx).namespaces.find((entry) => entry.key === key)).toBeDefined();
    }
    const chapter = CHAPTER_INVESTIGATIONS[1];
    const key = CHAPTER_INVESTIGATION_KEYS[chapter.id];
    expect(clearNamespacesWithReport(ctx, [key])).toEqual({ cleared: [key], failed: [] });
    expect(readStoredInvestigation(chapter.id, ctx).status).toBe("missing");
    for (const [otherKey, raw] of before)
      if (otherKey !== key) expect(window.localStorage.getItem(otherKey)).toBe(raw);
    expect(exportNamespaces(ctx).namespaces.filter((entry) => before.has(entry.key))).toHaveLength(6);
  });

  test("another tab's change conflicts only with the matching prompt slot", () => {
    const first = CHAPTER_INVESTIGATIONS[1];
    const sibling = CHAPTER_INVESTIGATIONS[2];
    const older = createInvestigationPersistence(first.id);
    const newer = createInvestigationPersistence(first.id);
    const separate = createInvestigationPersistence(sibling.id);
    expect(newer.save(pinned(first.spec, first.task))).toBe("saved");
    const saved = window.localStorage.getItem(CHAPTER_INVESTIGATION_KEYS[first.id]);
    expect(older.save(pinned(first.spec, first.task))).toBe("conflict");
    expect(older.clear()).toBe("conflict");
    expect(separate.save(pinned(sibling.spec, sibling.task))).toBe("saved");
    expect(window.localStorage.getItem(CHAPTER_INVESTIGATION_KEYS[first.id])).toBe(saved);
  });

  test("sibling providers restore, save independently, and return through the notebook", async () => {
    for (const item of ALL) expect(saveStoredInvestigation(item.id, item.report)).toBe("saved");
    const originalBytes = Object.values(INVESTIGATION_KEYS).map((key) => [
      key,
      window.localStorage.getItem(key),
    ] as const);
    await act(async () => root.render(
      <>
        {CHAPTER_INVESTIGATIONS.map((chapter) => (
          <DiscoveryInvestigationProvider
            key={chapter.id}
            storageId={chapter.id}
            spec={chapter.spec}
          >
            <Probe id={chapter.id} />
          </DiscoveryInvestigationProvider>
        ))}
      </>,
    ));
    for (const chapter of CHAPTER_INVESTIGATIONS) {
      const store = seen.get(chapter.id);
      assert.ok(store);
      expect(store.getSnapshot().report?.promptId).toBe(chapter.id);
      await act(async () => {
        expect(store.explain(`Kept explanation for ${chapter.id}`).ok).toBe(true);
      });
    }
    for (const [key, raw] of originalBytes) expect(window.localStorage.getItem(key)).toBe(raw);
    await act(async () => root.render(<KeptInvestigations />));
    expect(document.querySelectorAll("[data-kept-investigation]")).toHaveLength(7);
    for (const chapter of CHAPTER_INVESTIGATIONS) {
      const article = document.querySelector(`[data-kept-investigation="${chapter.id}"]`);
      assert.ok(article);
      expect(article.textContent).toContain(`Kept explanation for ${chapter.id}`);
      const prefix = `/papers/${chapter.paper}/${chapter.section}/#${chapter.id}`;
      expect(article.querySelector(`a[href="${prefix}"]`)).not.toBeNull();
      expect(article.querySelector(`a[href="${prefix}-revisit"]`)).not.toBeNull();
    }
  });

  test("a report placed in a sibling slot remains protected", async () => {
    const first = CHAPTER_INVESTIGATIONS[1];
    const sibling = CHAPTER_INVESTIGATIONS[2];
    const raw = JSON.stringify({ schemaVersion: 1, report: pinned(first.spec, first.task) });
    window.localStorage.setItem(CHAPTER_INVESTIGATION_KEYS[sibling.id], raw);
    await act(async () => root.render(
      <DiscoveryInvestigationProvider spec={sibling.spec} storageId={sibling.id}>
        <Probe id={sibling.id} />
      </DiscoveryInvestigationProvider>,
    ));
    expect(seen.get(sibling.id)?.getSnapshot().report).toBeNull();
    expect(window.localStorage.getItem(CHAPTER_INVESTIGATION_KEYS[sibling.id])).toBe(raw);
    await act(async () => root.render(<KeptInvestigations />));
    expect(document.querySelector(`[data-kept-investigation="${sibling.id}"]`)).toBeNull();
    expect(document.body.textContent).toContain("could not be opened");
    expect(window.localStorage.getItem(CHAPTER_INVESTIGATION_KEYS[sibling.id])).toBe(raw);
  });

  test("a chapter notebook download contains its own report and prompt-specific filename", async () => {
    const chapter = CHAPTER_INVESTIGATIONS[2];
    const report = pinned(chapter.spec, chapter.task);
    expect(saveStoredInvestigation(chapter.id, report)).toBe("saved");
    const create = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const previousClick = HTMLAnchorElement.prototype.click;
    const blobs = new Map<string, Blob>();
    const downloads: { name: string; blob: Blob }[] = [];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (blob: Blob) => {
        const url = `blob:http://localhost/chapter-${blobs.size}`;
        blobs.set(url, blob);
        return url;
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
    HTMLAnchorElement.prototype.click = function () {
      const blob = blobs.get(this.href);
      assert.ok(blob);
      downloads.push({ name: this.download, blob });
    };
    try {
      await act(async () => root.render(<KeptInvestigations />));
      const article = document.querySelector(`[data-kept-investigation="${chapter.id}"]`);
      assert.ok(article);
      for (const button of article.querySelectorAll("button"))
        await act(async () => button.click());
      expect(downloads.map((download) => download.name)).toEqual([
        `${chapter.id}-investigation.json`,
        `${chapter.id}-investigation.html`,
      ]);
      const json = downloads[0];
      const html = downloads[1];
      assert.ok(json && html);
      expect(JSON.parse(await json.blob.text())).toEqual(report);
      expect(await html.blob.text()).toContain(report.prediction);
      expect(readStoredInvestigation(chapter.id).report).toEqual(report);
    } finally {
      await act(async () => root.render(null));
      HTMLAnchorElement.prototype.click = previousClick;
      if (create) Object.defineProperty(URL, "createObjectURL", create);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (revoke) Object.defineProperty(URL, "revokeObjectURL", revoke);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });
});
