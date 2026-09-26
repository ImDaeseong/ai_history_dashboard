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
// 2026-09-26 독립 리뷰 발견: README는 qaStateFiles를 "저장소 기준 상대경로"라고
// 약속하지만, 검증 로직이 절대경로를 막지 않아서 path.resolve가 repoRoot를
// 버리고 그 절대경로를 그대로 읽을 수 있었다.
assert.throws(
  () => metrics.validateConfig({ ...metrics.DEFAULTS, qaStateFiles: ['C:\\Windows\\System32\\config.json'] }),
  /relative/,
);

console.log('PASS: dashboard measurement and outcome checks');
