# AI Agent Work-History Dashboard

Claude Code / Codex 에이전트 사용량과 관련 저장소 git 커밋 활동을 한눈에 보는
정적 HTML 대시보드입니다.

## 보는 방법

- 로컬: `index.html`을 브라우저로 바로 열면 됩니다(외부 요청 없이 완전히 독립적으로 동작).
- 웹: GitHub Pages로 호스팅 — 아래 설정 참고.

## 데이터 출처

- **에이전트 세션 활동**: `~/.claude/projects/*/*.jsonl`(Claude Code), `~/.codex/session_index.jsonl`(Codex)에서
  세션 시작일 기준으로 집계.
- **커밋 결과물**: `hermes-agents` / `ai-workspace` / `ai_prompt` / `skills` 4개 독립 저장소의 최근 30일 `git log`.

두 도구의 로그 스키마가 달라(Codex는 세션 제목, Claude Code는 세션당 라인 수) 완전히 대칭적인 비교는 아닙니다.

## 갱신 방법

수치는 스냅샷입니다. 최신 데이터로 갱신하려면 위 데이터 출처를 다시 집계해 `index.html`의
`AGG` / `COMMITS` / `SESS` 인라인 JSON을 교체한 뒤 재게시하면 됩니다.

## GitHub Pages 설정

1. 저장소 **Settings → Pages**로 이동
2. **Source**를 `Deploy from a branch`로 설정
3. **Branch**를 `main` / `/(root)`로 설정 후 저장
4. 잠시 후 `https://imdaeseong.github.io/history_dashboard/`에서 확인 가능
