'use strict';

const assert = require('assert');
const { summarizePulse } = require('./devex-pulse');

assert.deepStrictEqual(summarizePulse([]), { status: 'HOLD', reason: 'no_devex_pulse', samples: 0 });
const result = summarizePulse([
  { date: '2026-09-17', feedbackLoops: 3, cognitiveLoad: 4, flow: 2, satisfaction: 3 },
  { date: '2026-09-24', feedbackLoops: 5, cognitiveLoad: 2, flow: 4, satisfaction: 5 },
]);
assert.strictEqual(result.samples, 2);
assert.strictEqual(result.averages.feedbackLoops, 4);
assert.strictEqual(result.latest.date, '2026-09-24');
assert.throws(() => summarizePulse([{ date: '2026-09-24', feedbackLoops: 6, cognitiveLoad: 2, flow: 4, satisfaction: 5 }]), /1 to 5/);
console.log('PASS: DevEx pulse checks');
