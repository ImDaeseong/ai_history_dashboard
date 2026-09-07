# AI Agent Work-History Dashboard

Claude Code / Codex 세션 활동과 4개 저장소 git 커밋 활동을 한눈에 보는 정적 HTML 대시보드.

**바로가기 →** [imdaeseong.github.io/ai_history_dashboard](https://imdaeseong.github.io/ai_history_dashboard/)

## 데이터 출처

| 항목 | 소스 |
|---|---|
| 세션 활동 | `~/.claude/projects/*/*.jsonl`(Claude Code), `~/.codex/session_index.jsonl`(Codex) |
| 커밋 | `hermes-agents` / `ai-workspace` / `ai_prompt` / `skills` 최근 30일 `git log` |

두 도구는 로그 스키마가 달라(Codex는 세션 제목만, Claude Code는 라인 수도 기록) 완전히 대칭 비교는 아닙니다.

## 화면 구성

- **0. 요약** — 통합 KPI 카드, 일별 활동 히트맵, 요일별 활동 리듬
- **1. 세션 활동** — 도구별 일별 추이, 가장 긴 세션 TOP 5, 세션 로그
- **2. 커밋 결과물** — 저장소별 일별 추이, 가장 큰 커밋 TOP 5, 커밋 로그

## 갱신

원본 로그가 이 컴퓨터에만 있어 클라우드 CI로는 못 돌립니다 — 필요할 때 아래 중 하나를 수동 실행합니다.

| 방법 | 하는 일 |
|---|---|
| `scripts\regenerate.bat` 더블클릭 | `index.html`만 갱신 (git 조작 없음) |
| `scripts\publish.bat` 더블클릭 | 갱신 + 변경 시 커밋·푸시 |

터미널에서 직접 실행하려면 각각 `node scripts/regenerate.js`, `powershell -File scripts/regenerate.ps1`.

## Pages 설정

Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `/(root)`

## 관련 구조 문서

집계 대상 저장소들의 역할 분담과 구조도. 원본은 비공개 저장소 `hermes-agents`에 있고 아래는 그 시점의 사본이라 자동 갱신되지 않습니다. 링크는 반드시 Pages 주소로 열어야 렌더링됩니다(저장소 파일 목록에서 직접 열면 GitHub가 소스 코드로만 보여줍니다).

- [hermes-workspace-structure.html](https://imdaeseong.github.io/ai_history_dashboard/hermes-workspace-structure.html) — 4개 저장소 역할 분담과 새 프로젝트 생성 흐름
- [hermes-agent-architecture.html](https://imdaeseong.github.io/ai_history_dashboard/hermes-agent-architecture.html) — 요청 하나가 하네스→규칙→도구/스킬→메모리→커밋 게이트를 거쳐 산출물이 되는 내부 처리 흐름
