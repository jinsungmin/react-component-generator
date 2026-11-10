import { describe, it, expect, vi } from 'vitest';
import { readStorage, writeStorage } from './storage';

const asString = (raw: unknown) => {
  if (typeof raw !== 'string') throw new Error('invalid');
  return raw;
};

describe('storage', () => {
  it('저장된 값이 없으면 fallback을 반환한다', () => {
    expect(readStorage('k', asString, 'fb')).toBe('fb');
  });

  it('writeStorage로 저장한 값을 readStorage로 읽는다', () => {
    writeStorage('k', 'hello');
    expect(readStorage('k', asString, 'fb')).toBe('hello');
  });

  it('JSON이 깨져 있으면 fallback을 반환한다', () => {
    localStorage.setItem('k', '{broken');
    expect(readStorage('k', asString, 'fb')).toBe('fb');
  });

  it('parse가 예외를 던지면 fallback을 반환한다', () => {
    localStorage.setItem('k', JSON.stringify(123));
    expect(readStorage('k', asString, 'fb')).toBe('fb');
  });

  it('저장소가 가득 차 setItem이 실패해도 예외를 던지지 않는다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => writeStorage('k', 'v')).not.toThrow();
    spy.mockRestore();
  });
});
