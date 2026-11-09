import { afterEach, expect, test } from "bun:test";
import {
  emitTestIntersection,
  installDom,
  observedTestIntersections,
  uninstallDom,
} from "./reactDom.ts";

afterEach(uninstallDom);

test("manual intersections report only the target actually observed, then stop on cleanup", async () => {
  await installDom({ intersections: "manual" });
  const observed = document.createElement("section");
  const sibling = document.createElement("aside");
  const received: IntersectionObserverEntry[] = [];
  const observer = new window.IntersectionObserver((entries) => received.push(...entries));
  observer.observe(observed);
  await Promise.resolve();
  expect(received).toHaveLength(0);
  expect(observedTestIntersections()).toEqual([observed]);
  expect(emitTestIntersection(sibling, true)).toBe(0);
  expect(emitTestIntersection(observed, true)).toBe(1);
  expect(received[0]?.target).toBe(observed);
  expect(received[0]?.isIntersecting).toBe(true);
  expect(emitTestIntersection(observed, false)).toBe(1);
  expect(received[1]?.intersectionRatio).toBe(0);
  observer.disconnect();
  expect(observedTestIntersections()).toEqual([]);
  expect(emitTestIntersection(observed, true)).toBe(0);
  expect(received).toHaveLength(2);
});

test("visible intersections deliver the initial entry asynchronously and honor unobserve", async () => {
  await installDom({ intersections: "visible" });
  const kept = document.createElement("section");
  const removed = document.createElement("section");
  const received: IntersectionObserverEntry[] = [];
  const observer = new window.IntersectionObserver((entries) => received.push(...entries));
  observer.observe(kept);
  observer.observe(removed);
  observer.unobserve(removed);
  expect(received).toHaveLength(0);
  await Promise.resolve();
  expect(received.map((entry) => entry.target)).toEqual([kept]);
  expect(received[0]?.isIntersecting).toBe(true);
  observer.disconnect();
  expect(observedTestIntersections()).toEqual([]);
});

test("ordinary DOM installation keeps deterministic intersections opt in", async () => {
  await installDom();
  expect(() => observedTestIntersections()).toThrow("explicit intersections");
});
