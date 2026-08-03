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

## 화면 구성

- **0. 요약**: 총 세션/커밋/변경 라인 수 통합 카드 + 세션·커밋을 합산한 일별 활동 히트맵
- **1. 에이전트 세션 활동**: 도구별 일별 추이, 총량, 요일 패턴, 가장 긴 세션 TOP 5, 세션 로그
- **2. 커밋 결과물**: 저장소별 일별 추이, 총량, 요일 패턴, 가장 큰 커밋 TOP 5, 커밋 로그

## 갱신

`scripts/regenerate.js`(Node.js, 의존성 없음)가 위 소스를 다시 집계해 `index.html`의 `AGG` /
`COMMITS` / `SESS` 인라인 JSON을 그대로 교체합니다.

```
node scripts/regenerate.js          # index.html만 갱신
powershell -File scripts/regenerate.ps1   # 갱신 + 변경 있으면 커밋·푸시까지
```

원본 로그(`~/.claude/projects`, `~/.codex/session_index.jsonl`)는 이 컴퓨터에만 있는 로컬 파일이라
**GitHub Actions 같은 클라우드 CI에서는 실행할 수 없습니다.** 자동 스케줄 등록 없이, 갱신하고 싶을 때
위 명령을 수동으로 실행하는 방식으로 운영합니다.

## Pages 설정

Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `/(root)`
