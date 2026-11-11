import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { dateKindLabel, formatTimelineDate, timelineSpan } from "../../discovery/timeline/model.ts";
import { loadTimeline } from "../../discovery/timeline/records.ts";
import TimelinePage from "./page.tsx";

const timeline = loadTimeline();
const html = renderToStaticMarkup(<TimelinePage />);
const browser = new Window();
browser.document.body.innerHTML = html;
const document = browser.document;

describe("the timeline's static reading experience", () => {
  test("every source event has a unique public anchor, date kind, source and limits in the HTML", () => {
    const anchors = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const entry of timeline.entries) {
      const element = document.getElementById(`t-${entry.id}`);
      expect(element).not.toBeNull();
      expect(element?.textContent).toContain(dateKindLabel(entry.date.kind));
      expect(element?.textContent).toContain(formatTimelineDate(entry.date));
      expect(element?.textContent).toContain(entry.summary);
      if (entry.limits) expect(element?.textContent).toContain(entry.limits);
      for (const source of entry.sources) {
        expect(element?.textContent).toContain(source.title);
        if (source.locator) expect(element?.textContent).toContain(source.locator);
      }
    }
  });

  test("track spans are computed from the dated entries that actually render", () => {
    for (const track of timeline.tracks) {
      const element = document.getElementById(`timeline-${track.id}`);
      const ids = [...(element?.querySelectorAll("[data-timeline-entry]") ?? [])].map((entry) =>
        entry.getAttribute("data-timeline-entry"),
      );
      expect(ids.length).toBeGreaterThan(0);
      const rendered = timeline.entries.filter((entry) => ids.includes(entry.id));
      expect(element?.querySelector("[data-timeline-span]")?.textContent).toContain(
        timelineSpan(rendered),
      );
    }
  });

  test("the boundary separates available work from parallel work and imports in the long arc", () => {
    const longArc = document.getElementById("timeline-long-arc");
    expect(longArc).not.toBeNull();
    const boundary = longArc?.querySelector("#t-boundary-1904");
    expect(boundary?.textContent).toContain("The end of 1904");
    const before = longArc?.querySelector("ol.timeline-events");
    const after = longArc?.querySelector("#timeline-post-1904");
    for (const entry of timeline.entries.filter((item) => item.track === "long-arc")) {
      expect(
        (entry.beforeBoundary ? before : after)?.querySelector(`#t-${entry.id}`),
      ).not.toBeNull();
      expect((entry.beforeBoundary ? after : before)?.querySelector(`#t-${entry.id}`)).toBeNull();
    }
  });

  test("no JavaScript is needed for a source or date, and inactive filters do not pretend to work", () => {
    expect(document.querySelector(".timeline-filters")?.hasAttribute("hidden")).toBe(true);
    expect(document.getElementById("timeline-post-1904")?.hasAttribute("hidden")).toBe(false);
    expect(document.getElementById("timeline-later-confirmations")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(document.querySelectorAll("[data-timeline-entry]").length).toBe(timeline.entries.length);
    expect(html).not.toContain("Awaiting verification");
    expect(html).not.toContain("Verified against original source");
  });

  test("month-only manuscript dates do not acquire a day in their time element", () => {
    const massEnergy = document.getElementById("t-mass-energy-date-line");
    expect(massEnergy?.querySelector("time")?.getAttribute("datetime")).toBe("1905-09");
    expect(massEnergy?.querySelector("time")?.textContent).toBe("September 1905");
  });

  test("every local jump published by the timeline reaches a real static element", () => {
    const jumps = [...document.querySelectorAll('a[href^="#"]')];
    expect(jumps.length).toBeGreaterThan(0);
    for (const link of jumps)
      expect(document.getElementById(link.getAttribute("href")?.slice(1) ?? "")).not.toBeNull();
  });
});
