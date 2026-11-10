import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

const asString = (raw: unknown) => {
  if (typeof raw !== 'string') throw new Error('invalid');
  return raw;
};

describe('usePersistentState', () => {
  it('저장된 값이 없으면 초기값을 쓴다', () => {
    const { result } = renderHook(() => usePersistentState('k', 'init', asString));
    expect(result.current[0]).toBe('init');
  });

  it('저장된 값이 있으면 그 값으로 시작한다 (새로고침 복원)', () => {
    localStorage.setItem('k', JSON.stringify('saved'));
    const { result } = renderHook(() => usePersistentState('k', 'init', asString));
    expect(result.current[0]).toBe('saved');
  });

  it('값을 바꾸면 localStorage에 저장된다', () => {
    const { result } = renderHook(() => usePersistentState('k', 'init', asString));
    act(() => result.current[1]('next'));
    expect(result.current[0]).toBe('next');
    expect(JSON.parse(localStorage.getItem('k')!)).toBe('next');
  });

  it('함수형 업데이트를 지원한다', () => {
    const { result } = renderHook(() => usePersistentState('k', 'a', asString));
    act(() => result.current[1]((prev) => prev + 'b'));
    expect(result.current[0]).toBe('ab');
  });

  it('저장된 값이 유효하지 않으면 초기값을 쓴다', () => {
    localStorage.setItem('k', JSON.stringify(42));
    const { result } = renderHook(() => usePersistentState('k', 'init', asString));
    expect(result.current[0]).toBe('init');
  });
});
