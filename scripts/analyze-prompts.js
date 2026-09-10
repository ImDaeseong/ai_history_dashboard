#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const DAYS = Number(process.env.AI_HISTORY_DAYS || 30);
const HOME = os.homedir();
const CLAUDE_DIR = process.env.AI_HISTORY_CLAUDE_DIR || path.join(HOME, '.claude', 'projects');
const CODEX_DIR = process.env.AI_HISTORY_CODEX_DIR || path.join(HOME, '.codex', 'sessions');
const OUTPUT = process.env.AI_HISTORY_PRIVATE_OUTPUT || path.resolve(__dirname, '..', 'private-dashboard.html');
const CUTOFF = Date.now() - DAYS * 86400000;

const INTENTS = [
  ['검증·재확인', /검증|확인|테스트|점검|다시\s*(확인|실행)|verify|test|check/i],
  ['구현·수정', /구현|수정|개선|추가|삭제|만들|진행하시오|fix|implement|build|add|update/i],
  ['분석·조사', /분석|조사|찾아|원인|비교|검토|analy[sz]e|research|investigate|review/i],
  ['설계·계획', /설계|계획|구조|아키텍처|방안|plan|design|architecture/i],
  ['설명·요약', /설명|정리|요약|보여|알려|explain|summari[sz]e|show/i],
  ['배포·Git', /커밋|푸시|배포|깃|git|commit|push|deploy/i],
];

function walkJsonl(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(full);
    }
  }
  return out;
}

function textParts(content, accepted) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(x => x && accepted.has(x.type) && typeof x.text === 'string').map(x => x.text).join('\n');
}

function isInjected(text) {
  const t = text.trim();
  return !t || /^<(system-reminder|environment_context|permissions|recommended_plugins|skills_instructions|apps_instructions|plugins_instructions)[>\s]/i.test(t);
}

function cleanUserText(text) {
  let out = text;
  const blocks = [
    'system-reminder', 'environment_context', 'recommended_plugins',
    'skills_instructions', 'permissions', 'collaboration_mode',
    'apps_instructions', 'plugins_instructions', 'INSTRUCTIONS',
  ];
  const closingPositions = blocks.map(tag => ({ tag, index: out.toLowerCase().lastIndexOf(`</${tag.toLowerCase()}>`) })).filter(x => x.index >= 0);
  if (closingPositions.length) {
    const last = closingPositions.sort((a, b) => b.index - a.index)[0];
    const tail = out.slice(last.index + last.tag.length + 3).trim();
    if (tail) out = tail;
  }
  for (const tag of blocks) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`<${escaped}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${escaped}>`, 'gi'), ' ');
  }
  out = out.replace(/# AGENTS\.md instructions[^\n]*[\s\S]*?(?=\n[^#<\n][^\n]{0,300}$)/i, ' ');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function readRows(file, tool) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const rows = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const timestamp = Date.parse(rec.timestamp || rec.message?.timestamp || rec.payload?.timestamp || '');
    if (Number.isFinite(timestamp) && timestamp < CUTOFF) continue;
    if (tool === 'claude') {
      if (!['user', 'assistant'].includes(rec.type) || !rec.message) continue;
      const role = rec.message.role;
      const text = role === 'user' ? cleanUserText(textParts(rec.message.content, new Set(['text']))) : textParts(rec.message.content, new Set(['text']));
      if (role === 'user' && isInjected(text)) continue;
      rows.push({ role, text, timestamp: rec.timestamp || null, hasTool: rec.message.content?.some?.(x => x?.type === 'tool_use') || false });
    } else if (rec.type === 'response_item' && ['user', 'assistant'].includes(rec.payload?.role)) {
      const role = rec.payload.role;
      const accepted = role === 'user' ? new Set(['input_text']) : new Set(['output_text']);
      const rawText = textParts(rec.payload.content, accepted);
      const text = role === 'user' ? cleanUserText(rawText) : rawText;
      if (role === 'user' && isInjected(text)) continue;
      rows.push({ role, text, timestamp: rec.timestamp || null, hasTool: false });
    } else if (tool === 'codex' && rec.type === 'response_item' && /function_call|tool_call/.test(rec.payload?.type || '')) {
      rows.push({ role: 'tool', text: '', timestamp: rec.timestamp || null, hasTool: true });
    }
  }
  return rows;
}

function classify(text) {
  const found = INTENTS.filter(([, re]) => re.test(text)).map(([name]) => name);
  return found.length ? found : ['기타'];
}

