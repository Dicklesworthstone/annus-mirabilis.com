import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { DISCOVERY_NOTE_KEYS } from "../../platform/storage/keys.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import {
  decodeNotebook,
  emptyNotebook,
  encodeNotebook,
  NOTE_FILE_LIMIT,
  recordObservation,
  recordPrediction,
} from "../notebook.ts";
import { DiscoveryNotebookProvider } from "./context.tsx";
import { notebookHtml } from "./files.ts";
import { KeptStageNotes } from "./KeptStageNotes.tsx";
import { stageNoteManifest } from "./manifest.ts";
import { DiscoveryNotebookControls } from "./NotebookControls.tsx";
import { DiscoveryStageNotes } from "./StageNotes.tsx";

const manifest = stageNoteManifest("mass-energy", "1", [
  { id: "step-one", title: "One emission" },
  { id: "step-two", title: "Compare the frames" },
]);
const key = DISCOVERY_NOTE_KEYS[manifest.paper];
function savedFile(prediction: string) {
  return encodeNotebook(
    recordPrediction(emptyNotebook(manifest), manifest, "step-one", prediction, null),
    manifest,
  );
}
function Guide() {
  return (
    <DiscoveryNotebookProvider manifest={manifest}>
      <DiscoveryNotebookControls />
      <DiscoveryStageNotes stageId="step-one" prompt="What will the body lose?" />
      <p data-explanation>The worked explanation stays available.</p>
      <DiscoveryStageNotes stageId="step-two" prompt="What changes between the two frames?" />
    </DiscoveryNotebookProvider>
  );
}

