import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatExternalLink,
  formatInternalLink,
  formatPrintableLink,
  formatSectionLocator,
  isBareLink,
  isExternalLink,
} from "./linkPrinting.ts";

describe("linkPrinting: Link Formatting and Locators", () => {
  it("identifies external vs internal links correctly", () => {
    assert.equal(isExternalLink("https://doi.org/10.1002/andp.19053220607"), true);
    assert.equal(isExternalLink("http://example.com"), true);
    assert.equal(isExternalLink("//example.com/asset"), true);
    assert.equal(isExternalLink("/papers/brownian-motion"), false);
    assert.equal(isExternalLink("#sec-03"), false);
  });

  it("formats external links with destination URL in parentheses", () => {
    const formatted = formatExternalLink(
      "Annalen der Physik",
      "https://doi.org/10.1002/andp.19053220607",
    );
    assert.equal(formatted, "Annalen der Physik (https://doi.org/10.1002/andp.19053220607)");
  });

  it("formats internal cross-references with section and page locator", () => {
    // With section and page number
    const withPage = formatInternalLink("Stokes' Law", "s4", 556);
    assert.equal(withPage, "Stokes' Law (§4, p. 556)");

    // Section only
    const secOnly = formatInternalLink("Osmotic Pressure", "3");
    assert.equal(secOnly, "Osmotic Pressure (§3)");

    assert.equal(formatSectionLocator("s5", 558), "§5, p. 558");
    assert.equal(formatSectionLocator("2"), "§2");
  });

  it("identifies bare links with no destination or text", () => {
    assert.equal(isBareLink("", "Click here"), true);
    assert.equal(isBareLink("#", "Click here"), true);
    assert.equal(isBareLink("https://example.com", ""), true);
    assert.equal(isBareLink(undefined, "Click here"), true);
    assert.equal(isBareLink("https://example.com", "Example Link"), false);
  });

  it("formats printable link through combined helper", () => {
    const ext = formatPrintableLink("Planck 1900", "https://doi.org/10.1002/andp.19013090310");
    assert.equal(ext, "Planck 1900 (https://doi.org/10.1002/andp.19013090310)");

    const int = formatPrintableLink("Osmotic derivation", "/papers/brownian-motion#s2", {
      section: "2",
      pageNumber: 551,
    });
    assert.equal(int, "Osmotic derivation (§2, p. 551)");

    const bare = formatPrintableLink("Bare text", "");
    assert.equal(bare, "Bare text");
  });
});
