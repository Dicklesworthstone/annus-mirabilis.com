/** Real passage controls, lazy adapters and reader history retain the accepted laboratory owner. */
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReaderController } from "../reader/ReaderController.tsx";
import { deserializeStackState } from "../reader/stack/history.ts";
import { closeDirectOpenDialog, openFromTrigger } from "../reader/stack/mountDirectOpen.ts";
import { TestLogger } from "./log/logger.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

const logger = new TestLogger("reader-laboratory-return");
afterAll(() => logger.flush());
let controller: Root | undefined;

beforeEach(async () => {
  await installDom();
  if (typeof HTMLDialogElement.prototype.showModal !== "function") {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  }
});
afterEach(async () => {
  await act(async () => {
    closeDirectOpenDialog(document);
    controller?.unmount();
  });
  controller = undefined;
  await uninstallDom();
});

async function until(done: () => boolean): Promise<void> {
  for (let tick = 0; tick < 100; tick++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    if (done()) return;
  }
  throw new Error("Reader laboratory did not settle.");
}

async function readingPage(instrument: "lq-08" | "sr-05") {
  history.replaceState({ unrelated: "preserved" }, "", "/papers/light-quanta/?detail=2#passage-a");
  const page = document.createElement("div");
  page.dataset.readerRoot = "";
  page.dataset.view = "reading";
  page.innerHTML = "<dialog data-clarification-dialog></dialog><p data-reader-announcement></p>";
  for (const name of ["a", "b"]) {
    const article = document.createElement("article");
    article.id = `passage-${name}`;
    article.className = "reader-passage";
    const question = document.createElement("h2");
    question.className = "passage-question";
    question.textContent = `How does this follow in passage ${name}?`;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.id = `try-${name}`;
    trigger.dataset.clarificationOpen = `instrument-view:${instrument}`;
    trigger.textContent = "Try it";
    trigger.getBoundingClientRect = () => ({ top: 180, bottom: 200, height: 20 }) as DOMRect;
    trigger.getClientRects = () => [trigger.getBoundingClientRect()] as unknown as DOMRectList;
    article.append(question, trigger);
    page.append(article);
  }
  document.body.append(page);
  const host = document.createElement("div");
  page.prepend(host);
  controller = createRoot(host);
  await act(async () => {
    controller?.render(
      <StrictMode>
        <ReaderController
          registry={{
            paperId: "light-quanta",
            anchors: ["passage-a", "passage-b"],
            foundations: [],
          }}
          titles={{}}
          questions={{}}
        />
      </StrictMode>,
    );
  });
}

