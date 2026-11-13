import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { DataPanel } from "./DataPanel.tsx";
import type { ExportDocument, ExportedNamespace } from "./exportClear.ts";
import { QUARANTINE_KEY, quarantine } from "./quarantine.ts";
import { createStorageContext, type StorageContext, writeDocument, writeSetting } from "./store.ts";
import { InMemoryStorage, quotaExceededError } from "./testSupport.ts";

const logger = getLogger("platform-storage");
const BEAD = "am-plat-local-storage-km8f";

describe("DataPanel component", () => {
  let inMemory: InMemoryStorage;
  let ctx: StorageContext;

  beforeEach(async () => {
    await installDom();
    inMemory = new InMemoryStorage();
    ctx = createStorageContext({ getStorage: () => inMemory });
  });

  afterEach(async () => {
    await uninstallDom();
  });

  test("namespaces are listed with labels and formatted sizes", async () => {
    writeSetting(ctx, "am:settings:v1:theme", "kramgasse-night");
    writeDocument(ctx, "am:notebook:v1", { schemaVersion: 1, notes: ["Note 1"] });

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(DataPanel, { storageContext: ctx }));
      });

      const table = container.querySelector('[data-testid="namespaces-table"]');
      expect(table).not.toBeNull();

      const themeRow = container.querySelector('[data-namespace-key="am:settings:v1:theme"]');
      expect(themeRow).not.toBeNull();
      expect(themeRow?.textContent).toContain("Reading theme");

      const themeSize = container.querySelector('[data-testid="size-am:settings:v1:theme"]');
      expect(themeSize?.textContent).not.toBe("0 B");

      const notebookRow = container.querySelector('[data-namespace-key="am:notebook:v1"]');
      expect(notebookRow).not.toBeNull();
      expect(notebookRow?.textContent).toContain("Notebook");

      const notebookSize = container.querySelector('[data-testid="size-am:notebook:v1"]');
      expect(notebookSize?.textContent).not.toBe("0 B");

      logger.log({
        testId: "datapanel-lists-namespaces-and-sizes",
        beadId: BEAD,
        outcome: "passed",
        message: "DataPanel correctly renders registered namespaces, labels, and sizes",
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("in-page confirmation is used for clearing; window.confirm is never called", async () => {
    writeSetting(ctx, "am:settings:v1:theme", "kramgasse-night");

    let confirmCalled = false;
    (window as unknown as { confirm: () => boolean }).confirm = () => {
      confirmCalled = true;
      return true;
    };

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(DataPanel, { storageContext: ctx }));
      });

      expect(container.querySelector('[data-testid="clear-confirmation"]')).toBeNull();

      // Click clear for the theme setting
      const clearBtn = container.querySelector(
        '[data-testid="clear-btn-am:settings:v1:theme"]',
      ) as HTMLButtonElement;
      expect(clearBtn).not.toBeNull();

      await act(async () => {
        clearBtn.click();
      });

      // Assert window.confirm was NOT called
      expect(confirmCalled).toBe(false);

      // Assert in-page confirmation banner is now visible
      const confirmation = container.querySelector('[data-testid="clear-confirmation"]');
      expect(confirmation).not.toBeNull();
      expect(confirmation?.textContent).toContain("Reading theme");

      // Test Cancel: clicking cancel dismisses confirmation without clearing
      const cancelBtn = container.querySelector(
        '[data-testid="cancel-clear-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        cancelBtn.click();
      });

      expect(container.querySelector('[data-testid="clear-confirmation"]')).toBeNull();
      expect(inMemory.getItem("am:settings:v1:theme")).toBe("kramgasse-night");

      // Re-trigger and confirm
      await act(async () => {
        const btn = container.querySelector(
          '[data-testid="clear-btn-am:settings:v1:theme"]',
        ) as HTMLButtonElement;
        btn.click();
      });

      const confirmBtn = container.querySelector(
        '[data-testid="confirm-clear-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        confirmBtn.click();
      });

      expect(container.querySelector('[data-testid="clear-confirmation"]')).toBeNull();
      expect(inMemory.getItem("am:settings:v1:theme")).toBeNull();

      const themeSize = container.querySelector('[data-testid="size-am:settings:v1:theme"]');
      expect(themeSize?.textContent).toBe("0 B");

      logger.log({
        testId: "datapanel-in-page-confirmation-no-window-confirm",
        beadId: BEAD,
        outcome: "passed",
        message: "clearing requires in-page confirmation and never invokes window.confirm",
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("clear all data clears all clearable namespaces after in-page confirmation", async () => {
    writeSetting(ctx, "am:settings:v1:theme", "annalen");
    writeDocument(ctx, "am:notebook:v1", { schemaVersion: 1, notes: ["Test note"] });

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(DataPanel, { storageContext: ctx }));
      });

      const clearAllBtn = container.querySelector(
        '[data-testid="clear-all-btn"]',
      ) as HTMLButtonElement;
      expect(clearAllBtn).not.toBeNull();

      await act(async () => {
        clearAllBtn.click();
      });

      const confirmBtn = container.querySelector(
        '[data-testid="confirm-clear-btn"]',
      ) as HTMLButtonElement;
      expect(confirmBtn).not.toBeNull();

      await act(async () => {
        confirmBtn.click();
      });

      expect(inMemory.getItem("am:settings:v1:theme")).toBeNull();
      expect(inMemory.getItem("am:notebook:v1")).toBeNull();

      const totalBytes = container.querySelector('[data-testid="total-bytes"]');
      expect(totalBytes?.textContent).toBe("0 B");

      logger.log({
        testId: "datapanel-clear-all-data",
        beadId: BEAD,
        outcome: "passed",
        message: "clear all data clears all clearable namespaces",
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("quarantined corrupt data is displayed and can be cleared", async () => {
    quarantine(ctx, "am:notebook:v1", "{corrupted raw text", "syntax error in JSON");

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(DataPanel, { storageContext: ctx }));
      });

      const qSection = container.querySelector('[data-testid="quarantine-section"]');
      expect(qSection).not.toBeNull();
      expect(qSection?.textContent).toContain("syntax error in JSON");
      expect(qSection?.textContent).toContain("am:notebook:v1");

      const clearQBtn = container.querySelector(
        '[data-testid="clear-quarantine-btn"]',
      ) as HTMLButtonElement;
      expect(clearQBtn).not.toBeNull();

      await act(async () => {
        clearQBtn.click();
      });

      const confirmBtn = container.querySelector(
        '[data-testid="confirm-clear-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        confirmBtn.click();
      });

      expect(container.querySelector('[data-testid="quarantine-section"]')).toBeNull();

      logger.log({
        testId: "datapanel-quarantine-display-and-clear",
        beadId: BEAD,
        outcome: "passed",
        message: "quarantined recovered data is listed and can be cleared with confirmation",
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("export button triggers exportNamespaces with valid JSON document", async () => {
    writeSetting(ctx, "am:settings:v1:theme", "annalen");
    writeDocument(ctx, "am:notebook:v1", { schemaVersion: 1, notes: ["Important observation"] });

    const captured: ExportDocument[] = [];
    const onExport = (doc: ExportDocument) => {
      captured.push(doc);
    };

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(DataPanel, { storageContext: ctx, onExport }));
      });

      const exportBtn = container.querySelector(
        '[data-testid="export-all-btn"]',
      ) as HTMLButtonElement;
      expect(exportBtn).not.toBeNull();

      await act(async () => {
        exportBtn.click();
      });

      expect(captured).toHaveLength(1);
      const doc = captured[0];
      if (!doc) throw new Error("Expected exported document");
      expect(doc.exportedAt).toBeTruthy();
      expect(doc.namespaces.length).toBeGreaterThanOrEqual(2);

      const notebookEntry = doc.namespaces.find(
        (n: ExportedNamespace) => n.key === "am:notebook:v1",
      );
      expect(notebookEntry).toBeDefined();
      expect(notebookEntry?.value).toEqual({ schemaVersion: 1, notes: ["Important observation"] });

      logger.log({
        testId: "datapanel-export-valid-json",
        beadId: BEAD,
        outcome: "passed",
        message: "export button generates a valid ExportDocument containing all active namespaces",
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("partial clearing stays retryable and reports only confirmed removals", async () => {
    let allowNotebookRemoval = false;
    class PartlyBlockedStorage extends InMemoryStorage {
      override removeItem(key: string): void {
        if (key === "am:notebook:v1" && !allowNotebookRemoval) {
          throw new Error("Removal was blocked.");
        }
        super.removeItem(key);
      }
    }
    const storage = new PartlyBlockedStorage();
    const partialCtx = createStorageContext({ getStorage: () => storage });
    writeSetting(partialCtx, "am:settings:v1:theme", "annalen");
    writeDocument(partialCtx, "am:notebook:v1", { notes: ["Keep this observation"] });
    partialCtx.fallback.set("am:notebook:v1", "an unsaved observation");
    const reports: (readonly string[])[] = [];
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          createElement(DataPanel, {
            storageContext: partialCtx,
            onClear: (keys) => reports.push(keys),
          }),
        );
      });
      await act(async () => {
        (container.querySelector('[data-testid="clear-all-btn"]') as HTMLButtonElement).click();
      });
      await act(async () => {
        (container.querySelector('[data-testid="confirm-clear-btn"]') as HTMLButtonElement).click();
      });

      expect(storage.getItem("am:settings:v1:theme")).toBeNull();
      expect(storage.getItem("am:notebook:v1")).toContain("Keep this observation");
      expect(partialCtx.fallback.get("am:notebook:v1")).toBe("an unsaved observation");
      expect(reports[0]).toContain("am:settings:v1:theme");
      expect(reports[0]).not.toContain("am:notebook:v1");
      expect(container.querySelector('[data-testid="status-message"]')?.textContent).toContain(
        "Could not confirm clearing Notebook",
      );
      expect(container.querySelector('[data-testid="clear-confirmation"]')).not.toBeNull();

      allowNotebookRemoval = true;
      await act(async () => {
        (container.querySelector('[data-testid="confirm-clear-btn"]') as HTMLButtonElement).click();
      });
      expect(storage.getItem("am:notebook:v1")).toBeNull();
      expect(partialCtx.fallback.has("am:notebook:v1")).toBe(false);
      expect(reports[1]).toContain("am:notebook:v1");
      expect(container.querySelector('[data-testid="clear-confirmation"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });

  test("a blocked download keeps saved and unsaved copies available after clearing", async () => {
    const storage = new InMemoryStorage({ throwOnSet: quotaExceededError() });
    const quotaCtx = createStorageContext({ getStorage: () => storage });
    storage.rawSet("am:notebook:v1", JSON.stringify({ notes: ["Saved observation"] }));
    expect(
      writeDocument(quotaCtx, "am:notebook:v1", { notes: ["Unsaved observation"] }).status,
    ).toBe("quota");
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => {
      throw new Error("Downloads are unavailable.");
    };
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(DataPanel, { storageContext: quotaCtx }));
      });
      await act(async () => {
        (container.querySelector('[data-testid="export-all-btn"]') as HTMLButtonElement).click();
      });

      const copy = container.querySelector('[data-testid="export-json"]') as HTMLTextAreaElement;
      expect(copy).not.toBeNull();
      expect(copy.readOnly).toBe(true);
      const exported = JSON.parse(copy.value) as ExportDocument;
      expect(exported.namespaces.find((entry) => entry.key === "am:notebook:v1")?.value).toEqual({
        notes: ["Saved observation"],
      });
      expect(exported.recoveryCopies).toEqual([
        { key: "am:notebook:v1", label: "Notebook", value: { notes: ["Unsaved observation"] } },
      ]);
      expect(container.querySelector('[data-testid="export-recovery"]')?.textContent).toContain(
        "Notebook",
      );
      const status = container.querySelector('[data-testid="status-message"]')?.textContent;
      expect(status).toContain("could not start the download");
      expect(status).not.toContain("Downloaded");

      const beforeClear = copy.value;
      await act(async () => {
        (container.querySelector('[data-testid="clear-all-btn"]') as HTMLButtonElement).click();
      });
      await act(async () => {
        (container.querySelector('[data-testid="confirm-clear-btn"]') as HTMLButtonElement).click();
      });
      expect(storage.getItem("am:notebook:v1")).toBeNull();
      expect(quotaCtx.fallback.has("am:notebook:v1")).toBe(false);
      expect(
        (container.querySelector('[data-testid="export-json"]') as HTMLTextAreaElement).value,
      ).toBe(beforeClear);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });

  test("partial exports identify the unreadable data in both JSON and the panel", async () => {
    class PartlyUnreadableStorage extends InMemoryStorage {
      override getItem(key: string): string | null {
        if (key === "am:notebook:v1") throw new Error("Notebook storage is unavailable.");
        return super.getItem(key);
      }
    }
    const storage = new PartlyUnreadableStorage();
    storage.rawSet("am:notebook:v1", '{"notes":["Not readable yet"]}');
    storage.rawSet("am:settings:v1:theme", "annalen");
    const partialCtx = createStorageContext({ getStorage: () => storage });
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(DataPanel, { storageContext: partialCtx }));
      });
      await act(async () => {
        (container.querySelector('[data-testid="export-all-btn"]') as HTMLButtonElement).click();
      });

      const copy = container.querySelector('[data-testid="export-json"]') as HTMLTextAreaElement;
      const exported = JSON.parse(copy.value) as ExportDocument;
      expect(exported.unreadableNamespaces).toEqual([{ key: "am:notebook:v1", label: "Notebook" }]);
      expect(exported.namespaces.find((entry) => entry.key === "am:settings:v1:theme")?.value).toBe(
        "annalen",
      );
      expect(container.querySelector('[data-testid="export-unreadable"]')?.textContent).toContain(
        "Notebook",
      );
      expect(container.querySelector('[data-testid="status-message"]')?.textContent).toContain(
        "this export may be incomplete",
      );
      expect(storage.rawGet("am:notebook:v1")).toContain("Not readable yet");
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });

  test("quarantine can be cleared when the storage quota prevents writes", async () => {
    const storage = new InMemoryStorage({ throwOnSet: quotaExceededError() });
    storage.rawSet(
      QUARANTINE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        entries: [
          {
            originalKey: "am:notebook:v1",
            rawValue: "{damaged notes",
            reason: "Invalid JSON",
            quarantinedAt: "2026-11-13T00:00:00.000Z",
          },
        ],
      }),
    );
    const fullCtx = createStorageContext({ getStorage: () => storage });
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(DataPanel, { storageContext: fullCtx }));
      });
      expect(container.querySelector('[data-testid="quarantine-section"]')).not.toBeNull();
      const clearButton = container.querySelector(
        '[data-testid="clear-quarantine-btn"]',
      ) as HTMLButtonElement;
      await act(async () => {
        clearButton.click();
      });
      await act(async () => {
        (container.querySelector('[data-testid="confirm-clear-btn"]') as HTMLButtonElement).click();
      });

      expect(storage.getItem(QUARANTINE_KEY)).toBeNull();
      expect(container.querySelector('[data-testid="quarantine-section"]')).toBeNull();
      expect(container.querySelector('[data-testid="status-message"]')?.textContent).toContain(
        "Cleared the data this site could not read",
      );
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });

  // What a returning reader's browser does: the page arrives rendered by a server with no
  // storage, and hydrates in a browser that holds a setting. Reading storage during the first
  // render made the two disagree, and React discarded the markup (minified error #418 on
  // /your-data/, BUILD 12). Asserted through onRecoverableError, which is where React reports it.
  test("hydrates without a mismatch when the browser holds stored data", async () => {
    const serverCtx = createStorageContext({ getStorage: () => new InMemoryStorage() });
    writeSetting(ctx, "am:settings:v1:theme", "kramgasse-night");

    const container = createContainer();
    container.innerHTML = renderToString(createElement(DataPanel, { storageContext: serverCtx }));
    const recoverable: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, createElement(DataPanel, { storageContext: ctx }), {
          onRecoverableError: (error) => {
            recoverable.push(error);
          },
        });
      });
      expect(recoverable).toEqual([]);
      // Non-vacuity: after mounting, the panel does show what the browser holds.
      const themeSize = container.querySelector('[data-testid="size-am:settings:v1:theme"]');
      expect(themeSize?.textContent).not.toBe("0 B");
    } finally {
      await act(async () => {
        root?.unmount();
      });
      removeContainer(container);
    }
  });
});
