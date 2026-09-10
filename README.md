# AI Agent Work-History Dashboard

## 로컬 AI 사용·프롬프트 분석

`scripts\analyze-private.bat`을 실행하면 최근 30일의 Claude Code/Codex 로컬 세션을 분석해 `private-dashboard.html`을 생성합니다.

- AI별 세션·프롬프트·응답 수
- 슬래시 명령어 사용 순위
- 검증·구현·분석·설계 등 반복 작업 유형
- 목표·대상·완료 조건·검증·출력 형태·제약의 포함률
- 익명 근거 ID와 마스킹된 요청 표본
- 응답 존재, 도구 사용, 검증 결과, 재지시 신호를 분리한 관측 지표

이 보고서는 로컬 전용이며 GitHub Pages에 게시되지 않습니다. 근거 표본은 180자로 제한하고 경로·URL·이메일·비밀값 패턴을 마스킹합니다. 5,000자를 넘는 user 역할 레코드는 재주입 컨텍스트나 장문 자료일 가능성이 있어 평가 모집단에서 제외하며 제외 수를 보고합니다. 지표는 정답률이 아니라 로그에서 관찰 가능한 미교정 휴리스틱이므로, 인간 라벨 표본과 비교하기 전까지 검증 상태를 HOLD로 표시합니다.

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
| `scripts\regenerate.bat` 더블클릭 | `index.html` 갱신 (git 조작 없음) |
| `scripts\publish.bat` 더블클릭 | 갱신 + 변경 시 커밋·푸시 |
| `scripts\update-dashboard.bat` 더블클릭 | `index.html` + `private-dashboard.html` 둘 다 갱신 (git 조작 없음) |

터미널에서 직접 실행하려면 각각 `node scripts/regenerate.js`, `powershell -File scripts/regenerate.ps1`.

## Pages 설정

Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `/(root)`

## 관련 구조 문서

hermes-agents의 구조를 정리한 손으로 디자인한 페이지(커스텀 SVG 다이어그램)입니다. hermes-agents 쪽 원본은 `.md`(Mermaid)로 관리되지만, 그 다이어그램 자체는 마크다운에서 기계적으로 뽑아낼 수 없어 `regenerate.js`가 자동 변환하지 않습니다 — hermes-agents의 저장소 구조가 실제로 바뀔 때만 이 두 파일을 손으로 갱신합니다.

- [hermes-workspace-structure.html](https://imdaeseong.github.io/ai_history_dashboard/hermes-workspace-structure.html) — 저장소별 역할 분담과 새 프로젝트 생성 흐름
- [hermes-agent-architecture.html](https://imdaeseong.github.io/ai_history_dashboard/hermes-agent-architecture.html) — 요청 하나가 하네스→규칙→도구/스킬→메모리→커밋 게이트를 거쳐 산출물이 되는 내부 처리 흐름
