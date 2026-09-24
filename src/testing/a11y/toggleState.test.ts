import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * A button whose look shows a choice says which choice it is (WCAG 4.1.2).
 *
 * On 2026-09-24, 42 buttons in eight components drew the chosen option in ink and the others as
 * `secondary`, from a ternary in className, and carried no aria-pressed, so nothing but colour
 * said which of BM-03's two placement models was chosen, and the same held for the prediction
 * choices on LQ-02, BM-02, LQ-05, LQ-07, SR-08 and SR-12. Found by this census and a sweep of the
 * live lab and embed pages; every one now carries aria-pressed from the ternary's own test
 * (1d12f3d7).
 *
 * This reads each `<button ...>` opening tag with comments blanked, and fails on a className
 * holding a ternary with no ARIA state beside it. It reads code, not text: the tag ends at the
 * first ">" at brace depth 0 outside a string, so the "=>" of an onClick does not end it. A regex
 * version did, and reported buttons that carry aria-pressed after their handler as missing it.
 *
 * WHAT IT DOES NOT SEE: a state drawn by an inline style alone, a className built in a variable
 * above the tag, and the reverse fault, where the state is announced but never drawn. ME-01's
 * toggles had that one: aria-pressed on each, and a class whose rules live in a stylesheet its
 * page never loads, so the chosen toggle looked like the other. Only a browser measures that.
 */

/** Ternaries in className that are not a selection state, each with its reason. */
const NOT_A_STATE: Record<string, string> = {
  "a11y/modal/ModalCloseButton.tsx": "the ternary appends a caller's class; it is not a choice",
};

const SRC = fileURLToPath(new URL("../../", import.meta.url));
const STATE = /\baria-(pressed|selected|checked|current|expanded)\b/;

/**
 * Comments blanked to spaces with newlines kept, so a comment that shows a tag is not a tag.
 * Quotes are tracked so "https://" in a string is not a comment. An apostrophe in JSX text would
 * open a quote and leave the comments after it unblanked; that errs loud, toward a comment being
 * read as code and failing, never toward a tag going unread.
 */
export function blankComments(source: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const c = source[i] ?? "";
    const next = source[i + 1] ?? "";
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next;
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** The attribute text of each <button> opening tag, with its line. */
export function buttonTags(source: string): { line: number; attributes: string }[] {
  const code = blankComments(source);
  const tags: { line: number; attributes: string }[] = [];
  for (const match of code.matchAll(/<button\b/g)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = start; i < code.length; i += 1) {
      const c = code[i];
      if (quote) {
        if (c === "\\") i += 1;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) continue;
    tags.push({
      line: code.slice(0, match.index).split("\n").length,
      attributes: code.slice(start, end),
    });
  }
  return tags;
}

/** The className={...} expression of a tag, brace-balanced, or null. */
function classNameExpression(attributes: string): string | null {
  const at = attributes.search(/\bclassName=\{/);
  if (at === -1) return null;
  const open = attributes.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < attributes.length; i += 1) {
    if (attributes[i] === "{") depth += 1;
    else if (attributes[i] === "}") {
      depth -= 1;
      if (depth === 0) return attributes.slice(open + 1, i);
    }
  }
  return null;
}

/** A tag whose className holds a ternary and which carries no ARIA state. */
export function stateless(attributes: string): boolean {
  const expression = classNameExpression(attributes);
  return Boolean(expression?.includes("?")) && !STATE.test(attributes);
}

function tsxFiles(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    const rel = `${base}${name}`;
    if (statSync(full).isDirectory()) return tsxFiles(`${full}/`, `${rel}/`);
    return name.endsWith(".tsx") && !name.includes(".test.") && !name.includes(".fixture.")
      ? [rel]
      : [];
  });
}

describe("a button that shows a choice announces it", () => {
  test("the tag reader ends a tag at code, not at an arrow or a comment", () => {
    const flagged = (source: string) =>
      buttonTags(source).filter((tag) => stateless(tag.attributes)).length;
    // Positive: a chosen look with no state.
    expect(flagged('<button className={on ? "primary" : "secondary"}>A</button>')).toBe(1);
    // The template-literal form, spelled in pieces so the fixture is not itself a template.
    expect(flagged(`<button className={\`button $${"{"}on ? "" : "secondary"}\`}>A</button>`)).toBe(
      1,
    );
    // The state after an arrow handler is still inside the tag.
    expect(
      flagged(
        '<button onClick={() => pick("a")} className={on ? "" : "secondary"} aria-pressed={on}>A</button>',
      ),
    ).toBe(0);
    // A ">" inside a string in the tag does not end it.
    expect(
      flagged('<button title={"a > b"} className={on ? "" : "secondary"} aria-pressed={on}>'),
    ).toBe(0);
    // A tag inside a comment is not a tag; a fixed className is not a choice.
    expect(flagged('{/* <button className={on ? "a" : "b"}> */}<button className="x">')).toBe(0);
    expect(flagged('// <button className={on ? "a" : "b"}>\n<button className="x">')).toBe(0);
    // A comment does not swallow the code after it, and a URL is not a comment.
    expect(
      flagged('/* note */ <button className={on ? "a" : "b"}>A</button>\n<a href="https://x.org">'),
    ).toBe(1);
  });

  test("every button whose className holds a ternary carries an ARIA state, bar the listed", () => {
    const files = tsxFiles(SRC);
    const found = new Map<string, number[]>();
    let tags = 0;
    for (const file of files) {
      for (const tag of buttonTags(readFileSync(`${SRC}${file}`, "utf8"))) {
        tags += 1;
        if (stateless(tag.attributes)) found.set(file, [...(found.get(file) ?? []), tag.line]);
      }
    }
    console.log(
      `[toggle state] ${files.length} files, ${tags} <button> tags, ${found.size} files with a ternary className and no ARIA state`,
    );
    expect(tags).toBeGreaterThan(300);
    const unlisted = [...found].filter(([file]) => !(file in NOT_A_STATE));
    expect(unlisted).toEqual([]);
    // An exemption for a file that no longer has the tag is slack, not a pass.
    expect([...found.keys()].sort()).toEqual(Object.keys(NOT_A_STATE).sort());
  });
});
