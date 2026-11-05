import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { INVESTIGATION_KEYS } from "../../platform/storage/keys.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createInvestigationStore, type InvestigationReport } from "./core.ts";
import { KeptInvestigations } from "./KeptInvestigations.tsx";
import { INVESTIGATIONS } from "./specs.ts";

type Paper = keyof typeof INVESTIGATIONS;
const KEY = INVESTIGATION_KEYS["brownian-motion"];

/** Exercise the same report producer and stored envelope that the discovery provider uses. */
function keptReport(paper: Paper = "brownian-motion"): InvestigationReport {
  const spec = INVESTIGATIONS[paper];
  let action = 1;
  const session = {
    getSnapshot() {
      const identity = {
        experimentId: spec.experimentId,
        instanceId: "placement-A",
        runId: `run-${action}`,
        actionIndex: action,
        revisions: { input: action, observer: 0, measurement: 0, estimator: 0 },
        parameters: { a: action * 5e-7, seed: "18446744073709551615" },
      };
      return {
        status: "accepted",
        pending: false,
        requested: { ...identity },
        accepted: {
          ...identity,
          snapshotVersion: action,
          stepIndex: 20,
          simulationTime: 1,
          final: true,
          outputs: spec.quantities.map(({ id }, i) => ({
            quantityId: id,
            ownerId: "fixture.reference",
            unit: "m",
            semanticKind: "coordinate-rms",
            status: "value",
            value: i ? 6e-6 / action : 8e-7 / action,
          })),
        },
      };
    },
    subscribe: () => () => {},
  };
  const store = createInvestigationStore(spec);
  store.connect(session, "fixture-source-v1");
  const begun = store.begin("The spread will get smaller.", {
    promptId: spec.promptId,
    task: "What happens when one setting changes?",
    perturbPrompt: "Change one setting.",
    explainPrompt: "Explain the change and the model's limits.",
  });
  if (!begun.ok) throw new Error(`Could not pin fixture: ${begun.message}`);
  action = 2;
  const captured = store.capture("Changed reading");
  if (!captured.ok) throw new Error(`Could not capture fixture: ${captured.message}`);
  const explained = store.explain("One changed setting explains the model's smaller spread.");
  if (!explained.ok) throw new Error(`Could not explain fixture: ${explained.message}`);
  const report = store.getSnapshot().report;
  if (!report) throw new Error("Fixture produced no report");
  return report;
}

function save(report: InvestigationReport, key: string = KEY): string {
  const raw = JSON.stringify({ schemaVersion: 1, report });
  window.localStorage.setItem(key, raw);
  return raw;
}

function restoreProperty(target: object, name: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, name, descriptor);
  else Reflect.deleteProperty(target, name);
}

