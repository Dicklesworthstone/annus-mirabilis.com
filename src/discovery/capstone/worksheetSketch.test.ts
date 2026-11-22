import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptySketch,
  readSketch,
  SKETCH_LIMITS,
  sketchPath,
  sketchSvg,
  sketchText,
  type WorksheetSketch,
  WorksheetSketchError,
} from "./worksheetSketch.ts";

test("an optional drawing admits descriptions alone, dots and disconnected strokes without aliasing", () => {
  assert.deepEqual(readSketch(emptySketch()), emptySketch());
  assert.deepEqual(readSketch({ description: "Describe a diagram instead.", strokes: [] }), {
    description: "Describe a diagram instead.",
    strokes: [],
  });
  const sketch = {
    description: "Two paths",
    strokes: [
      [
        { x: 0, y: 600 },
        { x: 1000, y: 0 },
      ],
      [{ x: 12, y: 34 }],
    ],
  };
  const read = readSketch(sketch);
  assert.deepEqual(read, sketch);
  assert.ok(read);
  const point = sketch.strokes[0]?.[0];
  assert.ok(point);
  point.x = 70;
  assert.equal(read?.strokes[0]?.[0]?.x, 0);
  assert.equal(sketchPath(read.strokes), "M 0 600 L 1000 0 M 12 34 L 12 34");
});

test("drawing admission refuses malformed geometry and unknown data instead of truncating it", () => {
  for (const point of [
    { x: -1, y: 0 },
    { x: 1001, y: 0 },
    { x: 0, y: 601 },
    { x: NaN, y: 1 },
    { x: 1, y: Infinity },
    { x: 0.1, y: 0 },
    { x: "1", y: 0 },
    { x: 1, y: 1, color: "red" },
    { x: 1 },
  ])
    assert.equal(readSketch({ description: "", strokes: [[point]] }), null);
  for (const value of [
    null,
    [],
    { description: "" },
    { ...emptySketch(), image: "data:image/svg+xml,bad" },
    { description: "bad\u0000text", strokes: [] },
    { description: "", strokes: [[]] },
    { description: "", strokes: [Array(2)] },
  ])
    assert.equal(readSketch(value), null);
  let invoked = false;
  const getter = {
    get x() {
      invoked = true;
      return 1;
    },
    y: 1,
  };
  assert.equal(readSketch({ description: "", strokes: [[getter]] }), null);
  assert.equal(invoked, false);
  const hidden = [{ x: 1, y: 1 }];
  Object.defineProperty(hidden, "privateExtra", { value: "never discard" });
  assert.equal(readSketch({ description: "", strokes: [hidden] }), null);
  const hiddenSketch = emptySketch();
  Object.defineProperty(hiddenSketch, "privateExtra", { value: "never discard" });
  assert.equal(readSketch(hiddenSketch), null);
  const hiddenPoint = { x: 1, y: 1 };
  Object.defineProperty(hiddenPoint, "privateExtra", { value: "never discard" });
  assert.equal(readSketch({ description: "", strokes: [[hiddenPoint]] }), null);
});

test("stroke, point and description bounds admit their boundaries and refuse the next item", () => {
  const point = { x: 500, y: 300 };
  assert.ok(readSketch({ description: "x".repeat(SKETCH_LIMITS.description), strokes: [] }));
  assert.equal(
    readSketch({ description: "x".repeat(SKETCH_LIMITS.description + 1), strokes: [] }),
    null,
  );
  assert.ok(
    readSketch({
      description: "",
      strokes: Array.from({ length: SKETCH_LIMITS.strokes }, () => [point]),
    }),
  );
  assert.equal(
    readSketch({
      description: "",
      strokes: Array.from({ length: SKETCH_LIMITS.strokes + 1 }, () => [point]),
    }),
    null,
  );
  const fullStroke = Array.from({ length: SKETCH_LIMITS.pointsPerStroke }, () => point);
  assert.ok(readSketch({ description: "", strokes: [fullStroke] }));
  assert.equal(readSketch({ description: "", strokes: [[...fullStroke, point]] }), null);
  const allPoints = Array.from(
    { length: SKETCH_LIMITS.points / SKETCH_LIMITS.pointsPerStroke },
    () => fullStroke,
  );
  assert.ok(readSketch({ description: "", strokes: allPoints }));
  assert.equal(readSketch({ description: "", strokes: [...allPoints, [point]] }), null);
});

test("text and static SVG exports preserve the drawing and keep descriptions inert", () => {
  const sketch = {
    description: '</desc><script>alert("private")</script> λ\nsecond line',
    strokes: [
      [
        { x: 17, y: 34 },
        { x: 28, y: 600 },
      ],
    ],
  };
  const text = sketchText(sketch);
  assert.ok(text.includes(sketch.description));
  assert.ok(text.includes("(17, 34) → (28, 600)"));
  assert.ok(text.includes("not physical quantities"));
  const svg = sketchSvg(sketch);
  assert.ok(svg.includes('viewBox="0 0 1000 600"'));
  assert.ok(svg.includes('d="M 17 34 L 28 600"'));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(!/<script|\son[a-z]+=|(?:href|src)=/iu.test(svg));
  assert.ok(sketchText({ ...sketch, description: "" }).includes("no description"));
  assert.ok(sketchSvg({ ...sketch, description: "" }).includes("no description"));
  assert.equal(sketchSvg(emptySketch()), "");
  assert.equal(sketchText(emptySketch()), "No drawing saved.");
});

test("capstone-sketch-invalid: exports also refuse unchecked drawing data", () => {
  const malformed = { description: "", strokes: [[{ x: NaN, y: 0 }]] } as WorksheetSketch;
  for (const render of [sketchText, sketchSvg]) {
    assert.throws(
      () => render(malformed),
      (error: unknown) =>
        error instanceof WorksheetSketchError && error.code === "capstone-sketch-invalid",
    );
  }
  assert.throws(() => sketchPath(malformed.strokes), WorksheetSketchError);
});
