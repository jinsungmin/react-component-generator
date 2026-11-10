---
name: create-pr
description: 현재 브랜치의 커밋과 변경사항을 분석해 템플릿에 맞춘 Pull Request를 생성한다. "PR 만들어줘", "PR 생성", "풀리퀘스트 올려줘", "/create-pr" 요청 시 활성화한다.
context: fork
allowed-tools: Read Glob Grep Bash
---

# create-pr

현재 브랜치를 기본 브랜치로 향하는 PR로 생성한다. 이 스킬이 호출되면 별도 승인 절차 없이 바로 생성하고, 끝나면 PR URL만 간단히 보고한다.

## 절차

### 1. 사전 확인
- `git rev-parse --is-inside-work-tree` 실패 시 저장소가 아니라고 알리고 종료한다.
- `gh auth status` 실패 시 `gh auth login`이 필요하다고 알리고 종료한다.
- 기본 브랜치: `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`. 원격이 없으면 알리고 종료한다.
- 현재 브랜치(`git branch --show-current`)가 기본 브랜치와 같으면 "기본 브랜치에서는 PR을 만들 수 없다"고 알리고 종료한다. 브랜치를 새로 만들거나 옮기지 않는다.
- `git status --short`에 커밋되지 않은 변경이 있으면 PR에 포함되지 않는다고 결과 보고에 함께 알린다. 커밋은 하지 않는다.
- 이미 같은 브랜치의 열린 PR이 있으면(`gh pr list --head <브랜치> --state open`) 새로 만들지 않고 그 URL을 알린 뒤 종료한다.

### 2. 변경 분석
- `git log --oneline <기본브랜치>..HEAD`와 `git diff <기본브랜치>...HEAD --stat`으로 범위를 파악하고, 필요한 파일만 `git diff <기본브랜치>...HEAD -- <파일>`로 읽는다.
- 포함할 커밋이 없으면 알리고 종료한다.

### 3. 템플릿 선택과 로드
이 단계 전에는 `references/`의 파일을 읽지 않는다. 선택된 템플릿 하나만 Read로 읽는다.

판정: `git remote get-url origin`에 `jinsungmin/react-component-generator`가 포함되면 이 프로젝트다.
- 이 프로젝트: `references/pr-template.kr.md` (한국어)
- 그 외 프로젝트: `references/pr-template.en.md` (영어)

### 4. 본문과 제목 작성
- 템플릿의 섹션 구조를 유지해 실제 변경 내용으로 채운다. 해당 없는 섹션은 "해당 없음"/"N/A"로 적는다. 템플릿의 안내 주석(`<!-- -->`)은 제거한다.
- 제목은 70자 이내, 템플릿 언어와 같은 언어로 쓴다.
  - 한국어: `<type>: <요약>` (type: feat/fix/refactor/chore)
  - 영어: `<type>: <summary>`
- 커밋에 없는 내용을 지어내지 않는다. 테스트는 실제로 실행한 것만 체크한다.
- 비밀 정보와 내부 경로를 본문에 넣지 않는다.

### 5. 생성
1. 현재 브랜치가 원격에 없거나 앞서 있으면 `git push -u origin <브랜치>`로 올린다. `--force`는 쓰지 않는다.
2. 본문은 heredoc으로 전달한다.
   ```bash
   gh pr create --base <기본브랜치> --title "<제목>" --body "$(cat <<'BODY'
   <본문>
   BODY
   )"
   ```
3. 결과로 PR URL, 제목, 사용한 템플릿 언어를 보고한다.

## 금지 사항
- `--force` push, 기본 브랜치 직접 push, 브랜치 삭제, PR 병합(`gh pr merge`)은 하지 않는다.
- 파일을 수정하지 않는다(Edit/Write 도구 없음).
