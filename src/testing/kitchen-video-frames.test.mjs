import assert from "node:assert/strict";
import test from "node:test";
import { KITCHEN_VIDEO_LIMITS } from "../experiments/bm07/kitchen/definition.ts";
import { createVideoFrameReader } from "../experiments/bm07/kitchen/videoFrames.ts";

class Video {
  src = "";
  videoWidth = 640;
  videoHeight = 480;
  duration = 60;
  readyState = 0;
  seeking = false;
  _time = 0;
  next = 0;
  listeners = new Map();
  callbacks = new Map();
  paused = 0;
  loads = 0;
  get currentTime() {
    return this._time;
  }
  set currentTime(value) {
    this._time = value;
    this.seeking = true;
  }
  pause() {
    this.paused++;
  }
  load() {
    this.loads++;
  }
  removeAttribute(name) {
    if (name === "src") this.src = "";
  }
  addEventListener(name, f) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(f);
  }
  removeEventListener(name, f) {
    this.listeners.get(name)?.delete(f);
  }
  emit(name) {
    for (const f of [...(this.listeners.get(name) ?? [])]) f();
  }
  requestVideoFrameCallback(f) {
    this.callbacks.set(++this.next, f);
    return this.next;
  }
  cancelVideoFrameCallback(id) {
    this.callbacks.delete(id);
  }
  present(time, counter = 1) {
    this._time = time;
    this.seeking = false;
    this.readyState = 2;
    const q = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const f of q) f(0, { mediaTime: time, presentedFrames: counter });
    this.emit("seeked");
  }
  data() {
    this.readyState = 2;
    this.emit("loadedmetadata");
    this.emit("loadeddata");
  }
}
function setup({ fallback = false, limits = {}, drawFailure = false } = {}) {
  const v = new Video(),
    timers = new Map(),
    revoked = [],
    draws = [];
  let timer = 0,
    created = 0;
  if (fallback) {
    v.requestVideoFrameCallback = undefined;
    v.cancelVideoFrameCallback = undefined;
  }
  const reader = createVideoFrameReader(
    v,
    30,
    (g) => {
      if (drawFailure) throw Error("no context");
      draws.push([g, v.currentTime]);
    },
    {
      limits: { ...KITCHEN_VIDEO_LIMITS, ...limits },
      createUrl: () => {
        created++;
        return "blob:local-only";
      },
      revokeUrl: (url) => revoked.push(url),
      setTimer: (cb) => {
        timers.set(++timer, cb);
        return timer;
      },
      clearTimer: (id) => timers.delete(id),
    },
  );
  return {
    v,
    reader,
    timers,
    revoked,
    draws,
    created: () => created,
    async open() {
      const p = reader.open(new Blob(["eightbyt"]));
      v.data();
      v.present(0);
      return p;
    },
    expire() {
      for (const t of [...timers.values()]) t();
    },
  };
}
test("nothing opens or allocates a URL until explicit open; first callback acquires a bounded frame", async () => {
  const s = setup();
  assert.equal(s.created(), 0);
  assert.equal(s.v.loads, 0);
  const r = await s.open();
  assert.equal(r.kind, "ready");
  assert.equal(r.value.frame.time, 0);
  assert.equal(r.value.frame.stamp.timingSource, "frame-callback");
  assert.equal(s.draws.length, 1);
  assert.equal(s.timers.size, 0);
  assert.equal(s.v.callbacks.size, 0);
});
test("read requests retain adjusted mediaTime rather than the requested time", async () => {
  const s = setup();
  await s.open();
  const p = s.reader.read(1);
  s.v.present(1.1, 2);
  const r = await p;
  assert.equal(r.value.frame.time, 1.1);
  assert.equal(r.value.frame.stamp.requestedTime, 1);
  assert.equal(r.value.frame.stamp.timingSource, "frame-callback-adjusted");
  assert.equal(r.value.reads, 2);
});
test("repeat clicks on one captured frame do not re-seek or invent a new timestamp", async () => {
  const s = setup();
  const first = await s.open();
  const repeated = await s.reader.read(0);
  assert.equal(first.value, repeated.value);
  assert.equal(s.reader.reads, 1);
  assert.equal(s.draws.length, 1);
});
test("fallback requires seek completion and labels timing as inferred", async () => {
  const s = setup({ fallback: true });
  const r = await s.open();
  assert.equal(r.value.frame.stamp.timingSource, "declared-rate");
  const p = s.reader.read(2);
  s.v._time = 2.01;
  s.v.emit("loadeddata");
  assert.equal(s.draws.length, 1);
  s.v.seeking = false;
  s.v.emit("seeked");
  const a = await p;
  assert.equal(a.value.frame.time, 2.01);
  assert.equal(a.value.frame.stamp.presentedFrames, null);
});
test("a supported callback timeout never degrades into a falsely verified seek time", async () => {
  const s = setup();
  await s.open();
  const p = s.reader.read(1);
  s.v.seeking = false;
  s.v.emit("seeked");
  s.expire();
  assert.equal((await p).outcome.outcome, "budget-exhausted");
  assert.equal(s.draws.length, 1);
  assert.equal(s.v.callbacks.size, 0);
});
test("supersession resolves the old request and ignores a late callback even after a newer acceptance", async () => {
  const s = setup();
  await s.open();
  const old = s.reader.read(1);
  const callback = [...s.v.callbacks.values()][0];
  const next = s.reader.read(2);
  assert.equal((await old).outcome.outcome, "superseded");
  s.v.present(2, 2);
  assert.equal((await next).value.frame.time, 2);
  callback(0, { mediaTime: 1, presentedFrames: 3 });
  assert.equal(s.draws.length, 2);
});
test("stop removes listeners and callbacks; disposing revokes the local URL exactly once", async () => {
  const s = setup();
  await s.open();
  const p = s.reader.read(1);
  s.reader.close();
  s.reader.close();
  assert.equal((await p).outcome.outcome, "cancelled");
  assert.deepEqual(s.revoked, ["blob:local-only"]);
  assert.equal(s.v.src, "");
  assert.equal(s.v.callbacks.size, 0);
  assert.equal(s.timers.size, 0);
  assert.ok([...s.v.listeners.values()].every((v) => v.size === 0));
  assert.equal((await s.reader.read(2)).kind, "outcome");
});
test("invalid metadata releases the blob and never exposes a frame", async () => {
  const s = setup();
  s.v.duration = 601;
  const p = s.reader.open(new Blob(["a"]));
  s.v.data();
  assert.equal((await p).kind, "refused");
  assert.equal(s.draws.length, 0);
  assert.equal(s.revoked.length, 1);
});
test("file limit is checked before any local URL or decode begins", async () => {
  const s = setup({ limits: { fileBytes: 2 } });
  assert.equal((await s.reader.open(new Blob(["aaa"]))).kind, "refused");
  assert.equal(s.created(), 0);
});
test("media errors and draw failures have typed execution outcomes, not fake observations", async () => {
  const s = setup();
  const p = s.reader.open(new Blob(["a"]));
  s.v.emit("error");
  assert.equal((await p).outcome.outcome, "environment-unsupported");
  const c = setup({ drawFailure: true });
  assert.equal((await c.open()).outcome.outcome, "context-lost");
  assert.equal(c.revoked.length, 1);
});
test("acquisition work is capped, including timeouts, without decoding a large fixture", async () => {
  const s = setup({ limits: { frameReads: 2 } });
  await s.open();
  const p = s.reader.read(1);
  s.expire();
  await p;
  const r = await s.reader.read(2);
  assert.equal(r.outcome.outcome, "budget-exhausted");
  assert.equal(r.outcome.allowed.workUnits, 2);
  assert.equal(s.reader.reads, 2);
  assert.equal(s.draws.length, 1);
});
for (const t of [-1, 60, Infinity, NaN])
  test(`invalid request time ${t} does not consume a frame`, async () => {
    const s = setup();
    await s.open();
    assert.equal((await s.reader.read(t)).kind, "refused");
    assert.equal(s.reader.reads, 1);
  });
test("callbacks while seeking are retried but cannot draw mismatched pixels", async () => {
  const s = setup();
  await s.open();
  const p = s.reader.read(1);
  const cb = [...s.v.callbacks.values()][0];
  s.v.callbacks.clear();
  cb(0, { mediaTime: 0, presentedFrames: 1 });
  assert.equal(s.draws.length, 1);
  assert.equal(s.v.callbacks.size, 1);
  s.v.present(1, 2);
  assert.equal((await p).value.frame.time, 1);
});
test("a resolution change cannot silently reuse the original calibration", async () => {
  const s = setup();
  await s.open();
  const p = s.reader.read(1);
  s.v.videoWidth = 128;
  s.v.present(1, 2);
  assert.equal((await p).kind, "refused");
  assert.equal(s.draws.length, 1);
});
