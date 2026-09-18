import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { DataPanel } from "./DataPanel.tsx";
import type { ExportDocument, ExportedNamespace } from "./exportClear.ts";
import { quarantine } from "./quarantine.ts";
import { createStorageContext, type StorageContext, writeDocument, writeSetting } from "./store.ts";
import { InMemoryStorage } from "./testSupport.ts";

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
    writeSetting(ctx, "am:settings:v1:theme", "slate");

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
      expect(inMemory.getItem("am:settings:v1:theme")).toBe("slate");

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
});
