import assert from "node:assert/strict";
import test from "node:test";
import { buildSyllabus, SyllabusError } from "./syllabus.ts";
const lesson = (id, prerequisites = []) => ({ id, title: id, summary: `Learn ${id}`, prerequisites });
const session = (id, foundations) => ({ id, foundations });
const ids = (lessons) => lessons.map((entry) => entry.id);
const code = (expected) => (error) => error instanceof SyllabusError && error.code === expected;

test("a session introduces the full prerequisite closure in dependency order", () => {
  const out = buildSyllabus([lesson("diffusion", ["variance"]), lesson("variance", ["averages"]), lesson("averages")], [session("paper", ["diffusion"])]);
  assert.deepEqual(ids(out.sessions[0].introduce), ["averages", "variance", "diffusion"]);
  assert.deepEqual(out.sessions[0].revisit, []);
  assert.deepEqual(out.furtherStudy, []);
});
test("shared prerequisites appear once and later sessions explicitly revisit them", () => {
  const out = buildSyllabus([lesson("units"), lesson("energy", ["units"]), lesson("waves", ["units"])], [session("one", ["energy"]), session("two", ["waves"])]);
  assert.deepEqual(ids(out.sessions[0].introduce), ["units", "energy"]);
  assert.deepEqual(ids(out.sessions[1].introduce), ["waves"]);
  assert.deepEqual(ids(out.sessions[1].revisit), ["units"]);
});
test("cross-links may cycle and never become prerequisite requirements", () => {
  const a = lesson("a", [{ foundationId: "b", kind: "cross-link" }]);
  const b = lesson("b", [{ foundationId: "a", kind: "cross-link" }]);
  const out = buildSyllabus([a, b], [session("one", ["a"])]);
  assert.deepEqual(ids(out.sessions[0].introduce), ["a"]);
  assert.deepEqual(ids(out.furtherStudy), ["b"]);
});
test("typed proof edges and legacy strings use the same foundation identities", () => {
  const out = buildSyllabus([lesson("a"), lesson("b", [{ foundationId: "foundation:a", kind: "proof-edge" }]), lesson("c", ["foundation:b"])], [session("one", ["foundation:c", "c"])]);
  assert.deepEqual(ids(out.sessions[0].introduce), ["a", "b", "c"]);
});
test("unassigned lessons are still included in prerequisite order", () => {
  const out = buildSyllabus([lesson("a"), lesson("z", ["a"]), lesson("c", ["z"])], []);
  assert.deepEqual(ids(out.furtherStudy), ["a", "z", "c"]);
  assert.equal(out.lessonCount, 3);
});
test("input ordering and duplicate roots cannot change a syllabus", () => {
  const lessons = [lesson("z", ["b", "a"]), lesson("a"), lesson("b")];
  const first = buildSyllabus(lessons, [session("one", ["z", "a", "z"])]);
  const second = buildSyllabus([...lessons].reverse(), [session("one", ["a", "z"])]);
  assert.deepEqual(first, second);
});
test("syllabus-prerequisite-cycle: a cycle is refused with the actual path", () => {
  assert.throws(() => buildSyllabus([lesson("a", ["b"]), lesson("b", ["c"]), lesson("c", ["a"])], []), (error) => code("syllabus-prerequisite-cycle")(error) && error.message.includes("a → b → c → a"));
});
test("syllabus-prerequisite-cycle: an unused cyclic component is not hidden", () => {
  assert.throws(() => buildSyllabus([lesson("ok"), lesson("bad", ["bad"])], [session("one", ["ok"])]), code("syllabus-prerequisite-cycle"));
});
for (const [name, lessons, sessions] of [
  ["root", [lesson("a")], [session("one", ["missing"])]],
  ["proof edge", [lesson("a", ["missing"])], []],
  ["cross-link", [lesson("a", [{ foundationId: "missing", kind: "cross-link" }])], []],
]) test(`syllabus-missing-lesson: a missing ${name} cannot yield a partial syllabus`, () => {
  assert.throws(() => buildSyllabus(lessons, sessions), code("syllabus-missing-lesson"));
});
test("syllabus-duplicate-id: duplicate lessons are not overwritten (syllabus.ts:51)", () => {
  assert.throws(() => buildSyllabus([lesson("a"), lesson("a")], []), code("syllabus-duplicate-id"));
});
test("syllabus-duplicate-id: duplicate sessions are not conflated (syllabus.ts:100)", () => {
  assert.throws(() => buildSyllabus([lesson("a")], [session("one", ["a"]), session("one", [])]), code("syllabus-duplicate-id"));
});
test("syllabus-invalid-id: lesson or session identities cannot turn into unsafe anchors", () => {
  assert.throws(() => buildSyllabus([lesson('bad"id')], []), code("syllabus-invalid-id"));
  assert.throws(() => buildSyllabus([], [session("../other", [])]), code("syllabus-invalid-id"));
});
test("a diamond graph lists the shared base once", () => {
  const out = buildSyllabus([lesson("a"), lesson("b", ["a"]), lesson("c", ["a"]), lesson("d", ["b", "c"])], [session("one", ["d"])]);
  assert.deepEqual(ids(out.sessions[0].introduce), ["a", "b", "c", "d"]);
});
test("the output is detached and frozen without freezing caller-owned data", () => {
  const a = lesson("a");
  const b = lesson("b", [{ foundationId: "a", kind: "proof-edge" }]);
  const out = buildSyllabus([a, b], [session("one", ["b"])]);
  a.title = "changed";
  b.prerequisites[0].foundationId = "changed";
  assert.equal(out.sessions[0].introduce[0].title, "a");
  assert.equal(out.sessions[0].introduce[1].prerequisites[0].foundationId, "a");
  assert.ok(Object.isFrozen(out.sessions[0].introduce));
  assert.ok(Object.isFrozen(out.sessions[0].introduce[1].prerequisites[0]));
  assert.equal(Object.isFrozen(b.prerequisites), false);
});
test("every lesson is introduced exactly once across sessions and further study", () => {
  const out = buildSyllabus([lesson("a"), lesson("b", ["a"]), lesson("c", ["a"]), lesson("d")], [session("one", ["b"]), session("two", ["a", "c"])]);
  const introduced = [...out.sessions.flatMap((item) => item.introduce), ...out.furtherStudy];
  assert.equal(introduced.length, out.lessonCount);
  assert.equal(new Set(ids(introduced)).size, out.lessonCount);
});
test("an empty published foundation catalogue makes no claim to have taught a lesson", () => {
  assert.deepEqual(buildSyllabus([], [session("one", [])]), { sessions: [{ sessionId: "one", introduce: [], revisit: [] }], furtherStudy: [], lessonCount: 0 });
});
