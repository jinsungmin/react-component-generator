import { describe, it, expect } from 'vitest';
import { splitLines } from './ndjson';

describe('splitLines', () => {
  it('개행으로 끝난 줄만 완결된 줄로 반환한다', () => {
    const { lines, rest } = splitLines('', '{"a":1}\n{"a":2}\n');
    expect(lines).toEqual(['{"a":1}', '{"a":2}']);
    expect(rest).toBe('');
  });

  it('개행 없는 마지막 조각은 rest로 남긴다', () => {
    const { lines, rest } = splitLines('', '{"a":1}\n{"a"');
    expect(lines).toEqual(['{"a":1}']);
    expect(rest).toBe('{"a"');
  });

  it('이전 rest와 새 청크를 이어 붙인다', () => {
    const { lines, rest } = splitLines('{"a"', ':1}\n');
    expect(lines).toEqual(['{"a":1}']);
    expect(rest).toBe('');
  });

  it('빈 줄은 건너뛴다', () => {
    const { lines } = splitLines('', '\n{"a":1}\n\n');
    expect(lines).toEqual(['{"a":1}']);
  });
});
