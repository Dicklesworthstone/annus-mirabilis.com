import { act } from "react";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { closeDirectOpenDialog, openFromSearch } from "../reader/stack/mountDirectOpen.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(() => {
  act(() => {
    closeDirectOpenDialog(document);
  });
  uninstallDom();
});

describe("openFromSearch: the direct-link acceptance criterion", () => {
  test("a well-formed instrument-view value opens a dialog with the compass and the mounted view", async () => {
    let opened = false;
    await act(async () => {
      opened = openFromSearch(document, "?open=instrument-view:bm-01");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(opened).toBe(true);
    const dialog = document.querySelector("[data-instrument-clarification-dialog]");
    expect(dialog).not.toBeNull();
    expect(dialog?.querySelector("[data-compass]")).not.toBeNull();
    expect(dialog?.querySelector("[data-compass-idea]")?.textContent).toBeTruthy();
  });

  test("an unknown but well-formed instrument id still opens, showing the explicit unknown-experiment notice", async () => {
    let opened = false;
    await act(async () => {
      opened = openFromSearch(document, "?open=instrument-view:zz-99");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(opened).toBe(true);
    const dialog = document.querySelector("[data-instrument-clarification-dialog]");
    expect(dialog?.querySelector('[data-testid="unknown-experiment-notice"]')).not.toBeNull();
  });

  test("a term value scrolls to its anchor and opens no dialog", () => {
    document.body.innerHTML += '<p id="rmsDisplacement1d">The term.</p>';
    const opened = openFromSearch(document, "?open=term:rmsDisplacement1d");
    expect(opened).toBe(true);
    expect(document.querySelector("[data-instrument-clarification-dialog]")).toBeNull();
  });

  test("no ?open= value at all: nothing opens, no error", () => {
    expect(openFromSearch(document, "")).toBe(false);
    expect(document.querySelector("[data-instrument-clarification-dialog]")).toBeNull();
  });

  test("an unregistered kind is ignored, never breaking the page", () => {
    expect(() => openFromSearch(document, "?open=not-a-real-kind:x")).not.toThrow();
    expect(openFromSearch(document, "?open=not-a-real-kind:x")).toBe(false);
  });

  test("a foundation value (not this bead's kind) is left alone: never opened, never throws", () => {
    // foundation is registered by a different bead, not landed in this repo; this proves this
    // module does not silently claim a kind it does not own.
    expect(openFromSearch(document, "?open=foundation:mean-variance-rms")).toBe(false);
    expect(document.querySelector("[data-instrument-clarification-dialog]")).toBeNull();
  });
});

describe("closeDirectOpenDialog", () => {
  test("closes an open dialog and unmounts its root", async () => {
    await act(async () => {
      openFromSearch(document, "?open=instrument-view:bm-01");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const dialog = document.querySelector<HTMLDialogElement>(
      "[data-instrument-clarification-dialog]",
    );
    expect(dialog?.open).toBe(true);
    act(() => {
      closeDirectOpenDialog(document);
    });
    expect(dialog?.open).toBe(false);
  });

  test("is a harmless no-op when nothing is open", () => {
    expect(() => closeDirectOpenDialog(document)).not.toThrow();
  });
});
