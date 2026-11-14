import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { srVelocityChains, srVelocitySourceLinks } from "../equations/derivations/srVelocityComposition.ts";
import { SRVelocityDerivation } from "./SRVelocityDerivation.tsx";

test("both component chains and all source returns exist in the server-rendered reader", () => {
  const html = renderToStaticMarkup(<SRVelocityDerivation />);
  expect(html).toContain('id="sr-velocity-derivation"');
  for (const chain of srVelocityChains) {
    expect(html).toContain(chain.id);
    for (const step of chain.steps) expect(html).toContain(step.id);
  }
  for (const source of srVelocitySourceLinks) {
    expect(html).toContain('id="' + source.id + '"');
    expect(html).toContain('/papers/special-relativity/view/german/#' + source.anchor);
  }
  expect(html).toContain("<details");
  expect(html).toContain("<math");
  expect(html).toContain("nonzero elapsed");
  expect(html).toContain("0/0");
});

test("the visitor can distinguish frame direction, oblique motion and the scope of the check", () => {
  const html = renderToStaticMarkup(<SRVelocityDerivation activeDetail="2" />);
  expect(html).toContain("given in the moving frame k");
  expect(html).toContain("result is expressed in K");
  expect(html).toContain("both transformed components are needed");
  expect(html).toContain("point speed at most V");
  expect(html).toContain("at time zero");
  expect(html).toContain("The two chains establish the component transformations");
  expect(html).toContain("/lab/sr-06/?v=0.6&amp;w=0.6&amp;alpha=90&amp;mode=angled");
});

test("the section page mounts the explorer while the full-paper page links to that section", () => {
  const page = readFileSync(new URL("./PaperPage.tsx", import.meta.url), "utf8");
  const lazy = readFileSync(new URL("./lazyIslands.tsx", import.meta.url), "utf8");
  expect(page).toContain('a.id === "arg-sr-velocity-composition"');
  expect(page).toContain("<LazySRVelocityDerivation />");
  expect(page).toContain("/papers/special-relativity/s5/#sr-velocity-derivation");
  expect(lazy).toContain('import("./SRVelocityDerivation.tsx")');
});
