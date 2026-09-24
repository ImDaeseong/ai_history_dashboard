'use strict';

const assert = require('assert');
const { calibrate } = require('./calibration');

assert.deepStrictEqual(calibrate([]), { status: 'HOLD', reason: 'no_human_labels', sample_size: 0 });
const result = calibrate([
  { id: '1', heuristic: true, raterA: true, raterB: true },
  { id: '2', heuristic: true, raterA: false, raterB: false },
  { id: '3', heuristic: false, raterA: true, raterB: true },
  { id: '4', heuristic: false, raterA: false, raterB: true },
]);
assert.strictEqual(result.status, 'MEASURED');
assert.strictEqual(result.sample_size, 4);
assert.strictEqual(result.consensus_size, 3);
assert.strictEqual(result.raw_agreement, 0.75);
assert.strictEqual(result.heuristic_precision, 0.5);
assert.strictEqual(result.heuristic_recall, 0.5);
assert.throws(() => calibrate([{ id: '1', heuristic: true, raterA: true, raterB: 'yes' }]), /must be boolean/);
console.log('PASS: human calibration checks');
