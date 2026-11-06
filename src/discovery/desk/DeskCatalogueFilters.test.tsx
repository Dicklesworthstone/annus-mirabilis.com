import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { openCommandPalette } from "../../search/CommandPalette.ts";
import { createSearchEngine } from "../../search/core.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { KnowledgeCardView } from "../cards/KnowledgeCard.tsx";
import { DeskCatalogueFilters, revealDeskCard } from "./DeskCatalogueFilters.tsx";
import { deskFilterEntry } from "./model.ts";
import { loadDesk } from "./records.ts";

const desk = loadDesk();
const entries = desk.catalogue.map(deskFilterEntry);
const targetId = "sutherland-1905-phil-mag";
const targetHash = `#card-${targetId}`;

function Catalogue() {
  return (
    <section id="desk-catalogue-list" aria-label="Knowledge catalogue">
      {desk.catalogue.map((entry) => (
        <article
          id={`desk-entry-${entry.card.id}`}
          key={entry.card.id}
          data-desk-entry={entry.card.id}
        >
          <KnowledgeCardView card={entry.card} />
        </article>
      ))}
    </section>
  );
}

test("the server renders every full card while the JavaScript filter controls stay hidden", () => {
  const html = renderToStaticMarkup(
    <>
      <DeskCatalogueFilters entries={entries} objects={desk.objects} />
      <Catalogue />
    </>,
  );
  expect(html).toContain('class="desk-catalogue-filters" hidden=""');
  expect((html.match(/data-desk-entry=/g) ?? []).length).toBe(39);
  for (const entry of desk.catalogue) {
    expect(html).toContain(`id="card-${entry.card.id}"`);
    expect(html).toContain(`id="desk-entry-${entry.card.id}"`);
  }
  expect(html).toContain("Parallel work");
  expect(html).not.toContain('id="card-einstein-1905-light-complex-transformation"');
});

function find<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  expect(node).not.toBeNull();
  return node as T;
}
type Handlers = Record<string, ((event: unknown) => void) | undefined>;
function handlers(control: Element, target: Element = control): Handlers {
  const key = Object.keys(control).find((candidate) => candidate.startsWith("__reactProps$"));
  const value = key ? (target as unknown as Record<string, Handlers>)[key] : undefined;
  expect(value).toBeDefined();
  return value ?? {};
}
async function edit(name: string, value: string) {
  const control = find<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  await act(async () => {
    control.value = value;
    if (control instanceof HTMLSelectElement)
      control.dispatchEvent(new Event("change", { bubbles: true }));
    else handlers(control).onChange?.({ currentTarget: control, target: control });
  });
}
async function apply() {
  const control = find<HTMLInputElement>('[name="from"]');
  const form = find<HTMLFormElement>('form[aria-label="Filter the 1904 knowledge catalogue"]');
  await act(async () => handlers(control, form).onSubmit?.({ preventDefault() {} }));
}
function visible() {
  return [...document.querySelectorAll<HTMLElement>("[data-desk-entry]")]
    .filter((entry) => !entry.hidden)
    .map((entry) => entry.dataset.deskEntry);
}
async function filterToSpectrum() {
  await edit("object", "object-spectrum");
  await apply();
  expect(find<HTMLElement>(`#desk-entry-${targetId}`).hidden).toBe(true);
}

