'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = Object.freeze({
  timeZone: 'Asia/Seoul',
  retentionDays: 30,
  evidenceExcerptChars: 180,
  includeEvidenceExcerpts: false,
  qaStateFiles: [],
  humanLabelsFile: null,
  devexPulseFile: null,
});

function validateConfig(config) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone }).format(new Date()); }
  catch { throw new Error(`invalid timeZone: ${config.timeZone}`); }
  if (!Number.isInteger(config.retentionDays) || config.retentionDays < 1 || config.retentionDays > 365) {
    throw new Error('retentionDays must be an integer from 1 to 365');
  }
  if (!Number.isInteger(config.evidenceExcerptChars) || config.evidenceExcerptChars < 0 || config.evidenceExcerptChars > 180) {
    throw new Error('evidenceExcerptChars must be an integer from 0 to 180');
  }
  if (typeof config.includeEvidenceExcerpts !== 'boolean') throw new Error('includeEvidenceExcerpts must be boolean');
  if (!Array.isArray(config.qaStateFiles) || config.qaStateFiles.some(x => typeof x !== 'string' || !x.trim())) {
    throw new Error('qaStateFiles must be a list of non-empty paths');
  }
  if (config.humanLabelsFile !== null && (typeof config.humanLabelsFile !== 'string' || !config.humanLabelsFile.trim())) {
    throw new Error('humanLabelsFile must be null or a non-empty path');
  }
  if (config.devexPulseFile !== null && (typeof config.devexPulseFile !== 'string' || !config.devexPulseFile.trim())) {
    throw new Error('devexPulseFile must be null or a non-empty path');
  }
  return config;
}

function loadConfig(repoRoot, configPath = process.env.AI_HISTORY_CONFIG) {
  const selected = configPath || path.join(repoRoot, 'private-data', 'dashboard.config.json');
  const custom = fs.existsSync(selected) ? JSON.parse(fs.readFileSync(selected, 'utf8')) : {};
  return validateConfig({ ...DEFAULTS, ...custom });
}

function zonedDate(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function loadOutcomeStates(repoRoot, files) {
  return files.map(file => {
    const full = path.resolve(repoRoot, file);
    const state = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!state.project || !state.check_id || !['running', 'complete', 'hold'].includes(state.status) || !Array.isArray(state.attempts)) {
      throw new Error(`invalid qa state: ${file}`);
    }
    return { project: state.project, check_id: state.check_id, status: state.status, attempts: state.attempts };
  });
}

function summarizeOutcomes(states) {
  const summary = { total_records: states.length, complete: 0, hold: 0, running: 0, attempts: 0, retries: 0, first_pass: 0 };
  for (const state of states) {
    summary[state.status]++;
    summary.attempts += state.attempts.length;
    summary.retries += Math.max(0, state.attempts.length - 1);
    if (state.status === 'complete' && state.attempts[0]?.status === 'pass') summary.first_pass++;
  }
  summary.completion_rate = summary.total_records ? Math.round(summary.complete / summary.total_records * 100) : null;
  summary.first_pass_rate = summary.total_records ? Math.round(summary.first_pass / summary.total_records * 100) : null;
  return summary;
}

module.exports = { DEFAULTS, loadConfig, validateConfig, zonedDate, loadOutcomeStates, summarizeOutcomes };
