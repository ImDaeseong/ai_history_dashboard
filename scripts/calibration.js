'use strict';

function ratio(n, d) { return d ? Math.round(n / d * 1000) / 1000 : null; }

function validateLabels(records) {
  if (!Array.isArray(records)) throw new Error('human labels must be an array');
  const ids = new Set();
  for (const row of records) {
    if (!row || typeof row.id !== 'string' || !row.id.trim()) throw new Error('each label requires a non-empty id');
    if (ids.has(row.id)) throw new Error(`duplicate label id: ${row.id}`);
    ids.add(row.id);
    for (const key of ['heuristic', 'raterA', 'raterB']) {
      if (typeof row[key] !== 'boolean') throw new Error(`${row.id}.${key} must be boolean`);
    }
  }
  return records;
}

function calibrate(records) {
  validateLabels(records);
  if (!records.length) return { status: 'HOLD', reason: 'no_human_labels', sample_size: 0 };
  const agree = records.filter(x => x.raterA === x.raterB);
  const aYes = records.filter(x => x.raterA).length / records.length;
  const bYes = records.filter(x => x.raterB).length / records.length;
  const observed = agree.length / records.length;
  const expected = aYes * bYes + (1 - aYes) * (1 - bYes);
  const kappa = expected === 1 ? 1 : (observed - expected) / (1 - expected);
  const tp = agree.filter(x => x.raterA && x.heuristic).length;
  const fp = agree.filter(x => !x.raterA && x.heuristic).length;
  const fn = agree.filter(x => x.raterA && !x.heuristic).length;
  return {
    status: 'MEASURED', sample_size: records.length, consensus_size: agree.length,
    disagreements: records.length - agree.length, raw_agreement: ratio(agree.length, records.length),
    cohens_kappa: Math.round(kappa * 1000) / 1000,
    heuristic_precision: ratio(tp, tp + fp), heuristic_recall: ratio(tp, tp + fn),
  };
}

module.exports = { validateLabels, calibrate };
