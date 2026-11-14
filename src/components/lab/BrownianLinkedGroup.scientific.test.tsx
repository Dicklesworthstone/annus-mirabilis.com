import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { captureBrownianGroup } from "../../experiments/groups/brownianTape.ts";
import { waitFor } from "../../experiments/groups/testSupport.ts";
import * as browserCodec from "../../experiments/permalink/browserCodec.ts";
import { decodeTapeDocument, encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import {
  brownianReplayFixture,
  brownianReplayLaboratory,
} from "../../testing/brownianGroupReplayHarness.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { BrownianLinkedGroup } from "./BrownianLinkedGroup.tsx";

const fixture = await brownianReplayFixture();
const source = brownianReplayLaboratory(fixture);
const recording = await (async () => {
  try {
    source.bundle.group.link(1e-6);
    await waitFor(() => source.bundle.group.getSnapshot().status === "accepted");
    const captured = await captureBrownianGroup(source.inputs, source.bundle);
    assert(captured.kind === "captured", JSON.stringify(captured));
    return captured.tape;
  } finally {
    source.disconnect();
  }
})();
const route = "/lab/bm-01/linked/";

describe("verified Brownian recording in the mounted comparison", () => {
  let container: HTMLElement;
  let root: Root | null = null;
  let lab: ReturnType<typeof brownianReplayLaboratory> | null = null;
  let restoreCodec: () => void;

  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    container = createContainer();
    history.replaceState({}, "", route + "?tape=" + encodeTapePermalink(recording));
    const decode = spyOn(browserCodec, "decodeTapeDocumentInBrowser").mockImplementation(
      async (input) => decodeTapeDocument(input),
    );
    const encode = spyOn(browserCodec, "encodeTapePermalinkInBrowser").mockImplementation(
      async (tape, options) => encodeTapePermalink(tape, options),
    );
    restoreCodec = () => {
      decode.mockRestore();
      encode.mockRestore();
    };
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      for (const channel of lab?.tracer.channels ?? []) channel.release();
      for (const channel of lab?.density ?? []) channel.release();
      await Promise.resolve();
    });
    root = null;
    lab?.disconnect();
    if (lab) {
      await waitFor(() => lab!.tracer.channels.every((channel) => channel.disposed) &&
        lab!.density.every((channel) => channel.disposed));
    }
    lab = null;
    restoreCodec();
    removeContainer(container);
    await uninstallDom();
  });

  function surface() {
    const found = container.querySelector<HTMLElement>("[data-linked-group]");
    assert(found);
    return found;
  }

  function displayed() {
    return [...surface().querySelectorAll<HTMLElement>("[data-linked-member]")].map((member) => ({
      instrument: member.dataset.linkedMember,
      instance: member.dataset.instanceId,
      run: member.dataset.runId,
      snapshot: member.dataset.snapshotVersion,
      radius: member.querySelector('[data-linked-output="radius"]')?.textContent,
    }));
  }

  function button(label: string) {
    const found = [...surface().querySelectorAll("button")].find(
      (entry) => entry.textContent?.trim() === label,
    );
    assert(found, "The reader must offer " + label);
    return found;
  }

  async function until(condition: () => boolean) {
    const deadline = Date.now() + 5000;
    while (!condition() && Date.now() < deadline)
      await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
    expect(condition()).toBe(true);
  }

  async function mount(options: Parameters<typeof brownianReplayLaboratory>[1] = {}) {
    lab = brownianReplayLaboratory(fixture, options);
    root = createRoot(container);
    await act(async () => root?.render(
      <StrictMode>
        <BrownianLinkedGroup
          definition={fixture.definition}
          tracerExample={fixture.tracer.example}
          densityExample={fixture.density}
          workerFactories={lab!.inputs.workerFactories}
        />
      </StrictMode>,
    ));
    await until(() => surface().dataset.groupRestoring === "false" &&
      surface().querySelector("[data-incoming-scientific-comparison]") !== null);
    return lab;
  }

  test("a scientific URL is inert until explicit restore, then shares the exact verified record", async () => {
    const transport = await mount();
    expect(transport.tracer.channels).toHaveLength(0);
    expect(transport.density).toHaveLength(0);
    expect(surface().textContent).toContain("no calculation has started");
    const before = displayed();
    await act(async () => button("Restore the scientific comparison").click());
    await until(() => surface().dataset.groupRestoring === "false" &&
      surface().dataset.groupStatus === "accepted");
    expect(displayed()).not.toEqual(before);
    expect(displayed().map((member) => member.radius?.trim())).toEqual(["1 μm", "1 μm"]);
    expect(surface().textContent).toContain("Both scientific checkpoints were verified");
    await until(() => !!surface().querySelector<HTMLInputElement>(
      '[data-brownian-scientific-share] [data-testid="selectable-url"]',
    )?.value);
    const address = surface().querySelector<HTMLInputElement>(
      '[data-brownian-scientific-share] [data-testid="selectable-url"]',
    )!.value;
    expect(address.length).toBeLessThanOrEqual(2048);
    const decoded = decodeTapeDocument(new URL(address));
    assert(decoded.kind === "success");
    expect(decoded.tape).toEqual(recording);
    expect(transport.tracer.channels.map((channel) => channel.requests)).toEqual([1, 1]);
    expect(transport.density.map((channel) => channel.requests)).toEqual([1, 1]);
  });

  test("canceling second-owner verification keeps the displayed pair and retires every candidate", async () => {
    const transport = await mount({ densityHold: (index) => index === 0 });
    const before = displayed();
    await act(async () => button("Restore the scientific comparison").click());
    await until(() => transport.density[0]?.results.length === 1);
    expect(displayed()).toEqual(before);
    expect(surface().dataset.groupRestoring).toBe("true");
    expect(surface().querySelector("fieldset")?.disabled).toBe(true);
    await act(async () => button("Cancel scientific restore").click());
    await until(() => transport.tracer.channels.every((channel) => channel.disposed) &&
      transport.density.every((channel) => channel.disposed));
    await act(async () => transport.density[0]?.release());
    expect(displayed()).toEqual(before);
    expect(surface().dataset.groupRestoring).toBe("false");
    expect(surface().textContent).toContain("restoration canceled");
  });

  test("navigation cancels a pending recording and repeated pageshow cannot restart it", async () => {
    const transport = await mount({ densityHold: (index) => index === 0 });
    const before = displayed();
    await act(async () => button("Restore the scientific comparison").click());
    await until(() => transport.density[0]?.results.length === 1);
    await act(async () => {
      history.pushState({}, "", route);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await until(() => surface().dataset.groupRestoring === "false");
    const count = transport.requests();
    await act(async () => {
      transport.density[0]?.release();
      window.dispatchEvent(new Event("pageshow"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(displayed()).toEqual(before);
    expect(transport.requests()).toBe(count);
    expect(surface().querySelector("[data-incoming-scientific-comparison]")).toBeNull();
  });
});