describe("a reader's notes across the authored discovery steps", () => {
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
  async function mount() {
    await act(async () =>
      root.render(
        <StrictMode>
          <Guide />
        </StrictMode>,
      ),
    );
  }
  function area(selector: string): HTMLTextAreaElement {
    const found = container.querySelector<HTMLTextAreaElement>(selector);
    if (!found) throw new Error(`Missing field: ${selector}`);
    return found;
  }
  function prediction(stage = "step-one") {
    return area(`[data-discovery-stage-notes="${stage}"] textarea[id$="-prediction"]`);
  }
  async function type(field: HTMLTextAreaElement, text: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (!setter) throw new Error("The textarea must expose its native value setter");
      setter.call(field, text);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  function button(label: string, within: ParentNode = container) {
    const found = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
      (item) => item.textContent === label,
    );
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  }
  async function click(label: string, within: ParentNode = container) {
    await act(async () => button(label, within).click());
  }
  async function record(text: string, stage = "step-one") {
    await type(prediction(stage), text);
    const host = container.querySelector(`[data-discovery-stage-notes="${stage}"]`);
    if (!host) throw new Error("Stage is missing");
    await click("Record this prediction", host);
  }
  function stored() {
    return decodeNotebook(window.localStorage.getItem(key) ?? "", manifest);
  }
  async function paste(raw: string) {
    await type(area('textarea[id$="-paste"]'), raw);
    await click("Check pasted notes");
  }
  async function choose(file: { size: number; text(): Promise<string> }) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Missing file chooser");
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  test("arrival and draft text do not write, and the no-JavaScript explanation remains outside notes", async () => {
    const markup = renderToStaticMarkup(<Guide />);
    expect(markup).toContain("Recording notes needs JavaScript");
    expect(markup).toContain("<fieldset disabled");
    expect(markup).toContain("The worked explanation stays available.");
    await mount();
    await type(prediction(), "Still thinking");
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(container.querySelector("[data-explanation]")?.closest("details")).toBeNull();
    expect(button("Record this prediction").disabled).toBe(false);
  });

  test("recording across two steps and a reload preserves every prediction and observation", async () => {
    await mount();
    await record("The rest frame stays balanced.");
    await type(area('textarea[id$="-observation"]'), "The opposite light pulses cancel momentum.");
    await click("Save this observation");
    await record("The moving frame loses kinetic energy.", "step-two");
    await record("My revised expectation.");
    const doc = stored();
    expect(doc.entries.map((entry) => entry.stageId)).toEqual(["step-one", "step-two"]);
    expect(doc.entries[0]?.attempts).toEqual([
      {
        prediction: "The rest frame stays balanced.",
        alternativeId: null,
        observation: "The opposite light pulses cancel momentum.",
      },
      { prediction: "My revised expectation.", alternativeId: null, observation: "" },
    ]);
    await act(async () => root.render(null));
    await mount();
    expect(container.textContent).toContain("The rest frame stays balanced.");
    expect(area('textarea[id$="-observation"]').value).toBe(
      "The opposite light pulses cancel momentum.",
    );
    expect(prediction().value).toBe("");
    expect(stored()).toEqual(doc);
  });

  test("a checked import requires explicit replacement and resets drafts only after confirmation", async () => {
    window.localStorage.setItem(key, savedFile("Original prediction"));
    await mount();
    await type(prediction(), "Unsaved new thought");
    const original = window.localStorage.getItem(key);
    await paste(savedFile("Imported prediction"));
    expect(window.localStorage.getItem(key)).toBe(original);
    expect(prediction().value).toBe("Unsaved new thought");
    expect(container.querySelector("[data-discovery-notes-preview]")?.textContent).toContain(
      "Imported prediction",
    );
    await click("Replace this guide’s notes with this file");
    expect(stored().entries[0]?.attempts[0]?.prediction).toBe("Imported prediction");
    expect(prediction().value).toBe("");
    expect(container.querySelector("[data-discovery-notes-preview]")).toBeNull();
    expect(document.activeElement?.tagName).toBe("SUMMARY");
  });

  test("a new draft invalidates a preview and a late file read cannot discard that draft", async () => {
    await mount();
    await paste(savedFile("Would replace"));
    await type(prediction(), "Newer thought");
    expect(container.querySelector("[data-discovery-notes-preview]")).toBeNull();
    let complete: ((raw: string) => void) | undefined;
    const pending = new Promise<string>((resolve) => {
      complete = resolve;
    });
    await choose({ size: 20, text: () => pending });
    await type(prediction(), "An even newer thought");
    await act(async () => complete?.(savedFile("Late import")));
    expect(container.querySelector("[data-discovery-notes-preview]")).toBeNull();
    expect(prediction().value).toBe("An even newer thought");
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  test("malformed, mismatched and oversized imports preserve the existing bytes", async () => {
    const original = savedFile("Keep this prediction");
    window.localStorage.setItem(key, original);
    await mount();
    for (const invalid of [
      "{broken",
      original.replace('"mass-energy"', '"brownian-motion"'),
      original.replace('"journeyRevision":"1"', '"journeyRevision":"retired"'),
    ]) {
      await paste(invalid);
      expect(container.querySelector("[data-discovery-notes-preview]")).toBeNull();
      expect(window.localStorage.getItem(key)).toBe(original);
    }
    let reads = 0;
    await choose({
      size: NOTE_FILE_LIMIT + 1,
      text: async () => {
        reads += 1;
        return original;
      },
    });
    expect(reads).toBe(0);
    expect(container.textContent).toContain("file is too large");
    expect(window.localStorage.getItem(key)).toBe(original);
  });

  test("another tab's change blocks a save and preserves both versions for export", async () => {
    const local = savedFile("This tab's prediction");
    window.localStorage.setItem(key, local);
    await mount();
    const remote = savedFile("The other tab's prediction");
    window.localStorage.setItem(key, remote);
    await record("New work in this tab");
    expect(window.localStorage.getItem(key)).toBe(remote);
    expect(container.textContent).toContain("Stored notes changed elsewhere");
    await click("Show copyable notes JSON");
    expect(area('textarea[id$="-export"]').value).toBe(local);
    expect(area('textarea[id$="-original"]').value).toBe(remote);
    expect(prediction().value).toBe("New work in this tab");
  });

  test("unreadable stored notes are offered unchanged and clearing requires a second action", async () => {
    const original = '{"older":"keep me"}';
    window.localStorage.setItem(key, original);
    await mount();
    expect(area('textarea[id$="-original"]').value).toBe(original);
    expect(prediction().closest("fieldset")?.disabled).toBe(true);
    await click("Clear this guide’s notes…");
    expect(window.localStorage.getItem(key)).toBe(original);
    await click("Keep my notes");
    expect(window.localStorage.getItem(key)).toBe(original);
    await click("Clear this guide’s notes…");
    await click("Yes, clear this guide’s recorded notes");
    expect(stored().entries).toEqual([]);
    expect(prediction().closest("fieldset")?.disabled).toBe(false);
  });

  test("blocked storage still allows recording and a copyable export with honest feedback", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    await mount();
    await record("A temporary prediction");
    expect(container.textContent).toContain(
      "Recorded in this tab, but device storage did not save it",
    );
    await click("Show copyable notes JSON");
    expect(
      decodeNotebook(area('textarea[id$="-export"]').value, manifest).entries[0]?.attempts[0]
        ?.prediction,
    ).toBe("A temporary prediction");
  });

  test("JSON and readable downloads contain both saved steps and exclude a newer draft", async () => {
    await mount();
    await record("First saved prediction");
    await record("Second saved prediction", "step-two");
    await type(prediction(), "This draft is not recorded");
    const blobs = new Map<string, Blob>();
    const saved: { name: string; blob: Blob }[] = [];
    const create = URL.createObjectURL;
    const revoke = URL.revokeObjectURL;
    const anchorClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => {
      if (!(blob instanceof Blob)) throw new Error("A notes download must contain a text file");
      const url = `blob:notes-${blobs.size}`;
      blobs.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {
      const blob = blobs.get(this.href);
      if (!blob) throw new Error("Download must reference the prepared local file");
      saved.push({ name: this.download, blob });
    };
    try {
      await click("Download notes JSON");
      await click("Download readable notes");
      expect(saved.map((item) => item.name)).toEqual([
        "mass-energy-discovery-notes.json",
        "mass-energy-discovery-notes.html",
      ]);
      const json = await saved[0]?.blob.text();
      expect(decodeNotebook(json ?? "", manifest)).toEqual(stored());
      const html = await saved[1]?.blob.text();
      expect(html).toContain("First saved prediction");
      expect(html).toContain("Second saved prediction");
      expect(html).not.toContain("This draft is not recorded");
      expect(container.textContent).toContain("Nothing was uploaded.");
      await act(async () => root.render(null));
    } finally {
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
      HTMLAnchorElement.prototype.click = anchorClick;
    }
  });

  test("the notebook page reads the exact guide record with safe return links", async () => {
    window.localStorage.setItem(key, savedFile("<script>Reader text stays text</script>"));
    const original = window.localStorage.getItem(key);
    await act(async () => root.render(<KeptStageNotes manifests={[manifest]} />));
    expect(container.textContent).toContain("<script>Reader text stays text</script>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('a[href="/discover/mass-energy/#step-one"]')?.textContent).toBe(
      "One emission",
    );
    expect(window.localStorage.getItem(key)).toBe(original);
  });
});

test("readable notes export escapes reader markup and preserves the scientific step link", () => {
  const prediction = '<img src=x onerror="alert(1)"> & a prediction';
  const observation = "</p><script>bad()</script>\nSecond line";
  const doc = recordObservation(
    recordPrediction(emptyNotebook(manifest), manifest, "step-one", prediction, null),
    manifest,
    "step-one",
    0,
    observation,
  );
  const html = notebookHtml(doc, manifest);
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; a prediction");
  expect(html).toContain("&lt;/p&gt;&lt;script&gt;bad()&lt;/script&gt;\nSecond line");
  expect(html).not.toContain("<script>");
  expect(html).toContain('href="https://annus-mirabilis.com/discover/mass-energy/#step-one"');
});

test("readable export refuses an unknown stage through the existing notebook validator", () => {
  const invalid = {
    ...emptyNotebook(manifest),
    entries: [
      {
        stageId: "removed-step",
        attempts: [
          { prediction: "A prediction for an unknown step", alternativeId: null, observation: "" },
        ],
      },
    ],
  };
  expect(() => notebookHtml(invalid, manifest)).toThrow("This step does not belong to this guide.");
});
