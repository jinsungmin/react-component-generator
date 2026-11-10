import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

const STORAGE_KEY = 'rcg:components';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useComponentGenerator 영속성', () => {
  it('저장된 컴포넌트 목록을 복원하고 createdAt을 Date로 만든다', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: '1', prompt: 'p', code: 'c', createdAt: '2026-01-01T00:00:00.000Z' }]),
    );
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].createdAt).toBeInstanceOf(Date);
  });

  it('생성된 컴포넌트가 localStorage에 저장된다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 'const A = 1;' }) }),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('카드', undefined, 'google'));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ prompt: '카드', code: 'const A = 1;' });
    });
  });

  it('삭제와 전체 삭제도 저장소에 반영된다', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', prompt: 'p', code: 'c', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: '2', prompt: 'q', code: 'd', createdAt: '2026-01-01T00:00:00.000Z' },
      ]),
    );
    const { result } = renderHook(() => useComponentGenerator());

    act(() => result.current.removeComponent('1'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1);

    act(() => result.current.clearAll());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });
});