function quality(text) {
  const checks = {
    '목표 명확성': /검증|확인|분석|정리|구현|수정|추가|만들|보여|알려|verify|analy[sz]e|implement|show/i.test(text),
    '대상·맥락': /[\\/]|프로젝트|폴더|파일|코드|이 내용|이전|project|file|folder|code/i.test(text),
    '완료 조건': /통과|완료|까지|순서|기준|결과|PASS|완료 조건|exit criteria/i.test(text),
    '검증 요구': /검증|확인|테스트|증거|비교|verify|test|evidence/i.test(text),
    '출력 형태': /표|목록|순위|요약|정리|보고|보여|table|list|summary|report/i.test(text),
    '제약·경계': /하지|제외|별도|포함|로컬|공개|비공개|만|without|exclude|only|private/i.test(text),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { score: Math.round(passed / Object.keys(checks).length * 100), checks };
}

function analyzeTool(tool, files) {
  const stats = { tool, sessions: 0, prompts: 0, responses: 0, chars: 0, commands: {}, intents: {}, qualitySum: 0, qualityChecks: {}, answered: 0, toolEvidence: 0, verifiedEvidence: 0, correctionSignals: 0, excludedBootstrap: 0, evidenceRows: [] };
  for (const file of files) {
    const rows = readRows(file, tool);
    if (!rows.some(r => r.role === 'user')) continue;
    stats.sessions++;
    const sessionId = crypto.createHash('sha256').update(file).digest('hex').slice(0, 10);
    let userOrdinal = 0;
    let sawUser = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.role === 'assistant' && row.text.trim()) stats.responses++;
      if (row.role !== 'user' || !row.text.trim()) continue;
      if (row.text.length > 5000) {
        sawUser = true;
        stats.excludedBootstrap++;
        continue;
      }
      sawUser = true;
      userOrdinal++;
      stats.prompts++;
      stats.chars += row.text.length;
      const cmd = row.text.trim().match(/^\/(\S+)/)?.[1];
      if (cmd) stats.commands[`/${cmd}`] = (stats.commands[`/${cmd}`] || 0) + 1;
      for (const intent of classify(row.text)) stats.intents[intent] = (stats.intents[intent] || 0) + 1;
      const q = quality(row.text); stats.qualitySum += q.score;
      for (const [name, pass] of Object.entries(q.checks)) stats.qualityChecks[name] = (stats.qualityChecks[name] || 0) + Number(pass);
      let nextUserIndex = i + 1;
      while (nextUserIndex < rows.length && rows[nextUserIndex].role !== 'user') nextUserIndex++;
      const untilNextUser = rows.slice(i + 1, nextUserIndex);
      const assistantText = untilNextUser.filter(r => r.role === 'assistant').map(r => r.text).join('\n');
      const answered = Boolean(assistantText.trim());
      const toolUsed = untilNextUser.some(r => r.hasTool);
      const verified = toolUsed && /\b\d+\s+(passed|failed|error)|exit[_ ]?code|PASS|FAIL|검증.{0,20}(통과|실패)|테스트.{0,20}(통과|실패)/i.test(assistantText);
      if (answered) stats.answered++;
      if (toolUsed) stats.toolEvidence++;
      if (verified) stats.verifiedEvidence++;
      const nextUser = rows[nextUserIndex]?.text || '';
      const correction = /^(아니|다시|그게 아니라|잘못|여전히|부실|no[, ]|retry)/i.test(nextUser.trim());
      if (correction) stats.correctionSignals++;
      stats.evidenceRows.push({
        id: `${tool}-${sessionId}-${userOrdinal}`,
        timestamp: row.timestamp ? row.timestamp.slice(0, 10) : 'unknown',
        intent: classify(row.text).join(', '),
        excerpt: redactExcerpt(row.text),
        specScore: q.score,
        missing: Object.entries(q.checks).filter(([, pass]) => !pass).map(([name]) => name),
        answered, toolUsed, verified, correction,
      });
    }
  }
  stats.avgPromptChars = stats.prompts ? Math.round(stats.chars / stats.prompts) : 0;
  stats.avgQuality = stats.prompts ? Math.round(stats.qualitySum / stats.prompts) : 0;
  stats.answerRate = stats.prompts ? Math.round(stats.answered / stats.prompts * 100) : 0;
  stats.toolRate = stats.prompts ? Math.round(stats.toolEvidence / stats.prompts * 100) : 0;
  stats.verifiedRate = stats.prompts ? Math.round(stats.verifiedEvidence / stats.prompts * 100) : 0;
  return stats;
}

