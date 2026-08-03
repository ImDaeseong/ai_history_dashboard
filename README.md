# AI Agent Work-History Dashboard

Claude Code / Codex 에이전트 세션 활동과 관련 저장소 git 커밋 활동을 한눈에 보는 정적 HTML 대시보드

**대시보드 바로가기 →** https://imdaeseong.github.io/history_dashboard/

---

## 데이터 출처

| 항목 | 소스 |
|---|---|
| 에이전트 세션 활동 | `~/.claude/projects/*/*.jsonl`(Claude Code), `~/.codex/session_index.jsonl`(Codex) — 세션 시작일 기준 집계 |
| 커밋 결과물 | `hermes-agents` / `ai-workspace` / `ai_prompt` / `skills` 4개 저장소 최근 30일 `git log` |

두 도구는 로그 스키마가 달라(Codex는 세션 제목, Claude Code는 세션당 라인 수) 완전히 대칭적인 비교는 아닙니다.

## 갱신

수치는 스냅샷입니다. 위 소스를 다시 집계해 `index.html`의 `AGG` / `COMMITS` / `SESS` 인라인 JSON을 교체하고 재배포하면 됩니다.

## Pages 설정

Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `/(root)`
