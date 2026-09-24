'use strict';

const assert = require('assert');
const metrics = require('./dashboard-metrics');

assert.strictEqual(metrics.zonedDate('2026-09-23T16:30:00Z', 'Asia/Seoul'), '2026-09-24');
assert.strictEqual(metrics.zonedDate('not-a-date', 'Asia/Seoul'), null);

const summary = metrics.summarizeOutcomes([
  { status: 'complete', attempts: [{ status: 'pass' }] },
  { status: 'complete', attempts: [{ status: 'fail' }, { status: 'pass' }] },
  { status: 'hold', attempts: [{ status: 'fail' }, { status: 'fail' }, { status: 'fail' }] },
]);
assert.deepStrictEqual(summary, {
  total_records: 3, complete: 2, hold: 1, running: 0,
  attempts: 6, retries: 3, first_pass: 1, completion_rate: 67, first_pass_rate: 33,
});
assert.throws(() => metrics.validateConfig({ ...metrics.DEFAULTS, retentionDays: 0 }), /retentionDays/);
assert.throws(() => metrics.validateConfig({ ...metrics.DEFAULTS, evidenceExcerptChars: 181 }), /evidenceExcerptChars/);
assert.throws(() => metrics.validateConfig({ ...metrics.DEFAULTS, qaStateFiles: [''] }), /qaStateFiles/);

console.log('PASS: dashboard measurement and outcome checks');
