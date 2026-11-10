import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { TRACE_POINTS } from "../../experiments/bm01/definition.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import { recordedSampleIndex } from "../../experiments/playback/recordingClock.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import exampleJson from "../../generated/bm01-example.json";
import { PLAYBACK_MANIFESTS } from "../../generated/playback.ts";
import {
  createContainer,
  emitTestIntersection,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { array } from "./presentation.ts";
import { TracerPlayback } from "./TracerPlayback.tsx";

const manifest = PLAYBACK_MANIFESTS["bm-01"];
let workersCreated = 0;
const session = createBm01Session("playback-test", exampleJson as PreparedBm01Example, () => {
  workersCreated++;
  throw new Error("Playback must not create a numerical worker.");
});
const snapshot = session.getServerSnapshot().accepted as AcceptedSnapshot;

test("the no-JavaScript case has complete traces, and eligibility comes from the manifest", () => {
  const html = renderToStaticMarkup(
    <TracerPlayback snapshot={snapshot} zoom={1} manifest={manifest} />,
  );
  expect(html).toContain('data-recorded-time="1"');
  expect(html).toContain("The complete accepted traces are shown.");
  expect(html).toContain('hidden="" class="tracer-playback-controls"');
  expect(html).toContain("Read the displayed positions as a table");
  const ineligible = renderToStaticMarkup(
    <TracerPlayback snapshot={snapshot} zoom={1} manifest={PLAYBACK_MANIFESTS["sr-05"]} />,
  );
  expect(ineligible).not.toContain("Replay the same traces");
  expect(ineligible).toContain("tracer-path");
});

describe("real tracer playback controls", () => {
  let container: HTMLElement;
  let root: Root;
  let now: number;
  let nextFrame: number;
  let frames: Map<number, FrameRequestCallback>;
  let restoreClock: () => void;
  let reducedMotion: boolean;
  let preference: MediaQueryList;

  beforeEach(async () => {
    installDom({ intersections: "visible" });
    container = createContainer();
    root = createRoot(container);
    now = 1000;
    nextFrame = 0;
    frames = new Map();
    reducedMotion = false;
    const matchMedia = window.matchMedia.bind(window);
    preference = matchMedia("(prefers-reduced-motion: reduce)");
    Object.defineProperty(preference, "matches", { configurable: true, get: () => reducedMotion });
    window.matchMedia = (query) => (query === preference.media ? preference : matchMedia(query));
    const oldNow = Object.getOwnPropertyDescriptor(window.performance, "now");
    Object.defineProperty(window.performance, "now", { configurable: true, value: () => now });
    restoreClock = () => {
      if (oldNow) Object.defineProperty(window.performance, "now", oldNow);
    };
    window.requestAnimationFrame = (callback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      frames.delete(id);
    };
    await act(async () =>
      root.render(<TracerPlayback snapshot={snapshot} zoom={1} manifest={manifest} />),
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    restoreClock();
    removeContainer(container);
    await uninstallDom();
  });

  function button(text: string): HTMLButtonElement {
    const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent === text,
    );
    expect(found).toBeDefined();
    return found as HTMLButtonElement;
  }

  function plot(index = 0): HTMLElement {
    const found = container.querySelector<HTMLElement>(`[data-playback-view="${index}"] figure`);
    expect(found).not.toBeNull();
    return found as HTMLElement;
  }

  async function press(text: string) {
    await act(async () => button(text).click());
  }
  async function advance(milliseconds: number) {
    now += milliseconds;
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => {
      for (const callback of pending) callback(now);
    });
  }

  async function setInput(selector: string, value: string | boolean) {
    const control = container.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    expect(control).not.toBeNull();
    const source = [...container.querySelectorAll("input,button")].flatMap((input) =>
      Object.keys(input),
    );
    const key = source.find((name) => name.startsWith("__reactProps$"));
    expect(key).toBeDefined();
    const props = (control as unknown as Record<string, { onChange: (event: unknown) => void }>)[
      key as string
    ];
    expect(props?.onChange).toBeDefined();
    await act(async () => {
      if (typeof value === "boolean") (control as HTMLInputElement).checked = value;
      else (control as HTMLInputElement).value = value;
      props?.onChange({ target: control, currentTarget: control });
    });
  }

  test("starts paused; wall time selects exact accepted samples without changing the trial", async () => {
    const before = session.getSnapshot();
    expect(frames.size).toBe(0);
    await advance(5000);
    expect(plot().dataset.playbackTime).toBe("1");
    await press("Play recording");
    expect(frames.size).toBe(1);
    await advance(500);
    expect(Number(plot().dataset.playbackTime)).toBe(0.5);
    const sample = recordedSampleIndex(array(snapshot, "traceTimes"), 0.5);
    const trace = array(snapshot, "traceCoordinates");
    const marker = plot().querySelector<SVGCircleElement>('[data-tracer-index="3"]');
    expect(Number(marker?.dataset.xMetres)).toBe(trace.at((3 * TRACE_POINTS + sample) * 2));
    expect(Number(marker?.dataset.yMetres)).toBe(trace.at((3 * TRACE_POINTS + sample) * 2 + 1));
    await advance(500);
    expect(plot().dataset.recordedTime).toBe("1");
    expect(frames.size).toBe(0);
    expect(session.getSnapshot()).toBe(before);
    expect(workersCreated).toBe(0);
  });

  test("the rate selector and side-by-side views change timing, never positions or statistics", async () => {
    await setInput("select", "25");
    expect(plot().dataset.playbackMultiplier).toBe("25");
    expect(container.textContent).toContain("25 times faster");
    await setInput('input[type="checkbox"]', true);
    await press("Play recording");
    await advance(20);
    expect(Number(plot(0).dataset.playbackTime)).toBeCloseTo(0.02, 12);
    expect(Number(plot(1).dataset.playbackTime)).toBeCloseTo(0.5, 12);
    await advance(30);
    expect(plot(1).dataset.playbackTime).toBe("1");
    await press("Pause playback");
    await advance(100_000);
    await press("Play recording");
    await advance(10);
    // The faster view already finished: resuming the slower one must not start another replay.
    expect(plot(1).dataset.playbackTime).toBe("1");
    expect(Number(plot(0).dataset.playbackTime)).toBeCloseTo(0.06, 12);
    expect(workersCreated).toBe(0);
  });

  test("typed time, keyboard range and next-recorded-position controls inspect the same samples", async () => {
    await press("Go to start");
    await press("Next recorded position");
    expect(Number(plot().dataset.recordedTime)).toBe(0.02);
    await setInput('input[type="range"]', "0.5");
    expect(plot().dataset.recordedTime).toBe("0.5");
    await setInput('input[type="number"]', "0.4");
    await press("Go to time");
    expect(plot().dataset.recordedTime).toBe("0.4");
    await press("Show complete traces");
    expect(plot().dataset.recordedTime).toBe("1");
    expect(frames.size).toBe(0);
  });

  test("offscreen playback pauses and keeps its place until the reader explicitly resumes", async () => {
    await press("Play recording");
    await advance(200);
    const region = container.querySelector<HTMLElement>("[data-tracer-playback]") as HTMLElement;
    await act(async () => {
      expect(emitTestIntersection(region, false)).toBe(1);
    });
    expect(frames.size).toBe(0);
    await advance(100_000);
    expect(Number(plot().dataset.playbackTime)).toBe(0.2);
    await act(async () => {
      emitTestIntersection(region, true);
    });
    expect(frames.size).toBe(0);
    await press("Play recording");
    await advance(100);
    expect(Number(plot().dataset.playbackTime)).toBeCloseTo(0.3, 12);
  });

  test("reading-only suppresses playback while retaining manual sample navigation", async () => {
    await press("Play recording");
    await advance(100);
    await act(async () => {
      document.documentElement.dataset.readingOnly = "on";
    });
    expect(frames.size).toBe(0);
    expect(button("Play recording").disabled).toBe(true);
    await press("Next recorded position");
    expect(Number(plot().dataset.recordedTime)).toBe(0.12);
    expect(container.textContent).toContain("Use the time field or step controls");
  });

  test("a changed reduced-motion preference stops animation and preserves stepping", async () => {
    await press("Play recording");
    await advance(100);
    await act(async () => {
      reducedMotion = true;
      preference.dispatchEvent(new Event("change"));
    });
    expect(frames.size).toBe(0);
    expect(button("Play recording").disabled).toBe(true);
    await press("Next recorded position");
    expect(Number(plot().dataset.recordedTime)).toBe(0.12);
  });

  test("pagehide cancels the frame loop and pageshow never autoplays it", async () => {
    await press("Play recording");
    await advance(100);
    await act(async () => window.dispatchEvent(new Event("pagehide")));
    expect(frames.size).toBe(0);
    await advance(100_000);
    await act(async () => window.dispatchEvent(new Event("pageshow")));
    expect(frames.size).toBe(0);
    expect(Number(plot().dataset.playbackTime)).toBe(0.1);
  });

  test("a new accepted snapshot cancels playback and shows its complete static case", async () => {
    await press("Play recording");
    await advance(100);
    const next = { ...snapshot, snapshotVersion: snapshot.snapshotVersion + 1 };
    await act(async () =>
      root.render(<TracerPlayback snapshot={next} zoom={1} manifest={manifest} />),
    );
    expect(frames.size).toBe(0);
    expect(plot().dataset.recordedTime).toBe("1");
    expect(
      container.querySelector("[data-tracer-playback]")?.getAttribute("data-snapshot-version"),
    ).toBe(String(next.snapshotVersion));
  });

  test("scale length comes from the manifest and zoom stays independent of playback speed", async () => {
    const larger = { ...manifest, scaleBar: { length: 2e-6, unit: "m" } };
    await act(async () =>
      root.render(<TracerPlayback snapshot={snapshot} zoom={2} manifest={larger} />),
    );
    const bar = plot().querySelector(".scale-bar line");
    expect(Number(bar?.getAttribute("x2")) - Number(bar?.getAttribute("x1"))).toBe(100);
    await setInput("select", "25");
    const after = plot().querySelector(".scale-bar line");
    expect(Number(after?.getAttribute("x2")) - Number(after?.getAttribute("x1"))).toBe(100);
  });
});
