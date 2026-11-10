# AGENTS.md

## Operational Commands

- 패키지 매니저는 `bun` 고정 (`bun install`). npm/yarn/pnpm 사용 금지 (`bun.lock` 존재).
- 개발 서버(API + Vite 동시): `bun run dev`
- API 서버만: `bun run server` (`bun --watch run server/index.ts`)
- 테스트: `bun run test` (vitest run). `bun test`(Bun 내장 러너)는 jsdom 설정이 적용되지 않으므로 사용 금지.
- 단일 테스트: `bun run test -- server/generator.test.ts`
- 린트: `bun run lint`, 빌드/타입체크: `bun run build` (`tsc -b && vite build`)
- 작업 완료 전 `bun run lint`, `bun run test`, `bun run build`를 모두 통과시킨다.

## Project Context

프롬프트로 React 컴포넌트를 생성하고 react-live로 미리보기하는 도구.
Stack: React 19, TypeScript, Vite, Vitest, react-live, Bun(API 프록시).

## Golden Rules

Immutable:
- API 키를 코드에 하드코딩하거나 커밋하지 않는다. 서버 키는 `.env`(gitignore 대상)에서만 읽는다 (`server/index.ts:59-62`).
- 서버 환경변수 값을 클라이언트에 내려주지 않는다. `/api/config`는 키 존재 여부(boolean)만 반환한다 (`server/index.ts:147-153`). 이 응답에 값을 추가하지 마라.
- 사용자가 UI에 입력한 키는 서버 요청 본문으로만 전달하고, 브라우저에는 `rcg:apiKeys`(localStorage, 평문)에만 저장한다 (`src/App.tsx`, `src/hooks/usePersistentState.ts`). 쿠키, URL, 로그, 서버 저장소로 옮기지 마라.
- 민감 파일은 읽기·수정·출력·복사를 모두 금지한다. 대상: `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production`, `.env.test`, 이름에 `credential`/`secret`이 들어간 파일, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa*`, `id_ed25519*`, `.npmrc`, `.netrc`, `~/.ssh/**`, `~/.aws/**`. `.claude/settings.json`의 `permissions.deny`로 차단되어 있다.
  - 키 존재 여부나 변수 이름이 필요하면 `.env.example`을 참조한다 (이 파일은 허용).
  - `cat`, `type`, `Get-Content`, `grep` 등 셸 명령으로 우회해서 읽지 않는다. deny 패턴에 없는 경로라도 같은 성격의 파일이면 동일하게 취급한다.
  - 민감 파일이 필요한 작업은 직접 처리하지 말고 사용자에게 요청한다. `permissions.deny`를 임의로 완화하거나 제거하지 않는다.

Do's & Don'ts:
- API 포트 3002는 서버(`server/index.ts:139`)와 Vite 프록시(`vite.config.ts:11`) 두 곳에 있다. 변경 시 둘을 함께 수정한다.
- 생성 코드는 react-live `noInline` 모드로 실행되므로 `render(<X />)` 호출이 필수다 (`src/components/LivePreview.tsx:277`, `server/generator.ts:258`). 이 계약을 바꾸면 서버 정규화와 프리뷰를 함께 바꾼다.
- 테스트는 부수효과 없는 모듈에 둔다. `server/index.ts`는 `Bun.serve`를 import 시점에 실행하므로 테스트가 불가능하다. 새 로직은 `server/generator.ts`, `server/fallback.ts`처럼 별도 모듈로 분리하고 `*.test.ts`를 함께 추가한다.
- 테스트 파일 위치는 `src/**/*.test.{ts,tsx}`, `server/**/*.test.ts`만 인식된다 (`vite.config.ts:20`).
- 서버 세부 규칙은 `server/AGENTS.md`를 따른다.

## Standards & References

- 사용자 대상 에러 메시지와 주석은 한국어로 쓴다 (`server/index.ts:196`, `server/fallback.ts:1`).
- 커밋: `<type>: <한국어 요약>` (type: feat/fix/refactor/chore). 절차는 `.claude/skills/commit/SKILL.md`.
- 프로젝트 소개와 실행 방법은 `README.md` 참조.
- Maintenance Policy: 규칙과 코드 사이에 괴리가 생기면(포트, 명령어, 모델 목록 등) 이 파일 갱신을 제안한다.
