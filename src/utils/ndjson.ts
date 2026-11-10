/** 스트림 청크를 이전 버퍼에 이어 붙여 개행으로 끝난 줄만 반환한다. 남은 조각은 rest로 돌려준다. */
export function splitLines(buffer: string, chunk: string): { lines: string[]; rest: string } {
  const parts = (buffer + chunk).split('\n');
  const rest = parts.pop() ?? '';
  return { lines: parts.filter((line) => line !== ''), rest };
}
