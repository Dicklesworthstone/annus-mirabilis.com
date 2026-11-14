import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as brownianTape from "../../experiments/groups/brownianRadiusTape.ts";
import { loadBrownianRadiusGroup } from "../../experiments/groups/loadBrownianRadius.ts";
import { controlledOwner, smallBrownianExamples } from "../../experiments/groups/testSupport.ts";
import * as browserCodec from "../../experiments/permalink/browserCodec.ts";
import { decodeTapeDocument, encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { validateTapeGroupV3 } from "../../experiments/permalink/groupSchema.ts";
import { tapeStateDigestV2 } from "../../experiments/permalink/sessionTape.ts";
import type { TapeGroupV3 } from "../../experiments/permalink/types.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { BrownianLinkedGroup } from "./BrownianLinkedGroup.tsx";

const examples = await smallBrownianExamples();
const definition = loadBrownianRadiusGroup();
const route = "/lab/brownian-linked/";
const forbidden = (): WorkerChannel => {
  throw new Error("Authoring a settings record must not start a worker.");
};
const baseline = brownianTape.createBrownianRadiusSession(
  "shared-settings-fixture",
  definition,
  examples,
  [forbidden, forbidden],
);
const baselineTape = brownianTape.tapeForBrownianRadius(baseline);
assert(baselineTape);

/** These are settings records, not fabricated worker results. Every restored number is real. */
function record(tracer: number, density = tracer, enabled = true): TapeGroupV3 {
  assert(baselineTape);
  return validateTapeGroupV3({
    ...baselineTape,
    group: { ...baselineTape.group, enabled, valueSI: enabled ? tracer : null },
    members: baselineTape.members.map((member) => {
      const initialConditions = {
        ...member.tape.initialConditions,
        a: member.memberId === "bm-01" ? tracer : density,
      };
      return {
        ...member,
        tape: {
          ...member.tape,
          initialConditions,
          acceptedCheckpoint: {
            ...member.tape.acceptedCheckpoint,
            digest: tapeStateDigestV2(initialConditions, 0),
          },
        },
      };
    }),
  });
}

type Instrument = "bm-01" | "bm-06";
type ControlledOwner = ReturnType<typeof controlledOwner>;

function ownerPool() {
  const channels: { instrument: Instrument; owner: ControlledOwner }[] = [];
  const holding = new Set<Instrument>();
  const factory = (instrument: Instrument) => (): WorkerChannel => {
    // A controller owns one listener. Each mounted or candidate channel gets a fresh one.
    const owner = controlledOwner(
      instrument,
      instrument === "bm-01" ? examples.tracer.sourceDigest : examples.density.sourceDigest,
    );
    if (holding.has(instrument)) owner.hold();
    channels.push({ instrument, owner });
    return owner.factory();
  };
  return {
    channels,
    factories: [factory("bm-01"), factory("bm-06")] as const,
    holdNew(instrument: Instrument, hold = true) {
      if (hold) holding.add(instrument);
      else holding.delete(instrument);
    },
    requests: () => channels.flatMap(({ owner }) => owner.requests),
    disposals: () => channels.reduce((total, { owner }) => total + owner.disposals, 0),
    releaseAll() {
      for (const { owner } of channels) owner.release();
    },
  };
}

describe("shared Brownian settings in the mounted reader", () => {
  let container: HTMLElement;
  let root: Root | null = null;
  let pools: ReturnType<typeof ownerPool>[];
  let restoreSpies: (() => void) | null = null;
  let holdSuccessfulRestore = false;
  let deliveries: { result: brownianTape.BrownianRadiusTapeRestore; release(): void }[];
  let handledRestores: brownianTape.BrownianRadiusTapeRestore[];

  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    history.replaceState({}, "", route);
    container = createContainer();
    pools = [];
    deliveries = [];
    handledRestores = [];
    holdSuccessfulRestore = false;
    // happy-dom supplies the DOM, while the real native codec supplies bounded tape transport.
    const decode = spyOn(browserCodec, "decodeTapeDocumentInBrowser").mockImplementation(
      async (input) => decodeTapeDocument(input),
    );
    const encode = spyOn(browserCodec, "encodeTapePermalinkInBrowser").mockImplementation(
      async (tape, options) => encodeTapePermalink(tape, options),
    );
    const restore = brownianTape.restoreBrownianRadiusFromUrl;
    const delivery = spyOn(brownianTape, "restoreBrownianRadiusFromUrl").mockImplementation(
      (...args) => {
        const operation = restore(...args).then((result) => {
          if (!holdSuccessfulRestore || result.kind !== "restored") return result;
          return new Promise<brownianTape.BrownianRadiusTapeRestore>((resolve) =>
            deliveries.push({ result, release: () => resolve(result) }),
          );
        });
        const then = operation.then.bind(operation);
        // Observe delivery after the component's real fulfillment handler queues its update.
        // This changes only async scheduling, never a calculated result or owner behavior.
        spyOn(operation, "then").mockImplementation(function <
          Result = brownianTape.BrownianRadiusTapeRestore,
          Rejected = never,
        >(
          onFulfilled?:
            | ((value: brownianTape.BrownianRadiusTapeRestore) => Result | PromiseLike<Result>)
            | null,
          onRejected?: ((reason: unknown) => Rejected | PromiseLike<Rejected>) | null,
        ) {
          return then<Result, Rejected>(
            onFulfilled
              ? (result) => {
                  const returned = onFulfilled(result);
                  handledRestores.push(result);
                  return returned;
                }
              : onFulfilled,
            onRejected,
          );
        });
        return operation;
      },
    );
    restoreSpies = () => {
      delivery.mockRestore();
      decode.mockRestore();
      encode.mockRestore();
    };
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      for (const delivery of deliveries) delivery.release();
      for (const pool of pools) pool.releaseAll();
      await Promise.resolve();
    });
    root = null;
    for (const pool of pools) {
      expect(pool.disposals()).toBe(pool.channels.length);
      expect(pool.channels.flatMap(({ owner }) => owner.errors)).toEqual([]);
    }
    restoreSpies?.();
    restoreSpies = null;
    removeContainer(container);
    await uninstallDom();
  });

  function newPool() {
    const pool = ownerPool();
    pools.push(pool);
    return pool;
  }

  function surface(index = 0): HTMLElement {
    const found = container.querySelectorAll<HTMLElement>("[data-linked-group]")[index];
    assert(found, "The reader must mount the requested comparison.");
    return found;
  }

  function displayed(index = 0) {
    return [...surface(index).querySelectorAll<HTMLElement>("[data-linked-member]")].map(
      (member) => ({
        instrument: member.dataset.linkedMember,
        run: member.dataset.runId,
        snapshot: member.dataset.snapshotVersion,
        generation: member.dataset.displayedGeneration,
        radius: member.querySelector('[data-linked-output="radius"]')?.textContent?.trim(),
      }),
    );
  }

  function radii(index = 0) {
    return displayed(index).map((member) => member.radius);
  }

  function shareUrl(index = 0) {
    return (
      surface(index).querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ?? ""
    );
  }

  function button(label: string, index = 0) {
    const found = [...surface(index).querySelectorAll("button")].find(
      (entry) => entry.textContent?.trim() === label,
    );
    assert(found, `The comparison must offer ${label}.`);
    return found;
  }

  async function until(condition: () => boolean) {
    const deadline = Date.now() + 5000;
    while (!condition() && Date.now() < deadline)
      await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
    expect(condition()).toBe(true);
  }

  async function mount(tape?: TapeGroupV3, pool = newPool()) {
    if (tape) history.replaceState({}, "", `${route}?tape=${encodeTapePermalink(tape)}`);
    root = createRoot(container);
    await act(async () =>
      root?.render(
        <StrictMode>
          <BrownianLinkedGroup
            definition={definition}
            tracerExample={examples.tracer}
            densityExample={examples.density}
            workerFactories={pool.factories}
          />
        </StrictMode>,
      ),
    );
    return pool;
  }

  function changeLocation(tape?: TapeGroupV3) {
    history.pushState({}, "", tape ? `${route}?tape=${encodeTapePermalink(tape)}` : route);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function navigate(tape?: TapeGroupV3) {
    await act(async () => changeLocation(tape));
  }

  async function submitRadius(name: string, value: string, index = 0) {
    const input = surface(index).querySelector<HTMLInputElement>(`input[name="${name}"]`);
    assert(input);
    input.value = value;
    // Invoke React's rendered input handler; happy-dom has no browser-native value tracker.
    const key = Object.keys(input).find((entry) => entry.startsWith("__reactProps$"));
    assert(key);
    const props = (
      input as unknown as Record<
        string,
        {
          onChange?: (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => void;
        }
      >
    )[key];
    assert(props?.onChange);
    await act(async () => props.onChange?.({ target: input, currentTarget: input }));
    const form = input.closest("form");
    assert(form);
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  test("a linked incoming record calculates once per owner and the normal share control round-trips it", async () => {
    const tape = record(1e-6);
    const pool = await mount(tape);
    await until(() => surface().dataset.groupRestoring === "false" && shareUrl() !== "");
    expect(surface().dataset.groupEnabled).toBe("true");
    expect(surface().dataset.groupStatus).toBe("accepted");
    expect(radii()).toEqual(["1 μm", "1 μm"]);
    expect(displayed().map((member) => member.generation)).toEqual(["1", "1"]);
    expect(pool.channels).toHaveLength(2);
    expect(pool.channels.map(({ owner }) => owner.requests.length)).toEqual([1, 1]);
    expect(surface().textContent).toContain("recalculated from the shared settings");
    expect(surface().textContent).toContain("does not store its previous trajectory");
    const decoded = decodeTapeDocument(new URL(shareUrl()));
    assert(decoded.kind === "success" && decoded.tape.tapeVersion === 3);
    expect(decoded.tape).toEqual(tape);
    expect(new URL(shareUrl()).pathname).toBe(route);
    expect(shareUrl().length).toBeLessThanOrEqual(2048);
  });

  test("independent incoming radii stay separate and editing one owner leaves its neighbour unchanged", async () => {
    const pool = await mount(record(1e-6, 2e-6, false));
    await until(() => surface().dataset.groupRestoring === "false");
    expect(surface().dataset.groupEnabled).toBe("false");
    expect(radii()).toEqual(["1 μm", "2 μm"]);
    expect(surface().querySelector("[data-link-chip]")).toBeNull();
    expect(surface().textContent).toContain("remain independent");
    const density = displayed()[1];
    const densityRequests = pool.channels.find((entry) => entry.instrument === "bm-06")?.owner
      .requests.length;
    await submitRadius("bm-01-radius", "3");
    await until(() => radii()[0] === "3 μm");
    expect(displayed()[1]).toEqual(density);
    expect(pool.channels.find((entry) => entry.instrument === "bm-06")?.owner.requests.length).toBe(
      densityRequests,
    );
  });

  test("a slow candidate keeps the complete old pair and blocks shared controls and unlink until adoption", async () => {
    const pool = await mount(record(1e-6));
    await until(() => surface().dataset.groupRestoring === "false");
    const before = displayed();
    const oldOwners = [...pool.channels];
    pool.holdNew("bm-06");
    await navigate(record(2e-6));
    await until(() => pool.channels.length === 4 && pool.channels[3]?.owner.held.length === 1);
    expect(surface().dataset.groupRestoring).toBe("true");
    expect(displayed()).toEqual(before);
    expect(button("Unlink").disabled).toBe(true);
    const count = pool.requests().length;
    await submitRadius("shared-radius", "3");
    await act(async () => button("Unlink").click());
    expect(pool.requests()).toHaveLength(count);
    expect(displayed()).toEqual(before);
    expect(surface().dataset.groupEnabled).toBe("true");
    expect(shareUrl()).toBe("");
    await act(async () => pool.channels[3]?.owner.release());
    await until(() => surface().dataset.groupRestoring === "false");
    expect(radii()).toEqual(["2 μm", "2 μm"]);
    expect(displayed().map((member) => member.generation)).toEqual(["1", "1"]);
    expect(oldOwners.map(({ owner }) => owner.disposals)).toEqual([1, 1]);
    expect(pool.channels.slice(2).map(({ owner }) => owner.disposals)).toEqual([0, 0]);
  });

  test("a broken checkpoint or missing declared member names the problem without replacing accepted owners", async () => {
    const good = record(1e-6);
    const pool = await mount(good);
    await until(() => surface().dataset.groupRestoring === "false");
    const before = displayed();
    const corrupt = {
      ...good,
      members: good.members.map((member) =>
        member.memberId === "bm-06"
          ? {
              ...member,
              tape: {
                ...member.tape,
                acceptedCheckpoint: {
                  ...member.tape.acceptedCheckpoint,
                  digest: "host:0000000000000000",
                },
              },
            }
          : member,
      ),
    };
    await navigate(corrupt);
    await until(() => surface().dataset.groupRestoring === "false");
    expect(surface().textContent).toContain("recorded settings do not match their checkpoint");
    expect(displayed()).toEqual(before);
    expect(pool.channels).toHaveLength(2);
    const missing = {
      ...good,
      members: good.members.map((member) =>
        member.memberId === "bm-06" ? { ...member, memberId: "bm-08" } : member,
      ),
    };
    await navigate(missing);
    await until(() => surface().dataset.groupRestoring === "false");
    expect(surface().textContent).toContain("missing BM-06");
    expect(surface().textContent).toContain("Your comparison is unchanged");
    expect(displayed()).toEqual(before);
    expect(pool.channels).toHaveLength(2);
    expect(pool.disposals()).toBe(0);
  });

  test("rapid history changes dispose the superseded candidate and pageshow does not calculate again", async () => {
    const pool = newPool();
    pool.holdNew("bm-06");
    await mount(record(1e-6), pool);
    await until(() => pool.channels.length === 2 && pool.channels[1]?.owner.held.length === 1);
    const superseded = [...pool.channels];
    pool.holdNew("bm-06", false);
    await navigate(record(2e-6));
    await until(() => surface().dataset.groupRestoring === "false");
    expect(radii()).toEqual(["2 μm", "2 μm"]);
    expect(superseded.map(({ owner }) => owner.disposals)).toEqual([1, 1]);
    const accepted = displayed();
    const requests = pool.requests().length;
    await act(async () => {
      for (const { owner } of superseded) owner.release();
      window.dispatchEvent(new Event("pageshow"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(displayed()).toEqual(accepted);
    expect(pool.channels).toHaveLength(4);
    expect(pool.requests()).toHaveLength(requests);
  });

  test("leaving during a restore disposes both the accepted pair and pending candidate with no late work", async () => {
    const pool = await mount(record(1e-6));
    await until(() => surface().dataset.groupRestoring === "false");
    pool.holdNew("bm-06");
    await navigate(record(2e-6));
    await until(() => pool.channels.length === 4 && pool.channels[3]?.owner.held.length === 1);
    const requests = pool.requests().length;
    await act(async () => root?.unmount());
    root = null;
    await until(() => pool.disposals() === pool.channels.length);
    await act(async () => pool.releaseAll());
    expect(container.querySelector("[data-linked-group]")).toBeNull();
    expect(pool.requests()).toHaveLength(requests);
    expect(pool.channels).toHaveLength(4);
  });

  test("a second mounted copy has independent workers, accepted identities and later radius changes", async () => {
    const first = newPool();
    const second = newPool();
    history.replaceState({}, "", `${route}?tape=${encodeTapePermalink(record(1e-6))}`);
    root = createRoot(container);
    await act(async () =>
      root?.render(
        <>
          {[
            { id: "first", pool: first },
            { id: "second", pool: second },
          ].map(({ id, pool }) => (
            <BrownianLinkedGroup
              key={id}
              definition={definition}
              tracerExample={examples.tracer}
              densityExample={examples.density}
              workerFactories={pool.factories}
            />
          ))}
        </>,
      ),
    );
    await until(
      () =>
        surface(0).dataset.groupRestoring === "false" &&
        surface(1).dataset.groupRestoring === "false",
    );
    expect(radii(0)).toEqual(["1 μm", "1 μm"]);
    expect(radii(1)).toEqual(["1 μm", "1 μm"]);
    const separate = displayed(1);
    const instanceIds = [...first.requests(), ...second.requests()].map(
      (request) => request.instanceId,
    );
    expect(new Set(instanceIds).size).toBe(4);
    await submitRadius("shared-radius", "2", 0);
    await until(() => radii(0).every((radius) => radius === "2 μm"));
    expect(displayed(1)).toEqual(separate);
    expect(second.requests()).toHaveLength(2);
  });

  test("navigation after successful calculation but before React adopts it keeps the mounted pair", async () => {
    const pool = await mount();
    await until(() => surface().dataset.groupRestoring === "false");
    const before = displayed();
    holdSuccessfulRestore = true;
    await navigate(record(1e-6));
    await until(() => deliveries.length === 1);
    expect(pool.channels).toHaveLength(2);
    expect(pool.channels.map(({ owner }) => owner.requests.length)).toEqual([1, 1]);
    expect(displayed()).toEqual(before);
    await act(async () => {
      const delivery = deliveries[0];
      assert(delivery);
      delivery.release();
      // Let the real result queue its React update, then supersede it within this same batch.
      for (let turn = 0; turn < 20 && !handledRestores.includes(delivery.result); turn++)
        await Promise.resolve();
      expect(handledRestores).toContain(delivery.result);
      expect(displayed()).toEqual(before);
      changeLocation();
    });
    await until(() => surface().dataset.groupRestoring === "false");
    expect(displayed()).toEqual(before);
    expect(surface().dataset.groupEnabled).toBe("false");
    expect(pool.disposals()).toBe(2);
    expect(pool.requests()).toHaveLength(2);
  });
});
