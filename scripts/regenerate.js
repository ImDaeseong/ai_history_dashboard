#!/usr/bin/env node
// Regenerates the AGG / COMMITS / SESS inline JSON blocks in ../index.html
// from local git logs (4 repos) and local Claude Code / Codex session logs.
//
// This script only reads local files on this machine — it cannot run in a
// cloud CI runner, because ~/.claude/projects and ~/.codex/session_index.jsonl
// do not exist there. Run it locally (see scripts/regenerate.ps1).

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const WINDOW_DAYS = 30;
const HOME = os.homedir();
const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(REPO_ROOT, 'index.html');

const REPOS = [
  { key: 'hermes-agents', dir: path.join(HOME, 'Desktop', 'hermes-agents') },
  { key: 'ai-workspace', dir: path.join(HOME, 'Desktop', 'hermes-agents', 'ai-workspace') },
  { key: 'ai_prompt', dir: path.join(HOME, 'Desktop', 'hermes-agents', 'ai_prompt') },
  { key: 'skills', dir: path.join(HOME, 'Desktop', 'skills') },
];
const CLAUDE_PROJECTS_DIR = path.join(HOME, '.claude', 'projects');
const CLAUDE_PROJECT_PREFIX = 'c--Users-' + path.basename(HOME) + '-Desktop-';
const CODEX_SESSION_INDEX = path.join(HOME, '.codex', 'session_index.jsonl');

function isoDate(d) { return d.toISOString().slice(0, 10); }
function todayUTC() { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; }
function daysAgoUTC(n) { const d = todayUTC(); d.setUTCDate(d.getUTCDate() - n); return d; }
function dateRange(start, end) {
  const out = [];
  const cur = new Date(start);
  while (cur <= end) { out.push(isoDate(cur)); cur.setUTCDate(cur.getUTCDate() + 1); }
  return out;
}
function dowIndexMonFirst(isoStr) {
  // JS getUTCDay(): 0=Sun..6=Sat. We want 0=Mon..6=Sun to match dashboard's 월~일 order.
  const jsDow = new Date(isoStr + 'T00:00:00Z').getUTCDay();
  return (jsDow + 6) % 7;
}
const DOW_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

const END = todayUTC();
const START = daysAgoUTC(WINDOW_DAYS - 1);
const ALL_DATES = dateRange(START, END);
const START_STR = isoDate(START), END_STR = isoDate(END);

// ---------- 1. Commits (AGG + COMMITS) ----------
function collectRepoCommits(repo) {
  let out;
  try {
    out = execFileSync('git', [
      'log', `--since=${WINDOW_DAYS} days ago`, '--date=short',
      '--pretty=format:COMMIT\t%H\t%ad\t%s', '--numstat',
    ], { cwd: repo.dir, encoding: 'utf8' });
  } catch (e) {
    console.error(`[warn] git log failed for ${repo.key} (${repo.dir}): ${e.message}`);
    return [];
  }
  const commits = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (!line) continue;
    if (line.startsWith('COMMIT\t')) {
      if (cur) commits.push(cur);
      const [, hash, date, subject] = line.split('\t');
      cur = { repo: repo.key, date, subject, ins: 0, del: 0, files: 0 };
    } else if (cur) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t/);
      if (m) {
        if (m[1] !== '-') cur.ins += parseInt(m[1], 10);
        if (m[2] !== '-') cur.del += parseInt(m[2], 10);
        cur.files += 1;
      }
    }
  }
  if (cur) commits.push(cur);
  return commits;
}

const COMMITS = REPOS.flatMap(collectRepoCommits)
  .filter(c => c.date >= START_STR && c.date <= END_STR)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

function buildAGG() {
  const repoKeys = REPOS.map(r => r.key);
  const byDate = Object.fromEntries(ALL_DATES.map(d => [d, Object.fromEntries(repoKeys.map(r => [r, 0]))]));
  for (const c of COMMITS) byDate[c.date][c.repo] += 1;

  const daily = ALL_DATES.map(date => {
    const row = { date };
    let total = 0;
    for (const r of repoKeys) { row[r] = byDate[date][r]; total += row[r]; }
    row.total = total;
    return row;
  });

  const repo_totals = Object.fromEntries(repoKeys.map(r => [r, COMMITS.filter(c => c.repo === r).length]));
  const dow_series = new Array(7).fill(0);
  for (const d of daily) dow_series[dowIndexMonFirst(d.date)] += d.total;

  const busiest = daily.reduce((a, b) => (b.total > a.total ? b : a), daily[0]);
  const active_days = daily.filter(d => d.total > 0).length;

  return {
    daily, repos: repoKeys,
    total_commits: COMMITS.length,
    total_ins: COMMITS.reduce((s, c) => s + c.ins, 0),
    total_del: COMMITS.reduce((s, c) => s + c.del, 0),
    total_files: COMMITS.reduce((s, c) => s + c.files, 0),
    repo_totals, dow_series, dow_names: DOW_NAMES,
    busiest_date: busiest.date, busiest_count: busiest.total,
    active_days, total_days: ALL_DATES.length,
    start_date: START_STR, end_date: END_STR,
  };
}

