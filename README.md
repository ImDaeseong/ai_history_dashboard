# AI Agent Work-History Dashboard

Claude Code / Codex 세션 활동과 Desktop 아래 모든 git 저장소의 커밋 활동을 한눈에 보는 정적 HTML 대시보드.

**바로가기 →** [imdaeseong.github.io/ai_history_dashboard](https://imdaeseong.github.io/ai_history_dashboard/)

## 데이터 출처

| 항목 | 소스 |
|---|---|
| 세션 활동 | `~/.claude/projects/*/*.jsonl`(Claude Code), `~/.codex/session_index.jsonl`(Codex) |
| 커밋 | `Desktop/*`와 그 한 단계 아래(`hermes-agents/ai-workspace` 등)에서 자동 발견한 모든 git 저장소, 최근 30일 `git log`. 새 프로젝트를 추가해도 다음 갱신 때 자동으로 잡힙니다. 원격이 `github.com/ImDaeseong/*`가 아닌 저장소(설치한 서드파티 플러그인 클론 등)와 부모와 원격이 같은 중복 `.git`은 제외합니다. |

두 도구는 로그 스키마가 달라(Codex는 세션 제목만, Claude Code는 라인 수도 기록) 완전히 대칭 비교는 아닙니다.

## 화면 구성

- **0. 요약** — 통합 KPI 카드, 일별 활동 히트맵, 요일별 활동 리듬
- **1. 세션 활동** — 도구별 일별 추이, 가장 긴 세션 TOP 5, 세션 로그
- **2. 커밋 결과물** — 저장소별 일별 추이, 가장 큰 커밋 TOP 5, 커밋 로그

## 갱신

원본 로그가 이 컴퓨터에만 있어 클라우드 CI로는 못 돌립니다 — 필요할 때 아래 중 하나를 수동 실행합니다.

| 방법 | 하는 일 |
|---|---|
| `scripts\regenerate.bat` 더블클릭 | `index.html`과 구조 문서 2종 갱신 (git 조작 없음) |
| `scripts\publish.bat` 더블클릭 | 갱신 + 변경 시 커밋·푸시 |

터미널에서 직접 실행하려면 각각 `node scripts/regenerate.js`, `powershell -File scripts/regenerate.ps1`.

## Pages 설정

Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `/(root)`

## 관련 구조 문서

원본은 hermes-agents의 `.md`(Mermaid 다이어그램 포함)이며, `regenerate`/`publish` 실행 때마다 이 저장소용 `.html`로 변환해 갱신됩니다 — GitHub Pages는 `.md`를 그대로 텍스트로만 서빙해 Mermaid가 안 그려지므로, 이 저장소에서는 링크를 Pages 주소로 엽니다.

- [hermes-workspace-structure.html](https://imdaeseong.github.io/ai_history_dashboard/hermes-workspace-structure.html) — 저장소별 역할 분담과 새 프로젝트 생성 흐름
- [hermes-agent-architecture.html](https://imdaeseong.github.io/ai_history_dashboard/hermes-agent-architecture.html) — 요청 하나가 하네스→규칙→도구/스킬→메모리→커밋 게이트를 거쳐 산출물이 되는 내부 처리 흐름
