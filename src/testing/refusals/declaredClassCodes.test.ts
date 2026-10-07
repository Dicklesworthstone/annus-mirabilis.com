/**
 * THE THIRD WAY A REFUSAL CAN BE TYPED, AND THE PROOF THAT READING IT DID NOT LOOSEN THE GATE
 * (am-16nj).
 *
 * `declaredClassCodes` lets the coded scanner resolve `throw new CapstoneCaptureError()` to
 * `notebook-capstone-invalid`, because that class declares `readonly code = "..."` and the throw
 * site carries no literal. Without it the site read as an untyped throw, `capstoneEntry.ts` arrived
 * as a file with an unbaselined bare throw, and the bare-throw ratchet was red on HEAD for a day
 * while the refusal was both typed and covered by four tests naming its code.
 *
 * A SCANNER CHANGE THAT LOWERS A COUNT IS THE EXACT SHAPE A WEAKENED GATE HIDES IN, so the
 * negatives below are the deliverable and the nine reclassified sites are not. Every one of them
 * must still read as bare: a built-in class, a project class with no code at all, a code that is
 * only a TYPE member, a code assigned from a constructor argument, and a code sitting in a comment.
 */
import { describe, expect, test } from "bun:test";
import { BUILTIN_ERROR_CLASSES, declaredClassCodes, scanBareThrowSites } from "./refusalScanner.ts";

const bareClasses = (source: string): string[] =>
  scanBareThrowSites(source, "probe.ts").map((site) => site.errorClass);

describe("declaredClassCodes reads a code fixed on the class", () => {
  test("a readonly literal initialiser is read, with or without the readonly keyword", () => {
    const source = `
export class CapstoneCaptureError extends TypeError {
  readonly code = "notebook-capstone-invalid";
  constructor() {
    super("unsupported");
    this.name = "CapstoneCaptureError";
  }
}
export class PlainOne extends Error {
  code = "plain-declared-code";
}
`;
    expect([...declaredClassCodes(source).entries()].sort()).toEqual([
      ["CapstoneCaptureError", "notebook-capstone-invalid"],
      ["PlainOne", "plain-declared-code"],
    ]);
  });

  test("a type annotation on the property does not stop the literal being read", () => {
    const source = `
export class Annotated extends Error {
  readonly code: string = "annotated-code";
}
`;
    expect(declaredClassCodes(source).get("Annotated")).toBe("annotated-code");
  });
});

describe("what declaredClassCodes must NOT read, which is where a loosened gate would hide", () => {
  test("a code that is only a TYPE member fixes nothing and is not read", () => {
    // `code: string` promises a field; it does not say which code. Reading it would credit a site
    // whose code is whatever the caller passed.
    const source = `
export class TypeOnly extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
`;
    expect(declaredClassCodes(source).has("TypeOnly")).toBe(false);
  });

  test("a code assigned from a constructor argument is not read", () => {
    const source = `
export class FromArgument extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
`;
    expect(declaredClassCodes(source).has("FromArgument")).toBe(false);
  });

  test("a class with no code at all contributes nothing", () => {
    expect(declaredClassCodes("export class NoCode extends Error {}\n").size).toBe(0);
  });

  test("a value that is not a refusal code is refused", () => {
    // isRefusalCode gates it, so a camelCase or sentence value cannot become a code.
    const source = `
export class NotAKebab extends Error {
  readonly code = "NotAKebabCode";
}
`;
    expect(declaredClassCodes(source).has("NotAKebab")).toBe(false);
  });
});

describe("the sites that must still read as bare after the change", () => {
  test("a built-in class thrown with no literal is still bare", () => {
    const source = `
function guard(ok: boolean): void {
  if (!ok) throw new Error("something went wrong");
}
function other(ok: boolean): void {
  if (!ok) throw new TypeError();
}
`;
    // Both are built-ins, so no class declaration exists to resolve and nothing changes.
    expect(bareClasses(source)).toEqual(["Error", "TypeError"]);
    expect(BUILTIN_ERROR_CLASSES.has("Error")).toBe(true);
  });

  test("a project class with NO declared code, thrown with no literal, is still bare", () => {
    const source = `
export class NoCodeHere extends Error {
  constructor() {
    super("no code on this class");
  }
}
function guard(ok: boolean): void {
  if (!ok) throw new NoCodeHere();
}
`;
    expect(bareClasses(source)).toEqual(["NoCodeHere"]);
  });

  test("a class whose code comes from its constructor argument is still bare", () => {
    const source = `
export class FromArgument extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
function guard(ok: boolean): void {
  if (!ok) throw new FromArgument("some-code");
}
`;
    // The literal here is the CALLER's, which the existing positional arm already reads when the
    // class name ends in Error; what must not happen is the class resolving a code it never fixed.
    expect(declaredClassCodes(source).has("FromArgument")).toBe(false);
  });

  test("a declaration that exists only in a COMMENT does not credit a throw", () => {
    // The scanner blanks comment text before matching, and this is that rule for this arm: a note
    // explaining the construct is not the construct. Without it, THIS FILE's own docblock would
    // credit sites, which is the failure mode the repository has hit four times.
    const source = `
// export class CommentedOnly extends Error { readonly code = "commented-code"; }
export class CommentedOnly extends Error {}
function guard(ok: boolean): void {
  if (!ok) throw new CommentedOnly();
}
`;
    expect(bareClasses(source)).toEqual(["CommentedOnly"]);
  });
});

describe("the live case, end to end", () => {
  test("the capstone refusal is no longer counted bare, and nothing else in that shape is either", () => {
    const source = `
export class CapstoneCaptureError extends TypeError {
  readonly code = "notebook-capstone-invalid";
  constructor() {
    super("This capstone snapshot is unsupported, inconsistent, or too large.");
    this.name = "CapstoneCaptureError";
  }
}
export function parseCapstoneCapture(input: unknown): unknown {
  const capture = read(input);
  if (!capture) throw new CapstoneCaptureError();
  return capture;
}
function read(input: unknown): unknown {
  return input;
}
`;
    // The whole point: zero bare throws where there was one, and the code is the class's own.
    expect(bareClasses(source)).toEqual([]);
    expect(declaredClassCodes(source).get("CapstoneCaptureError")).toBe(
      "notebook-capstone-invalid",
    );
  });

  test("the declaration may sit far from the throw, which is why it is not a local window", () => {
    // In capstoneEntry.ts the class is at line 26 and the throw at line 95. The existing
    // property arm reads an eight-line window from the throw, so it cannot reach the declaration;
    // this map is built once per file for that reason.
    const filler = "// padding\n".repeat(60);
    const source = `
export class FarAway extends Error {
  readonly code = "far-away-code";
}
${filler}
function guard(ok: boolean): void {
  if (!ok) throw new FarAway();
}
`;
    expect(bareClasses(source)).toEqual([]);
  });
});