describe("discovery investigations in the reading notebook", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;
  let createUrl: PropertyDescriptor | undefined;
  let revokeUrl: PropertyDescriptor | undefined;
  let clickAnchor: typeof HTMLAnchorElement.prototype.click;
  let downloaded: { filename: string; blob: Blob }[];
  let blobs: Map<string, Blob>;

  beforeEach(async () => {
    await installDom();
    window.localStorage.clear();
    container = createContainer();
    root = createRoot(container);
    downloaded = [];
    blobs = new Map();
    createUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    revokeUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    clickAnchor = HTMLAnchorElement.prototype.click;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (blob: Blob) => {
        const url = `blob:http://localhost/investigation-${blobs.size}`;
        blobs.set(url, blob);
        return url;
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: () => {},
    });
    HTMLAnchorElement.prototype.click = function () {
      const blob = blobs.get(this.href);
      if (!blob) throw new Error("A download did not use a local object URL");
      downloaded.push({ filename: this.download, blob });
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    HTMLAnchorElement.prototype.click = clickAnchor;
    restoreProperty(URL, "createObjectURL", createUrl);
    restoreProperty(URL, "revokeObjectURL", revokeUrl);
    removeContainer(container);
    await uninstallDom();
  });

  async function mount() {
    await act(async () => root.render(<KeptInvestigations />));
  }

  async function click(label: string) {
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === label,
    );
    if (!button) throw new Error(`Missing button: ${label}`);
    await act(async () => button.click());
  }

  test("an empty device offers a journey without claiming there is saved work", async () => {
    await mount();
    expect(container.querySelectorAll("[data-kept-investigation]")).toHaveLength(0);
    expect(container.textContent).toContain("No discovery investigations are kept");
    expect(container.querySelector('a[href="/discover/brownian-motion/"]')).not.toBeNull();
  });

  test("all four published investigations reuse their saved records and canonical return links", async () => {
    const originals = new Map<string, string>();
    for (const paper of Object.keys(INVESTIGATIONS) as Paper[]) {
      originals.set(INVESTIGATION_KEYS[paper], save(keptReport(paper), INVESTIGATION_KEYS[paper]));
    }
    await mount();
    expect(container.querySelectorAll("[data-kept-investigation]")).toHaveLength(4);
    for (const paper of Object.keys(INVESTIGATIONS) as Paper[]) {
      const article = container.querySelector(`[data-kept-investigation="${paper}"]`);
      expect(article?.querySelector("[data-kept-prediction]")?.textContent).toBe(
        "The spread will get smaller.",
      );
      expect(article?.querySelector("[data-kept-explanation]")?.textContent).toBe(
        "One changed setting explains the model's smaller spread.",
      );
      expect(article?.textContent).toContain("1 changed reading");
      const link = article?.querySelector("a");
      expect(link?.getAttribute("href")).toBe(
        `/discover/${paper}/#${INVESTIGATIONS[paper].promptId}`,
      );
      expect(window.localStorage.getItem(INVESTIGATION_KEYS[paper])).toBe(
        originals.get(INVESTIGATION_KEYS[paper]) as string,
      );
    }
  });

  test("reader text stays inert and a stored source URL cannot change navigation", async () => {
    const prediction = '<img src=x onerror="alert(1)">';
    const report = {
      ...keptReport(),
      prediction,
      explanation: "<script>alert(2)</script>",
      sourceHref: "javascript:alert(3)",
    };
    save(report);
    await mount();
    expect(container.querySelector("[data-kept-prediction]")?.textContent).toBe(prediction);
    expect(container.querySelector("[data-kept-explanation]")?.textContent).toBe(
      report.explanation,
    );
    expect(container.querySelector("img, script")).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(
      container.querySelector(`a[href="${INVESTIGATIONS["brownian-motion"].sourceHref}"]`),
    ).not.toBeNull();
  });

  test("a valid report under the wrong paper's key is preserved and refused", async () => {
    const raw = save(keptReport("light-quanta"));
    await mount();
    expect(container.querySelectorAll("[data-kept-investigation]")).toHaveLength(0);
    expect(container.textContent).toContain("could not be opened in this edition");
    expect(window.localStorage.getItem(KEY)).toBe(raw);
  });

  test("unreadable bytes remain recoverable through the existing quarantine", async () => {
    window.localStorage.setItem(KEY, "{not valid json");
    await mount();
    expect(container.textContent).toContain("could not be opened in this edition");
    expect(container.querySelector('a[href="/your-data/"]')).not.toBeNull();
    const quarantine = JSON.parse(window.localStorage.getItem("am:quarantine:v1") as string);
    expect(quarantine.entries[0].originalKey).toBe(KEY);
    expect(quarantine.entries[0].rawValue).toBe("{not valid json");
  });

  test("blocked storage is reported without claiming that saved work is empty", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked by the browser", "SecurityError");
      },
    });
    try {
      await mount();
      expect(container.textContent).toContain("browser storage is blocked or unavailable");
      expect(container.textContent).not.toContain("No discovery investigations are kept");
      expect(container.querySelectorAll("[data-kept-investigation]")).toHaveLength(0);
    } finally {
      restoreProperty(window, "localStorage", original);
    }
  });

  test("JSON and printable downloads retain the complete report even when storage is full", async () => {
    const report = keptReport();
    const raw = save(report);
    const writes = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    try {
      await mount();
      await click("Download investigation JSON");
      await click("Download printable investigation");
      expect(downloaded).toHaveLength(2);
      const [jsonDownload, htmlDownload] = downloaded;
      if (!jsonDownload || !htmlDownload)
        throw new Error("Both investigation downloads must start");
      expect(jsonDownload.filename).toBe("brownian-motion-investigation.json");
      expect(JSON.parse(await jsonDownload.blob.text())).toEqual(report);
      expect(htmlDownload.filename).toBe("brownian-motion-investigation.html");
      const html = await htmlDownload.blob.text();
      const readable = new DOMParser().parseFromString(html, "text/html");
      expect(readable.body.textContent).toContain(report.prediction);
      expect(readable.body.textContent).toContain(report.explanation);
      expect(html).toContain("Changed reading");
      expect(html).toContain("Content-Security-Policy");
      expect(writes).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(KEY)).toBe(raw);
    } finally {
      writes.mockRestore();
    }
  });

  test("a failed download tells the reader and leaves the saved report intact", async () => {
    const raw = save(keptReport());
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => {
        throw new Error("Downloads are blocked");
      },
    });
    await mount();
    await click("Download investigation JSON");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "The download could not start",
    );
    expect(window.localStorage.getItem(KEY)).toBe(raw);
  });

  test("clearing the investigation in another tab removes its notebook card", async () => {
    save(keptReport());
    await mount();
    expect(container.querySelectorAll("[data-kept-investigation]")).toHaveLength(1);
    await act(async () => {
      window.localStorage.removeItem(KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(container.querySelectorAll("[data-kept-investigation]")).toHaveLength(0);
    expect(container.textContent).toContain("No discovery investigations are kept");
    expect(container.textContent).toContain("Clearing the reading notebook above keeps");
  });
});