function laboratory(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-instrument-clarification-dialog] [data-instrument-id="${id}"][data-instance-id]`,
  );
  if (!element) throw new Error(`The live ${id} laboratory is missing.`);
  return element;
}
async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}
async function open(instrument: string, passage = "a") {
  const trigger = document.getElementById(`try-${passage}`);
  if (!trigger) throw new Error("The reading passage trigger is missing.");
  await click(trigger);
  await until(
    () => document.querySelector(`[data-instrument-id="${instrument}"][data-instance-id]`) !== null,
  );
  return laboratory(instrument);
}
async function close() {
  const button = document.querySelector<HTMLElement>("[data-clarification-close]");
  if (!button) throw new Error("The clarification close control is missing.");
  await click(button);
  await until(
    () => !document.querySelector("[data-instrument-clarification-dialog] [data-instrument-id]"),
  );
}
function capture(lab: HTMLElement) {
  return {
    instanceId: lab.dataset.instanceId,
    runId: lab.dataset.runId,
    snapshotVersion: lab.dataset.snapshotVersion,
    actionIndex: lab.dataset.acceptedActionIndex,
    inputRevision: lab.dataset.inputRevision,
    acceptedInputRevision: lab.dataset.acceptedInputRevision,
    parameters: [...lab.querySelectorAll<HTMLInputElement>('input[type="text"]')].map(
      (input) => input.value,
    ),
    readings: [...lab.querySelectorAll("[data-field], [data-output]")].map(
      (output) => output.textContent,
    ),
  };
}
async function change(instrument: string) {
  const lab = laboratory(instrument);
  const button =
    instrument === "sr-05"
      ? lab.querySelector<HTMLElement>('[data-preset-id="sr-05-low-speed-1e-4"]')
      : [...lab.querySelectorAll<HTMLButtonElement>("button")].find((candidate) =>
          candidate.textContent?.startsWith("Red light, 450"),
        );
  if (!button) throw new Error("A real laboratory preset is missing.");
  await click(button);
}

describe("reader close and history returns", () => {
  for (const instrument of ["lq-08", "sr-05"] as const) {
    test(`${instrument}: close/reopen restores parameters, action, revisions and accepted snapshot without a hidden root`, async () => {
      await readingPage(instrument);
      const initial = capture(await open(instrument));
      await change(instrument);
      const accepted = capture(laboratory(instrument));
      expect(accepted.actionIndex).not.toBe(initial.actionIndex);
      expect(accepted.snapshotVersion).not.toBe(initial.snapshotVersion);
      expect(accepted.runId).not.toBe(initial.runId);
      const frame = deserializeStackState(history.state.annusClarification.stack)?.frames[0];
      expect(frame?.openedLab).toMatchObject({
        instanceId: accepted.instanceId,
        runId: accepted.runId,
        experimentId: instrument,
        checkpointDigest: "",
        compactTape: "",
      });
      expect(frame?.lab).toBeNull();
      await close();
      expect(document.querySelector("[data-instrument-id]")).toBeNull();
      expect(
        document.querySelector("[data-instrument-clarification-mount]")?.childElementCount,
      ).toBe(0);
      expect(new URLSearchParams(location.search).has("open")).toBe(false);
      expect(capture(await open(instrument))).toEqual(accepted);
      expect(document.querySelector("[data-lab-return-notice]")).toBeNull();
      expect(history.state.unrelated).toBe("preserved");
      logger.log({
        testId: `${instrument}-close-reopen`,
        beadId: "am-read-return-stack-oxa",
        instrumentId: instrument,
        instanceId: accepted.instanceId,
        runId: accepted.runId,
        snapshotVersion: Number(accepted.snapshotVersion),
        acceptedInputRevision: Number(accepted.acceptedInputRevision),
        outcome: "passed",
        message:
          "A real lazy laboratory preserves accepted parameters and identities through reader close/reopen; the closed React root is empty.",
      });
    });
  }

  test("Back/Forward returns preserve actual owners while separate passages keep independent experiments", async () => {
    await readingPage("sr-05");
    await open("sr-05");
    await change("sr-05");
    const first = capture(laboratory("sr-05"));
    const forward = { state: structuredClone(history.state), url: location.href };
    await act(async () => {
      history.back();
    });
    await until(() => !document.querySelector('[data-instrument-id="sr-05"]'));
    await act(async () => {
      // happy-dom's HistoryItemList.replace incorrectly truncates forward history when the
      // reader normalizes its URL after Back. Recreate that saved future entry and deliver it
      // through the real popstate listener; the laboratory and reader restore code stay real.
      history.pushState(forward.state, "", forward.url);
      window.dispatchEvent(new PopStateEvent("popstate", { state: forward.state }));
    });
    await until(
      () => document.querySelector('[data-instrument-id="sr-05"][data-instance-id]') !== null,
    );
    expect(capture(laboratory("sr-05"))).toEqual(first);
    await close();
    const second = capture(await open("sr-05", "b"));
    expect(second.instanceId).not.toBe(first.instanceId);
    expect(second.runId).not.toBe(first.runId);
    expect(second.readings).not.toEqual(first.readings);
    await close();
    expect(capture(await open("sr-05", "a"))).toEqual(first);
  });

  test("ending the reader route releases its owners and labels a later return as a fresh experiment", async () => {
    await readingPage("sr-05");
    await open("sr-05");
    await change("sr-05");
    const previous = capture(laboratory("sr-05"));
    await act(async () => {
      controller?.unmount();
    });
    controller = undefined;
    expect(document.querySelector('[data-instrument-id="sr-05"]')).toBeNull();
    const host = document.createElement("div");
    document.body.append(host);
    controller = createRoot(host);
    await act(async () => {
      controller?.render(
        <ReaderController
          registry={{
            paperId: "light-quanta",
            anchors: ["passage-a", "passage-b"],
            foundations: [],
          }}
          titles={{}}
          questions={{}}
        />,
      );
    });
    await until(() => document.querySelector('[data-instrument-id="sr-05"]') !== null);
    const fresh = capture(laboratory("sr-05"));
    expect(fresh.instanceId).not.toBe(previous.instanceId);
    expect(fresh.runId).not.toBe(previous.runId);
    expect(fresh.readings).not.toEqual(previous.readings);
    expect(document.querySelector("[data-lab-return-notice]")?.textContent).toContain(
      "starts a new experiment",
    );
  });

  test("descending to another laboratory records the interrupted owner and Back reopens that exact experiment", async () => {
    await readingPage("lq-08");
    await open("lq-08");
    await change("lq-08");
    const first = capture(laboratory("lq-08"));
    const nested = document.createElement("button");
    nested.type = "button";
    nested.id = "nested-clock-comparison";
    laboratory("lq-08").append(nested);
    await act(async () => {
      expect(openFromTrigger(document, nested, "instrument-view:sr-05")).toBe(true);
    });
    await until(
      () => document.querySelector('[data-instrument-id="sr-05"][data-instance-id]') !== null,
    );
    expect(document.querySelector('[data-instrument-id="lq-08"]')).toBeNull();
    const stack = deserializeStackState(history.state.annusClarification.stack);
    expect(stack?.frames).toHaveLength(2);
    expect(stack?.frames[1]?.lab).toMatchObject({
      instanceId: first.instanceId,
      runId: first.runId,
    });
    expect(stack?.frames[1]?.openedLab?.experimentId).toBe("sr-05");
    await act(async () => {
      history.back();
    });
    await until(
      () => document.querySelector('[data-instrument-id="lq-08"][data-instance-id]') !== null,
    );
    expect(capture(laboratory("lq-08"))).toEqual(first);
  });
});
