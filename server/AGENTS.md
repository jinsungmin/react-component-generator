# server/AGENTS.md

## Module Context

Bun 런타임의 AI API 프록시. 프론트엔드는 Vite 프록시(`/api`)를 통해서만 접근한다.

## Tech Stack & Constraints

- 외부 HTTP 호출은 내장 `fetch`만 사용한다. SDK/axios를 추가하지 않는다 (`server/index.ts:69,101`).
- 엔트리 `server/index.ts`는 import 시 서버를 기동한다. 순수 로직은 `generator.ts`, `fallback.ts`에 둔다.

## Testing Strategy

- `bun run test -- server/` (vitest, `server/**/*.test.ts`).
- `index.ts`는 테스트 경계 밖이다. 신규 로직은 순수 함수로 분리해 `*.test.ts`로 검증한다.

## Local Golden Rules

- Google 키는 URL 쿼리(`?key=`)로 전달된다 (`index.ts:99`). 요청 URL이나 fetch 에러 객체를 로그/응답에 노출하지 마라.
- 모델 폴백은 Google에만 있다 (`index.ts:5,134`). Anthropic 경로는 단일 모델 고정이다 (`index.ts:77`). 폴백을 추가하려면 `withModelFallback`을 재사용한다.
- 에러 분기는 `errors.ts`의 `describeError`가 메시지 문자열의 `503`/`429` 포함 여부와 `TimeoutError`로 판단한다. 업스트림 에러 메시지 형식(`... error: <status>`, `index.ts`)을 바꾸면 이 분기가 깨진다.
- 알 수 없는 에러의 원문은 클라이언트에 내리지 않는다(고정 한국어 문구). 사용자에게 그대로 보여줘도 되는 메시지는 `UserFacingError`로 던진다.
- 업스트림 `fetch`에는 반드시 `withTimeout(req.signal, ...)` 시그널을 넘긴다 (`abort.ts`). 클라이언트 연결 종료와 제한 시간이 업스트림 호출을 중단한다.
- 시스템 프롬프트의 "import 금지, TypeScript 문법 금지, render() 호출" 규칙은 react-live 실행 제약이다 (`index.ts:11-20`). 같은 위험을 `ensureRenderCall`이 응답 후처리로 한 번 더 막는다 (`generator.ts:258`). 한쪽만 제거하지 마라.
- 모델 응답은 `stripCodeFences` -> `ensureRenderCall` 순서로 정규화한다 (`index.ts:188`). 순서를 바꾸지 마라.
- CORS 헤더는 모든 `Response`에 직접 붙인다 (`index.ts:51`). 새 라우트/응답에도 `CORS_HEADERS`를 빠뜨리지 마라.
