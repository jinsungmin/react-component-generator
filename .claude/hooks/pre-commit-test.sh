#!/usr/bin/env bash
# git commit 직전에 테스트를 실행하고, 실패하면 커밋을 차단한다 (PreToolUse 훅).
input=$(cat)

if ! printf '%s' "$input" | grep -Eq 'git[[:space:]]+(-[^[:space:]]+[[:space:]]+)*commit([[:space:]]|\\"|"|$)'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if output=$(bun run test 2>&1); then
  exit 0
fi

{
  echo "테스트가 실패하여 커밋을 차단했습니다. 모든 테스트를 통과시킨 뒤 다시 커밋하세요."
  echo "$output" | tail -n 40
} >&2
exit 2
