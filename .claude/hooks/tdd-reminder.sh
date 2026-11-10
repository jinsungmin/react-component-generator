#!/usr/bin/env bash
# 코드 작성·수정 직전에 .claude/rules/tdd.md 규칙을 상기시키는 컨텍스트를 주입한다 (PreToolUse 훅).
input=$(cat)

file=$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)

# 테스트 파일, 문서, 설정 파일은 TDD 대상이 아니므로 상기시키지 않는다.
case "$file" in
  *.test.ts|*.test.tsx|*.md|*.json|*.css|*.html|*.lock|*.d.ts|*.config.*|.claude/*|*/.claude/*) exit 0 ;;
esac

msg='[TDD 리마인더] 코드를 쓰거나 고치기 전에 .claude/rules/tdd.md를 지켰는지 확인하라. 1) 로직(분기, 계산, 상태 변화)이나 버그 수정이면 실패하는 테스트를 먼저 쓰고 bun run test로 실행해 「기능 미구현」 때문에 실패하는지 확인했는가(RED). 2) 테스트 없이 프로덕션 코드를 먼저 썼다면 그 코드를 삭제하고 RED부터 다시 시작하라(참고용 보관 금지). 3) GREEN은 테스트를 통과시키는 최소 코드만 쓰고(YAGNI), 신규와 기존 테스트가 모두 통과하는지 확인하라. 4) REFACTOR에서는 새 동작을 추가하지 마라. 타입, 설정, 순수 UI만 TDD 예외다.'

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}\n' "$msg"
exit 0
