import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { createBm05Session, type PreparedBm05Example } from "../../experiments/bm05/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import exampleJson from "../../generated/bm05-example.json";
import {
  createContainer,
  emitTestIntersection,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { array } from "./presentation.ts";
import { WalkPlayback } from "./WalkPlayback.tsx";

let workersCreated = 0;
const session = createBm05Session("walk-playback-test", exampleJson as PreparedBm05Example, () => {
  workersCreated++;
  throw new Error("Inspecting an accepted walk must not start a numerical worker.");
});
const snapshot = session.getServerSnapshot().accepted as AcceptedSnapshot;
const times = array(snapshot, "traceTimes");
const duration = times.at(times.length - 1);

test("without JavaScript the whole accepted walk and its named position table remain readable", () => {
  const html = renderToStaticMarkup(<WalkPlayback snapshot={snapshot} />);
  expect(html).toContain(`data-recorded-time="${duration}"`);
  expect(html).toContain('hidden="" class="walk-playback-controls"');
  expect(html).toContain(
    "The complete accepted walks and their final recorded positions are shown.",
  );
  expect(html).toContain("Recorded positions at");
  expect(html).toContain("Walk 1</th>");
  expect(html).toContain("ensemble statistics stay at the accepted observation");
  // BM-05 has no declared natural physical rate. A display clock cannot invent one.
  expect(html).not.toMatch(/true rate|real time/i);
});

describe("same-recording random-walk playback", () => {
  let container: HTMLElement;
  let root: Root;
  let now: number;
  let serial: number;
  let frames: Map<number, FrameRequestCallback>;
  let reducedMotion: boolean;
  let preference: MediaQueryList;

  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    container = createContainer();
    root = createRoot(container);
    now = 1000;
    serial = 0;
    frames = new Map();
    reducedMotion = false;
    const matchMedia = window.matchMedia.bind(window);
    preference = matchMedia("(prefers-reduced-motion: reduce)");
    Object.defineProperty(preference, "matches", { configurable: true, get: () => reducedMotion });
    window.matchMedia = (query) => (query === preference.media ? preference : matchMedia(query));
    Object.defineProperty(window.performance, "now", { configurable: true, value: () => now });
    window.requestAnimationFrame = (callback) => {
      const handle = ++serial;
      frames.set(handle, callback);
      return handle;
    };
    window.cancelAnimationFrame = (handle) => {
      frames.delete(handle);
    };
    await act(async () => root.render(<WalkPlayback snapshot={snapshot} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    expect(frames.size).toBe(0);
    removeContainer(container);
    await uninstallDom();
  });

  function button(name: string): HTMLButtonElement {
    const result = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (node) => node.textContent === name,
    );
    expect(result).toBeDefined();
    return result as HTMLButtonElement;
  }

  function plot(): HTMLElement {
    const result = container.querySelector<HTMLElement>("figure[data-recorded-time]");
    expect(result).not.toBeNull();
    return result as HTMLElement;
  }

  async function press(name: string) {
    await act(async () => button(name).click());
  }

  async function advance(milliseconds: number) {
    now += milliseconds;
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => {
      for (const callback of pending) callback(now);
    });
  }

  async function input(suffix: string, value: string) {
    const control = container.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[id$="-${suffix}"]`,
    );
    expect(control).not.toBeNull();
    const key = [...container.querySelectorAll("input,button")]
      .flatMap((node) => Object.keys(node))
      .find((name) => name.startsWith("__reactProps$"));
    expect(key).toBeDefined();
    const props = (control as unknown as Record<string, { onChange: (event: unknown) => void }>)[
      key as string
    ];
    await act(async () => {
      (control as HTMLInputElement).value = value;
      props?.onChange({ target: control, currentTarget: control });
    });
  }

  test("plays accepted sample prefixes and holds a sample between jumps without touching the owner", async () => {
    const original = session.getSnapshot();
    expect(frames.size).toBe(0);
    await advance(20_000);
    expect(Number(plot().dataset.recordedTime)).toBe(duration);
    await press("Play recorded walks");
    expect(frames.size).toBe(1);
    await advance(125);
    expect(Number(plot().dataset.recordedTime)).toBe(0.1);
    const paths = [...plot().querySelectorAll(".walk-trace")].map((node) => node.getAttribute("d"));
    const positions = [...plot().querySelectorAll<SVGElement>("[data-walker-index]")].map((node) =>
      Number(node.dataset.displacementMetres),
    );
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.some((position) => position !== 0)).toBe(true);
    // Holding the preceding point is different from interpolating the next jump.
    await advance(25);
    expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.15, 12);
    expect(
      [...plot().querySelectorAll(".walk-trace")].map((node) => node.getAttribute("d")),
    ).toEqual(paths);
    expect(
      [...plot().querySelectorAll<HTMLElement>("tbody td[data-displacement-metres]")].map((node) =>
        Number(node.dataset.displacementMetres),
      ),
    ).toEqual(positions);
    await advance(1000);
    expect(Number(plot().dataset.recordedTime)).toBe(duration);
    expect(frames.size).toBe(0);
    expect(session.getSnapshot()).toBe(original);
    expect(workersCreated).toBe(0);
  });

  test("recorded-point navigation collapses duplicated slots and agrees with typed model time", async () => {
    expect(container.textContent).toContain("Recorded point (1 to 5)");
    await press("Go to start");
    await press("Next recorded point");
    expect(Number(plot().dataset.recordedTime)).toBe(0.1);
    await press("Next recorded point");
    expect(Number(plot().dataset.recordedTime)).toBe(0.2);
    await press("Previous recorded point");
    expect(Number(plot().dataset.recordedTime)).toBe(0.1);
    await input("point", "4");
    await press("Go to recorded point");
    expect(Number(plot().dataset.recordedTime)).toBeCloseTo(0.3, 12);
    await input("time", "0.25");
    await press("Go to time");
    expect(Number(plot().dataset.recordedTime)).toBe(0.2);
    await input("scrub", "0.15");
    expect(Number(plot().dataset.recordedTime)).toBe(0.1);
    await press("Show complete walks");
    expect(Number(plot().dataset.recordedTime)).toBe(duration);
    expect(frames.size).toBe(0);
  });

  for (const field of ["time", "point"] as const) {
    for (const invalid of ["", "-1", "1e300", ...(field === "point" ? ["1.5"] : [])]) {
      test(`refuses ${field} ${JSON.stringify(invalid)} without changing a playing recording`, async () => {
        await press("Play recorded walks");
        await advance(100);
        const before = plot().innerHTML;
        await input(field, invalid);
        await press(field === "time" ? "Go to time" : "Go to recorded point");
        expect(container.querySelector("form")?.noValidate).toBe(true);
        expect(container.querySelector(`[id$="-${field}"]`)?.getAttribute("aria-invalid")).toBe(
          "true",
        );
        expect(container.querySelector(".notice.error")?.textContent).toContain(
          "accepted trial are unchanged",
        );
        expect(plot().innerHTML).toBe(before);
        expect(frames.size).toBe(1);
        await advance(50);
        expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.15, 12);
        expect(workersCreated).toBe(0);
      });
    }
  }

  test("changing playback rate changes only the display clock", async () => {
    const original = session.getSnapshot();
    await input("rate", "10");
    await press("Play recorded walks");
    await advance(25);
    expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.25, 12);
    expect(Number(plot().dataset.recordedTime)).toBe(0.2);
    expect(
      container.querySelector("[data-walk-ensemble-time]")?.getAttribute("data-walk-ensemble-time"),
    ).toBe(String(duration));
    expect(session.getSnapshot()).toBe(original);
  });

  test("hidden views pause and require an explicit resume without consuming the hidden interval", async () => {
    await press("Play recorded walks");
    await advance(100);
    const region = container.querySelector<HTMLElement>("[data-walk-playback]");
    expect(region).not.toBeNull();
    await act(async () => {
      expect(emitTestIntersection(region as HTMLElement, false)).toBeGreaterThan(0);
    });
    expect(frames.size).toBe(0);
    expect(button("Play recorded walks").disabled).toBe(true);
    await advance(60_000);
    expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.1, 12);
    await act(async () => {
      expect(emitTestIntersection(region as HTMLElement, true)).toBeGreaterThan(0);
    });
    expect(frames.size).toBe(0);
    expect(button("Play recorded walks").disabled).toBe(false);
    await press("Play recorded walks");
    await advance(50);
    expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.15, 12);
  });

  for (const mode of ["reduced-motion", "reading-only"] as const) {
    test(`${mode} pauses animation while retaining manual inspection`, async () => {
      await press("Play recorded walks");
      await advance(100);
      await act(async () => {
        if (mode === "reduced-motion") {
          reducedMotion = true;
          preference.dispatchEvent(new Event("change"));
        } else {
          document.documentElement.dataset.readingOnly = "on";
        }
      });
      expect(frames.size).toBe(0);
      expect(button("Play recorded walks").disabled).toBe(true);
      await advance(60_000);
      expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.1, 12);
      await press("Next recorded point");
      expect(Number(plot().dataset.recordedTime)).toBe(0.2);
      await act(async () => {
        if (mode === "reduced-motion") {
          reducedMotion = false;
          preference.dispatchEvent(new Event("change"));
        } else {
          delete document.documentElement.dataset.readingOnly;
        }
      });
      expect(frames.size).toBe(0);
      expect(button("Play recorded walks").disabled).toBe(false);
      await press("Play recorded walks");
      await advance(50);
      expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.25, 12);
      expect(workersCreated).toBe(0);
    });
  }

  test("pagehide and a replacement snapshot cannot leave a stale animation running", async () => {
    await press("Play recorded walks");
    await advance(100);
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(frames.size).toBe(0);
    await advance(60_000);
    await act(async () => {
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(frames.size).toBe(0);
    expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.1, 12);
    await press("Play recorded walks");
    await advance(50);
    expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.15, 12);
    const replacement: AcceptedSnapshot = {
      ...snapshot,
      snapshotVersion: snapshot.snapshotVersion + 1,
    };
    await act(async () => root.render(<WalkPlayback snapshot={replacement} />));
    expect(frames.size).toBe(0);
    expect(Number(plot().dataset.recordedTime)).toBe(duration);
    await advance(60_000);
    expect(Number(plot().dataset.recordedTime)).toBe(duration);
    expect(workersCreated).toBe(0);
  });
});
