'use strict';

const FIELDS = ['feedbackLoops', 'cognitiveLoad', 'flow', 'satisfaction'];

function summarizePulse(rows) {
  if (!Array.isArray(rows)) throw new Error('DevEx pulse must be an array');
  const seen = new Set();
  for (const row of rows) {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date || '')) throw new Error('each DevEx pulse requires YYYY-MM-DD date');
    if (seen.has(row.date)) throw new Error(`duplicate DevEx pulse date: ${row.date}`);
    seen.add(row.date);
    for (const field of FIELDS) {
      if (!Number.isInteger(row[field]) || row[field] < 1 || row[field] > 5) throw new Error(`${row.date}.${field} must be an integer from 1 to 5`);
    }
  }
  if (!rows.length) return { status: 'HOLD', reason: 'no_devex_pulse', samples: 0 };
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const averages = Object.fromEntries(FIELDS.map(field => [field, Math.round(sorted.reduce((sum, row) => sum + row[field], 0) / sorted.length * 10) / 10]));
  return { status: 'MEASURED', samples: sorted.length, latest: sorted.at(-1), averages };
}

module.exports = { FIELDS, summarizePulse };
