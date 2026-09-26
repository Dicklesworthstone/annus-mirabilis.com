/**
 * The Connections page's map is drawn from content/connections/connections.yaml (dispatch 253), the
 * record the result cards read too: one row per connection, in the record's order, each linking to
 * the page's section of the same id.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadConnections } from "../../content/connections/connections.ts";
import { ConnectionMap } from "./ConnectionMap.tsx";
import ConnectionsPage from "./page.tsx";

const connections = loadConnections();
const map = renderToStaticMarkup(<ConnectionMap />);
const page = renderToStaticMarkup(<ConnectionsPage />);

/** Text as React writes it into markup. */
const markup = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("the connections map", () => {
  test("draws each recorded connection once, in the record's order, with its kind, words and papers", () => {
    expect(connections.length).toBeGreaterThan(0);
    const rows = [...map.matchAll(/data-kind="([^"]+)"[^>]*><a href="#([^"]+)"/g)].map((m) => [
      m[2],
      m[1],
    ]);
    expect(rows).toEqual(connections.map((c) => [c.id, c.kind]));
    for (const c of connections) {
      expect(map).toContain(markup(c.label));
      expect(map).toContain(markup(c.what));
    }
  });

  test("every row's link lands on a section of the page", () => {
    for (const c of connections) expect(page).toContain(`id="${c.id}"`);
  });
});
