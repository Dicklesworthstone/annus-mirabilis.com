import assert from "node:assert/strict";
import test from "node:test";
import {
  createPhiloxStream,
  parseU64,
  philox4x32_10,
  U64_MAX,
} from "../physics/reference/philox.ts";

const kats = [
  [
    [0, 0, 0, 0],
    [0, 0],
    [0x6627e8d5, 0xe169c58d, 0xbc57ac4c, 0x9b00dbd8],
  ],
  [
    Array(4).fill(0xffffffff),
    Array(2).fill(0xffffffff),
    [0x408f276d, 0x41c83b0e, 0xa20bc7c6, 0x6d5451fd],
  ],
  [
    [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344],
    [0xa4093822, 0x299f31d0],
    [0xd16cfe09, 0x94fdcceb, 0x5001e420, 0x24126ea1],
  ],
];
for (const [i, [counter, key, want]] of kats.entries())
  test(`Philox Random123 published known answer ${i}`, () =>
    assert.deepEqual(philox4x32_10(counter, key), want));
// Independent wide-integer implementation, not the production limb multiplication.
function oracle(counter, key) {
  let c = counter.map(BigInt),
    k = key.map(BigInt);
  const mask = 0xffffffffn;
  for (let round = 0; round < 10; round++) {
    if (round) k = [(k[0] + 0x9e3779b9n) & mask, (k[1] + 0xbb67ae85n) & mask];
    const p = 0xd2511f53n * c[0],
      q = 0xcd9e8d57n * c[2];
    c = [(q >> 32n) ^ c[1] ^ k[0], q & mask, (p >> 32n) ^ c[3] ^ k[1], p & mask];
  }
  return c.map(Number);
}
test("limb arithmetic matches independent BigInt rounds, including high-bit carries", () => {
  for (let i = 0; i < 2048; i++) {
    const c = [Math.imul(i + 1, 2654435761) >>> 0, ~i >>> 0, (i * 65537) >>> 0, (i * 999983) >>> 0];
    const k = [(i * 6700417) >>> 0, ~Math.imul(i, 1234567) >>> 0];
    assert.deepEqual(philox4x32_10(c, k), oracle(c, k));
  }
});
test("stream word mapping, u64 ordering, and uniform conversion match fs-rand", () => {
  for (const seed of ["0", "9007199254740992", "9007199254740993", U64_MAX.toString()]) {
    const k = { seed, kernel: 17, tile: 29 };
    const index = 4294967297n;
    const w = oracle(
      [1, 1, 29, 17],
      [Number(BigInt(seed) & 0xffffffffn), Number(BigInt(seed) >> 32n)],
    );
    const integer = (BigInt(w[1]) << 32n) | BigInt(w[0]);
    assert.equal(createPhiloxStream(k, index).nextU64(), integer);
    assert.equal(createPhiloxStream(k, index).nextF64(), Number(integer >> 11n) / 2 ** 53);
  }
  assert.notEqual(
    createPhiloxStream({ seed: "9007199254740992", kernel: 0, tile: 0 }).nextU64(),
    createPhiloxStream({ seed: "9007199254740993", kernel: 0, tile: 0 }).nextU64(),
  );
});
test("canonical u64 values refuse lossy numbers, signs, whitespace, and overflow", () => {
  for (const v of [
    0,
    1,
    9007199254740993,
    "01",
    "-1",
    "+1",
    " 1",
    "1.0",
    "1e2",
    "18446744073709551616",
    -1n,
    null,
  ])
    assert.throws(() => parseU64(v));
  for (const v of ["0", "9007199254740993", U64_MAX.toString()])
    assert.equal(parseU64(v), BigInt(v));
  assert.throws(() => philox4x32_10([0, 0, 0, -1], [0, 0]));
});
test("random access and independent tiles are prefix stable", () => {
  const key = { seed: "33", kernel: 9, tile: 3 };
  const a = createPhiloxStream(key);
  const values = Array.from({ length: 30 }, () => a.nextU64());
  for (let i = 0; i < values.length; i++)
    assert.equal(createPhiloxStream(key, BigInt(i)).nextU64(), values[i]);
  key.tile = 999;
  assert.equal(a.key.tile, 3);
  assert.notEqual(createPhiloxStream(key).nextU64(), values[0]);
});
test("host normals consume exactly two draws, and exhaustion never partially consumes", () => {
  const k = { seed: "123", kernel: 1, tile: 2 };
  const n = createPhiloxStream(k),
    u = createPhiloxStream(k);
  assert.equal(
    n.nextNormal(),
    Math.sqrt(-2 * Math.log(1 - u.nextF64())) * Math.cos(2 * Math.PI * u.nextF64()),
  );
  assert.equal(n.index, 2n);
  const edge = createPhiloxStream(k, U64_MAX - 1n);
  assert.throws(
    () => edge.nextNormal(),
    (e) => e.code === "stream-index-overflow",
  );
  assert.equal(edge.index, U64_MAX - 1n);
  edge.nextU64();
  assert.equal(edge.index, U64_MAX);
  assert.throws(
    () => edge.nextF64(),
    (e) => e.code === "stream-index-overflow",
  );
  assert.equal(edge.index, U64_MAX);
});
