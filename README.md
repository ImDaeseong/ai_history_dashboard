# AI Agent Work-History Dashboard

**🤔 [쉬운 설명 보기](https://imdaeseong.github.io/ai_history_dashboard/ELI5.html)** — 비개발자를 위한 한 페이지 요약

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

핵심 목적은 활동량 순위가 아니라 AI 작업의 검증 완료·첫 시도 PASS·재시도·사람 검토 HOLD를 함께 보는 것입니다. 세션·커밋·변경 라인은 작업 맥락을 보여 주는 활동 지표일 뿐 생산성 점수가 아닙니다.

**바로가기 →** [imdaeseong.github.io/ai_history_dashboard](https://imdaeseong.github.io/ai_history_dashboard/)

## 데이터 출처

| 항목 | 소스 |
|---|---|
| 세션 활동 | `~/.claude/projects/*/*.jsonl`(Claude Code), `~/.codex/session_index.jsonl`(Codex) |
| 커밋 | `Desktop/*`와 그 한 단계 아래(`hermes-agents/ai-workspace` 등)에서 자동 발견한 모든 git 저장소, 최근 30일 `git log`. 새 프로젝트를 추가해도 다음 갱신 때 자동으로 잡힙니다. 원격이 `github.com/ImDaeseong/*`가 아닌 저장소(설치한 서드파티 플러그인 클론 등)와 부모와 원격이 같은 중복 `.git`은 제외합니다. |
| 검증 결과 | 로컬 설정의 `qaStateFiles`에 명시한 `qa_manager` 제한형 검증 상태 JSON. 읽기만 하며 대상 프로젝트나 상태 파일을 수정하지 않습니다. |

두 도구는 로그 스키마가 달라(Codex는 세션 제목만, Claude Code는 라인 수도 기록) 완전히 대칭 비교는 아닙니다.

## 로컬 설정과 개인정보

`dashboard.config.example.json`을 `private-data/dashboard.config.json`으로 복사해 사용합니다. `private-data/`는 Git에서 제외됩니다.

- `timeZone`: 커밋과 세션을 같은 지역 날짜로 묶습니다.
- `retentionDays`: 분석 기간이며 1~365일만 허용합니다.
- `qaStateFiles`: 대시보드 저장소 기준 상대경로로 명시한 검증 상태 파일만 읽습니다.
- `humanLabelsFile`: 두 독립 평가자의 로컬 라벨 JSON입니다. 원시 일치율, Cohen’s κ, 자동 휴리스틱의 정밀도·재현율을 계산합니다.
- `devexPulseFile`: 피드백 루프·인지부하·몰입·만족도를 주 1회 1~5점으로 기록한 로컬 JSON입니다.
- `includeEvidenceExcerpts`: 기본값 `false`; 비공개 보고서의 요청 표본 표시 허용 여부입니다.
- `evidenceExcerptChars`: 표본을 허용해도 최대 180자입니다.

경로를 자동 탐색하지 않고 명시적 파일 목록만 읽으며, 설정 오류나 잘못된 상태 파일은 조용히 누락하지 않고 생성을 실패시킵니다.

`human-labels.example.json`은 형식 예시일 뿐 평가 데이터가 아닙니다. 실제 파일은 `private-data/`에 두고 `humanLabelsFile`에 연결합니다. 라벨이 없으면 평가 타당도는 계속 HOLD입니다.

`devex-pulse.example.json` 역시 형식 예시이며 실제 응답이 아닙니다. DORA 지표는 배포 사건이 존재하는 개별 애플리케이션에만 적용해야 하므로, 현재처럼 여러 저장소의 커밋을 합친 화면에는 임의의 DORA 점수를 만들지 않습니다.

## 측정 원칙

- [SPACE 프레임워크](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/): 생산성을 개인 활동량이나 단일 숫자로 축소하지 않고 만족도·성과·활동·협업·효율을 함께 봅니다.
- [DORA 지표](https://dora.dev/guides/dora-metrics/): 배포 처리량과 불안정성을 개별 애플리케이션 맥락에서 함께 측정합니다.
- [HEDS](https://aclanthology.org/2022.humeval-1.6/): 인간 평가의 표본·기준·평가 절차를 기록해 비교와 재현이 가능하게 합니다.
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework): 데이터 생명주기와 개인정보 위험을 함께 관리합니다.

이 원칙에 따라 활동량은 설명 지표, qa_manager 상태는 실행 근거, 인간 라벨은 휴리스틱 교정, DevEx 펄스는 자기보고 경험으로 분리합니다. 서로 다른 측정값을 하나의 생산성 점수로 합치지 않습니다.

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