describe("the mounted desk catalogue", () => {
  let root: ReturnType<typeof createRoot>;
  beforeEach(async () => {
    await installDom();
    window.history.replaceState(null, "", "/1904/");
    document.body.innerHTML = `<div id="filters"></div>${renderToStaticMarkup(<Catalogue />)}`;
    root = createRoot(find("#filters"));
    await act(async () =>
      root.render(<DeskCatalogueFilters entries={entries} objects={desk.objects} />),
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    await uninstallDom();
  });

  test("the three filter dimensions apply together only after the reader submits", async () => {
    expect(visible()).toHaveLength(39);
    await edit("object", "object-microscope");
    await edit("from", "1904");
    await edit("to", "1905");
    expect(visible()).toHaveLength(39);
    await apply();
    expect(visible()).toEqual(["sutherland-1904-dunedin", targetId]);
    expect(find('[role="status"]').textContent).toContain("Showing 2 of 39 cards");
    await edit("status", "available");
    await apply();
    expect(visible()).toEqual(["sutherland-1904-dunedin"]);
    await edit("status", "parallel-work");
    await apply();
    expect(visible()).toEqual([targetId]);
    expect(find<HTMLDetailsElement>(targetHash).dataset.status).toBe("parallel-work");
  });

  test("invalid year bounds preserve the previously accepted list, then a correction recovers", async () => {
    await edit("object", "object-microscope");
    await apply();
    const previous = visible();
    expect(previous).toHaveLength(12);
    for (const from of ["0", "-1", "1904.5", "10000", "not-a-year"]) {
      await edit("from", from);
      await apply();
      expect(visible()).toEqual(previous);
      expect(find('[role="alert"]').textContent).toContain("previous filter remains applied");
      expect(find('[role="status"]').textContent).toContain("Showing 12 of 39 cards");
    }
    await edit("from", "1905");
    await edit("to", "1904");
    await apply();
    expect(visible()).toEqual(previous);
    expect(find('[role="alert"]').textContent).toContain("first year must be no later");
    await edit("from", "1904");
    await edit("to", "1905");
    await apply();
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(visible()).toEqual(["sutherland-1904-dunedin", targetId]);
  });

  test("a zero-result query explains the result and Show all restores the whole catalogue", async () => {
    await edit("from", "1906");
    await apply();
    expect(visible()).toEqual([]);
    expect(find('[role="status"]').textContent).toContain("No cards match these filters");
    await act(async () => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (candidate) => candidate.textContent === "Show all cards",
      );
      expect(button).toBeDefined();
      button?.click();
    });
    expect(visible()).toHaveLength(39);
    expect(find<HTMLInputElement>('[name="from"]').value).toBe("");
  });

  test("a new fragment reveals a filtered card, opens its native details, and synchronizes the controls", async () => {
    await filterToSpectrum();
    await act(async () => {
      window.history.replaceState(null, "", `/1904/${targetHash}`);
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(find<HTMLElement>(`#desk-entry-${targetId}`).hidden).toBe(false);
    expect(find<HTMLDetailsElement>(targetHash).open).toBe(true);
    expect(find<HTMLSelectElement>('[name="object"]').value).toBe("all");
    expect(visible()).toHaveLength(39);
    expect(find('[role="status"]').textContent).toContain("Showing 39 of 39 cards");
  });

  test("a same-hash link outside the list still reveals a card hidden after navigation", async () => {
    await act(async () => {
      window.history.replaceState(null, "", `/1904/${targetHash}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await filterToSpectrum();
    const link = document.createElement("a");
    link.href = `/1904/${targetHash}`;
    link.textContent = "Read the parallel-work card";
    document.body.append(link);
    await act(async () => {
      window.addEventListener("click", (event) => event.preventDefault(), { once: true });
      link.click();
    });
    expect(window.location.hash).toBe(targetHash);
    expect(find<HTMLElement>(`#desk-entry-${targetId}`).hidden).toBe(false);
    expect(find<HTMLDetailsElement>(targetHash).open).toBe(true);
    expect(visible()).toHaveLength(39);
  });

  test("keyboard selection in the real search palette reveals the hidden card before navigation", async () => {
    await act(async () => {
      window.history.replaceState(null, "", `/1904/${targetHash}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await filterToSpectrum();
    const engine = createSearchEngine([
      {
        id: "desk:parallel-work",
        type: "timeline",
        paper: "brownian-motion",
        section: "",
        lang: "en",
        title: "Sutherland parallel work",
        text: "The 1905 publication, flagged as parallel work.",
        terms: [],
        route: "/1904/",
        anchor: targetHash.slice(1),
        face: "",
        scopeLabel: "Knowledge catalogue",
      },
    ]);
    let close = () => {};
    let destination = "";
    try {
      await act(async () => {
        close = openCommandPalette({
          load: async () => ({ engine, buildDigest: "test", profile: "scaffold", papers: [] }),
          navigate: (href) => {
            destination = href;
            expect(find<HTMLElement>(`#desk-entry-${targetId}`).hidden).toBe(false);
          },
        });
        const input = document.querySelector<HTMLInputElement>("dialog input");
        if (input) input.value = "Sutherland parallel work";
      });
      expect(document.querySelectorAll("dialog .search-option")).toHaveLength(1);
      await act(async () =>
        find<HTMLInputElement>("dialog input").dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
        ),
      );
      expect(destination).toBe(`/1904/${targetHash}`);
      expect(find<HTMLDetailsElement>(targetHash).open).toBe(true);
      expect(visible()).toHaveLength(39);
    } finally {
      close();
    }
  });

  test("modified links, another document, and malformed fragments do not reset the filter", async () => {
    await filterToSpectrum();
    const previous = visible();
    const link = document.createElement("a");
    document.body.append(link);
    for (const [href, ctrlKey] of [
      [`/1904/${targetHash}`, true],
      [`/papers/${targetHash}`, false],
    ] as const) {
      link.href = href;
      await act(async () => {
        window.addEventListener("click", (event) => event.preventDefault(), { once: true });
        link.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey }),
        );
      });
      expect(visible()).toEqual(previous);
    }
    expect(revealDeskCard(find("#desk-catalogue-list"), "#%zz")).toBe(false);
    expect(revealDeskCard(find("#desk-catalogue-list"), "#absent")).toBe(false);
    expect(visible()).toEqual(previous);
  });
});
