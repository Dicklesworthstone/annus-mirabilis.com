import { describe, expect, test } from "bun:test";
import { createMigrationChain, migrateDocument, UnmigratableVersionError } from "./migrations.ts";

describe("migrateDocument", () => {
  test("returns a v1 document unchanged when currentVersion is 1", () => {
    const chain = createMigrationChain(1);
    const doc = { schemaVersion: 1, note: "hello" };
    expect(migrateDocument(chain, doc)).toEqual(doc);
  });

  test("upgrades a v1 fixture through two registered migrations to v3", () => {
    const chain = createMigrationChain(3, {
      1: (doc) => ({ schemaVersion: 2, items: [doc.title as string] }),
      2: (doc) => ({ schemaVersion: 3, items: doc.items as string[] }),
    });
    const v1 = { schemaVersion: 1, title: "first note" };
    expect(migrateDocument(chain, v1)).toEqual({ schemaVersion: 3, items: ["first note"] });
  });

  test("an unknown (future) schemaVersion is unmigratable", () => {
    const chain = createMigrationChain(2, { 1: (d) => ({ ...d, schemaVersion: 2 }) });
    expect(() => migrateDocument(chain, { schemaVersion: 99 })).toThrow(UnmigratableVersionError);
  });

  test("a missing migration step is unmigratable", () => {
    const chain = createMigrationChain(3, { 1: (d) => ({ ...d, schemaVersion: 2 }) }); // no 2 -> 3 step
    expect(() => migrateDocument(chain, { schemaVersion: 1 })).toThrow(UnmigratableVersionError);
  });

  test("a migration that does not land on version+1 is unmigratable", () => {
    const chain = createMigrationChain(3, { 1: (d) => ({ ...d, schemaVersion: 3 }) }); // skips 2
    expect(() => migrateDocument(chain, { schemaVersion: 1 })).toThrow(UnmigratableVersionError);
  });

  test("a document with no schemaVersion, or a non-object, is unmigratable", () => {
    const chain = createMigrationChain(1);
    expect(() => migrateDocument(chain, { note: "no version" })).toThrow(UnmigratableVersionError);
    expect(() => migrateDocument(chain, "just a string")).toThrow(UnmigratableVersionError);
    expect(() => migrateDocument(chain, null)).toThrow(UnmigratableVersionError);
    expect(() => migrateDocument(chain, [1, 2, 3])).toThrow(UnmigratableVersionError);
  });

  test("UnmigratableVersionError carries the found version for diagnostics", () => {
    const chain = createMigrationChain(1);
    try {
      migrateDocument(chain, { schemaVersion: 5 });
      throw new Error("expected migrateDocument to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(UnmigratableVersionError);
      expect((error as InstanceType<typeof UnmigratableVersionError>).foundVersion).toBe(5);
    }
  });
});
