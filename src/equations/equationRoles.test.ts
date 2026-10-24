import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROLE_CLASS_NAMES } from "../design/semanticColor/classNames.ts";
import { FOUNDATION_QUANTITIES } from "./foundationQuantities.ts";
import { ALLOWED_ROLE_CLASSES } from "./latex/markers.ts";
import { LIGHT_QUANTA_QUANTITIES } from "./lightQuantaQuantities.ts";
import { MASS_ENERGY_QUANTITIES } from "./massEnergyQuantities.ts";
import {
  BROWNIAN_QUANTITIES,
  EQUATION_ROLE_CLASS_NAMES,
  equationRoleClassName,
  type QuantityRegistry,
} from "./quantities.ts";
import type { EquationRecord } from "./record.ts";
import { admitsRoleClass, compileEquation } from "./render.ts";
import { SPECIAL_RELATIVITY_QUANTITIES } from "./specialRelativityQuantities.ts";

/**
 * THE EQUATION ROLE CLASS VOCABULARY, ASSERTED THROUGH THE RENDERER RATHER THAN BESIDE IT.
 *
 * Four sites spelled `am-role-input`/`result`/`constant` independently: the trust callback in
 * render.ts (as a literal array), the stylesheet, `roleForQuantity` in content/kernel/trace.ts,
 * and `ALLOWED_ROLE_CLASSES` in latex/markers.ts, which spells five. A fifth module,
 * src/design/semanticColor/classNames.ts, produced seven DIFFERENT names from the meaning-role
 * vocabulary and claimed in its docblock to be the set that callback admits. It has no production
 * importer, so nothing contradicted it.
 *
 * The first test is the one with teeth, and it reads the RENDERED HTML rather than the source of
 * the allowlist. A class the trust callback refuses does not throw: KaTeX drops the \htmlClass and
 * formats the body as ordinary text, so the term loses its colour and keeps its data-term marker.
 * render.ts's own guard checks the markers, not the class, so that loss is silent. Compiling the
 * corpus and reading back which classes SURVIVED is therefore the only way to ask the callback
 * what it really admits.
 *
 * Both directions, because each fails differently: a class in the HTML that this module does not
 * declare means something emits a name the stylesheet will not colour, and a declared class that
 * never survives means the callback refuses a name the renderer still emits.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const EQUATIONS_DIR = join(ROOT, "content/equations");
const CSS_PATH = join(ROOT, "src/equations/equations.css");

/**
 * All five registries, because the expectation must not be derived from the same constant the
 * renderer is being judged against. The EMITTER builds its class from a quantity's own `role`
 * (`wrapHtmlClass` in latex/markers.ts), so the registries say what the renderer will try to emit,
 * independently of what the trust callback admits. Comparing the two is the whole test; comparing
 * EQUATION_ROLE_CLASS_NAMES with itself would stay green while a class was being dropped.
 */
const REGISTRIES: ReadonlyArray<readonly [string, QuantityRegistry]> = [
  ["brownian", BROWNIAN_QUANTITIES],
  ["mass-energy", MASS_ENERGY_QUANTITIES],
  ["light-quanta", LIGHT_QUANTA_QUANTITIES],
  ["special-relativity", SPECIAL_RELATIVITY_QUANTITIES],
  ["foundations", FOUNDATION_QUANTITIES],
];

function registryRoleClasses(): ReadonlySet<string> {
  const classes = new Set<string>();
  for (const [, registry] of REGISTRIES) {
    for (const quantity of Object.values(registry)) {
      classes.add(equationRoleClassName(quantity.role));
    }
  }
  return classes;
}

type Corpus = Readonly<{
  records: number;
  occurrences: number;
  classes: ReadonlyMap<string, number>;
}>;

function compileCorpus(): Corpus {
  const classes = new Map<string, number>();
  let records = 0;
  let occurrences = 0;
  for (const paper of readdirSync(EQUATIONS_DIR)) {
    let files: readonly string[];
    try {
      files = readdirSync(join(EQUATIONS_DIR, paper));
    } catch {
      continue; // a file rather than a paper directory
    }
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const record = JSON.parse(
        readFileSync(join(EQUATIONS_DIR, paper, file), "utf8"),
      ) as EquationRecord;
      if (record.kind !== "equation") continue;
      records += 1;
      // Not guarded: a record that stops compiling is a failure of this gate, not a record to
      // skip. Skipping on throw is how a corpus check quietly shrinks to nothing.
      const { html } = compileEquation(record);
      for (const match of html.matchAll(/class="([^"]*am-role-[^"]*)"/g)) {
        for (const cls of String(match[1]).split(/\s+/)) {
          if (!cls.startsWith("am-role-")) continue;
          classes.set(cls, (classes.get(cls) ?? 0) + 1);
          occurrences += 1;
        }
      }
    }
  }
  return { records, occurrences, classes };
}