function redactExcerpt(text) {
  return text
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, '[LOCAL_PATH]')
    .replace(/https?:\/\/\S+/gi, '[URL]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    .replace(/\b(?:sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/g, '[SECRET]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[LONG_TOKEN]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function ranked(obj) { return Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
function esc(v) { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rows(items, total) { return items.length ? items.map(([k,v]) => `<tr><td>${esc(k)}</td><td>${v}</td><td>${total ? Math.round(v/total*100) : 0}%</td></tr>`).join('') : '<tr><td colspan="3">데이터 없음</td></tr>'; }

function render(report) {
  const totalPrompts = report.tools.reduce((s, x) => s + x.prompts, 0);
  const intents = {}; const commands = {}; const checks = {};
  for (const t of report.tools) {
    for (const [k,v] of Object.entries(t.intents)) intents[k]=(intents[k]||0)+v;
    for (const [k,v] of Object.entries(t.commands)) commands[k]=(commands[k]||0)+v;
    for (const [k,v] of Object.entries(t.qualityChecks)) checks[k]=(checks[k]||0)+v;
  }
  const avgQuality = totalPrompts ? Math.round(report.tools.reduce((s,t)=>s+t.qualitySum,0)/totalPrompts) : 0;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local AI Usage Analysis</title><style>body{font-family:system-ui,sans-serif;background:#0b1020;color:#e8edf7;margin:0;padding:28px}.wrap{max-width:1100px;margin:auto}.notice{background:#30250a;border:1px solid #806819;padding:14px;border-radius:10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:20px 0}.card,section{background:#151c30;border:1px solid #2a3552;border-radius:12px;padding:18px}h1,h2{margin-top:0}strong.big{font-size:30px;display:block}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #2a3552}.muted{color:#aab5ca}.good{color:#75df9b}.warn{color:#ffd36b}</style></head><body><div class="wrap"><h1>AI 사용·프롬프트 분석</h1><p class="notice">로컬 전용 보고서입니다. 원문 프롬프트·응답·경로는 포함하지 않습니다. 수행 품질은 로그 기반 대리지표이며 정답 여부를 보증하지 않습니다.</p><p class="muted">분석 기간: 최근 ${report.days}일 · 생성: ${esc(report.generatedAt)}</p><div class="grid"><div class="card"><span>사용자 프롬프트</span><strong class="big">${totalPrompts}</strong></div><div class="card"><span>평균 프롬프트 품질</span><strong class="big">${avgQuality}</strong></div><div class="card"><span>분석 세션</span><strong class="big">${report.tools.reduce((s,t)=>s+t.sessions,0)}</strong></div><div class="card"><span>명시적 /명령</span><strong class="big">${Object.values(commands).reduce((a,b)=>a+b,0)}</strong></div></div><section><h2>AI별 사용량</h2><table><tr><th>AI</th><th>세션</th><th>프롬프트</th><th>응답</th><th>평균 길이</th><th>품질</th><th>응답률</th><th>증거 신호</th><th>재지시 신호</th></tr>${report.tools.map(t=>`<tr><td>${t.tool}</td><td>${t.sessions}</td><td>${t.prompts}</td><td>${t.responses}</td><td>${t.avgPromptChars}자</td><td>${t.avgQuality}</td><td>${t.answerRate}%</td><td>${t.evidenceRate}%</td><td>${t.correctionSignals}</td></tr>`).join('')}</table></section><div class="grid"><section><h2>가장 많이 입력한 작업 유형</h2><table><tr><th>유형</th><th>횟수</th><th>비율</th></tr>${rows(ranked(intents),totalPrompts)}</table></section><section><h2>슬래시 명령어 순위</h2><table><tr><th>명령</th><th>횟수</th><th>비율</th></tr>${rows(ranked(commands),Object.values(commands).reduce((a,b)=>a+b,0))}</table></section></div><section><h2>프롬프트 구성요소 충족률</h2><table><tr><th>요소</th><th>포함</th><th>비율</th></tr>${rows(ranked(checks),totalPrompts)}</table><p class="muted">낮은 항목부터 보완하십시오. 좋은 요청은 목표, 대상, 완료 조건, 검증 방법, 출력 형태, 제약을 필요한 만큼 명시합니다.</p></section><section><h2>해석 시 주의</h2><ul><li>응답률은 후속 assistant 메시지 존재 여부입니다.</li><li>증거 신호는 도구 사용 또는 검증 관련 표현의 존재이며 사실 정확도 평가는 아닙니다.</li><li>재지시 신호는 다음 사용자 메시지가 “다시/아니/잘못” 등으로 시작하는 경우입니다.</li><li>실제 정답률 평가는 프로젝트 테스트, 사용자 판정 또는 별도 평가 데이터가 필요합니다.</li></ul></section></div></body></html>`;
}

function renderEvidenceBase(report) {
  const tools = report.tools;
  const totalPrompts = tools.reduce((s, t) => s + t.prompts, 0);
  const intents = {}, commands = {}, checks = {};
  for (const t of tools) {
    for (const [k,v] of Object.entries(t.intents)) intents[k]=(intents[k]||0)+v;
    for (const [k,v] of Object.entries(t.commands)) commands[k]=(commands[k]||0)+v;
    for (const [k,v] of Object.entries(t.qualityChecks)) checks[k]=(checks[k]||0)+v;
  }
  const evidence = tools.flatMap(t => t.evidenceRows.map(r => ({...r, tool:t.tool})))
    .sort((a,b) => Number(b.correction)-Number(a.correction) || a.specScore-b.specScore || b.timestamp.localeCompare(a.timestamp))
    .slice(0, 50);
  const pct = (n,d=totalPrompts) => d ? Math.round(n/d*100) : 0;
  const tableRows = evidence.map(r => `<tr><td><code>${esc(r.id)}</code><br><small>${esc(r.timestamp)}</small></td><td>${esc(r.excerpt || '(빈 입력)')}</td><td>${esc(r.intent)}</td><td>${r.specScore}</td><td>${esc(r.missing.join(', ') || '없음')}</td><td>${r.answered?'응답':'없음'} / ${r.toolUsed?'도구':'무도구'} / ${r.verified?'검증결과':'결과미확인'}${r.correction?' / 재지시':''}</td></tr>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evidence-based AI Usage Analysis</title><style>body{font-family:system-ui,sans-serif;background:#0b1020;color:#e8edf7;margin:0;padding:28px}.wrap{max-width:1280px;margin:auto}.notice,.hold{padding:14px;border-radius:10px}.notice{background:#10283c;border:1px solid #26648f}.hold{background:#30250a;border:1px solid #806819}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:20px 0}.card,section{background:#151c30;border:1px solid #2a3552;border-radius:12px;padding:18px;margin:14px 0}h1,h2{margin-top:0}strong.big{font-size:30px;display:block}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:9px;border-bottom:1px solid #2a3552}.muted,small{color:#aab5ca}code{color:#8dd8ff}a{color:#8dd8ff}.scroll{overflow:auto}.tag{display:inline-block;padding:2px 7px;border-radius:10px;background:#263453}</style></head><body><div class="wrap"><h1>AI 사용·프롬프트 증거 기반 분석</h1><p class="hold"><strong>검증 상태: 미교정 휴리스틱(HOLD)</strong><br>이 보고서는 관측 가능한 로그 신호를 재현 가능하게 집계하지만, 인간 라벨 표본과 비교해 정확도를 교정하지 않았습니다. 따라서 “AI가 정확했다” 또는 “프롬프트가 좋았다”는 결론이 아니라 개선 후보를 찾는 진단 도구입니다.</p><p class="notice">로컬 전용 보고서입니다. 아래 근거 문장은 180자 이하로 잘리고 경로·URL·이메일·비밀값 패턴이 마스킹됩니다. GitHub Pages에는 게시되지 않습니다.</p><p class="muted">최근 ${report.days}일 · 생성 ${esc(report.generatedAt)} · 분석 단위 ${totalPrompts}개 사용자 턴</p><div class="grid"><div class="card">사용자 턴<strong class="big">${totalPrompts}</strong></div><div class="card">응답 존재<strong class="big">${pct(tools.reduce((s,t)=>s+t.answered,0))}%</strong></div><div class="card">도구 사용 증거<strong class="big">${pct(tools.reduce((s,t)=>s+t.toolEvidence,0))}%</strong></div><div class="card">검증 결과 증거<strong class="big">${pct(tools.reduce((s,t)=>s+t.verifiedEvidence,0))}%</strong></div><div class="card">재지시 신호<strong class="big">${tools.reduce((s,t)=>s+t.correctionSignals,0)}</strong></div></div><section><h2>AI별 관측 결과</h2><div class="scroll"><table><tr><th>AI</th><th>세션</th><th>사용자 턴</th><th>평균 입력</th><th>명세요소 포함률</th><th>응답</th><th>도구</th><th>검증결과</th><th>재지시</th></tr>${tools.map(t=>`<tr><td>${t.tool}</td><td>${t.sessions}</td><td>${t.prompts}</td><td>${t.avgPromptChars}자</td><td>${t.avgQuality}%</td><td>${t.answerRate}%</td><td>${t.toolRate}%</td><td>${t.verifiedRate}%</td><td>${t.correctionSignals}</td></tr>`).join('')}</table></div><p class="muted">명세요소 포함률은 목표·대상·완료조건·검증·출력형태·제약의 문자열 신호입니다. 짧은 후속 지시에는 불리하므로 품질 점수가 아닙니다.</p></section><div class="grid"><section><h2>많이 입력한 작업 유형</h2><table><tr><th>유형</th><th>횟수</th><th>사용자 턴 대비</th></tr>${rows(ranked(intents),totalPrompts)}</table><p class="muted">한 프롬프트가 여러 유형에 포함될 수 있어 합계는 100%를 넘을 수 있습니다.</p></section><section><h2>슬래시 명령</h2><table><tr><th>명령</th><th>횟수</th><th>명령 중 비율</th></tr>${rows(ranked(commands),Object.values(commands).reduce((a,b)=>a+b,0))}</table></section></div><section><h2>프롬프트 명세 요소</h2><table><tr><th>요소</th><th>포함 턴</th><th>포함률</th></tr>${rows(ranked(checks),totalPrompts)}</table></section><section><h2>추적 가능한 근거 표본</h2><p class="muted">재지시가 있거나 명세요소 포함률이 낮은 항목을 우선한 최대 50개 진단 표본입니다. ID는 원본 파일 경로 대신 SHA-256 기반 세션 가명과 턴 번호를 사용합니다.</p><div class="scroll"><table><tr><th>근거 ID</th><th>마스킹된 요청 일부</th><th>분류</th><th>명세%</th><th>누락 신호</th><th>후속 관측</th></tr>${tableRows}</table></div></section><section><h2>평가 방법과 유효성</h2><table><tr><th>측정값</th><th>판정 규칙</th><th>지원하는 주장</th><th>지원하지 않는 주장</th></tr><tr><td>응답 존재</td><td>다음 사용자 턴 전 assistant 텍스트 존재</td><td>AI가 답변을 반환함</td><td>답변이 정확함</td></tr><tr><td>도구 사용</td><td>해당 턴 구간의 tool/function call 존재</td><td>외부 확인 행동이 있었음</td><td>올바른 도구·대상을 확인함</td></tr><tr><td>검증 결과</td><td>도구 사용과 PASS/FAIL·테스트 수 같은 결과 표현 동시 존재</td><td>결과를 보고한 실행 흔적</td><td>결과가 조작되지 않았음</td></tr><tr><td>재지시</td><td>다음 사용자 입력이 다시·아니·잘못·부실 등으로 시작</td><td>명시적 불만/수정 가능성</td><td>그 외 모든 불만을 탐지함</td></tr><tr><td>명세요소</td><td>6개 요소별 공개된 정규식 신호</td><td>요청의 구조적 단서</td><td>프롬프트의 절대 품질</td></tr></table><h3>형식 검증 결론</h3><p>현재 형식은 <strong>재현 가능한 진단 보고서</strong>이지만 <strong>검증 완료된 성능 평가</strong>는 아닙니다. 검증 완료로 올리려면 무작위 표본을 사람이 독립 라벨링하고, 휴리스틱과의 일치율·오탐·누락을 계산한 뒤 기준을 고정해야 합니다.</p><h3>근거가 된 공식 원칙</h3><ul><li><a href="https://openai.com/index/evals-drive-next-chapter-of-ai/">OpenAI: Specify → Measure → Improve와 실제 업무 조건 기반 contextual evals</a></li><li><a href="https://platform.openai.com/docs/api-reference/graders">OpenAI Graders: 판정 방식과 기준값을 명시한 grader 구조</a></li><li><a href="https://docs.anthropic.com/ko/docs/test-and-evaluate/eval-tool">Anthropic: 테스트 케이스, 5점 인간 평가, 버전 비교</a></li><li><a href="https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence">NIST AI 600-1: 측정·평가와 위험/한계의 명시</a></li></ul></section></div></body></html>`;
}

function renderEvidence(report) {
  const excluded = report.tools.reduce((sum, tool) => sum + tool.excludedBootstrap, 0);
  const canvaStyle = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap"><style>
:root{--bg:#f4f6fb;--surface:#fff;--surface-2:#f4f2ff;--text:#20232b;--muted:#666c7a;--border:#e3e7f0;--shadow:0 2px 6px rgba(30,35,60,.05),0 14px 32px -18px rgba(30,35,60,.18);--blue:#3a5afe;--blue-bg:#e9edff;--orange:#ff7f11;--orange-bg:#fff1e2;--purple:#8b5cf6;--purple-bg:#f1ebff;--cyan:#06b6d4;--cyan-bg:#e3f8fc;--red:#e63946;--red-bg:#fdeaec;--green:#10b981;--green-bg:#e4f8f1}
*{box-sizing:border-box}body{font-family:"Noto Sans KR",-apple-system,sans-serif;background:radial-gradient(circle at 12% 0,var(--purple-bg),transparent 30rem),var(--bg);color:var(--text);line-height:1.65;padding:36px 24px}.wrap{max-width:1240px}h1,h2,h3{font-family:"Jua",sans-serif;font-weight:400;letter-spacing:.01em}h1{font-size:clamp(32px,5vw,48px);margin-bottom:18px}h2{font-size:25px}.notice,.hold,.card,section{background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow)}.notice,.hold{border-radius:18px;padding:17px 20px}.notice{background:var(--blue-bg);border-color:#ccd5ff}.hold{background:var(--orange-bg);border-color:#ffd8ad}.grid{gap:16px}.card,section{border-radius:20px}.card{position:relative;overflow:hidden;padding:20px}.card::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:var(--blue)}.card:nth-child(2)::before{background:var(--purple)}.card:nth-child(3)::before{background:var(--cyan)}.card:nth-child(4)::before{background:var(--green)}.card:nth-child(5)::before{background:var(--red)}strong.big{font-family:"Jua",sans-serif;font-weight:400;color:var(--blue);margin-top:5px}section{padding:24px;margin:18px 0}.scroll{max-height:520px;overflow:auto;border:1px solid var(--border);border-radius:14px;scrollbar-gutter:stable}.scroll table{min-width:840px}.scroll th{position:sticky;top:0;z-index:2;background:var(--surface-2);box-shadow:0 1px 0 var(--border)}table{background:var(--surface)}th{background:var(--surface-2);font-weight:700}th,td{padding:11px 12px;border-color:var(--border)}tbody tr:nth-child(even),tr:nth-child(even){background:#fafbfe}code{background:var(--purple-bg);color:var(--purple);padding:3px 7px;border-radius:6px}.muted,small{color:var(--muted)}a{color:var(--blue)}ul{padding-left:22px}@media(max-width:700px){body{padding:22px 12px}section{padding:17px}.scroll{max-height:420px}}
@media(prefers-color-scheme:dark){:root{--bg:#14161c;--surface:#1c1f27;--surface-2:#242833;--text:#eef0f5;--muted:#9aa0b0;--border:#31353f;--shadow:0 2px 6px rgba(0,0,0,.35),0 14px 32px -18px rgba(0,0,0,.55);--blue-bg:#1d2350;--orange-bg:#3a2712;--purple-bg:#2a1f4a;--cyan-bg:#0f3540;--red-bg:#3a1c20;--green-bg:#0f3a2e}body{background:radial-gradient(circle at 12% 0,var(--purple-bg),transparent 30rem),var(--bg)}.notice{border-color:#35447d}.hold{border-color:#66471f}tbody tr:nth-child(even),tr:nth-child(even){background:#191c23}}
</style>`;
  const researchHtml = `<h3>형식 검증 결론</h3>
  <p><strong>판정: 진단 형식은 재현 가능, 평가 타당도는 아직 HOLD입니다.</strong> 로그 출처·제외 규칙·판정 규칙·근거 ID가 고정되어 같은 입력에서 같은 결과를 다시 만들 수 있다는 점은 검증됐습니다. 그러나 “명세요소가 많은 프롬프트가 더 좋은 프롬프트다” 또는 “도구·검증 표현이 있는 응답이 실제로 더 정확하다”는 구성타당도와 준거타당도는 인간 판정이나 실제 과업 성공값과 비교하지 않았으므로 검증되지 않았습니다.</p>
  <div class="scroll"><table><tr><th>검증 차원</th><th>현재 상태</th><th>현재 증거</th><th>PASS에 필요한 추가 증거</th></tr>
  <tr><td>데이터 계보</td><td><span class="tag">PASS</span></td><td>Claude/Codex 로컬 JSONL → 고정 분석기 → 로컬 HTML. 제외 건수와 기간 표시</td><td>스키마 변경 감지 회귀 테스트 유지</td></tr>
  <tr><td>재현성</td><td><span class="tag">PASS</span></td><td>판정 정규식·5,000자 제외 기준·마스킹·근거 ID 생성 규칙이 코드와 테스트에 고정</td><td>동일 로그 재실행 결과 스냅샷 비교</td></tr>
  <tr><td>내용타당도</td><td><span class="tag">부분</span></td><td>목표·대상·완료조건·검증·출력형태·제약 6요소를 측정</td><td>사용자의 실제 업무 유형별로 누락된 평가 요소가 없는지 전문가 검토</td></tr>
  <tr><td>구성타당도</td><td><span class="tag">HOLD</span></td><td>현재 지표는 프롬프트 구조와 실행 흔적의 대리변수</td><td>“좋은 프롬프트”, “성공적 수행”의 조작적 정의와 반례 테스트</td></tr>
  <tr><td>준거타당도</td><td><span class="tag">HOLD</span></td><td>인간 평가·테스트 성공값과 아직 비교하지 않음</td><td>독립 인간 라벨 및 객관적 테스트 결과와 민감도·특이도·상관/일치도 비교</td></tr>
  <tr><td>평정 신뢰도</td><td><span class="tag">HOLD</span></td><td>휴리스틱은 결정적이지만 인간 기준 자체의 합의도 미측정</td><td>동일 표본을 2명 이상이 독립 평가하고 원시 일치율과 우연 보정 Cohen’s κ 보고</td></tr>
  <tr><td>외적 타당도</td><td><span class="tag">HOLD</span></td><td>한 사용자·최근 ${report.days}일의 Claude/Codex 사용만 분석</td><td>다른 기간·프로젝트·작업 유형에서도 동일 결론이 유지되는지 반복</td></tr></table></div>
  <h3>논문 근거가 현재 형식에 주는 의미</h3>
  <div class="scroll"><table><tr><th>연구</th><th>확인된 사실</th><th>이 대시보드에 반영한 판단</th></tr>
  <tr><td><a href="https://openreview.net/forum?id=mdA5lVvNcU">Bean et al. (NeurIPS 2025), Measuring What Matters</a></td><td>29명의 전문가가 445개 LLM 벤치마크를 체계적으로 검토했고, 측정 현상·과업·점수의 불일치가 평가 주장의 타당도를 약화시키는 패턴을 보고했습니다.</td><td>“프롬프트 품질”이라는 추상 개념과 문자열 대리변수를 동일시하지 않고 구성타당도를 HOLD로 분리합니다.</td></tr>
  <tr><td><a href="https://arxiv.org/abs/2306.05685">Zheng et al. (2023), MT-Bench & Chatbot Arena</a></td><td>강한 LLM 심판이 특정 설정에서 인간 선호와 80% 이상 일치할 수 있었지만 위치·장황성·자기선호 편향도 확인했습니다.</td><td>향후 LLM 심판을 추가해도 인간 교정 없이 정답 판정기로 사용하지 않으며, 답변 순서 교환과 길이 편향 점검이 필요합니다.</td></tr>
  <tr><td><a href="https://aclanthology.org/2023.emnlp-main.153/">Liu et al. (EMNLP 2023), G-Eval</a></td><td>요약 과업에서 인간 평가와 Spearman 0.514 상관을 보고했지만, LLM 생성 텍스트 선호 가능성도 지적했습니다.</td><td>상관은 완전한 일치나 정확도를 뜻하지 않으므로 자동 점수 하나로 AI 수행 품질을 결론내리지 않습니다.</td></tr>
  <tr><td><a href="https://aclanthology.org/2023.findings-acl.226/">Belz et al. (ACL Findings 2023)</a></td><td>검토한 NLP 인간 평가 중 충분한 정보와 장벽 없는 재실행 조건을 만족한 비율을 약 5%, 저자 도움 시 약 20%로 추정했습니다.</td><td>기간·모집단·제외 규칙·판정 규칙·증거 ID·한계를 보고서 자체에 남겨 재실행 가능성을 높입니다.</td></tr>
  <tr><td><a href="https://aclanthology.org/2022.humeval-1.6/">Shimorina & Belz (2022), HEDS</a></td><td>인간 평가의 비교·메타평가·재현성 판단을 위해 실험 세부사항을 표준화해 기록하는 datasheet를 제안했습니다.</td><td>검증 상태표를 데이터, 판정 규칙, 모집단, 필요한 추가 증거로 구조화합니다.</td></tr>
  <tr><td><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3900052/">McHugh (2012), Interrater Reliability</a></td><td>단순 일치율은 우연 일치를 반영하지 않으며 Cohen’s κ가 이를 보정하지만, κ 해석 자체에도 분포와 적용 맥락의 한계가 있습니다.</td><td>인간 교정 단계에서 원시 일치율과 κ를 함께 보고하고 단일 임계값만으로 PASS를 선언하지 않습니다.</td></tr>
  <tr><td><a href="https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence">NIST AI 600-1 (2024)</a></td><td>생성형 AI의 측정·평가는 사용 맥락, 위험 허용도, 수명주기 전반의 신뢰성 관리와 연결되어야 합니다.</td><td>최근 30일 개인 코딩 사용이라는 적용 범위를 명시하고 다른 사용자·업무로 일반화하지 않습니다.</td></tr></table></div>
  <h3>검증 완료로 전환하는 절차</h3>
  <ol><li><strong>구성 정의:</strong> 프롬프트 명확성, 지시 준수, 사실 정확성, 과업 성공을 서로 다른 변수로 정의합니다.</li><li><strong>표본 고정:</strong> AI·프로젝트·작업 유형·길이 구간을 포함하도록 표본을 나누고 동일 근거 ID 목록을 보존합니다.</li><li><strong>독립 인간 평가:</strong> 명시적 코드북으로 2명 이상이 서로의 결과를 보지 않고 라벨링합니다.</li><li><strong>신뢰도 보고:</strong> 원시 일치율과 Cohen’s κ를 함께 계산하고 불일치 사례를 공개된 규칙으로 조정합니다.</li><li><strong>준거 비교:</strong> 코딩 과업은 테스트/빌드 결과, 사실 질문은 출처 검증, 주관 과업은 인간 평정과 대조합니다.</li><li><strong>자동 평가 검증:</strong> 휴리스틱 또는 LLM 심판의 민감도·특이도·오탐·누락을 인간 기준과 비교합니다. LLM 심판은 답변 순서를 바꿔 재평가하고 길이·자기선호 편향을 점검합니다.</li><li><strong>반복:</strong> 기간과 모델 버전을 바꿔 같은 결론이 유지되는지 확인한 뒤에만 평가 상태를 PASS로 올립니다.</li></ol>
  <p class="hold"><strong>현재 최종 판정:</strong> 이 페이지는 사용 습관과 검토 후보를 찾는 증거 추적형 진단 도구로는 적합합니다. 인간 교정과 실제 과업 성공값 대조가 끝나기 전에는 프롬프트 능력이나 AI 정확도를 측정한 검증 도구로 사용하면 안 됩니다.</p>`;
  const totalPrompts = report.tools.reduce((sum, tool) => sum + tool.prompts, 0);
  const combinedChecks = {};
  for (const tool of report.tools) for (const [name, count] of Object.entries(tool.qualityChecks)) combinedChecks[name] = (combinedChecks[name] || 0) + count;
  const weakest = Object.entries(combinedChecks).sort((a,b) => a[1]-b[1]).slice(0,3);
  const weakRows = weakest.map(([name,count]) => `<tr><td>${esc(name)}</td><td>${count}/${totalPrompts} (${Math.round(count/totalPrompts*100)}%)</td><td>${({
    '목표 명확성':'첫 문장에 원하는 결과를 동사로 씁니다: “원인을 진단하고 결과를 표로 정리해 줘.”',
    '대상·맥락':'프로젝트·파일·현재 상태를 지정합니다: “프로젝트 X의 파일 Y에서…”',
    '완료 조건':'끝났다고 판단할 수 있는 조건을 씁니다: “테스트 3종 PASS와 남은 위험 보고까지.”',
    '검증 요구':'확인 수단을 지정합니다: “실제 명령을 실행하고 종료 코드와 실패 출력을 보여 줘.”',
    '출력 형태':'읽을 결과 형태를 지정합니다: “결론 → 근거 → 개선안 순서의 표로.”',
    '제약·경계':'변경 가능 범위를 씁니다: “진단만 하고 파일은 수정하지 마.”'
  })[name]}</td></tr>`).join('');
  const aiRows = report.tools.map(tool => `<tr><td>${tool.tool}</td><td>${tool.prompts}턴</td><td>응답 ${tool.answerRate}% · 도구 ${tool.toolRate}% · 검증결과 ${tool.verifiedRate}% · 재지시 ${tool.correctionSignals}건</td><td>${tool.verifiedRate < 30 ? '실행 요청에서는 마지막 답변에 실행 명령, 종료 코드, 통과·실패 수, 남은 미검증 항목을 분리해 요구하십시오.' : '검증 표현은 비교적 자주 관측됩니다. 도구 실행이 실제 요구사항을 검증했는지 근거 ID 표본으로 점검하십시오.'}</td></tr>`).join('');
  const guidanceHtml = `<section><h2>현재 데이터에 근거한 개선 의견</h2>
  <p class="notice"><strong>읽는 법:</strong> 아래 권고는 최근 ${report.days}일의 ${totalPrompts}개 분석 대상 사용자 턴에서 관측된 비율에 반응해 생성됩니다. 비율이 낮다는 사실은 “나쁜 프롬프트”의 증명이 아니라, AI가 추측해야 할 여지를 줄일 수 있는 개선 후보라는 뜻입니다.</p>
  <h3>1. 질문·프롬프트를 어떻게 보완할 것인가</h3><div class="scroll"><table><tr><th>우선 보완 요소</th><th>현재 관측</th><th>권장 표현</th></tr>${weakRows}</table></div>
  <h4>재사용 가능한 요청 형식</h4><div class="notice"><code>[상황/대상]</code> 어디에서 무엇을 다루는지<br><code>[목표]</code> AI가 만들어야 할 결과<br><code>[제약]</code> 변경 금지·보안·시간·범위<br><code>[검증 가능 완료조건]</code> 테스트, 개수, 비교 기준, 출처<br><code>[출력 형식]</code> 표·파일·요약 순서</div>
  <p><strong>예시:</strong> “ai_history_dashboard의 프롬프트 분석을 보완해 줘. 최근 30일 로그만 사용하고 원문·경로·비밀값은 공개 파일에 저장하지 마. 사용자 입력과 AI 실행을 분리해 분석하고, 각 결론에 근거 ID와 논문 링크를 붙여 줘. 단위 테스트·실데이터 생성·브라우저 검증이 모두 통과하면 완료로 보고해.”</p>
  <p class="muted">White et al.의 Prompt Pattern Catalog는 반복 가능한 문맥·지시·출력 규칙을 패턴으로 정리합니다. IFEval은 프로그램으로 확인 가능한 제약을 사용해 지시 준수를 측정합니다. 따라서 “자세히 해줘”보다 검사 가능한 완료조건이 분석과 실행 모두에 유리합니다. 이는 특정 문장이 항상 더 좋은 결과를 낸다는 보장은 아닙니다.</p>
  <h3>2. AI 실행과 응답을 어떻게 요구할 것인가</h3><div class="scroll"><table><tr><th>AI</th><th>분석량</th><th>관측 신호</th><th>개선 의견</th></tr>${aiRows}</table></div>
  <h4>AI 최종 응답에 요구할 증거 형식</h4><ol><li><strong>결과:</strong> 요청한 산출물이 무엇인지 한 문장으로 명시</li><li><strong>실행 증거:</strong> 사용한 파일·명령·종료 코드·통과/실패 수</li><li><strong>요구사항 대응표:</strong> 요청 항목별 완료·실패·미검증</li><li><strong>남은 위험:</strong> 실제 환경, 인간 판단, 외부 서비스처럼 확인하지 못한 범위</li><li><strong>다음 행동:</strong> 사용자 승인이 필요한 작업만 별도 표시</li></ol>
  <p class="muted">ReAct는 추론과 외부 행동을 결합했지만, 이 대시보드는 도구 호출을 성공으로 간주하지 않습니다. ExecutionAgent 연구가 테스트 실행을 코드 변경의 피드백으로 사용하는 것처럼, 가능한 경우 환경 상태·테스트·빌드 같은 외부 준거가 필요합니다.</p>
  <h3>3. 근거 논문과 적용 범위</h3><div class="scroll"><table><tr><th>자료</th><th>사실 기반 시사점</th><th>현재 적용</th></tr>
  <tr><td><a href="https://arxiv.org/abs/2302.11382">White et al. (2023), Prompt Pattern Catalog</a></td><td>프롬프트 기법을 재사용 가능한 패턴과 예시로 체계화했습니다.</td><td>상황·목표·제약·완료조건·출력형식 템플릿 제공</td></tr>
  <tr><td><a href="https://arxiv.org/abs/2311.07911">Zhou et al. (2023), IFEval</a></td><td>판정 가능한 지시 제약과 결정적 검사기로 instruction following을 평가했습니다.</td><td>가능한 완료조건을 테스트·개수·형식처럼 검사 가능하게 작성하도록 권고</td></tr>
  <tr><td><a href="https://arxiv.org/abs/2210.03629">Yao et al. (ICLR 2023), ReAct</a></td><td>언어적 추론과 환경 행동을 교차시켜 여러 과업에서 상호작용 성능과 해석 가능성을 연구했습니다.</td><td>도구 사용을 별도 관측하되 성공 판정과 분리</td></tr>
  <tr><td><a href="https://doi.org/10.1145/3728922">Qian et al. (PACMSE 2025), ExecutionAgent</a></td><td>다양한 프로젝트에서 테스트 스위트 실행을 자동화하고 이를 변경 검증 피드백으로 사용했습니다.</td><td>코딩 응답에 실제 테스트 명령·종료 결과를 요구</td></tr>
  <tr><td><a href="https://arxiv.org/abs/2306.05685">Zheng et al. (2023), LLM-as-a-Judge</a></td><td>LLM 심판의 인간 선호 일치 가능성과 위치·장황성·자기선호 편향을 함께 보고했습니다.</td><td>응답 길이나 자동 점수만으로 품질을 결론내리지 않음</td></tr></table></div></section>`;
  return renderEvidenceBase(report)
    .replace('개 사용자 턴</p>', `개 사용자 턴 · 제외된 대용량 컨텍스트 레코드 ${excluded}개</p>`)
    .replace('짧은 후속 지시에는 불리하므로 품질 점수가 아닙니다.</p>', '짧은 후속 지시에는 불리하므로 품질 점수가 아닙니다. 5,000자를 넘는 user 역할 레코드는 재주입 컨텍스트 또는 장문 자료일 가능성이 있어 평가 모집단에서 제외하고 위에 제외 수를 공개합니다.</p>')
    .replace(/<h3>형식 검증 결론<\/h3>[\s\S]*?<\/ul><\/section>/, `${researchHtml}</section>`)
    .replace('<section><h2>평가 방법과 유효성</h2>', `${guidanceHtml}<section><h2>평가 방법과 유효성</h2>`)
    .replace('</head>', `${canvaStyle}</head>`);
}

function main() {
  const report = { days: DAYS, generatedAt: new Date().toISOString(), tools: [analyzeTool('claude', walkJsonl(CLAUDE_DIR)), analyzeTool('codex', walkJsonl(CODEX_DIR))] };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, renderEvidence(report), 'utf8');
  console.log(`OK: wrote local-only report ${OUTPUT}`);
  for (const t of report.tools) console.log(`  ${t.tool}: ${t.sessions} sessions, ${t.prompts} prompts, spec coverage ${t.avgQuality}%`);
}

if (require.main === module) main();
module.exports = { classify, quality, isInjected, cleanUserText, redactExcerpt, readRows, analyzeTool, render, renderEvidence };
