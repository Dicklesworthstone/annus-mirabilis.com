import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { CHAPTER_INVESTIGATIONS } from "../discovery/investigation/chapterTasks.ts";
import { KeptInvestigations } from "../discovery/investigation/KeptInvestigations.tsx";
import { readStoredInvestigation } from "../discovery/investigation/persistence.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { PaperChapterInvestigation } from "./PaperChapterInvestigation.tsx";

describe("additional chapter tasks use the real laboratory controls", () => {
  let root: Root;
  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    window.localStorage.clear();
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    await uninstallDom();
  });

  async function until(check: () => boolean) {
    for (let attempt = 0; attempt < 150 && !check(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    expect(check()).toBe(true);
  }
  function button(label: string): HTMLButtonElement {
    const found = [...document.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === label,
    );
    assert.ok(found, label);
    return found;
  }
  async function click(label: string) {
    await act(async () => button(label).click());
  }
  async function openWorkspace() {
    const details = document.querySelector<HTMLDetailsElement>(".investigation-disclosure");
    assert.ok(details);
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    await until(() => document.querySelector('textarea[id$="-prediction"]') !== null);
  }
  function field(suffix: string): HTMLTextAreaElement {
    const found = document.querySelector<HTMLTextAreaElement>(`textarea[id$="-${suffix}"]`);
    assert.ok(found);
    return found;
  }
  function props(node: Element): Record<string, (event: unknown) => void> {
    const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
    assert.ok(key);
    return (node as unknown as Record<string, Record<string, (event: unknown) => void>>)[key] ?? {};
  }
  async function change(selector: string, value: string) {
    const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    assert.ok(element, selector);
    await act(async () => {
      element.value = value;
      props(element).onChange?.({ target: element, currentTarget: element });
    });
  }

  test("explanations, revisit prompts and standalone links exist without JavaScript", () => {
    for (const chapter of CHAPTER_INVESTIGATIONS) {
      const markup = renderToStaticMarkup(
        <PaperChapterInvestigation paper={chapter.paper} section={chapter.section} />,
      );
      expect(markup).toContain(`data-chapter-investigation="${chapter.id}"`);
      expect(markup).toContain("Read the worked explanation at any time");
      expect(markup).toContain("Assumption.");
      expect(markup).toContain("Quantity.");
      expect(markup).toContain("A possible confusion.");
      expect(markup).toContain("Questions for your explanation");
      expect(markup).toContain(`id="${chapter.id}-revisit"`);
      expect(markup).toContain(`href="/lab/${chapter.laboratory}/"`);
      expect(markup).not.toContain("data-instrument-id=");
    }
    expect(renderToStaticMarkup(
      <PaperChapterInvestigation paper="special-relativity" section="s5" />,
    )).toBe("");
  });

  for (const chapter of [CHAPTER_INVESTIGATIONS[1], CHAPTER_INVESTIGATIONS[2]]) {
    test(`${chapter.laboratory}: explicit load, changed reading, refused edit, saved return`, async () => {
      const { spec } = chapter;
      const page = `/papers/${chapter.paper}/${chapter.section}/`;
      window.history.replaceState({}, "", `${page}#${spec.laboratoryAnchor}`);
      await act(async () => root.render(
        <PaperChapterInvestigation paper={chapter.paper} section={chapter.section} />,
      ));
      const disclosure = document.querySelector<HTMLDetailsElement>(
        `[data-chapter-lab="${chapter.laboratory}"]`,
      );
      assert.ok(disclosure);
      expect(disclosure.open).toBe(true);
      expect(document.querySelector(`[data-instrument-id="${chapter.laboratory}"]`)).toBeNull();
      await openWorkspace();
      expect(button("Pin prediction and starting reading").disabled).toBe(true);
      await click("Load this experiment");
      await until(() => !button("Pin prediction and starting reading").disabled);
      const lab = document.querySelector(`[data-instrument-id="${chapter.laboratory}"]`);
      assert.ok(lab);
      const instance = lab.getAttribute("data-instance-id");
      assert.ok(instance);
      expect(document.querySelectorAll(`#${spec.laboratoryAnchor}`)).toHaveLength(1);
      field("prediction").value = "The description changes while the physical event is the same.";
      await click("Pin prediction and starting reading");
      const baseline = readStoredInvestigation(chapter.id).report?.baseline.reading;
      assert.ok(baseline);
      expect(baseline.instanceId).toBe(instance);

      if (chapter.laboratory === "sr-02") {
        const radios = document.querySelectorAll<HTMLInputElement>('input[name="descriptionFrame"]');
        const conductor = radios[1];
        assert.ok(conductor);
        await act(async () => props(conductor).onChange?.({ target: conductor }));
      } else {
        await change('select[name="forceConvention"]', "laboratory");
      }
      await click("Apply settings");
      const acceptedAction = lab.getAttribute("data-accepted-action-index");
      expect(button("Capture changed reading").disabled).toBe(false);

      // These blank edits fail in the view before session.apply. The old accepted result remains
      // on screen, but it must not be capturable as a result of the refused change.
      const numeric = chapter.laboratory === "sr-02" ? "speed" : "initialSpeed";
      await change(`input[name="${numeric}"]`, "");
      await click("Apply settings");
      expect(button("Capture changed reading").disabled).toBe(true);
      expect(lab.getAttribute("data-accepted-action-index")).toBe(acceptedAction);
      await click("Capture changed reading");
      expect(readStoredInvestigation(chapter.id).report?.observations).toEqual([]);
      await change(`input[name="${numeric}"]`, chapter.laboratory === "sr-02" ? "10" : "0.6");
      await click("Apply settings");
      expect(button("Capture changed reading").disabled).toBe(false);
      await click("Capture changed reading");
      const report = readStoredInvestigation(chapter.id).report;
      assert.ok(report);
      const changed = report.observations[0]?.reading;
      assert.ok(changed);
      expect(changed.instanceId).toBe(instance);
      expect(changed.runId).toBe(baseline.runId);
      expect(changed.actionIndex).toBeGreaterThan(baseline.actionIndex);
      expect(changed.origin).toBe("accepted-laboratory-result");
      expect(report.baseline.reading).toEqual(baseline);
      expect(
        chapter.laboratory === "sr-02"
          ? changed.parameters.descriptionFrame
          : changed.parameters.forceConvention,
      ).toBe(chapter.laboratory === "sr-02" ? "conductor-rest" : "laboratory");

      field("explanation").value = "I compared the two frame-labelled readings with my prediction.";
      await click("Keep my explanation");
      const saved = JSON.stringify(readStoredInvestigation(chapter.id).report);
      await act(async () => {
        disclosure.open = false;
        disclosure.dispatchEvent(new Event("toggle"));
        disclosure.open = true;
        disclosure.dispatchEvent(new Event("toggle"));
      });
      expect(document.querySelector(`[data-instrument-id="${chapter.laboratory}"]`)).toBe(lab);

      await act(async () => root.render(<KeptInvestigations />));
      expect(
        document.querySelector(`[data-kept-investigation="${chapter.id}"]`)?.textContent,
      ).toContain(report.prediction);
      await act(async () => root.render(
        <PaperChapterInvestigation paper={chapter.paper} section={chapter.section} />,
      ));
      await openWorkspace();
      expect(document.body.textContent).toContain(report.prediction);
      expect(button("Capture changed reading").disabled).toBe(true);
      expect(JSON.stringify(readStoredInvestigation(chapter.id).report)).toBe(saved);
    }, 20_000);
  }

  test("a refused Brownian form edit cannot capture the prepared accepted snapshot", async () => {
    const chapter = CHAPTER_INVESTIGATIONS[0];
    window.history.replaceState({}, "", `/papers/brownian-motion/s3/#${chapter.spec.laboratoryAnchor}`);
    await act(async () => root.render(
      <PaperChapterInvestigation paper={chapter.paper} section={chapter.section} />,
    ));
    await openWorkspace();
    await click("Load this experiment");
    await until(() => !button("Pin prediction and starting reading").disabled);
    field("prediction").value = "I will compare the zero-force step presets.";
    await click("Pin prediction and starting reading");
    const baseline = readStoredInvestigation(chapter.id).report?.baseline.reading;
    assert.ok(baseline);
    await change('input[name="T"]', "");
    await click("Apply settings");
    expect(button("Capture changed reading").disabled).toBe(true);
    await click("Capture changed reading");
    const report = readStoredInvestigation(chapter.id).report;
    expect(report?.observations).toEqual([]);
    expect(report?.baseline.reading).toEqual(baseline);
  }, 20_000);
});