/** Class names from bare `.am-role-x` selectors. `[class*="am-role-"]` has no dot and is skipped. */
function styledRoleClasses(css: string): ReadonlySet<string> {
  return new Set([...css.matchAll(/\.(am-role-[a-z-]+)/g)].map((m) => String(m[1])));
}

describe("the equation role classes a reader actually receives", () => {
  test("every class the registries make the renderer emit survives the trust callback", () => {
    const corpus = compileCorpus();
    const found = [...corpus.classes.keys()].sort();
    const wanted = [...registryRoleClasses()].sort();
    console.log(
      `[equation role census] ${corpus.records} equation records compiled; ${corpus.occurrences} role-class occurrences; ${REGISTRIES.length} registries declare ${wanted.length} role classes; classes present: ${[
        ...corpus.classes,
      ]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
    );
    // A denominator of zero reads exactly like a clean sweep. 154 records compiled when this was
    // written; the floor is a record of that population, not a target.
    expect(corpus.records).toBeGreaterThan(140);
    expect(corpus.occurrences).toBeGreaterThan(0);
    expect(wanted.length).toBeGreaterThan(0);
    // The expectation comes from the registries, so refusing a class in the callback reddens this
    // even though the callback and the declared list are edited together.
    expect(found).toEqual(wanted);
  });

  test("the declared vocabulary is exactly the one the registries use", () => {
    // The other half of the pair above: a role a registry stopped using, or started using, shows
    // up here rather than as a silent change in what mathematics may carry.
    expect([...registryRoleClasses()].sort()).toEqual([...EQUATION_ROLE_CLASS_NAMES].sort());
  });

  test("every declared class is coloured on screen and neutralised in print", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const styled = styledRoleClasses(css);
    expect(styled.size).toBeGreaterThan(0);
    // Both directions: an admitted class with no colour rule is an invisible role, and a styled
    // class nothing admits is a rule that can never match.
    expect([...styled].sort()).toEqual([...EQUATION_ROLE_CLASS_NAMES].sort());
    // The print block sets `color: inherit` on the same three, so a printed equation is not three
    // greys. Asserted by identity rather than by counting the rules.
    const printBlock = css.slice(css.indexOf("@media print"));
    for (const cls of EQUATION_ROLE_CLASS_NAMES) {
      expect(printBlock).toContain(`.${cls}`);
    }
  });

  test("the callback admits the three and refuses every other name offered to it", () => {
    // The widening direction, which rendered HTML cannot show: see admitsRoleClass's docblock.
    for (const cls of EQUATION_ROLE_CLASS_NAMES) expect(admitsRoleClass(cls)).toBe(true);
    const mustRefuse = [
      // The seven meaning-role classes. classNames.ts claimed for weeks that these were the set
      // this callback admits, so they are named here rather than left to a general rule.
      ...ROLE_CLASS_NAMES,
      // The two markers.ts enumerates but nothing emits.
      "am-role-parameter",
      "am-role-intermediate",
      // And the shapes a careless widening tends to take.
      "am-role-",
      "am-role-input am-role-result",
      "am-role-INPUT",
      "katex",
      "",
    ];
    expect(mustRefuse.length).toBeGreaterThan(0);
    const wronglyAdmitted = mustRefuse.filter(admitsRoleClass);
    expect(wronglyAdmitted).toEqual([]);
  });

  test("markers.ts admits two further names that nothing emits and nothing colours", () => {
    // Recorded by name rather than by count, because these two are permanent until someone
    // deliberately introduces them: emitting one would turn the first test red, and that is the
    // intended outcome rather than a surprise.
    const inert = ALLOWED_ROLE_CLASSES.filter((c) => !EQUATION_ROLE_CLASS_NAMES.includes(c));
    expect(inert.sort()).toEqual(["am-role-intermediate", "am-role-parameter"]);
    const styled = styledRoleClasses(readFileSync(CSS_PATH, "utf8"));
    for (const cls of inert) expect(styled.has(cls)).toBe(false);
  });
});