// ---------- 2. Sessions (SESS) ----------
function firstTimestampDate(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/"timestamp":"(\d{4}-\d{2}-\d{2})T/);
    if (m) return m[1];
  }
  return null;
}

function collectClaudeCodeSessions() {
  const rows = [];
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return rows;
  for (const entry of fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(CLAUDE_PROJECT_PREFIX)) continue;
    const label = entry.name.slice(CLAUDE_PROJECT_PREFIX.length);
    const dir = path.join(CLAUDE_PROJECTS_DIR, entry.name);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      const full = path.join(dir, f);
      let date;
      try { date = firstTimestampDate(full); } catch { continue; }
      if (!date || date < START_STR || date > END_STR) continue;
      const lines = fs.readFileSync(full, 'utf8').split('\n').filter(Boolean).length;
      rows.push({ tool: 'claude-code', date, label, lines });
    }
  }
  return rows;
}

function collectCodexSessions() {
  const rows = [];
  if (!fs.existsSync(CODEX_SESSION_INDEX)) return rows;
  const text = fs.readFileSync(CODEX_SESSION_INDEX, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (!rec.updated_at) continue;
    const date = rec.updated_at.slice(0, 10);
    if (date < START_STR || date > END_STR) continue;
    rows.push({ tool: 'codex', date, label: rec.thread_name || '(untitled)', lines: 0 });
  }
  return rows;
}

const SESS_ROWS = [...collectClaudeCodeSessions(), ...collectCodexSessions()]
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

function buildSESS() {
  const tools = ['claude-code', 'codex'];
  const byDate = Object.fromEntries(ALL_DATES.map(d => [d, { 'claude-code': 0, codex: 0, total: 0 }]));
  for (const r of SESS_ROWS) { byDate[r.date][r.tool] += 1; byDate[r.date].total += 1; }
  const daily = ALL_DATES.map(date => ({ date, ...byDate[date] }));

  const tool_totals = Object.fromEntries(tools.map(t => [t, SESS_ROWS.filter(r => r.tool === t).length]));
  const dow_series = { 'claude-code': new Array(7).fill(0), codex: new Array(7).fill(0) };
  for (const d of daily) { dow_series['claude-code'][dowIndexMonFirst(d.date)] += d['claude-code']; dow_series.codex[dowIndexMonFirst(d.date)] += d.codex; }

  const busiest = daily.reduce((a, b) => (b.total > a.total ? b : a), daily[0]);
  const active_days = daily.filter(d => d.total > 0).length;

  return {
    daily, tools, tool_totals, dow_names: DOW_NAMES, dow_series,
    busiest_date: busiest.date, busiest_count: busiest.total,
    active_days, total_days: ALL_DATES.length,
    start_date: START_STR, end_date: END_STR,
    total_sessions: SESS_ROWS.length, rows: SESS_ROWS,
  };
}

const AGG = buildAGG();
const SESS = buildSESS();

// ---------- 3. Splice into index.html ----------
function replaceConst(html, name, value) {
  const closeChar = Array.isArray(value) ? '\\]' : '\\}';
  const re = new RegExp(`const ${name} = [\\s\\S]*?\\r?\\n${closeChar};\\r?\\n`);
  const json = JSON.stringify(value, null, 1);
  if (!re.test(html)) throw new Error(`could not find "const ${name} = ...;" block in index.html`);
  return html.replace(re, `const ${name} = ${json};\r\n`);
}

let html = fs.readFileSync(INDEX_HTML, 'utf8');
html = replaceConst(html, 'AGG', AGG);
html = replaceConst(html, 'COMMITS', COMMITS);
html = replaceConst(html, 'SESS', SESS);
fs.writeFileSync(INDEX_HTML, html, 'utf8');

console.log(`OK — window ${START_STR} ~ ${END_STR}`);
console.log(`  commits: ${COMMITS.length} across ${REPOS.length} repos`);
console.log(`  sessions: ${SESS_ROWS.length} (claude-code ${SESS.tool_totals['claude-code']}, codex ${SESS.tool_totals.codex})`);
