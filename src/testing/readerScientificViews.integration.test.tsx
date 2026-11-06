/** Real reader adapters: a mounted lab must calculate, retain its identity, and leave the paper URL alone. */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BM01_DEFAULTS } from "../experiments/bm01/definition.ts";
import { encodeBm01Settings } from "../experiments/bm01/permalink.ts";
import { LQ08_DEFAULTS } from "../experiments/lq08/definition.ts";
import { lq08TapeFor } from "../experiments/lq08/tape.ts";
import { encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { getClarificationKind } from "../reader/stack/kinds.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

const mounted: Root[] = [];
beforeEach(installDom);
afterEach(async () => {
  await act(async () => {
    for (const root of mounted.splice(0)) root.unmount();
  });
  await uninstallDom();
});

async function mountLaboratory(id: string, instanceId: string) {
  const definition = getClarificationKind("instrument-view");
  const parsed = definition?.parseId(id);
  if (!definition?.render || !parsed) throw new Error(`Cannot open ${id}`);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  await act(async () => root.render(definition.render?.({ parsed, instanceId })));
  for (let tick = 0; tick < 100; tick += 1) {
    if (container.querySelector("[data-instance-id]")) break;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(container.querySelector('[data-testid="in-preparation-notice"]')).toBeNull();
  const laboratory = container.querySelector<HTMLElement>("[data-instance-id]");
  expect(laboratory).not.toBeNull();
  return { container, laboratory: laboratory as HTMLElement };
}

describe("scientific laboratories inside a paper", () => {
  for (const [name, search] of [
    ["paper query", "?open=instrument-view:bm-01"],
    ["unrelated tape", "?open=instrument-view:bm-01&tape=invalid"],
    ["legacy settings", encodeBm01Settings({ ...BM01_DEFAULTS, M: 32 })],
  ] as const) {
    test(`BM-01 ignores the parent ${name} and keeps its reader identity`, async () => {
      window.history.replaceState(null, "", `/papers/brownian-motion/${search}#s5`);
      const href = window.location.href;
      const { container, laboratory } = await mountLaboratory("bm-01", "reader-bm01");
      expect(laboratory.dataset.instanceId).toBe("reader-bm01");
      expect(laboratory.dataset.executionLabel).toBe("static");
      expect(container.textContent).toContain("The tracer ensemble");
      expect(container.textContent).not.toContain("Shared settings are loaded as a draft");
      expect(container.textContent).not.toContain("This tracer link is incomplete or unsupported");
      expect(container.querySelector("[data-tape-notice]")).toBeNull();
      expect(window.location.href).toBe(href);
    });
  }

  test("LQ-08 ignores a paper's tape, then computes a genuine below-threshold result", async () => {
    const tape = lq08TapeFor({ ...LQ08_DEFAULTS, frequency: 910e12 });
    if (!tape) throw new Error("The admitted photoelectric settings must produce a tape");
    window.history.replaceState(
      null,
      "",
      `/papers/light-quanta/?open=instrument-view:lq-08&tape=${encodeTapePermalink(tape)}#s8`,
    );
    const href = window.location.href;
    const { container, laboratory } = await mountLaboratory("lq-08", "reader-lq08");
    expect(laboratory.dataset.instanceId).toBe("reader-lq08");
    expect(laboratory.dataset.executionLabel).toBe("static");
    expect(container.querySelector('[role="status"].status-line')?.textContent).toContain(
      "600 THz",
    );
    const before = laboratory.dataset.snapshotVersion;
    const redLight = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Red light, 450 THz"),
    );
    expect(redLight).toBeDefined();
    await act(async () => redLight?.click());
    expect(laboratory.dataset.snapshotVersion).not.toBe(before);
    expect(laboratory.dataset.resultStatus).toBe("not-applicable");
    expect(laboratory.dataset.executionLabel).toBe("host");
    // AcceptedStatus schedules polite announcements separately from the accepted snapshot.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[role="status"].status-line')?.textContent).toContain(
      "450 THz",
    );
    expect(window.location.href).toBe(href);
  });

  test("the clock lab keeps its identity and shares a working standalone configuration", async () => {
    window.history.replaceState(
      null,
      "",
      "/papers/moving-bodies/?open=instrument-view:sr-01&frame=0.9#s1",
    );
    const href = window.location.href;
    const { container, laboratory } = await mountLaboratory("sr-01", "reader-clock");
    expect(laboratory.dataset.instanceId).toBe("reader-clock");
    expect(laboratory.dataset.executionLabel).toBe("static");
    const share = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Share configuration link"),
    );
    expect(share).toBeDefined();
    await act(async () => share?.click());
    const shared = Array.from(container.querySelectorAll("code")).find((code) =>
      code.textContent?.startsWith(window.location.origin),
    );
    expect(shared?.textContent).toBe(`${window.location.origin}/lab/sr-01/`);
    expect(window.location.href).toBe(href);
  });

  test("the mass-energy lab can relax its premise without reading or replacing the paper's settings", async () => {
    window.history.replaceState(
      null,
      "",
      "/papers/mass-energy/?open=instrument-view:me-01&v=0.9&L=5#s1",
    );
    const href = window.location.href;
    const { container, laboratory } = await mountLaboratory("me-01", "reader-me01");
    expect(laboratory.dataset.instanceId).toBe("reader-me01");
    expect(laboratory.dataset.executionLabel).toBe("static");
    expect(container.textContent).not.toContain("The link's settings are in the fields");
    expect(
      container.querySelector<HTMLInputElement>('input[type="text"][id^="frameSpeed-"]')?.value,
    ).toBe("0.6");
    const relax = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Allowed to change"),
    );
    expect(relax).toBeDefined();
    const before = laboratory.dataset.snapshotVersion;
    await act(async () => relax?.click());
    expect(laboratory.dataset.snapshotVersion).not.toBe(before);
    expect(
      container.querySelector('[data-view-id="me-01-ledgers"]')?.getAttribute("data-premise"),
    ).toBe("relaxed");
    expect(container.textContent).toContain(
      "With the premise relaxed (C ≠ C′), the drop ΔK is not determined.",
    );
    expect(laboratory.dataset.executionLabel).toBe("host");
    const share = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy a link to these settings"),
    );
    expect(share).toBeDefined();
    await act(async () => share?.click());
    const shared = Array.from(container.querySelectorAll("code")).find((code) =>
      code.textContent?.startsWith(window.location.origin),
    );
    expect(shared?.textContent).toBe(`${window.location.origin}/lab/me-01/?premise=relaxed`);
    expect(window.location.href).toBe(href);
  });
});
