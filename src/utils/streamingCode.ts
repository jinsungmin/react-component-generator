/** 스트리밍 중인 부분 응답에서 마크다운 코드펜스를 걷어내 코드만 보여준다. */
export function stripStreamingFences(text: string): string {
  let code = text;
  if (code.startsWith('```')) {
    const newline = code.indexOf('\n');
    if (newline === -1) return '';
    code = code.slice(newline + 1);
  }
  return code.replace(/\n?```\s*$/, '');
}
