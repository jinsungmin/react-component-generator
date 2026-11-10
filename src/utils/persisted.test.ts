import { describe, it, expect } from 'vitest';
import {
  parseProvider,
  parseApiKeys,
  parseHistory,
  parseComponents,
  addToHistory,
  MAX_HISTORY,
} from './persisted';

describe('parseProvider', () => {
  it('유효한 provider를 반환한다', () => {
    expect(parseProvider('anthropic')).toBe('anthropic');
    expect(parseProvider('google')).toBe('google');
  });

  it('알 수 없는 값이면 예외를 던진다', () => {
    expect(() => parseProvider('openai')).toThrow();
    expect(() => parseProvider(1)).toThrow();
  });
});

describe('parseApiKeys', () => {
  it('provider별 문자열 키를 반환한다', () => {
    expect(parseApiKeys({ anthropic: 'a', google: 'g' })).toEqual({ anthropic: 'a', google: 'g' });
  });

  it('누락된 provider는 빈 문자열로 채운다', () => {
    expect(parseApiKeys({ google: 'g' })).toEqual({ anthropic: '', google: 'g' });
  });

  it('객체가 아니면 예외를 던진다', () => {
    expect(() => parseApiKeys('x')).toThrow();
    expect(() => parseApiKeys(null)).toThrow();
  });

  it('문자열이 아닌 값은 빈 문자열로 처리한다', () => {
    expect(parseApiKeys({ anthropic: 5, google: 'g' })).toEqual({ anthropic: '', google: 'g' });
  });
});

describe('parseHistory', () => {
  it('문자열 배열을 반환한다', () => {
    expect(parseHistory(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('문자열이 아닌 항목은 걸러낸다', () => {
    expect(parseHistory(['a', 1, null, 'b'])).toEqual(['a', 'b']);
  });

  it('배열이 아니면 예외를 던진다', () => {
    expect(() => parseHistory('a')).toThrow();
  });
});

describe('parseComponents', () => {
  const raw = { id: '1', prompt: 'p', code: 'c', createdAt: '2026-01-01T00:00:00.000Z' };

  it('createdAt을 Date로 복원한다', () => {
    const [result] = parseComponents([raw]);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(result).toMatchObject({ id: '1', prompt: 'p', code: 'c' });
  });

  it('필드가 잘못된 항목은 걸러낸다', () => {
    const result = parseComponents([raw, { id: '2' }, null, { ...raw, id: '3', createdAt: 'nope' }]);
    expect(result.map((c) => c.id)).toEqual(['1']);
  });

  it('배열이 아니면 예외를 던진다', () => {
    expect(() => parseComponents({})).toThrow();
  });
});

describe('addToHistory', () => {
  it('새 프롬프트를 맨 앞에 추가한다', () => {
    expect(addToHistory(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('중복이면 기존 항목을 제거하고 맨 앞으로 올린다', () => {
    expect(addToHistory(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('최대 개수를 넘으면 오래된 항목을 버린다', () => {
    const history = Array.from({ length: MAX_HISTORY }, (_, i) => `p${i}`);
    const result = addToHistory(history, 'new');
    expect(result).toHaveLength(MAX_HISTORY);
    expect(result[0]).toBe('new');
    expect(result).not.toContain(`p${MAX_HISTORY - 1}`);
  });
});
